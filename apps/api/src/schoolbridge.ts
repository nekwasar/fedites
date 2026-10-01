/**
 * The School Bridge (Phase 5 batch 4, session 5.4a): the school posts needs,
 * alumni fund or fulfil them. Wishlist (fund/fulfil), adopt-a-project (sets
 * sponsor renovations — progress posts loop back into the Feed per spec §8),
 * past questions bank, teacher tributes, facility booking (admin-approved
 * rentals), records verification (employer requests, admin-verified, §P
 * privacy: member content never public). Archived not deleted (N1).
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";
import { z } from "zod";

export async function schoolBridgeRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<import("@fedites/config").InstanceConfig> },
): Promise<void> {
  const { pool } = opts;

  /* ------------------------------ wishlist ----------------------------- */

  app.get("/v1/bridge/wishlist", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; details: string | null; est_cost_minor: string | null; currency: string | null; status: string; fulfil_note: string | null }>(
      `SELECT id, title, details, est_cost_minor::text, currency, status, fulfil_note
       FROM wishlist_items WHERE instance_id = $1 AND status <> 'closed'
       ORDER BY (CASE status WHEN 'open' THEN 0 ELSE 1 END), created_at DESC LIMIT 100`,
      [member.instanceId],
    );
    return { items: res.rows.map((r) => ({ id: r.id, title: r.title, details: r.details, estCostMinor: r.est_cost_minor !== null ? Number(r.est_cost_minor) : null, currency: r.currency, status: r.status, fulfilNote: r.fulfil_note })) };
  });

  /** Duty admins post school needs (mvp §9). */
  app.post("/v1/manage/bridge/wishlist", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zWishlistItem.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO wishlist_items (instance_id, title, details, est_cost_minor, currency)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, body.title, body.details ?? null, body.estCostMinor ?? null, body.estCostMinor !== undefined ? (body.currency ?? "NGN") : null],
    );
    return { id: res.rows[0]!.id };
  });

  /** Alumni either fund or physically fulfil (mvp §9). */
  app.post("/v1/bridge/wishlist/:id/fulfil", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zWishlistFulfil.parse(request.body ?? {});
    const res = await pool.query(
      `UPDATE wishlist_items SET status = $1, funded_by = $2, fulfil_note = $3
       WHERE id = $4 AND instance_id = $5 AND status = 'open' RETURNING id`,
      [body.physical === true ? "fulfilled" : "funded", member.id, body.note ?? null, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Open item not found." });
    return { ok: true };
  });

  /* --------------------------- adopt-a-project ------------------------- */

  app.get("/v1/bridge/projects", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; story: string | null; goal_minor: string; currency: string; sponsored_by: string | null; status: string; progress_notes: string | null; raised: string }>(
      `SELECT p.id, p.title, p.story, p.goal_minor::text, p.currency, p.sponsored_by, p.status, p.progress_notes,
              COALESCE((SELECT sum(l.amount_minor) FROM ledger_entries l WHERE l.campaign_id = p.id AND l.status = 'confirmed'), 0)::text AS raised
       FROM adopt_a_projects p WHERE p.status <> 'closed'
       ORDER BY (CASE p.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END), p.created_at DESC LIMIT 50`,
      [],
    );
    return {
      projects: res.rows.map((r) => ({
        id: r.id, title: r.title, story: r.story, goalMinor: Number(r.goal_minor), currency: r.currency,
        sponsoredBy: r.sponsored_by, status: r.status, progressNotes: r.progress_notes, raisedMinor: Number(r.raised),
      })),
    };
  });

  app.post("/v1/manage/bridge/projects", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zProject.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO adopt_a_projects (instance_id, title, story, goal_minor, currency, sponsored_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.title, body.story ?? null, body.goalMinor, body.currency, body.sponsoredBy ?? null],
    );
    return { id: res.rows[0]!.id };
  });

  app.post("/v1/manage/bridge/projects/:id/progress", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zProjectProgress.parse(request.body);
    await pool.query(
      `UPDATE adopt_a_projects SET status = $1, progress_notes = $2 WHERE id = $3 AND instance_id = $4`,
      [body.status, body.notes ?? null, id, member.instanceId],
    );
    return { ok: true };
  });

  /* -------------------------- past questions --------------------------- */

  app.get("/v1/bridge/past-questions", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { subject } = request.query as { subject?: string };
    const res = await pool.query<{ id: string; subject: string; year: number | null; title: string | null; media_id: string }>(
      `SELECT id, subject, year, title, media_id FROM past_questions
       WHERE instance_id = $1 AND archived_at IS NULL AND ($2::text IS NULL OR LOWER(subject) = LOWER($2))
       ORDER BY year DESC NULLS LAST, subject LIMIT 200`,
      [member.instanceId, subject ?? null],
    );
    return { questions: res.rows };
  });

  app.post("/v1/manage/bridge/past-questions", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zPastQuestion.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO past_questions (instance_id, subject, year, title, media_id, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.subject, body.year ?? null, body.title ?? null, body.mediaId, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /* -------------------------- teacher tributes ------------------------- */

  app.get("/v1/bridge/teacher-tributes", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ teacher_name: string; story: string; media_id: string | null; submitted_by_name: string; created_at: Date }>(
      `SELECT t.teacher_name, t.story, t.media_id, m.display_name AS submitted_by_name, t.created_at
       FROM teacher_tributes t JOIN members m ON m.id = t.submitted_by
       WHERE t.instance_id = $1 AND t.archived_at IS NULL ORDER BY t.created_at DESC LIMIT 200`,
      [member.instanceId],
    );
    return { tributes: res.rows };
  });

  app.post("/v1/bridge/teacher-tributes", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zTributeCreate.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO teacher_tributes (instance_id, teacher_name, story, media_id, submitted_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, body.teacherName, body.story, body.mediaId ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /* --------------------------- facility booking ------------------------ */

  app.get("/v1/bridge/bookings", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; member_name: string; facility: string; starts_at: Date; ends_at: Date; purpose: string | null; status: string }>(
      `SELECT b.id, m.display_name AS member_name, b.facility, b.starts_at, b.ends_at, b.purpose, b.status
       FROM facility_bookings b JOIN members m ON m.id = b.member_id
       WHERE b.instance_id = $1 AND b.status IN ('requested','approved')
         AND (b.member_id = $2 OR $3)
       ORDER BY b.starts_at DESC LIMIT 100`,
      [member.instanceId, member.id, requireDutyRole(member)],
    );
    return { bookings: res.rows.map((r) => ({ id: r.id, memberName: r.member_name, facility: r.facility, startsAt: r.starts_at, endsAt: r.ends_at, purpose: r.purpose, status: r.status })) };
  });

  /** Verified alumni rent halls/fields; admins approve (mvp §9). */
  app.post("/v1/bridge/bookings", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zBooking.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO facility_bookings (instance_id, member_id, facility, starts_at, ends_at, purpose)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, member.id, body.facility, body.startsAt, body.endsAt, body.purpose ?? null],
    );
    return { id: res.rows[0]!.id, status: "requested" };
  });

  app.post("/v1/manage/bridge/bookings/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zBookingDecision.parse(request.body);
    const res = await pool.query(
      `UPDATE facility_bookings SET status = $1, decided_by = $2
       WHERE id = $3 AND instance_id = $4 AND status = 'requested' RETURNING id`,
      [body.decision === "approve" ? "approved" : "declined", member.id, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Requested booking not found." });
    return { ok: true };
  });

  /* ------------------------ records verification ----------------------- */

  app.get("/v1/bridge/records", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; employer_name: string; employer_email: string; status: string; decided_at: Date | null }>(
      `SELECT id, employer_name, employer_email, status, decided_at FROM records_verifications
       WHERE instance_id = $1 AND member_id = $2 ORDER BY created_at DESC`,
      [member.instanceId, member.id],
    );
    return { requests: res.rows.map((r) => ({ id: r.id, employerName: r.employer_name, employerEmail: r.employer_email, status: r.status, decidedAt: r.decided_at })) };
  });

  /** Member requests official verification for an employer (mvp §9). */
  app.post("/v1/bridge/records", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zRecordsRequest.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO records_verifications (instance_id, member_id, employer_name, employer_email)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [member.instanceId, member.id, body.employerName, body.employerEmail],
    );
    return { id: res.rows[0]!.id, status: "requested" };
  });

  app.get("/v1/manage/bridge/records", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; member_name: string; employer_name: string; employer_email: string; status: string }>(
      `SELECT r.id, m.display_name AS member_name, r.employer_name, r.employer_email, r.status
       FROM records_verifications r JOIN members m ON m.id = r.member_id
       WHERE r.instance_id = $1 AND r.status = 'requested' ORDER BY r.created_at`,
      [member.instanceId],
    );
    return { requests: res.rows };
  });

  app.post("/v1/manage/bridge/records/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zRecordsDecision.parse(request.body);
    const res = await pool.query(
      `UPDATE records_verifications SET status = $1, decided_by = $2, decided_at = now()
       WHERE id = $3 AND instance_id = $4 AND status = 'requested' RETURNING id`,
      [body.decision === "verify" ? "verified" : "declined", member.id, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Requested verification not found." });
    return { ok: true };
  });
}

