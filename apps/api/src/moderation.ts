/**
 * Moderation v1 (2.6): members report bad content; group admins and school
 * moderators act with audit trails; escalation goes to school moderators.
 * Removal archives (read-only, preserved — N1); admin actions reversible
 * (N2) — archived content can be restored within the window.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";

const reportBody = z.object({
  postId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  reason: z.string().min(4).max(500),
}).refine((b) => (b.postId !== undefined) !== (b.messageId !== undefined), "report exactly one target");

const decisionBody = z.object({
  decision: z.enum(["remove-content", "dismiss", "escalate"]),
  resolution: z.string().max(500).optional(),
});

export async function moderationRoutes(app: FastifyInstance, opts: { pool: Pool }): Promise<void> {
  const { pool } = opts;

  /** Members report bad content (mvp §8 Moderation toolkit). */
  app.post("/v1/reports", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = reportBody.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO reports (instance_id, reporter_id, post_id, message_id, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, member.id, body.postId ?? null, body.messageId ?? null, body.reason],
    );
    return { id: res.rows[0]!.id };
  });

  /** Group admins see reports for their groups; school moderators see all. */
  app.get("/v1/reports", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const isMod = requireDutyRole(member);
    if (!isMod) {
      const anyAdmin = await pool.query(
        `SELECT 1 FROM group_members WHERE member_id = $1 AND is_admin = true LIMIT 1`,
        [member.id],
      );
      if (anyAdmin.rows.length === 0) return reply.status(403).send({ error: "Moderators only." });
    }
    const res = await pool.query<{
      id: string; reason: string; status: string; created_at: Date; reporter: string;
      post_id: string | null; message_id: string | null; post_body: string | null; group_name: string | null;
    }>(
      `SELECT r.id, r.reason, r.status, r.created_at, m.display_name AS reporter,
              r.post_id, r.message_id,
              CASE WHEN r.post_id IS NOT NULL THEN p.body ELSE msg.body END AS post_body,
              g.name AS group_name
       FROM reports r
       JOIN members m ON m.id = r.reporter_id
       LEFT JOIN activity_posts p ON p.id = r.post_id
       LEFT JOIN messages msg ON msg.id = r.message_id
       LEFT JOIN groups g ON g.id = COALESCE(p.group_id, msg.group_id)
       WHERE r.instance_id = $1
         AND r.status IN ('open','escalated')
         AND ($2 OR EXISTS (
           SELECT 1 FROM group_members gm WHERE gm.group_id = COALESCE(p.group_id, msg.group_id)
             AND gm.member_id = $3 AND gm.is_admin = true))
       ORDER BY r.created_at DESC LIMIT 50`,
      [member.instanceId, isMod, member.id],
    );
    return { reports: res.rows };
  });

  /** Act on a report: remove (archive) content, dismiss, or escalate to
   *  school moderators. Every action lands in the audit trail (2.6 gate). */
  app.post("/v1/reports/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = decisionBody.parse(request.body);
    const rep = await pool.query<{ post_id: string | null; message_id: string | null; status: string }>(
      "SELECT post_id, message_id, status FROM reports WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const r = rep.rows[0];
    if (!r) return reply.status(404).send({ error: "Report not found." });

    const isSchoolMod = requireDutyRole(member);
    let isGroupAdmin = false;
    if (r.post_id !== null) {
      const g = await pool.query<{ group_id: string | null }>("SELECT group_id FROM activity_posts WHERE id = $1", [r.post_id]);
      if (g.rows[0]?.group_id !== null) {
        const am = await pool.query("SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2 AND is_admin = true", [g.rows[0]!.group_id, member.id]);
        isGroupAdmin = am.rows.length > 0;
      }
    } else {
      const g = await pool.query<{ group_id: string | null }>("SELECT group_id FROM messages WHERE id = $1", [r.message_id]);
      if (g.rows[0]?.group_id !== null) {
        const am = await pool.query("SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2 AND is_admin = true", [g.rows[0]!.group_id, member.id]);
        isGroupAdmin = am.rows.length > 0;
      }
    }
    if (!isSchoolMod && !isGroupAdmin) return reply.status(403).send({ error: "Group admins or school moderators only." });
    if (body.decision === "escalate" && !isGroupAdmin && !isSchoolMod) {
      return reply.status(403).send({ error: "Group admins or school moderators escalate." });
    }

    if (body.decision === "remove-content") {
      if (r.post_id !== null) {
        await pool.query("UPDATE activity_posts SET archived_at = now() WHERE id = $1", [r.post_id]);
      } else {
        await pool.query("UPDATE messages SET deleted_at = now(), body = NULL WHERE id = $1", [r.message_id]);
      }
    }
    const status = body.decision === "remove-content" || body.decision === "dismiss" ? "resolved" : "escalated";
    await pool.query(
      "UPDATE reports SET status = $1, handled_by = $2, resolution = $3 WHERE id = $4",
      [status, member.id, body.resolution ?? null, id],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'moderation.decision',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ decision: body.decision, resolution: body.resolution ?? null })],
    );
    return { ok: true, status };
  });

  /** Restore archived content within the 30-day reversal window (N2). */
  app.post("/v1/reports/:id/undo", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "School moderators only." });
    const { id } = request.params as { id: string };
    const rep = await pool.query<{ post_id: string | null; message_id: string | null }>(
      "SELECT post_id, message_id FROM reports WHERE id = $1 AND instance_id = $2 AND status = 'resolved'",
      [id, member.instanceId],
    );
    const r = rep.rows[0];
    if (!r) return reply.status(404).send({ error: "Resolved report not found." });
    const audit = await pool.query<{ reversible_until: Date }>(
      "SELECT reversible_until FROM audit_log WHERE action = 'moderation.decision' AND target = $1 ORDER BY created_at DESC LIMIT 1",
      [id],
    );
    const windowEnd = audit.rows[0]?.reversible_until;
    if (windowEnd === undefined || new Date(windowEnd) < new Date()) {
      return reply.status(403).send({ error: "The 30-day reversal window has passed." });
    }
    if (r.post_id !== null) await pool.query("UPDATE activity_posts SET archived_at = NULL WHERE id = $1", [r.post_id]);
    else await pool.query("UPDATE messages SET deleted_at = NULL WHERE id = $1", [r.message_id]);
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'moderation.undo',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ undone: true })],
    );
    return { ok: true };
  });
}
