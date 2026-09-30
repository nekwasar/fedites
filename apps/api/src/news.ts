/**
 * News bulletin (2.4): school + alumni admins only (spec §2). Permanent,
 * high-signal; comments admin-toggled per post (default off, enforced at the
 * API); reactions always on; "discuss this in your set group" data when off.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";
import type { InstanceConfig } from "@fedites/config";

const newsBody = z.object({
  body: z.string().min(1).max(4000),
  commentsEnabled: z.boolean().optional(),
  mediaIds: z.array(z.string().uuid()).max(10).optional(),
});

export async function newsRoutes(app: FastifyInstance, opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig> }): Promise<void> {
  const { pool } = opts;

  app.get("/v1/news", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { before } = request.query as { before?: string };
    const res = await pool.query<{
      id: string; body: string; author_name: string | null; created_at: Date;
      comments_enabled: boolean; source_group: string | null; source_group_id: string | null;
      my_reaction: string | null;
    }>(
      `SELECT p.id, p.body, m.display_name AS author_name, p.created_at,
              p.comments_enabled,
              src.name AS source_group, src.id AS source_group_id,
              (SELECT emoji FROM reactions r WHERE r.post_id = p.id AND r.member_id = $2 LIMIT 1) AS my_reaction
       FROM activity_posts p
       LEFT JOIN members m ON m.id = p.author_id
       LEFT JOIN activity_posts orig ON orig.id = p.promoted_from_post
       LEFT JOIN groups src ON src.id = orig.group_id
       WHERE p.instance_id = $1 AND p.kind = 'news' AND p.archived_at IS NULL
         AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
       ORDER BY p.created_at DESC LIMIT 20`,
      [member.instanceId, member.id, before ?? null],
    );
    const out = [];
    for (const n of res.rows) {
      const reactions = await pool.query<{ emoji: string; n: string }>(
        "SELECT emoji, count(*)::text AS n FROM reactions WHERE post_id = $1 GROUP BY emoji",
        [n.id],
      );
      out.push({
        id: n.id, body: n.body, author: n.author_name, createdAt: n.created_at,
        commentsEnabled: n.comments_enabled,
        promotedFrom: n.source_group ? { name: n.source_group, id: n.source_group_id } : null,
        reactions: Object.fromEntries(reactions.rows.map((r) => [r.emoji, Number(r.n)])),
        myReaction: n.my_reaction,
      });
    }

    // "Discuss this in your set group" (§2): the member's set group.
    const mySetGroup = await pool.query<{ id: string; name: string }>(
      `SELECT g.id, g.name FROM members mm
       JOIN group_members gm ON gm.member_id = mm.id
       JOIN groups g ON g.id = gm.group_id AND g.type = 'set'
       WHERE mm.id = $1 LIMIT 1`,
      [member.id],
    );
    return {
      items: out,
      mySetGroup: mySetGroup.rows[0] ?? null,
    };
  });

  /** Composer — school + alumni admins only (§2). */
  app.post("/v1/news", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) {
      return reply.status(403).send({ error: "Only school and alumni admins post News." });
    }
    const body = newsBody.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body, comments_enabled)
       VALUES ($1, NULL, $2, 'news', $3, $4) RETURNING id`,
      [member.instanceId, member.id, body.body, body.commentsEnabled ?? config.instance.behavior.newsCommentsDefault],
    );
    const postId = res.rows[0]!.id;
    if (body.mediaIds !== undefined) {
      for (const [i, mediaId] of body.mediaIds.entries()) {
        await pool.query("INSERT INTO post_media (post_id, media_id, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [postId, mediaId, i]);
      }
    }
    return { id: postId };
  });
}