const zWishlistItem = z.object({
  title: z.string().min(2).max(160),
  details: z.string().max(1000).optional(),
  estCostMinor: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
});
const zWishlistFulfil = z.object({
  physical: z.boolean().optional(),
  note: z.string().max(500).optional(),
});
const zProject = z.object({
  title: z.string().min(2).max(160),
  story: z.string().max(2000).optional(),
  goalMinor: z.number().int().min(100),
  currency: z.string().length(3),
  sponsoredBy: z.string().max(80).optional(),
});
const zProjectProgress = z.object({
  status: z.enum(["open", "in_progress", "completed", "closed"]),
  notes: z.string().max(1000).optional(),
});
const zPastQuestion = z.object({
  subject: z.string().min(1).max(80),
  year: z.number().int().optional(),
  title: z.string().max(160).optional(),
  mediaId: z.string().uuid(),
});
const zTributeCreate = z.object({
  teacherName: z.string().min(2).max(120),
  story: z.string().min(10).max(3000),
  mediaId: z.string().uuid().optional(),
});
const zBooking = z.object({
  facility: z.string().min(2).max(120),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  purpose: z.string().max(500).optional(),
});
const zBookingDecision = z.object({ decision: z.enum(["approve", "decline"]) });
const zRecordsRequest = z.object({
  employerName: z.string().min(2).max(160),
  employerEmail: z.string().email(),
});
const zRecordsDecision = z.object({ decision: z.enum(["verify", "decline"]) });
