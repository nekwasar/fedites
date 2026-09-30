/**
 * Group engine (2.1): one group object, six types, membership rules per
 * spec §6. Anatomy: profile, members & roles, Activity, Chat, pinned
 * announcements, polls, member list. Lifecycle: proposed → active →
 * archived (read-only, never deleted — N1).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";
import { groupThreadUnread, markActivitySeen } from "./unread.js";
import type { InstanceConfig, GroupTypeConfig } from "@fedites/config";

const createBody = z.object({
  type: z.enum(["chapter", "interest", "guild", "committee"]),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
});

const J2_LARGE_GROUP = 50; // mentions-only default above 50 members (J2)

export async function groupsRoutes(app: FastifyInstance, opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig> }): Promise<void> {
  const { pool } = opts;

  async function groupTypeConfig(config: InstanceConfig, type: string): Promise<GroupTypeConfig | undefined> {
    return config.instance.groupTypes.find((g) => g.type === type);
  }

  /* ------------------------------ browse ------------------------------- */

  /** Discovery: enabled group types with activity pulse (§4.1). */
  app.get("/v1/groups", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const config = await opts.loadConfigByInstance(member.instanceId);
    const res = await pool.query<{
      id: string; type: string; name: string; status: string; members: string;
      posts_week: string; joined: boolean;
    }>(
      `SELECT g.id, g.type, g.name, g.status,
              (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.id)::text AS members,
              (SELECT count(*) FROM activity_posts p WHERE p.group_id = g.id AND p.created_at > now() - interval '7 days')::text AS posts_week,
              EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.member_id = $1) AS joined
       FROM groups g
       WHERE g.instance_id = $2 AND g.status = 'active'
       ORDER BY posts_week DESC, members DESC`,
      [member.id, member.instanceId],
    );
    return {
      groups: await Promise.all(res.rows.map(async (g) => {
        const tc = await groupTypeConfig(config, g.type);
        return {
          id: g.id, type: g.type, name: g.name, status: g.status,
          memberCount: Number(g.members), postsThisWeek: Number(g.posts_week), joined: g.joined,
          enabled: tc?.enabled ?? true,
          label: tc?.label ?? g.type,
        };
      })),
    };
  });

  /**
   * Groups home (§4.1): adaptive by membership density. My groups with
   * unseen-activity tags (pinned first, then latest unseen), then discovery.
   */
  app.get("/v1/groups/home", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const config = await opts.loadConfigByInstance(member.instanceId);

    const mine = await pool.query<{ id: string; type: string; name: string; pinned: boolean; latest_unseen: Date | null; members: string }>(
      `SELECT g.id, g.type, g.name, gm.pinned,
              (SELECT max(p.created_at) FROM activity_posts p
                WHERE p.group_id = g.id AND p.created_at > COALESCE(tr.activity_seen_at, to_timestamp(0))
                  AND p.archived_at IS NULL) AS latest_unseen,
              (SELECT count(*) FROM group_members x WHERE x.group_id = g.id)::text AS members
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       LEFT JOIN thread_reads tr ON tr.member_id = gm.member_id AND tr.thread_type = 'group' AND tr.thread_id = g.id
       WHERE gm.member_id = $1 AND g.status = 'active'
       ORDER BY gm.pinned DESC`,
      [member.id],
    );

    const rows = [];
    for (const g of mine.rows) {
      const unread = await groupThreadUnread(pool, member.id, g.id);
      rows.push({
        id: g.id, type: g.type, name: g.name, pinned: g.pinned,
        unseen: unread, memberCount: Number(g.members),
        label: config.instance.groupTypes.find((t) => t.type === g.type)?.label ?? g.type,
        sortKey: g.latest_unseen !== null ? new Date(g.latest_unseen).getTime() : 0,
      });
    }
    // Pinned first, then latest unseen activity (§4.1).
    rows.sort((a, b) => (a.pinned === b.pinned ? b.sortKey - a.sortKey : a.pinned ? -1 : 1));

    // Discovery shrinks as the list fills, never disappears (§4.1).
    const discovery = await pool.query<{ id: string; type: string; name: string; members: string; posts_week: string; member_city: string | null; intent_match: boolean }>(
      `SELECT g.id, g.type, g.name,
              (SELECT count(*) FROM group_members x WHERE x.group_id = g.id)::text AS members,
              (SELECT count(*) FROM activity_posts p WHERE p.group_id = g.id AND p.created_at > now() - interval '7 days')::text AS posts_week,
              me.city AS member_city,
              me.intents ?| ARRAY['network','business'] AND g.type = 'chapter' OR me.intents ? 'events' AS intent_match
       FROM groups g
       CROSS JOIN (SELECT city, prefs->'intents' AS intents FROM members WHERE id = $1) me
       WHERE g.instance_id = $2 AND g.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.member_id = $1)
         AND g.type IN ('chapter','interest')
       ORDER BY (CASE WHEN me.city IS NOT NULL AND g.name ILIKE '%' || me.city || '%' THEN 0 ELSE 1 END),
                (CASE WHEN me.intents ?| ARRAY['network','business','events'] THEN 0 ELSE 1 END),
                posts_week DESC
       LIMIT 6`,
      [member.id, member.instanceId],
    );

    return {
      myGroups: rows.map((r) => ({ id: r.id, type: r.type, name: r.name, pinned: r.pinned, unseen: r.unseen, memberCount: r.memberCount, label: r.label })),
      discovery: discovery.rows.map((g) => ({
        id: g.id, type: g.type, name: g.name,
        memberCount: Number(g.members), postsThisWeek: Number(g.posts_week),
        citySuggested: g.member_city !== null && g.name.toLowerCase().includes(String(g.member_city).toLowerCase()),
        intentSuggested: g.intent_match,
      })),
      terminology: config.instance.terminology,
    };
  });

  /* --------------------------- group profile --------------------------- */

  app.get("/v1/groups/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{
      id: string; type: string; name: string; description: string | null; status: string; created_at: Date; members: string;
    }>(
      `SELECT g.id, g.type, g.name, g.description, g.status, g.created_at,
              (SELECT count(*) FROM group_members x WHERE x.group_id = g.id)::text AS members
       FROM groups g WHERE g.id = $1 AND g.instance_id = $2`,
      [id, member.instanceId],
    );
    const g = res.rows[0];
    if (!g) return reply.status(404).send({ error: "Group not found." });
    const mem = await pool.query<{ is_admin: boolean; feed_muted: boolean; notify_level: string }>(
      "SELECT is_admin, feed_muted, notify_level FROM group_members WHERE group_id = $1 AND member_id = $2",
      [id, member.id],
    );
    const mine = mem.rows[0];
    const membersRes = await pool.query<{ id: string; display_name: string; is_admin: boolean }>(
      `SELECT m.id, m.display_name, gm.is_admin FROM group_members gm JOIN members m ON m.id = gm.member_id
       WHERE gm.group_id = $1 ORDER BY gm.is_admin DESC, m.display_name LIMIT 200`,
      [id],
    );
    return {
      id: g.id, type: g.type, name: g.name, description: g.description, status: g.status,
      memberCount: Number(g.members), createdAt: g.created_at,
      my: mine
        ? { joined: true, isAdmin: mine.is_admin, feedMuted: mine.feed_muted, notifyLevel: mine.notify_level }
        : { joined: false, isAdmin: false, feedMuted: false, notifyLevel: "all" },
      members: membersRes.rows,
    };
  });

  /* --------------------------- create + join --------------------------- */

  app.post("/v1/groups", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = createBody.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    const tc = await groupTypeConfig(config, body.type);
    if (!tc?.enabled) return reply.status(403).send({ error: "That group type is switched off for this community." });

    // Creation rights per type (spec §6): chapters by admins; interest/guild
    // by member proposal → admin approval; committees by exec, direct.
    if (body.type === "chapter") {
      if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins create city chapters." });
    }
    if (body.type === "committee" && !requireDutyRole(member)) {
      return reply.status(403).send({ error: "The executive creates committee workspaces." });
    }
    const status = body.type === "chapter" || body.type === "committee" ? "active" : "proposed";

    const res = await pool.query<{ id: string }>(
      `INSERT INTO groups (instance_id, type, name, description, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.type, body.name, body.description ?? null, status, member.id],
    );
    const groupId = res.rows[0]!.id;
    // Creator admins their own group (committees skip approval, §6).
    await pool.query(
      "INSERT INTO group_members (instance_id, group_id, member_id, is_admin) VALUES ($1,$2,$3,true)",
      [member.instanceId, groupId, member.id],
    );
    if (status === "proposed") {
      // Admin approval queue: notify duty-role holders.
      const admins = await pool.query<{ id: string }>(
        `SELECT DISTINCT m.id FROM members m
         JOIN member_roles mr ON mr.member_id = m.id JOIN roles r ON r.id = mr.role_id
         WHERE m.instance_id = $1 AND r.key IN ('president','secretary','moderator')`,
        [member.instanceId],
      );
      for (const a of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (instance_id, member_id, kind, payload)
           VALUES ($1,$2,'system.notice',$3)`,
          [member.instanceId, a.id, JSON.stringify({ title: `Group proposal: ${body.name}`, groupId, kind: "group-proposal" })],
        );
      }
    }
    return { id: groupId, status };
  });

  /** Approve a proposed group (admin duty). */
  app.post("/v1/groups/:id/approve", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const res = await pool.query<{ id: string; created_by: string | null; name: string }>(
      "UPDATE groups SET status = 'active' WHERE id = $1 AND instance_id = $2 AND status = 'proposed' RETURNING id, created_by, name",
      [id, member.instanceId],
    );
    const g = res.rows[0];
    if (!g) return reply.status(404).send({ error: "No pending proposal with that id." });
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'group.approve',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ name: g.name })],
    );
    return { ok: true };
  });

  /** Join per type rules (§6). J2: large groups default to mentions-only. */
  app.post("/v1/groups/:id/join", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const g = await pool.query<{ id: string; type: string; status: string; members: string }>(
      `SELECT g.id, g.type, g.status, (SELECT count(*) FROM group_members x WHERE x.group_id = g.id)::text AS members
       FROM groups g WHERE g.id = $1 AND g.instance_id = $2`,
      [id, member.instanceId],
    );
    const group = g.rows[0];
    if (!group || group.status !== "active") return reply.status(404).send({ error: "Group not found." });

    const already = await pool.query("SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2", [id, member.id]);
    if (already.rows.length > 0) return { ok: true, joined: true };

    const config = await opts.loadConfigByInstance(member.instanceId);
    const policy = config.instance.behavior;

    if (group.type === "set" || group.type === "house") {
      return reply.status(403).send({ error: "Set groups and houses assign automatically." });
    }
    if (group.type === "committee") {
      return reply.status(403).send({ error: "Committee workspaces are invite-only." });
    }
    if (group.type === "guild") {
      // Request to join → group admin approves.
      const req = await pool.query(
        `INSERT INTO group_join_requests (instance_id, group_id, member_id) VALUES ($1,$2,$3)
         ON CONFLICT (group_id, member_id) DO NOTHING RETURNING id`,
        [member.instanceId, id, member.id],
      );
      return req.rows.length > 0
        ? { ok: true, joined: false, requested: true }
        : { ok: true, joined: false, requested: true, note: "already requested" };
    }
    // chapter + interest: one-tap open join.
    void policy;
    const count = Number(group.members);
    const notify = count >= J2_LARGE_GROUP ? "mentions" : "all";
    await pool.query(
      "INSERT INTO group_members (instance_id, group_id, member_id, notify_level) VALUES ($1,$2,$3,$4)",
      [member.instanceId, id, member.id, notify],
    );
    // Lifecycle: intro thread on join (§6) — the member posts an intro.
    await pool.query(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body)
       VALUES ($1,$2,$3,'post',$4)`,
      [member.instanceId, id, member.id, `${member.displayName} joined the group. Say hello.`],
    );
    return { ok: true, joined: true, notifyLevel: notify };
  });

  app.post("/v1/groups/:id/leave", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const g = await pool.query<{ type: string }>("SELECT type FROM groups WHERE id = $1 AND instance_id = $2", [id, member.instanceId]);
    if (!g.rows[0]) return reply.status(404).send({ error: "Group not found." });
    if (g.rows[0].type === "set" || g.rows[0].type === "house") {
      return reply.status(403).send({ error: "Set groups and houses are part of membership." });
    }
    await pool.query("DELETE FROM group_members WHERE group_id = $1 AND member_id = $2", [id, member.id]);
    return { ok: true };
  });

  /* ------------------------ members + admin panel ---------------------- */

  app.post("/v1/groups/:id/members", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = z.object({ memberId: z.string().uuid() }).parse(request.body);
    // Invite-only committees: group admins add members directly.
    const am = await pool.query<{ is_admin: boolean }>("SELECT is_admin FROM group_members WHERE group_id = $1 AND member_id = $2", [id, member.id]);
    if (am.rows[0]?.is_admin !== true) return reply.status(403).send({ error: "Group admins only." });
    const g = await pool.query<{ type: string }>("SELECT type FROM groups WHERE id = $1 AND instance_id = $2", [id, member.instanceId]);
    if (g.rows[0]?.type !== "committee") return reply.status(400).send({ error: "Direct adds are for committee workspaces; other types join by their own rules." });
    await pool.query(
      `INSERT INTO group_members (instance_id, group_id, member_id) VALUES ($1,$2,$3)
       ON CONFLICT (instance_id, group_id, member_id) DO NOTHING`,
      [member.instanceId, id, body.memberId],
    );
    return { ok: true };
  });

  app.post("/v1/groups/:id/admins", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = z.object({ memberId: z.string().uuid(), isAdmin: z.boolean() }).parse(request.body);
    const am = await pool.query<{ is_admin: boolean }>("SELECT is_admin FROM group_members WHERE group_id = $1 AND member_id = $2", [id, member.id]);
    if (am.rows[0]?.is_admin !== true) return reply.status(403).send({ error: "Group admins only." });
    await pool.query(
      "UPDATE group_members SET is_admin = $1 WHERE group_id = $2 AND member_id = $3",
      [body.isAdmin, id, body.memberId],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'group.admin',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, body.memberId, JSON.stringify({ groupId: id, isAdmin: body.isAdmin })],
    );
    return { ok: true };
  });

  /** Join-request queue (guild) — group admins decide. */
  app.get("/v1/groups/:id/requests", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const am = await pool.query<{ is_admin: boolean }>("SELECT is_admin FROM group_members WHERE group_id = $1 AND member_id = $2", [id, member.id]);
    if (am.rows[0]?.is_admin !== true) return reply.status(403).send({ error: "Group admins only." });
    const res = await pool.query<{ id: string; member_id: string; display_name: string; created_at: Date }>(
      `SELECT r.id, r.member_id, m.display_name, r.created_at FROM group_join_requests r
       JOIN members m ON m.id = r.member_id
       WHERE r.group_id = $1 AND r.status = 'pending' ORDER BY r.created_at`,
      [id],
    );
    return { requests: res.rows };
  });

  app.post("/v1/groups/:id/requests/:requestId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id, requestId } = request.params as { id: string; requestId: string };
    const body = z.object({ decision: z.enum(["approve", "reject"]) }).parse(request.body);
    const am = await pool.query<{ is_admin: boolean }>("SELECT is_admin FROM group_members WHERE group_id = $1 AND member_id = $2", [id, member.id]);
    if (am.rows[0]?.is_admin !== true) return reply.status(403).send({ error: "Group admins only." });
    const req = await pool.query<{ member_id: string }>(
      "UPDATE group_join_requests SET status = $1, decided_by = $2 WHERE id = $3 AND group_id = $4 AND status = 'pending' RETURNING member_id",
      [body.decision === "approve" ? "approved" : "rejected", member.id, requestId, id],
    );
    const target = req.rows[0];
    if (!target) return reply.status(404).send({ error: "Request not found." });
    if (body.decision === "approve") {
      await pool.query(
        `INSERT INTO group_members (instance_id, group_id, member_id) VALUES ($1,$2,$3)
         ON CONFLICT (instance_id, group_id, member_id) DO NOTHING`,
        [member.instanceId, id, target.member_id],
      );
    }
    return { ok: true };
  });

  /* -------------------------- per-member prefs ------------------------- */

  /** Tune-my-feed (spec §5): "more from this group" nudges affinity; the
   *  feed weights recency by it. Explainable, never a black box. */
  app.post("/v1/groups/:id/tune", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = z.object({ more: z.boolean() }).parse(request.body);
    const delta = body.more ? 1 : -1;
    const res = await pool.query<{ affinity: number }>(
      `UPDATE group_members SET affinity = LEAST(3, GREATEST(-1, affinity + $1))
       WHERE group_id = $2 AND member_id = $3 RETURNING affinity`,
      [delta, id, member.id],
    );
    if (res.rows[0] === undefined) return reply.status(404).send({ error: "Join the group first." });
    return { ok: true, affinity: res.rows[0].affinity };
  });

  app.post("/v1/groups/:id/feed-mute", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = z.object({ muted: z.boolean() }).parse(request.body);
    await pool.query(
      "UPDATE group_members SET feed_muted = $1 WHERE group_id = $2 AND member_id = $3",
      [body.muted, id, member.id],
    );
    return { ok: true, muted: body.muted };
  });

  app.post("/v1/groups/:id/visit", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = z.object({ tab: z.enum(["activity", "chat"]) }).parse(request.body);
    if (body.tab === "activity") {
      await markActivitySeen(pool, member.instanceId, member.id, id);
    } else {
      const { markChatRead } = await import("./unread.js");
      await markChatRead(pool, member.instanceId, member.id, "group", id);
    }
    return { ok: true };
  });
}
