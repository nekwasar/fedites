/**
 * Chat (2.3): group chats + DMs, WhatsApp behavior — delete own anytime,
 * edit within the admin-settable window ("edited" shown), reply/quote,
 * read receipts, typing indicators, pin-to-feed bridge. Realtime events go
 * through the WS hub; enforcement stays here (M5).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, type SessionMember } from "./sessions.js";
import { groupThreadUnread, dmUnread, markChatRead } from "./unread.js";
import { Hub, threadRooms } from "./ws.js";
import { isGroupMember } from "./activity.js";
import type { InstanceConfig } from "@fedites/config";

// Group posting is open to approved members; DM gating happens in the DM
// route (config-driven probation capabilities, §P).

const messageBody = z.object({
  body: z.string().max(4000).optional(),
  mediaId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
});

export async function chatRoutes(app: FastifyInstance, opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: Hub }): Promise<void> {
  const { pool, hub } = opts;

  /** Chat tab (§4.3): group chats + private DMs, previews, shared unreads. */
  app.get("/v1/chat/threads", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const groups = await pool.query<{ id: string; name: string; last_at: Date | null; last_body: string | null; last_kind: string | null; last_author: string | null }>(
      `SELECT g.id, g.name,
              (SELECT max(m.created_at) FROM messages m WHERE m.group_id = g.id AND m.deleted_at IS NULL) AS last_at,
              (SELECT m.body FROM messages m WHERE m.group_id = g.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT m.kind FROM messages m WHERE m.group_id = g.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_kind,
              (SELECT a.display_name FROM messages m JOIN members a ON a.id = m.author_id WHERE m.group_id = g.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_author
       FROM group_members gm JOIN groups g ON g.id = gm.group_id
       WHERE gm.member_id = $1 AND g.status = 'active'`,
      [member.id],
    );
    const dms = await pool.query<{ other_id: string; name: string; last_at: Date | null; last_body: string | null; last_kind: string | null }>(
      `SELECT other.id AS other_id, other.display_name AS name,
              (SELECT max(m.created_at) FROM messages m
                WHERE m.dm_a = LEAST($1, other.id) AND m.dm_b = GREATEST($1, other.id) AND m.deleted_at IS NULL) AS last_at,
              (SELECT m.body FROM messages m
                WHERE m.dm_a = LEAST($1, other.id) AND m.dm_b = GREATEST($1, other.id) AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT m.kind FROM messages m
                WHERE m.dm_a = LEAST($1, other.id) AND m.dm_b = GREATEST($1, other.id) AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC LIMIT 1) AS last_kind
       FROM members other
       WHERE other.instance_id = $2 AND other.id <> $1 AND other.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM messages m
                     WHERE m.dm_a = LEAST($1, other.id) AND m.dm_b = GREATEST($1, other.id) AND m.deleted_at IS NULL)`,
      [member.id, member.instanceId],
    );
    const threads: Array<Record<string, unknown>> = [];
    for (const g of groups.rows) {
      const unread = await groupThreadUnread(pool, member.id, g.id);
      threads.push({
        type: "group", id: g.id, name: g.name,
        lastAt: g.last_at,
        preview: previewFor(g.last_kind, g.last_body, g.last_author, true),
        unread: unread.chatUnread,
        pinned: false,
      });
    }
    for (const d of dms.rows) {
      const unread = await dmUnread(pool, member.id, d.other_id);
      threads.push({
        type: "dm", id: d.other_id, name: d.name,
        lastAt: d.last_at,
        preview: previewFor(d.last_kind, d.last_body, null, false),
        unread,
        pinned: false,
      });
    }
    threads.sort((a, b) => {
      const pa = (a.pinned as boolean) ? 0 : 1;
      const pb = (b.pinned as boolean) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.lastAt as Date ?? 0).getTime() - new Date(a.lastAt as Date ?? 0).getTime();
    });
    return { threads };
  });

  app.get("/v1/chat/:type/:id/messages", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { type, id } = request.params as { type: "group" | "dm"; id: string };
    const { before } = request.query as { before?: string };
    const where = type === "group" ? "m.group_id = $2" : "m.dm_a = LEAST($2,$3) AND m.dm_b = GREATEST($2,$3)";
    const params: unknown[] = type === "group" ? [member.instanceId, id] : [member.instanceId, member.id, id];
    const res = await pool.query<{
      id: string; author_id: string; author_name: string; body: string | null; kind: string;
      media_id: string | null; reply_to: string | null; reply_body: string | null; reply_author: string | null;
      edited_at: Date | null; created_at: Date;
    }>(
      `SELECT m.id, m.author_id, a.display_name AS author_name, m.body, m.kind, m.media_id,
              m.reply_to, r.body AS reply_body, ra.display_name AS reply_author,
              m.edited_at, m.created_at
       FROM messages m
       JOIN members a ON a.id = m.author_id
       LEFT JOIN messages r ON r.id = m.reply_to
       LEFT JOIN members ra ON ra.id = r.author_id
       WHERE m.instance_id = $1 AND ${where} AND m.deleted_at IS NULL
         AND ($${params.length + 1}::timestamptz IS NULL OR m.created_at < $${params.length + 1}::timestamptz)
       ORDER BY m.created_at DESC LIMIT 50`,
      [...params, before ?? null],
    );
    return {
      messages: res.rows.map((m) => ({
        id: m.id, authorId: m.author_id, author: m.author_name, body: m.body,
        kind: m.kind, mediaId: m.media_id, isMine: m.author_id === member.id,
        replyTo: m.reply_to ? { id: m.reply_to, body: m.reply_body, author: m.reply_author } : null,
        editedAt: m.edited_at, createdAt: m.created_at,
      })).reverse(),
    };
  });

  async function insertMessage(
    member: SessionMember, thread: { type: "group" | "dm"; groupId?: string; otherId?: string },
    body: z.infer<typeof messageBody>, kind: "text" | "voice" | "photo" | "video" | "file",
  ): Promise<unknown> {
    const dmA = thread.type === "dm" ? [member.id, thread.otherId!].sort()[0]! : null;
    const dmB = thread.type === "dm" ? [member.id, thread.otherId!].sort()[1]! : null;
    const res = await pool.query<{ id: string; created_at: Date }>(
      `INSERT INTO messages (instance_id, group_id, dm_a, dm_b, author_id, body, kind, media_id, reply_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
      [
        member.instanceId,
        thread.type === "group" ? thread.groupId! : null,
        dmA, dmB,
        member.id,
        body.body ?? null,
        kind,
        body.mediaId ?? null,
        body.replyToId ?? null,
      ],
    );
    const message = {
      id: res.rows[0]!.id, createdAt: res.rows[0]!.created_at, authorId: member.id,
      author: member.displayName, body: body.body ?? null, kind, mediaId: body.mediaId ?? null,
      isMine: true,
      replyTo: body.replyToId ?? null,
    };
    const rooms = threadRooms(thread.type === "group" ? { type: "group", groupId: thread.groupId } : { type: "dm", a: member.id, b: thread.otherId! });
    hub.broadcast(rooms, { type: "message.new", thread: thread.type, threadId: thread.type === "group" ? thread.groupId : thread.otherId, message });
    // Receipts: the sender has read up to their own message.
    await markChatRead(pool, member.instanceId, member.id, thread.type, thread.type === "group" ? thread.groupId! : thread.otherId!);
    hub.broadcast(rooms, { type: "read", thread: thread.type, threadId: thread.type === "group" ? thread.groupId : thread.otherId, memberId: member.id, at: new Date().toISOString() });
    return message;
  }

  app.post("/v1/chat/group/:id/messages", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    if (!(await isGroupMember(pool, id, member.id))) return reply.status(403).send({ error: "Join the group to post in its chat." });
    const body = messageBody.parse(request.body);
    if (!body.body && !body.mediaId) return reply.status(400).send({ error: "Write a message or attach something first." });
    const kind = body.mediaId ? await mediaKind(pool, member.instanceId, body.mediaId) : "text";
    return insertMessage(member, { type: "group", groupId: id }, body, kind);
  });

  app.post("/v1/chat/dm/:otherId/messages", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { otherId } = request.params as { otherId: string };
    const config = await opts.loadConfigByInstance(member.instanceId);
    // §P: DMs unlock after verification (probation capability, config-driven).
    const full = member.verification === "verified" || member.verification === "honorary";
    if (!full && !config.instance.behavior.probationCapabilities.dms) {
      return reply.status(403).send({ error: "DMs unlock after verification." });
    }
    const other = await pool.query("SELECT 1 FROM members WHERE id = $1 AND instance_id = $2 AND verification <> 'rejected' AND deleted_at IS NULL", [otherId, member.instanceId]);
    if (other.rows.length === 0) return reply.status(404).send({ error: "Member not found." });
    const body = messageBody.parse(request.body);
    if (!body.body && !body.mediaId) return reply.status(400).send({ error: "Write a message or attach something first." });
    const kind = body.mediaId ? await mediaKind(pool, member.instanceId, body.mediaId) : "text";
    return insertMessage(member, { type: "dm", otherId }, body, kind);
  });

  app.patch("/v1/chat/messages/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = z.object({ body: z.string().min(1).max(4000) }).parse(request.body);
    const m = await pool.query<{ author_id: string; created_at: Date; group_id: string | null; dm_a: string | null; dm_b: string | null }>(
      "SELECT author_id, created_at, group_id, dm_a, dm_b FROM messages WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const msg = m.rows[0];
    if (!msg || msg.author_id !== member.id) return reply.status(404).send({ error: "Message not found." });
    const config = await opts.loadConfigByInstance(member.instanceId);
    const windowMinutes = config.instance.behavior.chatEditWindowMinutes;
    if (Date.now() - new Date(msg.created_at).getTime() > windowMinutes * 60_000) {
      return reply.status(403).send({ error: `Messages can be edited within ${windowMinutes} minutes.` });
    }
    const res = await pool.query<{ edited_at: Date }>(
      "UPDATE messages SET body = $1, edited_at = now() WHERE id = $2 RETURNING edited_at",
      [body.body, id],
    );
    const rooms = msg.group_id !== null
      ? threadRooms({ type: "group", groupId: msg.group_id })
      : threadRooms({ type: "dm", a: msg.dm_a!, b: msg.dm_b! });
    hub.broadcast(rooms, { type: "message.edited", messageId: id, body: body.body, editedAt: res.rows[0]!.edited_at });
    return { ok: true, editedAt: res.rows[0]!.edited_at };
  });

  app.delete("/v1/chat/messages/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const m = await pool.query<{ author_id: string; group_id: string | null; dm_a: string | null; dm_b: string | null }>(
      "SELECT author_id, group_id, dm_a, dm_b FROM messages WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const msg = m.rows[0];
    if (!msg || msg.author_id !== member.id) return reply.status(404).send({ error: "Message not found." });
    // Delete own messages anytime (§P); tombstoned, never hard-deleted content history (N1).
    await pool.query(
      "UPDATE messages SET deleted_at = now(), body = NULL, media_id = NULL WHERE id = $1",
      [id],
    );
    const rooms = msg.group_id !== null
      ? threadRooms({ type: "group", groupId: msg.group_id })
      : threadRooms({ type: "dm", a: msg.dm_a!, b: msg.dm_b! });
    hub.broadcast(rooms, { type: "message.deleted", messageId: id });
    return { ok: true };
  });

  app.post("/v1/chat/:type/:id/read", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { type, id } = request.params as { type: "group" | "dm"; id: string };
    await markChatRead(pool, member.instanceId, member.id, type, id);
    const rooms = type === "group" ? [Hub.groupRoom(id)] : [Hub.dmRoom(member.id, id)];
    hub.broadcast(rooms, { type: "read", thread: type, threadId: id, memberId: member.id, at: new Date().toISOString() });
    return { ok: true };
  });

  /** Typing indicators: ephemeral, WS-only (never stored). */
  app.post("/v1/chat/:type/:id/typing", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { type, id } = request.params as { type: "group" | "dm"; id: string };
    const rooms = type === "group" ? [Hub.groupRoom(id)] : [Hub.dmRoom(member.id, id)];
    hub.broadcast(rooms, { type: "typing", thread: type, threadId: id, memberId: member.id, name: member.displayName });
    return { ok: true };
  });

  /** Pin-to-feed bridge (§4.4): a chat message worth keeping becomes an
   *  Activity post, searchable forever. Group admins pin. */
  app.post("/v1/chat/messages/:id/pin", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const m = await pool.query<{ group_id: string | null; body: string | null; kind: string; author_id: string; deleted_at: Date | null }>(
      "SELECT group_id, body, kind, author_id, deleted_at FROM messages WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const msg = m.rows[0];
    if (!msg || msg.group_id === null || msg.deleted_at !== null) {
      return reply.status(404).send({ error: "Group message not found." });
    }
    if (!(await isGroupMember(pool, msg.group_id, member.id))) {
      return reply.status(403).send({ error: "Members only." });
    }
    const already = await pool.query("SELECT 1 FROM activity_posts WHERE pinned_from_message = $1", [id]);
    if (already.rows.length > 0) return reply.status(400).send({ error: "Already pinned to the feed." });
    const preview = msg.body ?? (msg.kind === "voice" ? "Voice note" : msg.kind === "photo" ? "Photo" : "Attachment");
    const post = await pool.query<{ id: string }>(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body, pinned_from_message)
       VALUES ($1,$2,$3,'post',$4,$5) RETURNING id`,
      [member.instanceId, msg.group_id, msg.author_id, preview, id],
    );
    await pool.query("UPDATE messages SET pinned_to_post = $1 WHERE id = $2", [post.rows[0]!.id, id]);
    hub.broadcast([Hub.groupRoom(msg.group_id)], { type: "post.new", groupId: msg.group_id, postId: post.rows[0]!.id });
    return { id: post.rows[0]!.id };
  });
}

function previewFor(kind: string | null, body: string | null, author: string | null, group: boolean): string {
  const who = group && author !== null ? `${author}: ` : "";
  const what = kind === "voice" ? "Voice note" : kind === "photo" ? "Photo" : kind === "video" ? "Video" : kind === "file" ? "Attachment" : (body ?? "");
  return `${who}${what}`;
}

async function mediaKind(pool: Pool, instanceId: string, mediaId: string): Promise<"voice" | "photo" | "video" | "file"> {
  const res = await pool.query<{ kind: string }>("SELECT kind FROM media WHERE id = $1 AND instance_id = $2", [mediaId, instanceId]);
  const k = res.rows[0]?.kind ?? "file";
  return k === "audio" ? "voice" : k === "image" ? "photo" : k === "video" ? "video" : "file";
}
