/**
 * Feed v1 (2.5): sources = official News + your groups' activity + group
 * content you are permitted to see. Never a leaky global feed. Ordering is
 * explainable: your groups (incl. set/city) first, then school-wide member-
 * visible groups, newest within each bucket. Intent rails v0 at the top,
 * dismissible (they retire once used). Melt-into-group is client motion —
 * the server tags every item with its source group.
 * Guardrails: committee workspaces only for members; feed-muted groups drop
 * out ("less from this group"); visibility-filtered per viewer.
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireMember } from "./sessions.js";

export async function feedRoutes(app: FastifyInstance, opts: { pool: Pool }): Promise<void> {
  const { pool } = opts;

  app.get("/v1/feed", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { before } = request.query as { before?: string };

    const news = await pool.query<{ id: string; body: string; author_name: string | null; created_at: Date; comments_enabled: boolean; source_group: string | null; source_group_id: string | null; my_reaction: string | null }>(
      `SELECT p.id, p.body, m.display_name AS author_name, p.created_at, p.comments_enabled,
              src.name AS source_group, src.id AS source_group_id,
              (SELECT emoji FROM reactions r WHERE r.post_id = p.id AND r.member_id = $2 LIMIT 1) AS my_reaction
       FROM activity_posts p
       LEFT JOIN members m ON m.id = p.author_id
       LEFT JOIN activity_posts orig ON orig.id = p.promoted_from_post
       LEFT JOIN groups src ON src.id = orig.group_id
       WHERE p.instance_id = $1 AND p.kind = 'news' AND p.archived_at IS NULL
         AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
       ORDER BY p.created_at DESC LIMIT 10`,
      [member.instanceId, member.id, before ?? null],
    );

    // My groups (including set/city chapters I joined), minus feed-muted.
    const groupItems = await pool.query<{ id: string; group_id: string; group_name: string; group_type: string; kind: string; body: string | null; author_name: string | null; created_at: Date; rank_ts: Date; my_reaction: string | null; comment_count: string }>(
      `SELECT p.id, p.group_id, g.name AS group_name, g.type AS group_type, p.kind, p.body,
              m.display_name AS author_name, p.created_at,
              p.created_at + (COALESCE(gm.affinity, 0) * interval '12 hours') AS rank_ts,
              (SELECT emoji FROM reactions r WHERE r.post_id = p.id AND r.member_id = $2 LIMIT 1) AS my_reaction,
              (SELECT count(*) FROM comments c WHERE c.post_id = p.id AND c.archived_at IS NULL)::text AS comment_count
       FROM activity_posts p
       JOIN groups g ON g.id = p.group_id
       JOIN group_members gm ON gm.group_id = g.id AND gm.member_id = $2 AND gm.feed_muted = false
       LEFT JOIN members m ON m.id = p.author_id
       WHERE p.instance_id = $1 AND p.kind <> 'news' AND p.archived_at IS NULL
         AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
       ORDER BY p.created_at + (COALESCE(gm.affinity, 0) * interval '12 hours') DESC LIMIT 20`,
      [member.instanceId, member.id, before ?? null],
    );

    // Rails v0: intent rails pinned at the top; they retire once used or
    // dismissed (§4.2). Explainable, no black box.
    const prefsRes = await pool.query<{ prefs: Record<string, unknown> }>("SELECT prefs FROM members WHERE id = $1", [member.id]);
    const dismissed = ((prefsRes.rows[0]?.prefs as { dismissedRails?: string[] })?.dismissedRails) ?? [];
    const rails: Array<{ key: string; title: string; kind: string; items: Array<Record<string, unknown>> }> = [];

    if (!dismissed.includes("countdowns")) {
      const events = await pool.query<{ id: string; title: string; starts_at: Date; group_name: string | null }>(
        `SELECT e.id, e.title, e.starts_at, g.name AS group_name FROM events e
         LEFT JOIN groups g ON g.id = e.group_id
         WHERE e.instance_id = $1 AND e.starts_at > now()
         ORDER BY e.starts_at LIMIT 3`,
        [member.instanceId],
      );
      if (events.rows.length > 0) {
        rails.push({
          key: "countdowns", kind: "countdowns", title: "Coming up",
          items: events.rows.map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at, groupName: e.group_name })),
        });
      }
    }
    if (!dismissed.includes("classmates")) {
      const classmates = await pool.query<{ id: string; display_name: string; set_year: number | null }>(
        `SELECT m.id, m.display_name, s.year AS set_year
         FROM members m
         LEFT JOIN sets s ON s.id = m.set_id
         WHERE m.instance_id = $1 AND m.set_id = (SELECT set_id FROM members WHERE id = $2)
           AND m.id <> $2 AND m.verification IN ('verified','honorary')
           AND m.memorial = false AND m.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM messages msg
                WHERE (msg.dm_a = LEAST(m.id, $2) AND msg.dm_b = GREATEST(m.id, $2)))
         ORDER BY m.display_name LIMIT 5`,
        [member.instanceId, member.id],
      );
      if (classmates.rows.length > 0) {
        rails.push({
          key: "classmates", kind: "classmates", title: "Suggested classmates",
          items: classmates.rows.map((m) => ({ id: m.id, name: m.display_name, setYear: m.set_year })),
        });
      }
    }
    if (!dismissed.includes("campaigns")) {
      const campaigns = await pool.query<{ id: string; title: string; goal_minor: string; currency: string; raised: string }>(
        `SELECT c.id, c.title, c.goal_minor::text, c.currency,
                (SELECT COALESCE(sum(l.amount_minor), 0)::text FROM ledger_entries l
                 WHERE l.campaign_id = c.id AND l.status = 'confirmed') AS raised
         FROM campaigns c
         WHERE c.instance_id = $1 AND c.status = 'open' AND c.archived_at IS NULL
         ORDER BY c.created_at DESC LIMIT 3`,
        [member.instanceId],
      );
      if (campaigns.rows.length > 0) {
        rails.push({
          key: "campaigns", kind: "campaigns", title: "Campaign progress",
          items: campaigns.rows.map((c) => ({
            id: c.id, title: c.title, currency: c.currency,
            goalMinor: Number(c.goal_minor), raisedMinor: Number(c.raised),
            progress: Math.min(100, Math.round((Number(c.raised) / Math.max(Number(c.goal_minor), 1)) * 100)),
          })),
        });
      }
    }
    if (!dismissed.includes("suggested")) {
      const suggested = await pool.query<{ id: string; name: string; type: string; members: string; posts_week: string }>(
        `SELECT g.id, g.name, g.type,
                (SELECT count(*) FROM group_members x WHERE x.group_id = g.id)::text AS members,
                (SELECT count(*) FROM activity_posts p WHERE p.group_id = g.id AND p.created_at > now() - interval '7 days')::text AS posts_week
         FROM groups g
         WHERE g.instance_id = $1 AND g.status = 'active' AND g.type IN ('chapter','interest')
           AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.member_id = $2)
         ORDER BY posts_week DESC LIMIT 3`,
        [member.instanceId, member.id],
      );
      if (suggested.rows.length > 0) {
        rails.push({
          key: "suggested", kind: "suggested", title: "Suggested groups",
          items: suggested.rows.map((g) => ({ id: g.id, name: g.name, type: g.type, memberCount: Number(g.members), postsThisWeek: Number(g.posts_week) })),
        });
      }
    }

    return {
      items: [
        ...news.rows.map((n) => ({
          kind: "news" as const, id: n.id, body: n.body, author: n.author_name,
          createdAt: n.created_at, commentsEnabled: n.comments_enabled,
          promotedFrom: n.source_group ? { name: n.source_group, id: n.source_group_id } : null,
          reactions: n.my_reaction,
          groupId: null as string | null, groupName: null as string | null, groupType: null as string | null,
        })),
        ...groupItems.rows.map((g) => ({
          kind: g.kind as string, id: g.id, body: g.body, author: g.author_name,
          createdAt: g.created_at, rankTs: g.rank_ts.toISOString(), commentsEnabled: true,
          promotedFrom: null, reactions: g.my_reaction,
          commentCount: Number(g.comment_count),
          groupId: g.group_id, groupName: g.group_name, groupType: g.group_type,
        })),
      ].sort((a, b) => {
        // Tune-my-feed (§5): affinity-boosted items rank by their boosted
        // timestamp; everything else by raw recency. Explainable.
        const ra = (a as { rankTs?: string }).rankTs;
        const rb = (b as { rankTs?: string }).rankTs;
        const ta = new Date(ra ?? a.createdAt).getTime();
        const tb = new Date(rb ?? b.createdAt).getTime();
        return tb - ta;
      }),
      rails,
    };
  });

  app.post("/v1/feed/rails/:key/dismiss", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { key } = request.params as { key: string };
    if (!/^[a-z-]+$/.test(key)) return reply.status(400).send({ error: "Unknown rail." });
    // Rails retire once used or dismissed (§4.2).
    await pool.query(
      `UPDATE members SET prefs = jsonb_set(
         COALESCE(prefs, '{}'::jsonb),
         '{dismissedRails}',
         (COALESCE(prefs->'dismissedRails', '[]'::jsonb) || to_jsonb($2::text))
       ) WHERE id = $1`,
      [member.id, key],
    );
    return { ok: true };
  });
}
