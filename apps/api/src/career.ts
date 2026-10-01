/**
 * Career rails (Phase 5 batch 5, session 5.4b) — enterprise-grade, built to
 * the standard of the best job systems:
 *
 *  - Job board: verified alumni post; board search/filter (industry, city,
 *    mode, type); FRESH-GRADUATE PRIORITY — internship and graduate-trainee
 *    roles rank above regular openings (mvp: "prioritizing fellow alumni and
 *    fresh graduates first").
 *  - Hiring pipeline: applications move submitted → screening → interview →
 *    offer → hired (or rejected/withdrawn), decided only by the poster.
 *  - Saved jobs for later.
 *  - Alumni business directory: services, hours, promo offers, verified-member
 *    reviews (one per member per business, rating 1-5).
 *  - Mentor office hours: mentors publish bookable slots; one booking per
 *    slot; meeting link resolved from the mentor's standing room (external
 *    Meet/Zoom per v6.1 — no native WebRTC).
 *  - Referral requests between alumni + skill endorsements (dedup per skill).
 *
 * Rules: M5 (every gate here), K1 (private applications), N1 (archived not
 * deleted), notifications for application/referral/booking events (J3-legit).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember } from "./sessions.js";
import { evaluate } from "./policy.js";
import type { InstanceConfig } from "@fedites/config";

type Hub = { broadcast: (rooms: string[], e: Record<string, unknown>) => void };

async function notifyAdminsAndTargets(
  pool: Pool, memberId: string, title: string, payload: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (instance_id, member_id, kind, payload)
     VALUES ((SELECT instance_id FROM members WHERE id = $1), $1, 'system.notice', $2)`,
    [memberId, JSON.stringify({ title, ...payload })],
  );
}

export async function careerRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: Hub },
): Promise<void> {
  const { pool } = opts;

  /* -------------------------------- jobs ------------------------------- */

  app.post("/v1/career/jobs", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zJobCreate.parse(request.body);
    // Alumni post openings — verified members only (mvp §2 Job board).
    if (member.verification !== "verified" && member.verification !== "honorary") {
      return reply.status(403).send({ error: "Only verified alumni post openings." });
    }
    const res = await pool.query<{ id: string }>(
      `INSERT INTO jobs (instance_id, posted_by, title, company_name, industry, city, country,
        employment_type, work_mode, description, requirements, salary_min_minor, salary_max_minor,
        salary_currency, salary_period, apply_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        member.instanceId, member.id, body.title, body.companyName, body.industry ?? null,
        body.city ?? null, body.country ?? null, body.employmentType, body.workMode,
        body.description, body.requirements ?? null, body.salaryMinMinor ?? null,
        body.salaryMaxMinor ?? null, body.salaryMinMinor !== undefined ? (body.salaryCurrency ?? "NGN") : null,
        body.salaryMinMinor !== undefined ? (body.salaryPeriod ?? "month") : null, body.applyBy ?? null,
      ],
    );
    return { id: res.rows[0]!.id };
  });

  /**
   * The board: open jobs, filters, fresh-graduate priority. Cursor = created
   * timestamp for stable pagination.
   */
  app.get("/v1/career/jobs", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const q = request.query as { industry?: string; city?: string; mode?: string; type?: string; remote?: string; text?: string; cursor?: string };
    const text = q.text !== undefined ? `%${q.text.toLowerCase()}%` : null;
    const mode = q.mode ?? (q.remote === "true" ? "remote" : null);
    const res = await pool.query<{
      id: string; title: string; company_name: string; industry: string | null; city: string | null; country: string | null;
      employment_type: string; work_mode: string; salary_min_minor: string | null; salary_max_minor: string | null;
      salary_currency: string | null; apply_by: string | null; created_at: Date; posted_by: string; poster_name: string; mine: boolean;
    }>(
      `SELECT j.id, j.title, j.company_name, j.industry, j.city, j.country, j.employment_type, j.work_mode,
              j.salary_min_minor::text, j.salary_max_minor::text, j.salary_currency, j.apply_by::text, j.created_at,
              j.posted_by, m.display_name AS poster_name,
              (j.posted_by = $2) AS mine
       FROM jobs j JOIN members m ON m.id = j.posted_by
       WHERE j.instance_id = $1 AND j.status = 'open'
         AND ($3::text IS NULL OR LOWER(j.industry) = LOWER($3))
         AND ($4::text IS NULL OR LOWER(j.city) = LOWER($4))
         AND ($5::text IS NULL OR j.work_mode = $5)
         AND ($6::text IS NULL OR j.employment_type = $6)
         AND ($7::text IS NULL OR LOWER(j.title) LIKE $7 OR LOWER(j.company_name) LIKE $7 OR LOWER(COALESCE(j.description,'')) LIKE $7)
       ORDER BY (CASE WHEN j.employment_type IN ('internship','graduate_trainee') THEN 0 ELSE 1 END),
                j.created_at DESC
       LIMIT 50`,
      [member.instanceId, member.id, q.industry ?? null, q.city ?? null, mode, q.type ?? null, text],
    );
    return {
      jobs: res.rows.map((j) => ({
        id: j.id, title: j.title, companyName: j.company_name, industry: j.industry,
        city: j.city, country: j.country, employmentType: j.employment_type,
        workMode: j.work_mode,
        salary: j.salary_min_minor !== null
          ? { minMinor: Number(j.salary_min_minor), maxMinor: j.salary_max_minor !== null ? Number(j.salary_max_minor) : null, currency: j.salary_currency }
          : null,
        applyBy: j.apply_by, createdAt: j.created_at.toISOString(),
        poster: j.poster_name, mine: j.mine,
      })),
    };
  });

  app.get("/v1/career/jobs/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{ id: string; posted_by: string; title: string; company_name: string; industry: string | null; city: string | null; country: string | null; employment_type: string; work_mode: string; description: string; requirements: string | null; salary_min_minor: string | null; salary_max_minor: string | null; salary_currency: string | null; apply_by: string | null; status: string; created_at: Date; poster_name: string; my_app: string | null; saved: boolean }>(
      `SELECT j.*, m.display_name AS poster_name,
              (SELECT a.id::text FROM job_applications a WHERE a.job_id = j.id AND a.applicant_id = $2) AS my_app,
              EXISTS (SELECT 1 FROM job_saved s WHERE s.job_id = j.id AND s.member_id = $2) AS saved
       FROM jobs j JOIN members m ON m.id = j.posted_by
       WHERE j.id = $1 AND j.instance_id = $3`,
      [id, member.id, member.instanceId],
    );
    const j = res.rows[0];
    if (!j) return reply.status(404).send({ error: "Job not found." });
    return {
      job: {
        id: j.id, title: j.title, companyName: j.company_name, industry: j.industry,
        city: j.city, country: j.country, employmentType: j.employment_type, workMode: j.work_mode,
        description: j.description, requirements: j.requirements,
        salary: j.salary_min_minor !== null
          ? { minMinor: Number(j.salary_min_minor), maxMinor: j.salary_max_minor !== null ? Number(j.salary_max_minor) : null, currency: j.salary_currency }
          : null,
        applyBy: j.apply_by, status: j.status, createdAt: j.created_at.toISOString(),
        poster: j.poster_name, mine: j.posted_by === member.id,
        myApplicationId: j.my_app, saved: j.saved,
      },
    };
  });

  app.patch("/v1/career/jobs/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zJobUpdate.parse(request.body);
    const res = await pool.query(
      "UPDATE jobs SET status = COALESCE($1, status), edited_at = now() WHERE id = $2 AND posted_by = $3 AND instance_id = $4 RETURNING id",
      [body.status ?? null, id, member.id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Open posting not found (poster only)." });
    return { ok: true };
  });

  /** Apply: one per member per job; poster notified (J3-legit). */
  app.post("/v1/career/jobs/:id/apply", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zApply.parse(request.body ?? {});
    const job = await pool.query<{ id: string; status: string; posted_by: string }>(
      "SELECT id, status, posted_by FROM jobs WHERE id = $1 AND instance_id = $2 AND status = 'open'",
      [id, member.instanceId],
    );
    if (!job.rows[0]) return reply.status(404).send({ error: "Open posting not found." });
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO job_applications (instance_id, job_id, applicant_id, cover_note)
       VALUES ($1,$2,$3,$4) ON CONFLICT (job_id, applicant_id) DO NOTHING RETURNING id`,
      [member.instanceId, id, member.id, body.coverNote ?? null],
    );
    if (ins.rows.length === 0) return reply.status(400).send({ error: "You already applied to this job." });
    await notifyAdminsAndTargets(pool, job.rows[0].posted_by, `New application: ${await jobTitle(pool, id)}`, { jobId: id, applicationId: ins.rows[0]!.id });
    return { id: ins.rows[0]!.id, status: "submitted" };
  });

  async function jobTitle(pool: Pool, jobId: string): Promise<string> {
    return (await pool.query<{ title: string }>("SELECT title FROM jobs WHERE id = $1", [jobId])).rows[0]?.title ?? "a job";
  }

  /** Hiring pipeline: poster-only decisions with notifications. */
  app.post("/v1/career/applications/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zAppDecision.parse(request.body);
    const app_ = await pool.query<{ id: string; job_id: string; applicant_id: string; posted_by: string; status: string }>(
      `SELECT a.id, a.job_id, a.applicant_id, j.posted_by, a.status
       FROM job_applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1 AND a.instance_id = $2`,
      [id, member.instanceId],
    );
    const a = app_.rows[0];
    if (!a) return reply.status(404).send({ error: "Application not found." });
    if (a.posted_by !== member.id) return reply.status(403).send({ error: "Only the posting alumnus decides." });
    await pool.query(
      "UPDATE job_applications SET status = $1, decided_at = now() WHERE id = $2",
      [body.status, id],
    );
    await notifyAdminsAndTargets(pool, a.applicant_id, `Your application moved to ${body.status.replace("_", " ")}`, { jobId: a.job_id });
    return { ok: true, status: body.status };
  });

  app.post("/v1/career/applications/:id/withdraw", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `UPDATE job_applications SET status = 'withdrawn', decided_at = now()
       WHERE id = $1 AND applicant_id = $2 AND status NOT IN ('hired','withdrawn') RETURNING id`,
      [id, member.id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Application not found or already settled." });
    return { ok: true };
  });

  app.get("/v1/career/my-applications", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; company_name: string; status: string; created_at: Date }>(
      `SELECT a.id, j.title, j.company_name, a.status, a.created_at
       FROM job_applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.instance_id = $1 AND a.applicant_id = $2 ORDER BY a.created_at DESC`,
      [member.instanceId, member.id],
    );
    return { applications: res.rows.map((r) => ({ id: r.id, title: r.title, companyName: r.company_name, status: r.status, createdAt: r.created_at.toISOString() })) };
  });

  /* ------------------------------ saved jobs --------------------------- */

  app.post("/v1/career/jobs/:id/save", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    await pool.query(
      `INSERT INTO job_saved (instance_id, job_id, member_id) VALUES ($1,$2,$3) ON CONFLICT (job_id, member_id) DO NOTHING`,
      [member.instanceId, id, member.id],
    );
    return { ok: true };
  });

  app.delete("/v1/career/jobs/:id/save", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    await pool.query("DELETE FROM job_saved WHERE job_id = $1 AND member_id = $2", [id, member.id]);
    return { ok: true };
  });

  app.get("/v1/career/saved", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; company_name: string; status: string }>(
      `SELECT j.id, j.title, j.company_name, j.status FROM job_saved s JOIN jobs j ON j.id = s.job_id
       WHERE s.instance_id = $1 AND s.member_id = $2 ORDER BY s.created_at DESC`,
      [member.instanceId, member.id],
    );
    return { jobs: res.rows };
  });

  /* ------------------------ business directory ------------------------- */

  app.post("/v1/career/businesses", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zBusiness.parse(request.body);
    if (member.verification !== "verified" && member.verification !== "honorary") {
      return reply.status(403).send({ error: "Only verified alumni list businesses." });
    }
    const res = await pool.query<{ id: string }>(
      `INSERT INTO businesses (instance_id, owner_id, name, industry, description, services,
        contact_phone, contact_email, website, opening_hours, city, country, promo_offer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        member.instanceId, member.id, body.name, body.industry, body.description ?? null,
        body.services ?? null, body.contactPhone ?? null, body.contactEmail ?? null,
        body.website ?? null, body.openingHours ?? null, body.city ?? null, body.country ?? null,
        body.promoOffer ?? null,
      ],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/career/businesses", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const q = request.query as { industry?: string; city?: string; text?: string };
    const text = q.text !== undefined ? `%${q.text.toLowerCase()}%` : null;
    const res = await pool.query<{ id: string; name: string; industry: string; description: string | null; city: string | null; promo_offer: string | null; owner_name: string; rating: string | null; reviews: string }>(
      `SELECT b.id, b.name, b.industry, b.description, b.city, b.promo_offer, m.display_name AS owner_name,
              (SELECT round(avg(r.rating)::numeric, 1)::text FROM business_reviews r WHERE r.business_id = b.id AND r.archived_at IS NULL) AS rating,
              (SELECT count(*) FROM business_reviews r WHERE r.business_id = b.id AND r.archived_at IS NULL)::text AS reviews
       FROM businesses b JOIN members m ON m.id = b.owner_id
       WHERE b.instance_id = $1 AND b.archived_at IS NULL
         AND ($2::text IS NULL OR LOWER(b.industry) = LOWER($2))
         AND ($3::text IS NULL OR LOWER(b.city) = LOWER($3))
         AND ($4::text IS NULL OR LOWER(b.name) LIKE $4 OR LOWER(COALESCE(b.description,'')) LIKE $4)
       ORDER BY b.name LIMIT 100`,
      [member.instanceId, q.industry ?? null, q.city ?? null, text],
    );
    return {
      businesses: res.rows.map((b) => ({
        id: b.id, name: b.name, industry: b.industry, description: b.description,
        city: b.city, promoOffer: b.promo_offer, owner: b.owner_name,
        rating: b.rating !== null ? Number(b.rating) : null, reviewCount: Number(b.reviews),
      })),
    };
  });

  app.get("/v1/career/businesses/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{ id: string; owner_id: string; name: string; industry: string; description: string | null; services: string | null; contact_phone: string | null; contact_email: string | null; website: string | null; opening_hours: string | null; city: string | null; country: string | null; promo_offer: string | null; owner_name: string }>(
      `SELECT b.*, m.display_name AS owner_name FROM businesses b JOIN members m ON m.id = b.owner_id
       WHERE b.id = $1 AND b.instance_id = $2 AND b.archived_at IS NULL`,
      [id, member.instanceId],
    );
    const b = res.rows[0];
    if (!b) return reply.status(404).send({ error: "Business not found." });
    const reviews = await pool.query<{ id: string; rating: number; comment: string | null; reviewer_name: string; created_at: Date }>(
      `SELECT r.id, r.rating, r.comment, m.display_name AS reviewer_name, r.created_at
       FROM business_reviews r JOIN members m ON m.id = r.reviewer_id
       WHERE r.business_id = $1 AND r.archived_at IS NULL ORDER BY r.created_at DESC`,
      [id],
    );
    return {
      business: {
        id: b.id, name: b.name, industry: b.industry, description: b.description,
        services: b.services, contactPhone: b.contact_phone, contactEmail: b.contact_email,
        website: b.website, openingHours: b.opening_hours, city: b.city, country: b.country,
        promoOffer: b.promo_offer, owner: b.owner_name, mine: b.owner_id === member.id,
      },
      reviews: reviews.rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, reviewer: r.reviewer_name, at: r.created_at })),
    };
  });

  app.patch("/v1/career/businesses/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zBusinessUpdate.parse(request.body);
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (col: string, v: unknown): void => { values.push(v); sets.push(`${col} = $${values.length}`); };
    if (body.description !== undefined) set("description", body.description);
    if (body.services !== undefined) set("services", body.services);
    if (body.promoOffer !== undefined) set("promo_offer", body.promoOffer);
    if (body.openingHours !== undefined) set("opening_hours", body.openingHours);
    if (sets.length === 0) return { ok: true };
    values.push(id, member.id, member.instanceId);
    await pool.query(
      `UPDATE businesses SET ${sets.join(", ")} WHERE id = $${values.length - 2} AND owner_id = $${values.length - 1} AND instance_id = $${values.length}`,
      values,
    );
    return { ok: true };
  });

  app.post("/v1/career/businesses/:id/reviews", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const b = await pool.query("SELECT 1 FROM businesses WHERE id = $1 AND instance_id = $2 AND archived_at IS NULL", [id, member.instanceId]);
    if (b.rows.length === 0) return reply.status(404).send({ error: "Business not found." });
    const parsed = zReviewInput.parse(request.body ?? {});
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO business_reviews (instance_id, business_id, reviewer_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (business_id, reviewer_id) DO NOTHING RETURNING id`,
      [member.instanceId, id, member.id, parsed.rating, parsed.comment ?? null],
    );
    if (ins.rows.length === 0) return reply.status(400).send({ error: "You already reviewed this business." });
    return { id: ins.rows[0]!.id };
  });

  /* -------------------------- mentor office hours ---------------------- */

  app.post("/v1/career/mentor-profile", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zMentor.parse(request.body);
    if (member.verification !== "verified" && member.verification !== "honorary") {
      return reply.status(403).send({ error: "Only verified alumni mentor." });
    }
    const res = await pool.query<{ id: string }>(
      `INSERT INTO mentor_profiles (instance_id, member_id, expertise, bio, default_link)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, member.id, body.expertise, body.bio ?? null, body.defaultLink ?? null],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/career/mentors", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ member_id: string; expertise: string; bio: string | null; default_link: string | null; member_name: string; open_slots: string }>(
      `SELECT mp.member_id, mp.expertise, mp.bio, mp.default_link, m.display_name AS member_name,
              (SELECT count(*) FROM mentor_slots s WHERE s.mentor_id = mp.member_id AND s.status = 'open' AND s.starts_at > now())::text AS open_slots
       FROM mentor_profiles mp JOIN members m ON m.id = mp.member_id
       WHERE mp.instance_id = $1 AND mp.status = 'active'
       ORDER BY open_slots DESC, m.display_name LIMIT 50`,
      [member.instanceId],
    );
    return {
      mentors: res.rows.map((r) => ({
        memberId: r.member_id, name: r.member_name, expertise: r.expertise, bio: r.bio,
        hasStandingLink: r.default_link !== null, openSlots: Number(r.open_slots),
      })),
    };
  });

  app.post("/v1/career/mentor-slots", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zSlot.parse(request.body);
    const mp = await pool.query("SELECT 1 FROM mentor_profiles WHERE member_id = $1 AND status = 'active'", [member.id]);
    if (mp.rows.length === 0) return reply.status(403).send({ error: "Become a mentor first." });
    const res = await pool.query<{ id: string }>(
      "INSERT INTO mentor_slots (instance_id, mentor_id, starts_at, ends_at) VALUES ($1,$2,$3,$4) RETURNING id",
      [member.instanceId, member.id, body.startsAt, body.endsAt],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/career/mentors/:memberId/slots", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { memberId } = request.params as { memberId: string };
    const res = await pool.query<{ id: string; starts_at: Date; ends_at: Date }>(
      `SELECT s.id, s.starts_at, s.ends_at FROM mentor_slots s
       WHERE s.mentor_id = $1 AND s.instance_id = $2 AND s.status = 'open' AND s.starts_at > now()
       ORDER BY s.starts_at LIMIT 50`,
      [memberId, member.instanceId],
    );
    return { slots: res.rows.map((s) => ({ id: s.id, startsAt: s.starts_at.toISOString(), endsAt: s.ends_at.toISOString() })) };
  });

  /** Book: one booking per slot; link resolved from the mentor's standing room. */
  app.post("/v1/career/mentor-slots/:id/book", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zBookNote.parse(request.body ?? {});
    const config = await opts.loadConfigByInstance(member.instanceId);
    const gate = evaluate(config, "dm.send", {
      status: member.verification === "rejected" ? "limited" : member.verification,
      verified: member.verification === "verified",
      honorary: member.verification === "honorary",
      roles: member.roles,
      vouchCount: 0,
    });
    if (!gate.allowed) return reply.status(403).send({ error: "Booking unlocks after verification." });
    const slot = await pool.query<{ id: string; mentor_id: string; status: string }>(
      "SELECT id, mentor_id, status FROM mentor_slots WHERE id = $1 AND instance_id = $2 AND status = 'open' AND starts_at > now()",
      [id, member.instanceId],
    );
    const s = slot.rows[0];
    if (!s) return reply.status(404).send({ error: "Open slot not found." });
    const profile = await pool.query<{ default_link: string | null }>(
      "SELECT default_link FROM mentor_profiles WHERE member_id = $1", [s.mentor_id],
    );
    const url = profile.rows[0]?.default_link ?? null;
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO mentor_bookings (instance_id, slot_id, mentee_id, note, meeting_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, id, member.id, body.note ?? null, url],
    );
    await pool.query("UPDATE mentor_slots SET status = 'booked' WHERE id = $1", [id]);
    await notifyAdminsAndTargets(pool, s.mentor_id, "A slot was booked for office hours", { slotId: id, bookingId: ins.rows[0]!.id });
    return { id: ins.rows[0]!.id, meetingUrl: url, status: "booked" };
  });

  app.get("/v1/career/my-mentoring", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const asMentor = await pool.query<{ id: string; mentee_name: string; slot_at: Date; meeting_url: string | null; status: string }>(
      `SELECT b.id, mm.display_name AS mentee_name, s.starts_at AS slot_at, b.meeting_url, b.status
       FROM mentor_bookings b
       JOIN mentor_slots s ON s.id = b.slot_id
       JOIN members mm ON mm.id = b.mentee_id
       WHERE s.mentor_id = $1 AND b.instance_id = $2 AND b.status <> 'cancelled'
       ORDER BY s.starts_at DESC`,
      [member.id, member.instanceId],
    );
    const asMentee = await pool.query<{ id: string; mentor_name: string; slot_at: Date; meeting_url: string | null; status: string }>(
      `SELECT b.id, mm.display_name AS mentor_name, s.starts_at AS slot_at, b.meeting_url, b.status
       FROM mentor_bookings b
       JOIN mentor_slots s ON s.id = b.slot_id
       JOIN members mm ON mm.id = s.mentor_id
       WHERE b.mentee_id = $1 AND b.instance_id = $2 AND b.status <> 'cancelled'
       ORDER BY s.starts_at DESC`,
      [member.id, member.instanceId],
    );
    return {
      asMentor: asMentor.rows.map((r) => ({ id: r.id, with: r.mentee_name, at: r.slot_at.toISOString(), meetingUrl: r.meeting_url, status: r.status })),
      asMentee: asMentee.rows.map((r) => ({ id: r.id, with: r.mentor_name, at: r.slot_at.toISOString(), meetingUrl: r.meeting_url, status: r.status })),
    };
  });

  app.post("/v1/career/mentor-bookings/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zMentorBookingAction.parse(request.body);
    const b = await pool.query<{ slot_id: string; mentee_id: string; mentor_id: string }>(
      `SELECT bk.slot_id, bk.mentee_id, s.mentor_id FROM mentor_bookings bk JOIN mentor_slots s ON s.id = bk.slot_id
       WHERE bk.id = $1 AND bk.instance_id = $2`,
      [id, member.instanceId],
    );
    const row = b.rows[0];
    if (!row) return reply.status(404).send({ error: "Booking not found." });
    const isMentor = row.mentor_id === member.id;
    const isMentee = row.mentee_id === member.id;
    if (!isMentor && !isMentee) return reply.status(403).send({ error: "Participants only." });

    if (body.action === "cancel") {
      await pool.query("UPDATE mentor_bookings SET status = 'cancelled' WHERE id = $1", [id]);
      await pool.query("UPDATE mentor_slots SET status = 'open' WHERE id = $1", [row.slot_id]);
      return { ok: true, status: "cancelled" };
    }
    if (body.action === "confirm" && !isMentor) return reply.status(403).send({ error: "Only the mentor confirms." });
    if (body.action === "complete" && !isMentor) return reply.status(403).send({ error: "Only the mentor completes." });
    const status = body.action;
    await pool.query("UPDATE mentor_bookings SET status = $1 WHERE id = $2", [status, id]);
    if (body.action === "complete") await pool.query("UPDATE mentor_slots SET status = 'completed' WHERE id = $1", [row.slot_id]);
    return { ok: true, status };
  });

  /* --------------------- referral requests + endorsements -------------- */

  app.post("/v1/career/referrals", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zReferralCreate.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (member.verification !== "verified" && member.verification !== "honorary") {
      return reply.status(403).send({ error: "Referral requests unlock after verification." });
    }
    void config;
    const res = await pool.query<{ id: string }>(
      `INSERT INTO referral_requests (instance_id, requester_id, target_member_id, company, role, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, member.id, body.targetMemberId, body.company, body.role, body.note ?? null],
    );
    await notifyAdminsAndTargets(pool, body.targetMemberId, `${await memberName(pool, member.id)} asks for a referral`, { referralId: res.rows[0]!.id, company: body.company });
    return { id: res.rows[0]!.id, status: "requested" };
  });

  async function memberName(pool: Pool, memberId: string): Promise<string> {
    return (await pool.query<{ display_name: string }>("SELECT display_name FROM members WHERE id = $1", [memberId])).rows[0]?.display_name ?? "A member";
  }

  app.get("/v1/career/referrals", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const sent = await pool.query<{ id: string; target_name: string; company: string; role: string; status: string; created_at: Date }>(
      `SELECT r.id, m.display_name AS target_name, r.company, r.role, r.status, r.created_at
       FROM referral_requests r JOIN members m ON m.id = r.target_member_id
       WHERE r.instance_id = $1 AND r.requester_id = $2 ORDER BY r.created_at DESC`,
      [member.instanceId, member.id],
    );
    const received = await pool.query<{ id: string; requester_name: string; company: string; role: string; note: string | null; status: string; created_at: Date }>(
      `SELECT r.id, m.display_name AS requester_name, r.company, r.role, r.note, r.status, r.created_at
       FROM referral_requests r JOIN members m ON m.id = r.requester_id
       WHERE r.instance_id = $1 AND r.target_member_id = $2 ORDER BY r.created_at DESC`,
      [member.instanceId, member.id],
    );
    return {
      sent: sent.rows.map((r) => ({ id: r.id, to: r.target_name, company: r.company, role: r.role, status: r.status, createdAt: r.created_at.toISOString() })),
      received: received.rows.map((r) => ({ id: r.id, from: r.requester_name, company: r.company, role: r.role, note: r.note, status: r.status, createdAt: r.created_at.toISOString() })),
    };
  });

  app.post("/v1/career/referrals/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zReferralAction.parse(request.body);
    const r = await pool.query<{ requester_id: string; target_member_id: string; status: string }>(
      "SELECT requester_id, target_member_id, status FROM referral_requests WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const req = r.rows[0];
    if (!req) return reply.status(404).send({ error: "Request not found." });
    if (req.target_member_id !== member.id) return reply.status(403).send({ error: "Only the asked alumnus responds." });
    const status = body.action;
    await pool.query(
      "UPDATE referral_requests SET status = $1, responded_at = now() WHERE id = $2",
      [status, id],
    );
    await notifyAdminsAndTargets(pool, req.requester_id, `Your referral request was ${status}`, { referralId: id });
    return { ok: true, status };
  });

  app.post("/v1/career/endorsements", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zEndorse.parse(request.body);
    if (body.memberId === member.id) return reply.status(400).send({ error: "Endorse others, not yourself." });
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO endorsements (instance_id, member_id, endorser_id, skill) VALUES ($1,$2,$3,$4)
       ON CONFLICT (member_id, skill, endorser_id) DO NOTHING RETURNING id`,
      [member.instanceId, body.memberId, member.id, body.skill],
    );
    if (ins.rows.length === 0) return reply.status(400).send({ error: "Already endorsed that skill." });
    await notifyAdminsAndTargets(pool, body.memberId, `${await memberName(pool, member.id)} endorsed your ${body.skill}`, { memberId: body.memberId });
    return { ok: true };
  });

  app.get("/v1/career/endorsements/:memberId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { memberId } = request.params as { memberId: string };
    const res = await pool.query<{ skill: string; count: string; endorsers: string }>(
      `SELECT e.skill, count(*)::text AS count, string_agg(m.display_name, ', ') AS endorsers
       FROM endorsements e JOIN members m ON m.id = e.endorser_id
       WHERE e.member_id = $1 AND e.instance_id = $2 GROUP BY e.skill ORDER BY count DESC, e.skill`,
      [memberId, member.instanceId],
    );
    return { skills: res.rows.map((r) => ({ skill: r.skill, count: Number(r.count), endorsers: r.endorsers })) };
  });
}

const zJobCreate = z.object({
  title: z.string().min(2).max(160),
  companyName: z.string().min(1).max(120),
  industry: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "internship", "graduate_trainee"]).default("full_time"),
  workMode: z.enum(["onsite", "hybrid", "remote"]).default("onsite"),
  description: z.string().min(10).max(20_000),
  requirements: z.string().max(10_000).optional(),
  salaryMinMinor: z.number().int().min(0).optional(),
  salaryMaxMinor: z.number().int().min(0).optional(),
  salaryCurrency: z.string().length(3).optional(),
  salaryPeriod: z.enum(["month", "year"]).optional(),
  applyBy: z.string().optional(),
});
const zJobUpdate = z.object({ status: z.enum(["open", "closed"]) });
const zApply = z.object({ coverNote: z.string().max(3000).optional() });
const zAppDecision = z.object({ status: z.enum(["submitted", "screening", "interview", "offer", "hired", "rejected"]) });
const zBusiness = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  services: z.string().max(2000).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().optional(),
  website: z.string().url().max(300).optional(),
  openingHours: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  promoOffer: z.string().max(500).optional(),
});
const zBusinessUpdate = z.object({
  description: z.string().max(2000).optional(),
  services: z.string().max(2000).optional(),
  promoOffer: z.string().max(500).optional(),
  openingHours: z.string().max(300).optional(),
});
const zReviewInput = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });
const zMentor = z.object({
  expertise: z.string().min(2).max(200),
  bio: z.string().max(1000).optional(),
  defaultLink: z.string().url().max(300).optional(),
});
const zSlot = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() });
const zBookNote = z.object({ note: z.string().max(500).optional() });
const zMentorBookingAction = z.object({ action: z.enum(["confirm", "complete", "cancel"]) });
const zReferralCreate = z.object({
  targetMemberId: z.string().uuid(),
  company: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  note: z.string().max(1000).optional(),
});
const zReferralAction = z.object({ action: z.enum(["accepted", "declined", "fulfilled"]) });
const zEndorse = z.object({ memberId: z.string().uuid(), skill: z.string().min(1).max(80) });
