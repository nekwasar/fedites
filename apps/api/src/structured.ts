/**
 * Structured giving (Phase 4 batch 3, session 4.4): P2P fundraisers with an
 * approval gate, pledge tracking with private nudges (K5), treasurer-approved
 * reimbursements, sponsorships with tiered recognition, scholarship
 * administration (endow → apply → screen → disburse), ledger publishing, and
 * tribute metadata on donations (§P: dues/tribute privacy respected).
 * Every confirmed flow writes to the one ledger (rail 5). M5: all gates here.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { getGateway } from "./payments.js";
import { requireMember, requireDutyRole } from "./sessions.js";
import { evaluate } from "./policy.js";
import { confirmIntent } from "./money.js";
import type { InstanceConfig } from "@fedites/config";

type Hub = { broadcast: (rooms: string[], e: Record<string, unknown>) => void };

async function moneyGate(member: { verification: "pending" | "limited" | "verified" | "honorary" | "rejected"; roles: string[] }, config: InstanceConfig): Promise<boolean> {
  const gate = evaluate(config, "money.pay", {
    status: member.verification === "rejected" ? "limited" : member.verification,
    verified: member.verification === "verified",
    honorary: member.verification === "honorary",
    roles: member.roles,
    vouchCount: 0,
  });
  return gate.allowed;
}

async function nextReceiptNo(pool: Pool, instanceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const res = await pool.query<{ last: string }>(
    `INSERT INTO receipt_counters (instance_id, year, last) VALUES ($1,$2,1)
     ON CONFLICT (instance_id, year) DO UPDATE SET last = receipt_counters.last + 1
     RETURNING last`,
    [instanceId, year],
  );
  return `RCPT-${year}-${String(res.rows[0]!.last).padStart(6, "0")}`;
}

export async function structuredRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: Hub },
): Promise<void> {
  const { pool } = opts;

  /* --------------------- P2P fundraisers (approval) -------------------- */

  /** Members create; admins approve before any money can flow. */
  app.post("/v1/money/p2p", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zP2pCreate.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Fundraising unlocks after verification." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO p2p_fundraisers (instance_id, creator_id, title, story, goal_minor, currency)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, member.id, body.title, body.story ?? null, body.goalMinor, body.currency],
    );
    return { id: res.rows[0]!.id, status: "pending" };
  });

  app.get("/v1/money/p2p", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; story: string | null; goal_minor: string; currency: string; status: string; raised: string; creator_name: string; creator_id: string }>(
      `SELECT f.id, f.title, f.story, f.goal_minor::text, f.currency, f.status,
              COALESCE((SELECT sum(l.amount_minor) FROM ledger_entries l WHERE l.p2p_id = f.id AND l.status = 'confirmed'), 0)::text AS raised,
              m.display_name AS creator_name, f.creator_id
       FROM p2p_fundraisers f JOIN members m ON m.id = f.creator_id
       WHERE f.instance_id = $1 AND f.status IN ('approved','pending','closed')
       ORDER BY f.created_at DESC LIMIT 50`,
      [member.instanceId],
    );
    return {
      fundraisers: res.rows.map((f) => ({
        id: f.id, title: f.title, story: f.story, status: f.status,
        goalMinor: Number(f.goal_minor), currency: f.currency, raisedMinor: Number(f.raised),
        creator: f.creator_name, mine: f.creator_id === member.id,
      })),
    };
  });

  app.get("/v1/manage/money/p2p", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; title: string; story: string | null; goal_minor: string; currency: string; creator_name: string; status: string }>(
      `SELECT f.id, f.title, f.story, f.goal_minor::text, f.currency, m.display_name AS creator_name, f.status
       FROM p2p_fundraisers f JOIN members m ON m.id = f.creator_id
       WHERE f.instance_id = $1 AND f.status = 'pending' ORDER BY f.created_at`,
      [member.instanceId],
    );
    return { pending: res.rows };
  });

  app.post("/v1/manage/money/p2p/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zDecision.parse(request.body);
    const status = body.decision === "approve" ? "approved" : "rejected";
    const res = await pool.query(
      "UPDATE p2p_fundraisers SET status = $1, decided_by = $2 WHERE id = $3 AND instance_id = $4 AND status = 'pending' RETURNING id",
      [status, member.id, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Pending fundraiser not found." });
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.p2p-decision',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ decision: body.decision })],
    );
    return { ok: true, status };
  });

  /** Give to an approved P2P fundraiser (same intent → confirm flow). */
  app.post("/v1/money/p2p/:id/donate", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zDonateMin.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Giving unlocks after verification." });
    const f = await pool.query("SELECT 1 FROM p2p_fundraisers WHERE id = $1 AND instance_id = $2 AND status = 'approved'", [id, member.instanceId]);
    if (f.rows.length === 0) return reply.status(404).send({ error: "Fundraiser not found or not approved." });
    const gateway = getGateway();
    const result = await gateway.initiate({ amountMinor: body.amountMinor, currency: body.currency, purpose: "p2p", memberRef: member.id });
    const intent = await pool.query<{ id: string }>(
      `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, provider, provider_ref, meta, status)
       VALUES ($1,$2,$3,$4,'p2p',$5,$6,$7,'awaiting_confirmation') RETURNING id`,
      [member.instanceId, member.id, body.amountMinor, body.currency, result.provider, result.providerRef, JSON.stringify({ p2pId: id, anonymous: body.anonymous ?? false })],
    );
    return { intentId: intent.rows[0]!.id, provider: result.provider, status: "awaiting_confirmation" };
  });

  /* --------------------------- pledge tracking ------------------------- */

  /** Record a promised contribution (own or by an admin on behalf). K5:
   *  pledges are private; nudges are polite and never public. */
  app.post("/v1/money/pledges", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zPledgeCreate.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Pledging unlocks after verification." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO pledges (instance_id, member_id, campaign_id, amount_minor, currency, due_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, member.id, body.campaignId ?? null, body.amountMinor, body.currency, body.dueDate ?? null],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/money/pledges", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; amount_minor: string; currency: string; status: string; promised_at: Date; due_date: string | null; campaign_title: string | null }>(
      `SELECT p.id, p.amount_minor::text, p.currency, p.status, p.promised_at, p.due_date::text, c.title AS campaign_title
       FROM pledges p LEFT JOIN campaigns c ON c.id = p.campaign_id
       WHERE p.instance_id = $1 AND p.member_id = $2 ORDER BY p.promised_at DESC`,
      [member.instanceId, member.id],
    );
    return {
      pledges: res.rows.map((p) => ({
        id: p.id, amountMinor: Number(p.amount_minor), currency: p.currency, status: p.status,
        promisedAt: p.promised_at, dueDate: p.due_date, campaign: p.campaign_title,
      })),
    };
  });

  /** Fulfil: intent → treasurer confirm (same dues-style flow). */
  app.post("/v1/money/pledges/:id/fulfil", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Fulfilment unlocks after verification." });
    const p = await pool.query<{ id: string; amount_minor: string; currency: string; campaign_id: string | null; status: string }>(
      "SELECT id, amount_minor, currency, campaign_id, status FROM pledges WHERE id = $1 AND member_id = $2 AND instance_id = $3",
      [id, member.id, member.instanceId],
    );
    const pledge = p.rows[0];
    if (!pledge || pledge.status !== "promised") return reply.status(404).send({ error: "Open pledge not found." });
    const gateway = getGateway();
    const result = await gateway.initiate({ amountMinor: Number(pledge.amount_minor), currency: pledge.currency, purpose: "donation", memberRef: member.id });
    const intent = await pool.query<{ id: string }>(
      `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, campaign_id, provider, provider_ref, meta, status)
       VALUES ($1,$2,$3,$4,'donation',$5,$6,$7,$8,'awaiting_confirmation') RETURNING id`,
      [member.instanceId, member.id, pledge.amount_minor, pledge.currency, pledge.campaign_id, result.provider, result.providerRef, JSON.stringify({ pledgeId: id })],
    );
    return { intentId: intent.rows[0]!.id, status: "awaiting_confirmation" };
  });

  /** Private nudges (K5): overdue promised pledges get one polite notice. */
  app.post("/v1/manage/money/pledges/nudge-run", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const overdue = await pool.query<{ id: string; member_id: string }>(
      `SELECT id, member_id FROM pledges
       WHERE instance_id = $1 AND status = 'promised' AND due_date IS NOT NULL AND due_date < now()
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.created_at > now() - interval '30 days'
             AND n.payload->>'pledgeId' = pledges.id::text
             AND n.member_id = pledges.member_id)`,
      [member.instanceId],
    );
    let sent = 0;
    for (const p of overdue.rows) {
      await pool.query(
        `INSERT INTO notifications (instance_id, member_id, kind, payload)
         VALUES ($1,$2,'system.notice',$3)`,
        [member.instanceId, p.member_id, JSON.stringify({ title: "Your pledge, whenever you are ready", body: "Your promised contribution is still open — fulfil it in the app at your pace, or let the treasurer know.", pledgeId: p.id })],
      );
      sent += 1;
    }
    return { sent };
  });

  /* ------------------------- reimbursements ---------------------------- */

  app.post("/v1/money/reimbursements", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zReimbursement.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Claims unlock after verification." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO reimbursements (instance_id, submitted_by, amount_minor, currency, memo, receipt_media)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, member.id, body.amountMinor, body.currency, body.memo, body.receiptMediaId ?? null],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/money/reimbursements", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; amount_minor: string; currency: string; memo: string; status: string; created_at: Date }>(
      `SELECT id, amount_minor::text, currency, memo, status, created_at FROM reimbursements
       WHERE instance_id = $1 AND submitted_by = $2 ORDER BY created_at DESC`,
      [member.instanceId, member.id],
    );
    return { claims: res.rows.map((r) => ({ id: r.id, amountMinor: Number(r.amount_minor), currency: r.currency, memo: r.memo, status: r.status, createdAt: r.created_at })) };
  });

  app.get("/v1/manage/money/reimbursements", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; member_name: string; amount_minor: string; currency: string; memo: string; receipt_media: string | null; status: string }>(
      `SELECT r.id, m.display_name AS member_name, r.amount_minor::text, r.currency, r.memo, r.receipt_media::text, r.status
       FROM reimbursements r JOIN members m ON m.id = r.submitted_by
       WHERE r.instance_id = $1 AND r.status = 'submitted' ORDER BY r.created_at`,
      [member.instanceId],
    );
    return { claims: res.rows };
  });

  app.post("/v1/manage/money/reimbursements/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zReimburseDecision.parse(request.body);
    const claim = await pool.query<{ id: string; submitted_by: string; amount_minor: string; currency: string }>(
      "SELECT id, submitted_by, amount_minor, currency FROM reimbursements WHERE id = $1 AND instance_id = $2 AND status = 'submitted'",
      [id, member.instanceId],
    );
    const c = claim.rows[0];
    if (!c) return reply.status(404).send({ error: "Submitted claim not found." });
    if (body.decision === "reject") {
      await pool.query(
        "UPDATE reimbursements SET status = 'rejected', decided_by = $1, decided_at = now() WHERE id = $2",
        [member.id, id],
      );
      return { ok: true, status: "rejected" };
    }
    // Approve → money out of the community: a negative (expense-direction)
    // ledger row keeps the one-ledger story intact; receipted (§P).
    const receiptNo = await nextReceiptNo(pool, member.instanceId);
    const entry = await pool.query<{ id: string }>(
      `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo, private_ledger, receipt_no, entered_by)
       VALUES ($1,$2,'reimbursement',$3,$4,$5,true,$6,$7) RETURNING id`,
      [member.instanceId, c.submitted_by, -c.amount_minor, c.currency, `Reimbursement: ${body.memo ?? "approved claim"}`, receiptNo, member.id],
    );
    await pool.query(
      "UPDATE reimbursements SET status = 'paid', decided_by = $1, decided_at = now(), paid_entry = $2 WHERE id = $3",
      [member.id, entry.rows[0]!.id, id],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.reimburse',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ receiptNo })],
    );
    return { ok: true, status: "paid", receiptNo };
  });

  /* --------------------------- sponsorships ---------------------------- */

  app.post("/v1/manage/money/sponsorships", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zSponsorship.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO sponsorships (instance_id, sponsor_name, contact, tier, amount_minor, currency, recognition, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [member.instanceId, body.sponsorName, body.contact ?? null, body.tier, body.amountMinor, body.currency, body.recognition ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /** Confirm receipt of a sponsorship → ledger entry (tiered recognition). */
  app.post("/v1/manage/money/sponsorships/:id/confirm", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const s = await pool.query<{ id: string; sponsor_name: string; amount_minor: string; currency: string; tier: string; status: string }>(
      "SELECT id, sponsor_name, amount_minor, currency, tier, status FROM sponsorships WHERE id = $1 AND instance_id = $2 AND status = 'pledged'",
      [id, member.instanceId],
    );
    const sp = s.rows[0];
    if (!sp) return reply.status(404).send({ error: "Pledged sponsorship not found." });
    const receiptNo = await nextReceiptNo(pool, member.instanceId);
    const entry = await pool.query<{ id: string }>(
      `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo, private_ledger, receipt_no, entered_by)
       VALUES ($1,NULL,'sponsorship',$2,$3,$4,false,$5,$6) RETURNING id`,
      [member.instanceId, sp.amount_minor, sp.currency, `Sponsorship (${sp.tier}): ${sp.sponsor_name}`, receiptNo, member.id],
    );
    await pool.query(
      "UPDATE sponsorships SET status = 'received', ledger_entry = $1 WHERE id = $2",
      [entry.rows[0]!.id, id],
    );
    void entry;
    return { ok: true, receiptNo };
  });

  /** Visible recognition for sponsors (mvp §7 sponsorship portal). */
  app.get("/v1/money/sponsors", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ sponsor_name: string; tier: string; recognition: string | null }>(
      `SELECT sponsor_name, tier, recognition FROM sponsorships
       WHERE instance_id = $1 AND status = 'received' ORDER BY created_at DESC LIMIT 50`,
      [member.instanceId],
    );
    return { sponsors: res.rows };
  });

  /* ------------------------- scholarships ------------------------------ */

  app.post("/v1/manage/money/scholarships", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zScholarship.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO scholarships (instance_id, name, description, endowed_minor, currency, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.name, body.description ?? null, body.endowedMinor, body.currency, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/money/scholarships", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; name: string; description: string | null; endowed_minor: string; currency: string; status: string }>(
      `SELECT id, name, description, endowed_minor::text, currency, status FROM scholarships
       WHERE instance_id = $1 AND status <> 'closed' ORDER BY created_at DESC`,
      [member.instanceId],
    );
    return { scholarships: res.rows.map((s) => ({ id: s.id, name: s.name, description: s.description, endowedMinor: Number(s.endowed_minor), currency: s.currency, status: s.status })) };
  });

  /** Members apply on behalf of a student (students are not members). */
  app.post("/v1/money/scholarships/:id/apply", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zApplication.parse(request.body);
    const s = await pool.query("SELECT 1 FROM scholarships WHERE id = $1 AND instance_id = $2 AND status = 'open'", [id, member.instanceId]);
    if (s.rows.length === 0) return reply.status(404).send({ error: "Scholarship not open for applications." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO scholarship_applications (instance_id, scholarship_id, student_name, student_class, statement, submitted_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, id, body.studentName, body.studentClass ?? null, body.statement, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/manage/money/scholarships/:id/applications", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const res = await pool.query<{ id: string; student_name: string; student_class: string | null; statement: string; submitted_by_name: string; status: string }>(
      `SELECT a.id, a.student_name, a.student_class, a.statement, m.display_name AS submitted_by_name, a.status
       FROM scholarship_applications a JOIN members m ON m.id = a.submitted_by
       WHERE a.scholarship_id = $1 AND a.instance_id = $2 ORDER BY a.created_at`,
      [id, member.instanceId],
    );
    return { applications: res.rows };
  });

  /** Screen/select/disburse — disbursement writes the ledger (rail 5). */
  app.post("/v1/manage/money/applications/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zApplicationDecision.parse(request.body);
    const a = await pool.query<{ id: string; student_name: string; status: string; scholarship_id: string }>(
      "SELECT id, student_name, status, scholarship_id FROM scholarship_applications WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const application = a.rows[0];
    if (!application) return reply.status(404).send({ error: "Application not found." });

    if (body.decision === "disburse") {
      if (application.status !== "selected") {
        return reply.status(400).send({ error: "Select the application before disbursement." });
      }
      const amount = body.amountMinor ?? 0;
      const receiptNo = await nextReceiptNo(pool, member.instanceId);
      const entry = await pool.query<{ id: string }>(
        `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo, private_ledger, receipt_no, entered_by)
         VALUES ($1,NULL,'scholarship',$2,$3,$4,false,$5,$6) RETURNING id`,
        [member.instanceId, -amount, (await pool.query<{ currency: string }>("SELECT currency FROM scholarships WHERE id = $1", [application.scholarship_id])).rows[0]!.currency, `Scholarship disbursement: ${application.student_name}`, receiptNo, member.id],
      );
      await pool.query(
        "UPDATE scholarship_applications SET status = 'disbursed', disbursed_minor = $1, decided_by = $2 WHERE id = $3",
        [amount, member.id, id],
      );
      await pool.query(
        `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
         VALUES ($1,$2,'money.scholarship',$3, now() + interval '30 days', $4)`,
        [member.instanceId, member.id, id, JSON.stringify({ student: application.student_name, amount, ledgerId: entry.rows[0]!.id })],
      );
      return { ok: true, status: "disbursed", receiptNo };
    }
    const status = body.decision === "select" ? "selected" : body.decision === "screen" ? "screening" : "rejected";
    await pool.query(
      "UPDATE scholarship_applications SET status = $1, decided_by = $2 WHERE id = $3",
      [status, member.id, id],
    );
    return { ok: true, status };
  });

  /* ------------------------- ledger publishing ------------------------- */

  /** Treasurer publishes a period snapshot: downloadable, member-visible. */
  app.post("/v1/manage/money/ledger/publish", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zPublish.parse(request.body);
    const rows = await pool.query<{ currency: string; total: string; n: string }>(
      `SELECT currency, sum(amount_minor)::text AS total, count(*)::text AS n
       FROM ledger_entries
       WHERE instance_id = $1 AND status = 'confirmed' AND private_ledger = false
         AND date_trunc('year', created_at) = date_trunc('year', $2::date)
       GROUP BY currency`,
      [member.instanceId, `${body.period}-01-01`],
    );
    const totals: Record<string, { minor: number; count: number }> = {};
    for (const r of rows.rows) totals[r.currency] = { minor: Number(r.total), count: Number(r.n) };
    const res = await pool.query<{ id: string }>(
      `INSERT INTO money_publications (instance_id, period, totals, row_count, published_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, body.period, JSON.stringify(totals), rows.rows.reduce((s, r) => s + Number(r.n), 0), member.id],
    );
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/money/publications", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; period: string; totals: Record<string, { minor: number; count: number }>; row_count: number; published_at: Date; published_by_name: string }>(
      `SELECT p.id, p.period, p.totals, p.row_count, p.published_at, m.display_name AS published_by_name
       FROM money_publications p JOIN members m ON m.id = p.published_by
       WHERE p.instance_id = $1 ORDER BY p.published_at DESC`,
      [member.instanceId],
    );
    return { publications: res.rows };
  });

  /* --------------------------- tribute giving -------------------------- */

  /** Donate in memory/honor of someone — metadata rides intent → ledger. */
  app.post("/v1/money/tribute", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zTribute.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Giving unlocks after verification." });
    const gateway = getGateway();
    const result = await gateway.initiate({ amountMinor: body.amountMinor, currency: body.currency, purpose: "tribute", memberRef: member.id });
    const intent = await pool.query<{ id: string }>(
      `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, provider, provider_ref, meta, status)
       VALUES ($1,$2,$3,$4,'tribute',$5,$6,$7,'awaiting_confirmation') RETURNING id`,
      [member.instanceId, member.id, body.amountMinor, body.currency, result.provider, result.providerRef, JSON.stringify({ tributeName: body.tributeName, tributeKind: body.tributeKind, anonymous: body.anonymous ?? false })],
    );
    return { intentId: intent.rows[0]!.id, status: "awaiting_confirmation" };
  });

  /** Tribute intents confirm with the tribute written into the ledger memo. */
  app.post("/v1/manage/money/tribute-intents/:id/confirm", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const meta = await pool.query<{ member_id: string; tribute_name: string; tribute_kind: string; anonymous: boolean }>(
      `SELECT member_id, meta->>'tributeName' AS tribute_name, meta->>'tributeKind' AS tribute_kind,
              COALESCE(meta->>'anonymous','false')::boolean AS anonymous
       FROM payment_intents WHERE id = $1 AND instance_id = $2 AND purpose = 'tribute' AND status = 'awaiting_confirmation'`,
      [id, member.instanceId],
    );
    const m = meta.rows[0];
    if (!m) return reply.status(404).send({ error: "Tribute intent not found." });
    const { receiptNo, ledgerId } = await confirmIntent(pool, member.instanceId, id, member.id, null);
    const label = m.tribute_kind === "memory" ? "In memory of" : m.tribute_kind === "honor" ? "In honor of" : "Celebrating";
    await pool.query(
      "UPDATE ledger_entries SET memo = $1, anonymous = $2 WHERE id = $3",
      [`${label} ${m.tribute_name}`, m.anonymous, ledgerId],
    );
    return { ok: true, receiptNo, ledgerId };
  });
}

const zP2pCreate = z.object({
  title: z.string().min(2).max(120),
  story: z.string().max(2000).optional(),
  goalMinor: z.number().int().min(100),
  currency: z.string().length(3),
});
const zDecision = z.object({ decision: z.enum(["approve", "reject"]) });
const zDonateMin = z.object({
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  anonymous: z.boolean().optional(),
});
const zPledgeCreate = z.object({
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  campaignId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});
const zReimbursement = z.object({
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  memo: z.string().min(4).max(500),
  receiptMediaId: z.string().uuid().optional(),
});
const zReimburseDecision = z.object({
  decision: z.enum(["approve", "reject"]),
  memo: z.string().max(200).optional(),
});
const zSponsorship = z.object({
  sponsorName: z.string().min(2).max(120),
  contact: z.string().max(200).optional(),
  tier: z.enum(["bronze", "silver", "gold"]),
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  recognition: z.string().max(500).optional(),
});
const zScholarship = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  endowedMinor: z.number().int().min(0),
  currency: z.string().length(3),
});
const zApplication = z.object({
  studentName: z.string().min(2).max(120),
  studentClass: z.string().max(60).optional(),
  statement: z.string().min(10).max(3000),
});
const zApplicationDecision = z.object({
  decision: z.enum(["screen", "select", "reject", "disburse"]),
  amountMinor: z.number().int().min(0).optional(),
});
const zPublish = z.object({ period: z.string().regex(/^\d{4}$/) });
const zTribute = z.object({
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  tributeName: z.string().min(2).max(120),
  tributeKind: z.enum(["memory", "honor", "birthday"]),
  anonymous: z.boolean().optional(),
});
