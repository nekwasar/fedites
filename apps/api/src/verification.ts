/**
 * Verification flow (1.2): invitation codes, admin approval queue, set
 * assignment, honorary accounts, setmate vouching.
 * §P: limited until 3 setmates identify or an admin overrides; vouching is
 * invisible after verification — voucher identity is never exposed to members.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { decisionBodySchema } from "@fedites/config";
import { requireMember, requireDutyRole } from "./sessions.js";

const vouchBody = z.object({ memberId: z.string().uuid() });

const inviteBody = z.object({
  setYear: z.number().int().optional(),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

const VOUCHES_REQUIRED = 3;

export async function verificationRoutes(
  app: FastifyInstance,
  opts: { pool: Pool },
): Promise<void> {
  const { pool } = opts;

  /* ------------------------- invite codes (mvp §1) ------------------------ */

  app.post("/v1/invites", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (member.verification !== "verified" && member.verification !== "honorary") {
      return reply.status(403).send({ error: "Only verified members can invite." });
    }
    const body = inviteBody.parse(request.body);
    let setId: string | null = null;
    if (body.setYear !== undefined) {
      const s = await pool.query<{ id: string }>("SELECT id FROM sets WHERE instance_id = $1 AND year = $2", [member.instanceId, body.setYear]);
      setId = s.rows[0]?.id ?? null;
      if (!setId) return reply.status(400).send({ error: "That set year does not exist." });
    }
    const code = randomBytes(5).toString("hex").toUpperCase();
    await pool.query(
      `INSERT INTO invite_codes (instance_id, code, created_by, expires_at) VALUES ($1,$2,$3, now() + ($4 || ' days')::interval)`,
      [member.instanceId, code, member.id, String(body.expiresInDays)],
    );
    return { code, expiresInDays: body.expiresInDays };
  });

  app.get("/v1/invites", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ code: string; used_at: Date | null; expires_at: Date | null; created_at: Date }>(
      `SELECT code, used_at, expires_at, created_at FROM invite_codes
       WHERE instance_id = $1 AND created_by = $2 ORDER BY created_at DESC LIMIT 25`,
      [member.instanceId, member.id],
    );
    return { invites: res.rows };
  });

  /* ---------------------------- admin queue ----------------------------- */

  app.get("/v1/verification/queue", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });

    const queue = await pool.query<{
      id: string; display_name: string; email: string; verification: string;
      set_year: number | null; vouch_count: number; created_at: Date;
    }>(
      `SELECT m.id, m.display_name, m.email, m.verification, s.year AS set_year, m.vouch_count, m.created_at
       FROM members m LEFT JOIN sets s ON s.id = m.set_id
       WHERE m.instance_id = $1 AND m.verification IN ('pending','limited')
       ORDER BY m.created_at`,
      [member.instanceId],
    );
    return { queue: queue.rows };
  });

  app.post("/v1/verification/decision", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = decisionBodySchema.parse(request.body);

    const targetRes = await pool.query<{ id: string; set_id: string | null; display_name: string; verification: string }>(
      "SELECT id, set_id, display_name, verification FROM members WHERE id = $1 AND instance_id = $2",
      [String((request.body as { memberId?: string }).memberId), member.instanceId],
    );
    const targetId = (request.body as { memberId?: string }).memberId;
    if (!targetId) return reply.status(400).send({ error: "memberId is required" });
    const target = targetRes.rows[0];
    if (!target) return reply.status(404).send({ error: "Member not found." });

    let setId = target.set_id;
    if (body.setYear !== undefined) {
      const s = await pool.query<{ id: string }>("SELECT id FROM sets WHERE instance_id = $1 AND year = $2", [member.instanceId, body.setYear]);
      if (!s.rows[0]) return reply.status(400).send({ error: "That set year does not exist." });
      setId = s.rows[0].id;
    }

    const status = body.decision === "activate" ? "limited" : body.decision === "verify" ? "verified" : body.decision === "honorary" ? "honorary" : "rejected";
    await pool.query(
      `UPDATE members SET verification = $1, set_id = $2, approved_by = $3, approved_at = now(),
         rejected_at = CASE WHEN $1 = 'rejected' THEN now() ELSE rejected_at END
       WHERE id = $4`,
      [status, setId, member.id, target.id],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'verification.decision',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, target.id, JSON.stringify({ decision: body.decision, setYear: body.setYear })],
    );

    const kind = body.decision === "reject" ? "verification.rejected" : body.decision === "activate" ? "verification.activated" : "verification.verified";
    await pool.query(
      `INSERT INTO notifications (instance_id, member_id, kind, payload)
       VALUES ($1,$2,$3,$4)`,
      [member.instanceId, target.id, kind, JSON.stringify({ by: member.displayName })],
    );
    return { ok: true, status };
  });

  /* ------------------------------- vouching ------------------------------ */

  app.get("/v1/verification/status", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ verification: string; vouch_count: number; set_year: number | null }>(
      `SELECT m.verification, m.vouch_count, s.year AS set_year
       FROM members m LEFT JOIN sets s ON s.id = m.set_id WHERE m.id = $1`,
      [member.id],
    );
    const row = res.rows[0];
    return {
      verification: row?.verification ?? member.verification,
      vouchCount: row?.vouch_count ?? 0,
      vouchesRequired: VOUCHES_REQUIRED,
      setYear: row?.set_year ?? null,
    };
  });

  app.post("/v1/verification/vouch", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (member.verification !== "verified" && member.verification !== "honorary") {
      return reply.status(403).send({ error: "Only verified members can identify new setmates." });
    }
    const body = vouchBody.parse(request.body);

    const targetRes = await pool.query<{ id: string; set_id: string | null; verification: string; vouch_count: number; display_name: string }>(
      "SELECT id, set_id, verification, vouch_count, display_name FROM members WHERE id = $1 AND instance_id = $2",
      [body.memberId, member.instanceId],
    );
    const target = targetRes.rows[0];
    if (!target) return reply.status(404).send({ error: "Member not found." });
    if (target.verification === "verified" || target.verification === "honorary") {
      return reply.status(400).send({ error: "That member is already verified." });
    }
    // Setmates identify their own (spec §11); the voucher must share the set.
    if (!target.set_id || target.set_id !== (await memberSetId(pool, member.id))) {
      return reply.status(403).send({ error: "Only setmates can identify a new member." });
    }
    if (target.id === member.id) return reply.status(400).send({ error: "You cannot vouch for yourself." });

    const inserted = await pool.query(
      `INSERT INTO vouches (instance_id, member_id, voucher_id) VALUES ($1,$2,$3)
       ON CONFLICT (instance_id, member_id, voucher_id) DO NOTHING RETURNING id`,
      [member.instanceId, target.id, member.id],
    );
    if (inserted.rows.length === 0) return reply.status(400).send({ error: "You already identified this member." });

    const updated = await pool.query<{ vouch_count: number }>(
      "UPDATE members SET vouch_count = vouch_count + 1 WHERE id = $1 RETURNING vouch_count",
      [target.id],
    );
    const count = updated.rows[0]?.vouch_count ?? 0;
    if (count >= VOUCHES_REQUIRED && target.verification !== "verified") {
      await pool.query(
        "UPDATE members SET verification = 'verified', approved_at = now() WHERE id = $1",
        [target.id],
      );
      await pool.query(
        `INSERT INTO notifications (instance_id, member_id, kind, payload)
         VALUES ($1,$2,'verification.verified',$3)`,
        [member.instanceId, target.id, JSON.stringify({ vouches: count })],
      );
    }
    return { ok: true, vouchCount: count, verified: count >= VOUCHES_REQUIRED };
  });
}

async function memberSetId(pool: Pool, memberId: string): Promise<string | null> {
  const res = await pool.query<{ set_id: string | null }>("SELECT set_id FROM members WHERE id = $1", [memberId]);
  return res.rows[0]?.set_id ?? null;
}
