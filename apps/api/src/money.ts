/**
 * Money (Phase 4 batch 1, sessions 4.1 + 4.2): one wallet/ledger (rail 5),
 * dues with private status (§P), receipts, tiers, reminders.
 *
 * Privacy law (§P, K1): dues status is private — the member sees only their
 * own; admins see filterable views in Manage (coarsely audit-logged); there
 * is NO public dues badge anywhere. Every payment is receipted. Dues cycle,
 * tiers, and reminders are admin-settable. Limited accounts are refused by
 * the money.pay policy (M5).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { getGateway } from "./payments.js";
import { requireMember, requireDutyRole } from "./sessions.js";
import { evaluate } from "./policy.js";
import { payDuesSchema, markPaidSchema, tierCreateSchema } from "@fedites/config";
import type { InstanceConfig, DuesAssessmentView, LedgerRow, TierView } from "@fedites/config";

async function nextReceiptNo(pool: Pool, instanceId: string, year: number): Promise<string> {
  const res = await pool.query<{ last: string }>(
    `INSERT INTO receipt_counters (instance_id, year, last) VALUES ($1,$2,1)
     ON CONFLICT (instance_id, year) DO UPDATE SET last = receipt_counters.last + 1
     RETURNING last`,
    [instanceId, year],
  );
  return `RCPT-${year}-${String(res.rows[0]!.last).padStart(6, "0")}`;
}

/** Confirm a payment intent into the one ledger + receipt (§P). */
async function confirmIntent(
  pool: Pool,
  instanceId: string,
  intentId: string,
  confirmedBy: string,
  reference: string | null,
): Promise<{ receiptNo: string; ledgerId: string }> {
  const intent = await pool.query<{ id: string; member_id: string; amount_minor: string; currency: string; purpose: string; assessment_id: string | null; status: string }>(
    "SELECT id, member_id, amount_minor, currency, purpose, assessment_id, status FROM payment_intents WHERE id = $1 AND instance_id = $2",
    [intentId, instanceId],
  );
  const intentRow = intent.rows[0];
  if (!intentRow) throw new Error("Payment intent not found.");
  if (intentRow.status === "confirmed") throw new Error("This payment is already confirmed.");

  const year = new Date().getFullYear();
  const receiptNo = await nextReceiptNo(pool, instanceId, year);
  const entry = await pool.query<{ id: string }>(
    `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo, private_ledger, reference, receipt_no, entered_by, assessment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      instanceId, intentRow.member_id, intentRow.purpose, intentRow.amount_minor,
      intentRow.currency, `${intentRow.purpose} payment`,
      intentRow.purpose === "dues", // dues entries are private by definition (§P)
      reference, receiptNo, confirmedBy, intentRow.assessment_id,
    ],
  );
  await pool.query(
    "UPDATE payment_intents SET status = 'confirmed', confirmed_at = now(), ledger_entry_id = $1 WHERE id = $2",
    [entry.rows[0]!.id, intentId],
  );
  if (intentRow.assessment_id !== null) {
    await pool.query("UPDATE dues_assessments SET status = 'paid' WHERE id = $1", [intentRow.assessment_id]);
  }
  return { receiptNo, ledgerId: entry.rows[0]!.id };
}

export async function moneyRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: { broadcast: (rooms: string[], e: Record<string, unknown>) => void } },
): Promise<void> {
  const { pool } = opts;

  /* ------------------------------ my money ----------------------------- */

  /** My dues (private: own only) + my payments & receipts history. */
  app.get("/v1/money/overview", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const config = await opts.loadConfigByInstance(member.instanceId);

    const assessments = await pool.query<{
      id: string; period: string; amount_minor: string; currency: string; due_date: string;
      status: string; tier_name: string | null; receipt: string | null;
    }>(
      `SELECT a.id, a.period, a.amount_minor::text, a.currency, a.due_date, a.status,
              t.name AS tier_name, l.receipt_no AS receipt
       FROM dues_assessments a
       LEFT JOIN membership_tiers t ON t.id = a.tier_id
       LEFT JOIN payment_intents pi ON pi.assessment_id = a.id AND pi.status = 'confirmed'
       LEFT JOIN ledger_entries l ON l.id = pi.ledger_entry_id
       WHERE a.instance_id = $1 AND a.member_id = $2
       ORDER BY a.due_date DESC`,
      [member.instanceId, member.id],
    );
    const dues: DuesAssessmentView[] = assessments.rows.map((a) => ({
      id: a.id, period: a.period, amountMinor: Number(a.amount_minor), currency: a.currency,
      dueDate: a.due_date, status: a.status as DuesAssessmentView["status"],
      tierName: a.tier_name, receiptNo: a.receipt,
    }));

    const ledger = await pool.query<{ id: string; kind: string; amount_minor: string; currency: string; memo: string | null; status: string; receipt_no: string | null; created_at: Date }>(
      `SELECT id, kind, amount_minor::text, currency, memo, status, receipt_no, created_at
       FROM ledger_entries WHERE instance_id = $1 AND member_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [member.instanceId, member.id],
    );
    const ledgerRows: LedgerRow[] = ledger.rows.map((l) => ({
      id: l.id, kind: l.kind, amountMinor: Number(l.amount_minor), currency: l.currency,
      memo: l.memo, status: l.status as LedgerRow["status"], receiptNo: l.receipt_no,
      createdAt: l.created_at.toISOString(),
    }));

    const tier = await pool.query<{ id: string; name: string; amount_minor: string; currency: string; cycle: string; perks: TierView["perks"] }>(
      `SELECT t.id, t.name, t.amount_minor::text, t.currency, t.cycle, t.perks
       FROM members m JOIN membership_tiers t ON t.id = m.tier_id WHERE m.id = $1`,
      [member.id],
    );
    const myTier = tier.rows[0]
      ? { id: tier.rows[0].id, name: tier.rows[0].name, amountMinor: Number(tier.rows[0].amount_minor), currency: tier.rows[0].currency, cycle: tier.rows[0].cycle, perks: tier.rows[0].perks }
      : null;

    const currency = config.instance.currency;
    const owed = dues
      .filter((d) => d.status !== "paid" && d.status !== "waived" && d.currency === currency)
      .reduce((s, d) => s + d.amountMinor, 0);

    return { dues, ledger: ledgerRows, myTier, owedMinor: owed, currency };
  });

  /** Pay dues: creates a gateway intent (manual gateway awaits treasurer). */
  app.post("/v1/money/dues/:assessmentId/pay", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { assessmentId } = request.params as { assessmentId: string };
    payDuesSchema.parse(request.body ?? {});
    const config = await opts.loadConfigByInstance(member.instanceId);
    const gate = evaluate(config, "money.pay", {
      status: member.verification === "rejected" ? "limited" : member.verification,
      verified: member.verification === "verified",
      honorary: member.verification === "honorary",
      roles: member.roles,
      vouchCount: 0,
    });
    if (!gate.allowed) return reply.status(403).send({ error: gate.reason });

    const a = await pool.query<{ id: string; amount_minor: string; currency: string; member_id: string; status: string }>(
      "SELECT id, amount_minor, currency, member_id, status FROM dues_assessments WHERE id = $1 AND instance_id = $2",
      [assessmentId, member.instanceId],
    );
    const assessment = a.rows[0];
    if (!assessment || assessment.member_id !== member.id) return reply.status(404).send({ error: "Assessment not found." });
    if (assessment.status === "paid" || assessment.status === "waived") {
      return reply.status(400).send({ error: "This assessment is already settled." });
    }
    const gateway = getGateway();
    if (!gateway.available) return reply.status(503).send({ error: "No payment gateway is available." });
    const result = await gateway.initiate({
      amountMinor: Number(assessment.amount_minor), currency: assessment.currency,
      purpose: "dues", memberRef: member.id,
    });
    const intent = await pool.query<{ id: string }>(
      `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, assessment_id, provider, provider_ref, status)
       VALUES ($1,$2,$3,$4,'dues',$5,$6,$7,'awaiting_confirmation') RETURNING id`,
      [member.instanceId, member.id, assessment.amount_minor, assessment.currency, assessmentId, result.provider, result.providerRef],
    );
    return { intentId: intent.rows[0]!.id, provider: result.provider, checkoutUrl: result.checkoutUrl, status: "awaiting_confirmation" };
  });

  /** Receipt (owner or treasurer). */
  app.get("/v1/money/receipts/:ledgerId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { ledgerId } = request.params as { ledgerId: string };
    const entry = await pool.query<{ id: string; member_id: string; kind: string; amount_minor: string; currency: string; receipt_no: string | null; created_at: Date; payer: string }>(
      `SELECT l.id, l.member_id, l.kind, l.amount_minor::text, l.currency, l.receipt_no, l.created_at,
              m.display_name AS payer
       FROM ledger_entries l JOIN members m ON m.id = l.member_id
       WHERE l.id = $1 AND l.instance_id = $2`,
      [ledgerId, member.instanceId],
    );
    const e = entry.rows[0];
    if (!e) return reply.status(404).send({ error: "Receipt not found." });
    if (e.member_id !== member.id && !requireDutyRole(member)) {
      return reply.status(403).send({ error: "Receipts are private to the payer and the treasurer." });
    }
    const config = await opts.loadConfigByInstance(member.instanceId);
    return {
      receiptNo: e.receipt_no,
      payer: e.payer,
      kind: e.kind,
      amountMinor: Number(e.amount_minor),
      currency: e.currency,
      issuedAt: e.created_at,
      community: config.instance.displayName,
    };
  });

  /* ------------------------------ tiers -------------------------------- */

  app.get("/v1/money/tiers", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; name: string; amount_minor: string; currency: string; cycle: string; perks: string }>(
      "SELECT id, name, amount_minor::text, currency, cycle, perks::text FROM membership_tiers WHERE instance_id = $1 AND archived_at IS NULL ORDER BY amount_minor",
      [member.instanceId],
    );
    const tiers: TierView[] = res.rows.map((t) => ({
      id: t.id, name: t.name, amountMinor: Number(t.amount_minor), currency: t.currency,
      cycle: t.cycle, perks: JSON.parse(t.perks) as TierView["perks"],
    }));
    return { tiers };
  });

  app.post("/v1/manage/money/tiers", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = tierCreateSchema.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO membership_tiers (instance_id, name, amount_minor, currency, cycle, perks)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.name, body.amountMinor, body.currency, body.cycle, JSON.stringify(body.perks)],
    );
    return { id: res.rows[0]!.id };
  });

  app.post("/v1/manage/money/members/:id/tier", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zTierAssign.parse(request.body);
    await pool.query(
      "UPDATE members SET tier_id = $1 WHERE id = $2 AND instance_id = $3",
      [body.tierId, id, member.instanceId],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.tier',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ tierId: body.tierId })],
    );
    return { ok: true };
  });

  /* --------------------------- treasurer ops --------------------------- */

  /** Run the dues cycle: one assessment per verified member for the period. */
  app.post("/v1/manage/money/assessments/run", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zRunCycle.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);

    const tierId = body.tierId ?? null;
    if (tierId === null && body.amountMinor === undefined) {
      return reply.status(400).send({ error: "Provide a base amount or a tier for the cycle." });
    }
    let amountMinor = body.amountMinor ?? 0;
    let currency = body.currency ?? config.instance.currency;
    if (tierId !== null) {
      const t = await pool.query<{ amount_minor: string; currency: string }>(
        "SELECT amount_minor::text, currency FROM membership_tiers WHERE id = $1 AND instance_id = $2",
        [tierId, member.instanceId],
      );
      if (!t.rows[0]) return reply.status(404).send({ error: "Tier not found." });
      amountMinor = Number(t.rows[0].amount_minor);
      currency = t.rows[0].currency;
    }
    const dueDate = body.dueDate ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    const members = await pool.query<{ id: string }>(
      `SELECT id FROM members WHERE instance_id = $1 AND verification IN ('verified','honorary')
       AND memorial = false AND deleted_at IS NULL`,
      [member.instanceId],
    );
    let created = 0;
    for (const m of members.rows) {
      // A member's assigned tier overrides the base amount and stamps the tier.
      let amt = amountMinor;
      let memberTier: string | null = tierId;
      const mt = await pool.query<{ id: string; amount_minor: string }>(
        `SELECT t.id, t.amount_minor::text FROM members mm JOIN membership_tiers t ON t.id = mm.tier_id WHERE mm.id = $1`,
        [m.id],
      );
      if (mt.rows[0] !== undefined) {
        amt = Number(mt.rows[0].amount_minor);
        memberTier = mt.rows[0].id;
      }
      const ins = await pool.query(
        `INSERT INTO dues_assessments (instance_id, member_id, tier_id, period, amount_minor, currency, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (instance_id, member_id, period) DO NOTHING RETURNING id`,
        [member.instanceId, m.id, memberTier, body.period, amt, currency, dueDate],
      );
      if (ins.rows.length > 0) created += 1;
    }
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.assess','cycle', now() + interval '30 days', $3)`,
      [member.instanceId, member.id, JSON.stringify({ period: body.period, created })],
    );
    return { created };
  });

  /** Admin dues view: filterable + coarsely audit-logged (§P). */
  app.get("/v1/manage/money/dues", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { status } = request.query as { status?: string };
    const res = await pool.query<{ id: string; display_name: string; period: string; amount_minor: string; currency: string; due_date: string; status: string; receipt: string | null }>(
      `SELECT a.id, m.display_name, a.period, a.amount_minor::text, a.currency, a.due_date, a.status,
              (SELECT l.receipt_no FROM payment_intents pi JOIN ledger_entries l ON l.id = pi.ledger_entry_id
                WHERE pi.assessment_id = a.id AND pi.status = 'confirmed' LIMIT 1) AS receipt
       FROM dues_assessments a JOIN members m ON m.id = a.member_id
       WHERE a.instance_id = $1 AND ($2::text IS NULL OR a.status = $2)
       ORDER BY a.due_date DESC LIMIT 200`,
      [member.instanceId, status ?? null],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.dues-view','manage', now() + interval '30 days', $3)`,
      [member.instanceId, member.id, JSON.stringify({ filter: status ?? "all" })],
    );
    return {
      assessments: res.rows.map((a) => ({
        id: a.id, memberName: a.display_name, period: a.period,
        amountMinor: Number(a.amount_minor), currency: a.currency,
        dueDate: a.due_date, status: a.status, receiptNo: a.receipt,
      })),
    };
  });

  /** Manual "mark as paid" (§P): treasurer confirms cash/offline. */
  app.post("/v1/manage/money/dues/:assessmentId/mark-paid", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { assessmentId } = request.params as { assessmentId: string };
    const markBody = markPaidSchema.parse(request.body ?? {});
    const a = await pool.query<{ id: string; member_id: string; amount_minor: string; currency: string; status: string }>(
      "SELECT id, member_id, amount_minor, currency, status FROM dues_assessments WHERE id = $1 AND instance_id = $2",
      [assessmentId, member.instanceId],
    );
    const assessment = a.rows[0];
    if (!assessment) return reply.status(404).send({ error: "Assessment not found." });
    if (assessment.status === "paid" || assessment.status === "waived") {
      return reply.status(400).send({ error: "Already settled." });
    }
    // Find the member's awaiting intent (manual gateway), else create one.
    let intent = await pool.query<{ id: string }>(
      "SELECT id FROM payment_intents WHERE assessment_id = $1 AND status = 'awaiting_confirmation' LIMIT 1",
      [assessmentId],
    );
    if (intent.rows[0] === undefined) {
      const created = await pool.query<{ id: string }>(
        `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, assessment_id, provider, provider_ref, status)
         VALUES ($1,$2,$3,$4,'dues',$5,'manual',$6,'awaiting_confirmation') RETURNING id`,
        [member.instanceId, assessment.member_id, assessment.amount_minor, assessment.currency, assessmentId, `manual-${Date.now()}`],
      );
      intent = created;
    }
    const { receiptNo, ledgerId } = await confirmIntent(pool, member.instanceId, intent.rows[0]!.id, member.id, markBody.reference ?? null);
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.mark-paid',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, assessmentId, JSON.stringify({ receiptNo })],
    );
    return { ok: true, receiptNo, ledgerId };
  });

  /** Waive (treasurer, audited, reversible window). */
  app.post("/v1/manage/money/dues/:assessmentId/waive", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { assessmentId } = request.params as { assessmentId: string };
    const res = await pool.query(
      `UPDATE dues_assessments SET status = 'waived', waived_by = $1, waived_at = now()
       WHERE id = $2 AND instance_id = $3 AND status <> 'paid' RETURNING id`,
      [member.id, assessmentId, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Assessment not found or already paid." });
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.waive',$3, now() + interval '30 days', '{}')`,
      [member.instanceId, member.id, assessmentId],
    );
    return { ok: true };
  });

  /** Polite reminders (K5): one in-app notice per overdue assessment; quiet
   *  hours gate future push channels (J4). No shaming copy. */
  app.post("/v1/manage/money/reminders/run", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const overdue = await pool.query<{ id: string; member_id: string; period: string; due_date: string; currency: string; amount_minor: string }>(
      `SELECT id, member_id, period, due_date::text, currency, amount_minor::text FROM dues_assessments
       WHERE instance_id = $1 AND status = 'due' AND due_date < now()`,
      [member.instanceId],
    );
    let sent = 0;
    for (const a of overdue.rows) {
      await pool.query(
        `INSERT INTO notifications (instance_id, member_id, kind, payload)
         VALUES ($1,$2,'system.notice',$3)`,
        [member.instanceId, a.member_id, JSON.stringify({
          title: "Dues reminder",
          body: `Your ${a.period} dues are due. Pay online or hand it to the treasurer — quietly, whenever it suits you.`,
          assessmentId: a.id,
        })],
      );
      sent += 1;
    }
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.reminders','run', now() + interval '30 days', $3)`,
      [member.instanceId, member.id, JSON.stringify({ sent })],
    );
    return { sent };
  });
}

const zRunCycle = z.object({
  period: z.string().min(1).max(20),
  tierId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().optional(),
});
const zTierAssign = z.object({ tierId: z.string().uuid() });
