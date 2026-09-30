/**
 * Activity tab (2.2): permanent, searchable group feed — posts, photos,
 * files, polls, events, reactions, threaded comments. Bridges: pin
 * announcements (group admin) and promote-to-News (2.4).
 * K2: reactions are emoji-counts within the group; no member league tables.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";
import { markActivitySeen } from "./unread.js";
import { record } from "./recognition.js";
import type { InstanceConfig } from "@fedites/config";

const postBody = z.object({
  kind: z.enum(["post", "photo", "file"]).default("post"),
  body: z.string().max(4000).optional(),
  mediaIds: z.array(z.string().uuid()).max(10).optional(),
});

const pollBody = z.object({
  body: z.string().max(4000).optional(),
  options: z.array(z.string().min(1).max(80)).min(2).max(8),
});

const commentBody = z.object({
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

const REACTIONS = ["thumb", "heart", "laugh", "wow", "sad"] as const;

async function isGroupAdmin(pool: Pool, groupId: string, memberId: string): Promise<boolean> {
  const res = await pool.query<{ is_admin: boolean }>(
    "SELECT is_admin FROM group_members WHERE group_id = $1 AND member_id = $2",
    [groupId, memberId],
  );
  return res.rows[0]?.is_admin === true;
}

export async function isGroupMember(pool: Pool, groupId: string, memberId: string): Promise<boolean> {
  const res = await pool.query("SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2", [groupId, memberId]);
  return res.rows.length > 0;
}

interface PostRow {
  id: string; kind: string; body: string | null; author_id: string | null; author_name: string | null;
  pinned_at: Date | null; comments_enabled: boolean; created_at: Date; group_id: string | null;
  promoted_from_post: string | null; source_group_name: string | null;
  poll: Array<{ id: string; label: string; votes: string }> | null;
  my_vote: string | null; my_reaction: string | null;
}

async function hydratePosts(pool: Pool, rows: PostRow[], memberId: string): Promise<unknown[]> {
  const out = [];
  for (const p of rows) {
    const reactions = await pool.query<{ emoji: string; n: string }>(
      "SELECT emoji, count(*)::text AS n FROM reactions WHERE post_id = $1 GROUP BY emoji",
      [p.id],
    );
    const media = await pool.query<{ media_id: string; kind: string }>(
      `SELECT pm.media_id, md.kind FROM post_media pm JOIN media md ON md.id = pm.media_id
       WHERE pm.post_id = $1 ORDER BY pm.position`,
      [p.id],
    );
    const commentCount = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM comments WHERE post_id = $1",
      [p.id],
    );
    out.push({
      id: p.id,
      groupId: p.group_id,
      kind: p.kind,
      body: p.body,
      author: p.author_name,
      isMine: p.author_id === memberId,
      pinnedAt: p.pinned_at,
      commentsEnabled: p.comments_enabled,
      createdAt: p.created_at,
      reactions: Object.fromEntries(reactions.rows.map((r) => [r.emoji, Number(r.n)])),
      myReaction: p.my_reaction,
      media: media.rows.map((m) => ({ id: m.media_id, kind: m.kind })),
      commentCount: Number(commentCount.rows[0]?.n ?? 0),
      poll: p.poll !== null
        ? {
            options: p.poll.map((o) => ({ id: o.id, label: o.label, votes: Number(o.votes) })),
            myVote: p.my_vote,
          }
        : null,
      promotedFrom: p.promoted_from_post
        ? { sourceGroupName: p.source_group_name }
        : null,
    });
  }
  return out;
}

export async function activityRoutes(app: FastifyInstance, opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: { broadcast: (rooms: string[], e: Record<string, unknown>) => void } }): Promise<void> {
  const { pool } = opts;

  /* ------------------------------ read feed ---------------------------- */

  app.get("/v1/groups/:id/activity", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const { cursor } = request.query as { cursor?: string };

    const g = await pool.query<{ type: string; status: string }>("SELECT type, status FROM groups WHERE id = $1 AND instance_id = $2", [id, member.instanceId]);
    const group = g.rows[0];
    if (!group) return reply.status(404).send({ error: "Group not found." });
    // Committee workspaces are private (§6).
    if (group.type === "committee" && !(await isGroupMember(pool, id, member.id))) {
      return reply.status(403).send({ error: "This workspace is private to its committee." });
    }

    const res = await pool.query<PostRow>(
      `SELECT p.id, p.kind, p.body, p.author_id, m.display_name AS author_name,
              p.pinned_at, p.comments_enabled, p.created_at, p.group_id,
              p.promoted_from_post, src.name AS source_group_name,
              (SELECT json_agg(json_build_object('id', po.id, 'label', po.label, 'votes',
                        (SELECT count(*) FROM poll_votes pv WHERE pv.option_id = po.id)) ORDER BY po.position)
               FROM poll_options po WHERE po.post_id = p.id) AS poll,
              (SELECT option_id FROM poll_votes pv WHERE pv.post_id = p.id AND pv.member_id = $2) AS my_vote,
              (SELECT emoji FROM reactions r WHERE r.post_id = p.id AND r.member_id = $2 LIMIT 1) AS my_reaction
       FROM activity_posts p
       LEFT JOIN members m ON m.id = p.author_id
       LEFT JOIN activity_posts srcp ON srcp.id = p.promoted_from_post
       LEFT JOIN groups src ON src.id = srcp.group_id
       WHERE p.group_id = $1 AND p.archived_at IS NULL AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
       ORDER BY p.pinned_at DESC NULLS LAST, p.created_at DESC
       LIMIT 25`,
      [id, member.id, cursor ?? null],
    );
    return { items: await hydratePosts(pool, res.rows, member.id), groupStatus: group.status };
  });

  app.get("/v1/activity/:postId/comments", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { postId } = request.params as { postId: string };
    const res = await pool.query<{ id: string; body: string; parent_id: string | null; author_name: string; author_id: string; created_at: Date }>(
      `SELECT c.id, c.body, c.parent_id, m.display_name AS author_name, c.author_id, c.created_at
       FROM comments c JOIN members m ON m.id = c.author_id
       WHERE c.post_id = $1 AND c.archived_at IS NULL ORDER BY c.created_at`,
      [postId],
    );
    return {
      comments: res.rows.map((c) => ({
        id: c.id, body: c.body, parentId: c.parent_id, author: c.author_name,
        authorId: c.author_id, isMine: c.author_id === member.id, createdAt: c.created_at,
      })),
    };
  });

  /* ------------------------------- post -------------------------------- */

  app.post("/v1/groups/:id/activity", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const g = await pool.query<{ type: string; status: string }>("SELECT type, status FROM groups WHERE id = $1 AND instance_id = $2", [id, member.instanceId]);
    const group = g.rows[0];
    if (!group) return reply.status(404).send({ error: "Group not found." });
    if (group.status === "archived") return reply.status(403).send({ error: "This group is archived and read-only." });
    if (group.type === "committee" && !(await isGroupMember(pool, id, member.id))) {
      return reply.status(403).send({ error: "This workspace is private to its committee." });
    }
    const body = postBody.parse(request.body);
    if (!body.body && (body.mediaIds === undefined || body.mediaIds.length === 0)) {
      return reply.status(400).send({ error: "Write something or attach a photo first." });
    }
    const post = await pool.query<{ id: string; created_at: Date }>(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
      [member.instanceId, id, member.id, body.kind, body.body ?? null],
    );
    const postId = post.rows[0]!.id;
    await record(pool, member.instanceId, member.id, "activity.post", { type: "activity_post", id: postId }).catch(() => undefined);
    if (body.mediaIds !== undefined) {
      for (const [i, mediaId] of body.mediaIds.entries()) {
        await pool.query(
          "INSERT INTO post_media (post_id, media_id, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [postId, mediaId, i],
        );
      }
    }
    opts.hub.broadcast([`group:${id}`], { type: "post.new", groupId: id, postId });
    return { id: postId, createdAt: post.rows[0]!.created_at };
  });

  app.post("/v1/groups/:id/poll", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = pollBody.parse(request.body);
    if (!(await isGroupMember(pool, id, member.id))) return reply.status(403).send({ error: "Members only." });
    const post = await pool.query<{ id: string }>(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body)
       VALUES ($1,$2,$3,'poll',$4) RETURNING id`,
      [member.instanceId, id, member.id, body.body ?? null],
    );
    const postId = post.rows[0]!.id;
    for (const [i, label] of body.options.entries()) {
      await pool.query("INSERT INTO poll_options (post_id, label, position) VALUES ($1,$2,$3)", [postId, label, i]);
    }
    opts.hub.broadcast([`group:${id}`], { type: "post.new", groupId: id, postId });
    return { id: postId };
  });

  app.post("/v1/activity/:postId/vote", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { postId } = request.params as { postId: string };
    const body = z.object({ optionId: z.string().uuid() }).parse(request.body);
    const poll = await pool.query<{ group_id: string }>(
      "SELECT group_id FROM activity_posts WHERE id = $1 AND kind = 'poll' AND instance_id = $2",
      [postId, member.instanceId],
    );
    if (!poll.rows[0]) return reply.status(404).send({ error: "Poll not found." });
    const opt = await pool.query("SELECT 1 FROM poll_options WHERE id = $1 AND post_id = $2", [body.optionId, postId]);
    if (opt.rows.length === 0) return reply.status(400).send({ error: "That option is not on this poll." });
    await pool.query(
      `INSERT INTO poll_votes (post_id, option_id, member_id) VALUES ($1,$2,$3)
       ON CONFLICT (post_id, member_id) DO UPDATE SET option_id = $2`,
      [postId, body.optionId, member.id],
    );
    const counts = await pool.query<{ option_id: string; n: string }>(
      "SELECT option_id, count(*)::text AS n FROM poll_votes WHERE post_id = $1 GROUP BY option_id",
      [postId],
    );
    return { ok: true, counts: Object.fromEntries(counts.rows.map((r) => [r.option_id, Number(r.n)])) };
  });

  /* --------------------------- comments etc ---------------------------- */

  app.post("/v1/activity/:postId/comments", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { postId } = request.params as { postId: string };
    const body = commentBody.parse(request.body);
    const post = await pool.query<{ group_id: string | null; comments_enabled: boolean; kind: string }>(
      "SELECT group_id, comments_enabled, kind FROM activity_posts WHERE id = $1 AND instance_id = $2",
      [postId, member.instanceId],
    );
    const p = post.rows[0];
    if (!p) return reply.status(404).send({ error: "Post not found." });
    if (p.kind === "news" && !p.comments_enabled) {
      // News comments are admin-toggled per post (§P) — enforced here (M5).
      return reply.status(403).send({ error: "Comments are off for this news item. Discuss it in your set group." });
    }
    if (body.parentId !== undefined) {
      const parent = await pool.query("SELECT 1 FROM comments WHERE id = $1 AND post_id = $2", [body.parentId, postId]);
      if (parent.rows.length === 0) return reply.status(400).send({ error: "The reply target is not on this post." });
    }
    const c = await pool.query<{ id: string }>(
      "INSERT INTO comments (instance_id, post_id, author_id, parent_id, body) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [member.instanceId, postId, member.id, body.parentId ?? null, body.body],
    );
    await record(pool, member.instanceId, member.id, "activity.comment", { type: "activity_post", id: postId }).catch(() => undefined);
    if (p.group_id !== null) {
      opts.hub.broadcast([`group:${p.group_id}`], { type: "comment.new", groupId: p.group_id, postId });
    }
    return { id: c.rows[0]!.id };
  });

  app.post("/v1/activity/:postId/reactions", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { postId } = request.params as { postId: string };
    const body = z.object({ emoji: z.enum(REACTIONS) }).parse(request.body);
    const post = await pool.query<{ group_id: string | null }>(
      "SELECT group_id FROM activity_posts WHERE id = $1 AND instance_id = $2",
      [postId, member.instanceId],
    );
    if (!post.rows[0]) return reply.status(404).send({ error: "Post not found." });
    const existing = await pool.query<{ emoji: string }>(
      "SELECT emoji FROM reactions WHERE post_id = $1 AND member_id = $2",
      [postId, member.id],
    );
    if (existing.rows[0]?.emoji === body.emoji) {
      await pool.query("DELETE FROM reactions WHERE post_id = $1 AND member_id = $2", [postId, member.id]);
    } else {
      await pool.query(
        `INSERT INTO reactions (instance_id, post_id, member_id, emoji) VALUES ($1,$2,$3,$4)
         ON CONFLICT (instance_id, post_id, member_id, emoji) DO UPDATE SET emoji = $4`,
        [member.instanceId, postId, member.id, body.emoji],
      );
      if (existing.rows[0] !== undefined) {
        await pool.query("DELETE FROM reactions WHERE post_id = $1 AND member_id = $2 AND emoji = $3", [postId, member.id, existing.rows[0].emoji]);
      }
    }
    const counts = await pool.query<{ emoji: string; n: string }>(
      "SELECT emoji, count(*)::text AS n FROM reactions WHERE post_id = $1 GROUP BY emoji",
      [postId],
    );
    const my = await pool.query<{ emoji: string }>("SELECT emoji FROM reactions WHERE post_id = $1 AND member_id = $2", [postId, member.id]);
    return { reactions: Object.fromEntries(counts.rows.map((r) => [r.emoji, Number(r.n)])), myReaction: my.rows[0]?.emoji ?? null };
  });

  /* ---------------------------- group admin ---------------------------- */

  app.post("/v1/activity/:postId/pin", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { postId } = request.params as { postId: string };
    const post = await pool.query<{ group_id: string; pinned_at: Date | null }>(
      "SELECT group_id, pinned_at FROM activity_posts WHERE id = $1 AND instance_id = $2",
      [postId, member.instanceId],
    );
    const p = post.rows[0];
    if (!p || p.group_id === null) return reply.status(404).send({ error: "Post not found." });
    if (!(await isGroupAdmin(pool, p.group_id, member.id))) return reply.status(403).send({ error: "Group admins pin announcements." });
    const pin = p.pinned_at === null;
    await pool.query("UPDATE activity_posts SET pinned_at = $1 WHERE id = $2", [pin ? new Date() : null, postId]);
    return { ok: true, pinned: pin };
  });

  /** Promote a standout group post into News with source attribution (§2). */
  app.post("/v1/activity/:postId/promote", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { postId } = request.params as { postId: string };
    const post = await pool.query<{ group_id: string; body: string | null; author_id: string | null }>(
      "SELECT group_id, body, author_id FROM activity_posts WHERE id = $1 AND instance_id = $2 AND kind <> 'news'",
      [postId, member.instanceId],
    );
    const p = post.rows[0];
    if (!p) return reply.status(404).send({ error: "Post not found." });
    // Promote-to-News is a school-admin or group-admin action (§7 Speak).
    const groupAdmin = p.group_id !== null && (await isGroupAdmin(pool, p.group_id, member.id));
    if (!groupAdmin && !requireDutyRole(member)) {
      return reply.status(403).send({ error: "Group admins or school admins promote to News." });
    }
    const config = await opts.loadConfigByInstance(member.instanceId);
    const news = await pool.query<{ id: string }>(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body, comments_enabled, promoted_from_post, promoted_by)
       VALUES ($1, NULL, $2, 'news', $3, $4, $5, $2) RETURNING id`,
      [member.instanceId, member.id, p.body ?? "", config.instance.behavior.newsCommentsDefault, postId],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'news.promote',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, news.rows[0]!.id, JSON.stringify({ fromPost: postId })],
    );
    opts.hub.broadcast([`group:${p.group_id!}`, `member:${member.id}`], { type: "news.new" });
    return { id: news.rows[0]!.id };
  });

  /** Visit watermark for activity unseen tags. */
  app.post("/v1/groups/:id/activity/seen", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    await markActivitySeen(pool, member.instanceId, member.id, id);
    return { ok: true };
  });

  /** Member search for the new-chat picker (minimal directory slice). */
  app.get("/v1/members/search", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { q } = request.query as { q?: string };
    const term = `%${(q ?? "").toLowerCase()}%`;
    const res = await pool.query<{ id: string; display_name: string; verification: string; set_year: number | null }>(
      `SELECT m.id, m.display_name, m.verification, s.year AS set_year
       FROM members m LEFT JOIN sets s ON s.id = m.set_id
       WHERE m.instance_id = $1 AND m.id <> $2 AND m.verification <> 'rejected'
         AND m.deleted_at IS NULL AND m.memorial = false
         AND ($3 = '%%' OR LOWER(m.display_name) LIKE $3 OR LOWER(COALESCE(m.city,'')) LIKE $3)
       ORDER BY m.display_name LIMIT 20`,
      [member.instanceId, member.id, term],
    );
    return { members: res.rows };
  });
}
