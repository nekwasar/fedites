/**
 * Recognition + personalization endpoints (session 3.4).
 * Badges/founding/streaks read the one ledger; intents and prefs power the
 * explainable personalization engine (spec §5 — no black box).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";
import { BADGES, type BadgeKey } from "./recognition.js";

const INTENTS = ["reconnect", "network", "give-back", "events", "business", "mentor"] as const;

const intentsBody = z.object({ intents: z.array(z.enum(INTENTS)).max(6) });
const notifyPrefsBody = z.object({
  mentions: z.enum(["on", "off"]).optional(),
  events: z.enum(["on", "off"]).optional(),
  news: z.enum(["on", "off"]).optional(),
});
const awardBody = z.object({
  memberId: z.string().uuid(),
  badge: z.enum(["founding", "verified", "first-post", "conversationalist", "shutterbug", "event-goer"]),
});

export async function recognitionRoutes(app: FastifyInstance, opts: { pool: Pool }): Promise<void> {
  const { pool } = opts;

  app.get("/v1/recognition/me", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const badges = await pool.query<{ badge: string; awarded_at: Date; awarded_by_name: string | null }>(
      `SELECT b.badge, b.awarded_at, a.display_name AS awarded_by_name
       FROM member_badges b LEFT JOIN members a ON a.id = b.awarded_by
       WHERE b.member_id = $1 ORDER BY b.awarded_at`,
      [member.id],
    );
    const points = await pool.query<{ total: string }>(
      "SELECT COALESCE(sum(points), 0)::text AS total FROM recognition_events WHERE member_id = $1",
      [member.id],
    );
    const streak = await pool.query<{ current_weeks: number; longest_weeks: number }>(
      "SELECT current_weeks, longest_weeks FROM member_streaks WHERE member_id = $1",
      [member.id],
    );
    return {
      points: Number(points.rows[0]?.total ?? 0),
      badges: badges.rows.map((b) => ({
        badge: b.badge,
        title: BADGES[b.badge as BadgeKey]?.title ?? b.badge,
        description: BADGES[b.badge as BadgeKey]?.description ?? "",
        awardedAt: b.awarded_at,
        awardedBy: b.awarded_by_name,
      })),
      streak: { current: streak.rows[0]?.current_weeks ?? 0, longest: streak.rows[0]?.longest_weeks ?? 0 },
    };
  });

  /** Public badges for a profile (K2-safe: achievements, not league tables). */
  app.get("/v1/members/:id/recognition", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const badges = await pool.query<{ badge: string; awarded_at: Date }>(
      "SELECT badge, awarded_at FROM member_badges WHERE member_id = $1 ORDER BY awarded_at",
      [id],
    );
    return {
      badges: badges.rows.map((b) => ({
        badge: b.badge,
        title: BADGES[b.badge as BadgeKey]?.title ?? b.badge,
        awardedAt: b.awarded_at,
      })),
    };
  });

  /** Join-intent capture (spec §5): multi-select, editable in Menu. */
  app.get("/v1/me/intents", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ prefs: Record<string, unknown> }>("SELECT prefs FROM members WHERE id = $1", [member.id]);
    const intents = (res.rows[0]?.prefs as { intents?: string[] })?.intents ?? [];
    return { intents, options: INTENTS };
  });

  app.post("/v1/me/intents", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = intentsBody.parse(request.body);
    await pool.query(
      `UPDATE members SET prefs = jsonb_set(COALESCE(prefs, '{}'::jsonb), '{intents}', $2) WHERE id = $1`,
      [member.id, JSON.stringify(body.intents)],
    );
    return { ok: true, intents: body.intents };
  });

  /** Per-category notification preferences (spec §5) with quiet hours. */
  app.get("/v1/me/notification-prefs", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ notify_prefs: Record<string, string> }>("SELECT notify_prefs FROM members WHERE id = $1", [member.id]);
    return { prefs: { mentions: "on", events: "on", news: "on", ...(res.rows[0]?.notify_prefs ?? {}) } };
  });

  app.post("/v1/me/notification-prefs", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = notifyPrefsBody.parse(request.body);
    await pool.query(
      `UPDATE members SET notify_prefs = COALESCE(notify_prefs, '{}'::jsonb) || $2 WHERE id = $1`,
      [member.id, JSON.stringify(body)],
    );
    return { ok: true };
  });

  /** Manual award (duty roles only) — e.g. founding status for a late pioneer. */
  app.post("/v1/recognition/award", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = awardBody.parse(request.body);
    const res = await pool.query(
      `INSERT INTO member_badges (instance_id, member_id, badge, awarded_by)
       VALUES ($1,$2,$3,$4) ON CONFLICT (member_id, badge) DO NOTHING RETURNING id`,
      [member.instanceId, body.memberId, body.badge, member.id],
    );
    if (res.rows.length === 0) return reply.status(400).send({ error: "That badge is already held." });
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'recognition.award',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, body.memberId, JSON.stringify({ badge: body.badge })],
    );
    return { ok: true };
  });
}
