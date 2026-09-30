/**
 * Giving (Phase 4 batch 2, session 4.3): donations (one-time + recurring
 * schedules), campaigns with live progress, donor wall (named by default,
 * anonymous per payment — §P), and the transparent ledger (member-browsable,
 * downloadable; dues and private rows never appear).
 *
 * F6: confetti is earned at exactly two moments — payment success and
 * campaign goal completion (the goal marker is recorded here; the component
 * fires client-side). K2: the wall shows names (or Anonymous), no amounts,
 * no league tables. K5: no guilt-trip copy anywhere. M5: §P money.pay gate
 * enforced; limited accounts refused.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { getGateway } from "./payments.js";
import { requireMember, requireDutyRole } from "./sessions.js";
import { evaluate } from "./policy.js";
import { record } from "./recognition.js";
import { confirmIntent } from "./money.js";
import type { InstanceConfig } from "@fedites/config";

async function raiseFor(pool: Pool, campaignId: string): Promise<number> {
  const res = await pool.query<{ total: string }>(
    `SELECT COALESCE(sum(amount_minor), 0)::text AS total FROM ledger_entries
     WHERE campaign_id = $1 AND status = 'confirmed'`,
    [campaignId],
  );
  return Number(res.rows[0]?.total ?? 0);
}

async function maybeReachGoal(pool: Pool, hub: { broadcastAll: (e: Record<string, unknown>) => void }, campaignId: string): Promise<boolean> {
  const c = await pool.query<{ goal_minor: string; currency: string; goal_reached_at: Date | null; title: string }>(
    "SELECT goal_minor, currency, goal_reached_at, title FROM campaigns WHERE id = $1",
    [campaignId],
  );
  const campaign = c.rows[0];
  if (!campaign || campaign.goal_reached_at !== null) return false;
  const raised = await raiseFor(pool, campaignId);
  if (raised < Number(campaign.goal_minor)) return false;
  await pool.query("UPDATE campaigns SET goal_reached_at = now() WHERE id = $1", [campaignId]);
  // F6 moment marker: clients show confetti when they see goal_reached_at.
  hub.broadcastAll({ type: "campaign.goal", campaignId });
  return true;
}

export async function givingRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: { broadcast: (rooms: string[], e: Record<string, unknown>) => void; broadcastAll: (e: Record<string, unknown>) => void } },
): Promise<void> {
  const { pool } = opts;

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

  /* ------------------------------ campaigns ---------------------------- */

  app.get("/v1/money/campaigns", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; description: string | null; goal_minor: string; currency: string; deadline: string | null; status: string; goal_reached_at: Date | null }>(
      `SELECT id, title, description, goal_minor::text, currency, deadline::text, status, goal_reached_at
       FROM campaigns WHERE instance_id = $1 AND status IN ('open','closed') AND archived_at IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [member.instanceId],
    );
    const campaigns = [];
    for (const c of res.rows) {
      const raised = await raiseFor(pool, c.id);
      campaigns.push({
        id: c.id, title: c.title, description: c.description,
        goalMinor: Number(c.goal_minor), currency: c.currency,
        raisedMinor: raised, deadline: c.deadline,
        goalReached: c.goal_reached_at !== null, status: c.status,
        progress: Math.min(100, Math.round((raised / Math.max(Number(c.goal_minor), 1)) * 100)),
      });
    }
    return { campaigns };
  });

  app.post("/v1/manage/money/campaigns", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zCampaignCreate.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO campaigns (instance_id, title, description, goal_minor, currency, deadline, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [member.instanceId, body.title, body.description ?? null, body.goalMinor, body.currency, body.deadline ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  app.post("/v1/manage/money/campaigns/:id/close", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const res = await pool.query(
      "UPDATE campaigns SET status = 'closed' WHERE id = $1 AND instance_id = $2 AND status = 'open' RETURNING id",
      [id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Open campaign not found." });
    return { ok: true };
  });

  /* ------------------------------ donate ------------------------------- */

  async function createDonationIntent(
    pool: Pool, instanceId: string, memberId: string,
    amountMinor: number, currency: string, campaignId: string | null, anonymous: boolean,
  ): Promise<{ intentId: string; provider: string; checkoutUrl: string | null }> {
    const gateway = getGateway();
    const result = await gateway.initiate({ amountMinor, currency, purpose: campaignId !== null ? "campaign" : "donation", memberRef: memberId });
    const intent = await pool.query<{ id: string }>(
      `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, campaign_id, provider, provider_ref, meta, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'awaiting_confirmation') RETURNING id`,
      [instanceId, memberId, amountMinor, currency, campaignId !== null ? "campaign" : "donation", campaignId, result.provider, result.providerRef, JSON.stringify({ anonymous })],
    );
    return { intentId: intent.rows[0]!.id, provider: result.provider, checkoutUrl: result.checkoutUrl };
  }

  /** One-time donation (general or toward a campaign). */
  app.post("/v1/money/donate", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zDonate.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) {
      return reply.status(403).send({ error: "Giving unlocks after verification." });
    }
    if (body.campaignId !== undefined) {
      const c = await pool.query("SELECT 1 FROM campaigns WHERE id = $1 AND instance_id = $2 AND status = 'open'", [body.campaignId, member.instanceId]);
      if (c.rows.length === 0) return reply.status(404).send({ error: "Campaign not found or closed." });
    }
    const r = await createDonationIntent(pool, member.instanceId, member.id, body.amountMinor, body.currency, body.campaignId ?? null, body.anonymous ?? false);
    return { ...r, status: "awaiting_confirmation" };
  });

  app.post("/v1/money/campaigns/:id/donate", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zDonate.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) {
      return reply.status(403).send({ error: "Giving unlocks after verification." });
    }
    const c = await pool.query("SELECT 1 FROM campaigns WHERE id = $1 AND instance_id = $2 AND status = 'open'", [id, member.instanceId]);
    if (c.rows.length === 0) return reply.status(404).send({ error: "Campaign not found or closed." });
    const r = await createDonationIntent(pool, member.instanceId, member.id, body.amountMinor, body.currency, id, body.anonymous ?? false);
    return { ...r, status: "awaiting_confirmation" };
  });

  /* ------------------------------ donor wall --------------------------- */

  /** Named by default, anonymous per payment (§P). Names only — K2. */
  app.get("/v1/money/campaigns/:id/donors", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{ display_name: string | null; anonymous: boolean; created_at: Date }>(
      `SELECT CASE WHEN l.anonymous THEN NULL ELSE m.display_name END AS display_name,
              l.anonymous, l.created_at
       FROM ledger_entries l JOIN members m ON m.id = l.member_id
       WHERE l.campaign_id = $1 AND l.instance_id = $2 AND l.status = 'confirmed'
       ORDER BY l.created_at DESC LIMIT 200`,
      [id, member.instanceId],
    );
    return {
      donors: res.rows.map((d) => ({
        name: d.anonymous ? "Anonymous friend" : (d.display_name ?? "Friend"),
        at: d.created_at,
      })),
    };
  });

  /* --------------------- transparent ledger (rail 5) ------------------- */

  /** Member-browsable: confirmed, non-private rows; dues never appear (§P). */
  app.get("/v1/money/transparent-ledger", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { format } = request.query as { format?: string };
    const res = await pool.query<{ kind: string; amount_minor: string; currency: string; receipt_no: string | null; created_at: Date; campaign_title: string | null; payer: string | null; anonymous: boolean }>(
      `SELECT l.kind, l.amount_minor::text, l.currency, l.receipt_no, l.created_at,
              c.title AS campaign_title,
              CASE WHEN l.anonymous THEN NULL ELSE m.display_name END AS payer,
              l.anonymous
       FROM ledger_entries l
       LEFT JOIN members m ON m.id = l.member_id
       LEFT JOIN campaigns c ON c.id = l.campaign_id
       WHERE l.instance_id = $1 AND l.status = 'confirmed' AND l.private_ledger = false
       ORDER BY l.created_at DESC LIMIT 500`,
      [member.instanceId],
    );
    const rows = res.rows.map((r) => ({
      kind: r.kind,
      amountMinor: Number(r.amount_minor),
      currency: r.currency,
      receiptNo: r.receipt_no,
      createdAt: r.created_at,
      campaign: r.campaign_title,
      payer: r.anonymous ? "Anonymous friend" : r.payer,
    }));
    if (format === "csv") {
      // Downloadable financial report (mvp §7 Transparent ledger).
      const header = "kind,amount_minor,currency,receipt_no,created_at,campaign,payer";
      const lines = rows.map((r) =>
        [r.kind, r.amountMinor, r.currency, r.receiptNo ?? "", new Date(r.createdAt).toISOString(), (r.campaign ?? "").replace(/,/g, ";"), (r.payer ?? "").replace(/,/g, ";")].join(","),
      );
      void reply.header("content-type", "text/csv; charset=utf-8");
      void reply.header("content-disposition", `attachment; filename="transparent-ledger.csv"`);
      return [header, ...lines].join("\n");
    }
    // Per-currency sums (multi-currency rows never merge).
    const sums: Record<string, number> = {};
    for (const r of rows) sums[r.currency] = (sums[r.currency] ?? 0) + r.amountMinor;
    return { rows, totals: sums };
  });

  /* ------------------------- recurring schedules ----------------------- */

  app.get("/v1/money/schedules", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; amount_minor: string; currency: string; frequency: string; campaign_title: string | null; status: string; next_date: string }>(
      `SELECT s.id, s.amount_minor::text, s.currency, s.frequency, c.title AS campaign_title, s.status, s.next_date::text
       FROM donation_schedules s LEFT JOIN campaigns c ON c.id = s.campaign_id
       WHERE s.instance_id = $1 AND s.member_id = $2 AND s.status = 'active' ORDER BY s.next_date`,
      [member.instanceId, member.id],
    );
    return { schedules: res.rows.map((s) => ({ id: s.id, amountMinor: Number(s.amount_minor), currency: s.currency, frequency: s.frequency, campaign: s.campaign_title, nextDate: s.next_date })) };
  });

  app.post("/v1/money/schedules", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zSchedule.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!(await moneyGate(member, config))) return reply.status(403).send({ error: "Giving unlocks after verification." });
    if (body.campaignId !== undefined) {
      const c = await pool.query("SELECT 1 FROM campaigns WHERE id = $1 AND instance_id = $2 AND status = 'open'", [body.campaignId, member.instanceId]);
      if (c.rows.length === 0) return reply.status(404).send({ error: "Campaign not found or closed." });
    }
    const next = new Date();
    if (body.frequency === "monthly") next.setMonth(next.getMonth() + 1);
    else if (body.frequency === "quarterly") next.setMonth(next.getMonth() + 3);
    else next.setFullYear(next.getFullYear() + 1);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO donation_schedules (instance_id, member_id, amount_minor, currency, frequency, campaign_id, next_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [member.instanceId, member.id, body.amountMinor, body.currency, body.frequency, body.campaignId ?? null, next.toISOString().slice(0, 10)],
    );
    return { id: res.rows[0]!.id };
  });

  app.delete("/v1/money/schedules/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    await pool.query(
      "UPDATE donation_schedules SET status = 'cancelled' WHERE id = $1 AND member_id = $2 AND instance_id = $3",
      [id, member.id, member.instanceId],
    );
    return { ok: true };
  });

  /** Treasurer run: due schedules become awaiting intents + polite notices. */
  app.post("/v1/manage/money/schedules/run", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const due = await pool.query<{ id: string; member_id: string; amount_minor: string; currency: string; campaign_id: string | null }>(
      `SELECT id, member_id, amount_minor, currency, campaign_id FROM donation_schedules
       WHERE instance_id = $1 AND status = 'active' AND next_date <= now()`,
      [member.instanceId],
    );
    let created = 0;
    for (const s of due.rows) {
      const gateway = getGateway();
      const result = await gateway.initiate({ amountMinor: Number(s.amount_minor), currency: s.currency, purpose: "donation", memberRef: s.member_id });
      await pool.query(
        `INSERT INTO payment_intents (instance_id, member_id, amount_minor, currency, purpose, campaign_id, provider, provider_ref, status)
         VALUES ($1,$2,$3,$4,'donation',$5,$6,$7,'awaiting_confirmation')`,
        [member.instanceId, s.member_id, s.amount_minor, s.currency, s.campaign_id, result.provider, result.providerRef],
      );
      const next = new Date();
      const sched = await pool.query<{ frequency: string }>("SELECT frequency FROM donation_schedules WHERE id = $1", [s.id]);
      if (sched.rows[0]?.frequency === "monthly") next.setMonth(next.getMonth() + 1);
      else if (sched.rows[0]?.frequency === "quarterly") next.setMonth(next.getMonth() + 3);
      else next.setFullYear(next.getFullYear() + 1);
      await pool.query("UPDATE donation_schedules SET next_date = $1 WHERE id = $2", [next.toISOString().slice(0, 10), s.id]);
      await pool.query(
        `INSERT INTO notifications (instance_id, member_id, kind, payload)
         VALUES ($1,$2,'system.notice',$3)`,
        [member.instanceId, s.member_id, JSON.stringify({ title: "Your recurring gift is ready to confirm", body: "Hand it to the treasurer or pay online — your receipt appears automatically." })],
      );
      created += 1;
    }
    return { created };
  });

  /* ------------------- manage: donation intents queue ------------------ */

  app.get("/v1/manage/money/intents", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; display_name: string; amount_minor: string; currency: string; purpose: string; campaign_title: string | null; created_at: Date; anonymous: boolean }>(
      `SELECT i.id, m.display_name, i.amount_minor::text, i.currency, i.purpose,
              c.title AS campaign_title, i.created_at,
              COALESCE(i.meta->>'anonymous', 'false') AS anonymous
       FROM payment_intents i
       JOIN members m ON m.id = i.member_id
       LEFT JOIN campaigns c ON c.id = i.campaign_id
       WHERE i.instance_id = $1 AND i.status = 'awaiting_confirmation'
       ORDER BY i.created_at LIMIT 100`,
      [member.instanceId],
    );
    return {
      intents: res.rows.map((i) => ({
        id: i.id, memberName: i.display_name, amountMinor: Number(i.amount_minor),
        currency: i.currency, purpose: i.purpose, campaign: i.campaign_title,
        createdAt: i.created_at,
      })),
    };
  });

  /** Confirm a donation intent → ledger (+ recognition points, §8). */
  app.post("/v1/manage/money/intents/:id/confirm", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zConfirm.parse(request.body ?? {});
    const meta = await pool.query<{ member_id: string; anonymous_flag: boolean }>(
      `SELECT member_id, COALESCE(meta->>'anonymous','false')::boolean AS anonymous_flag
       FROM payment_intents WHERE id = $1 AND instance_id = $2`,
      [id, member.instanceId],
    );
    if (!meta.rows[0]) return reply.status(404).send({ error: "Intent not found." });
    const { receiptNo, ledgerId } = await confirmIntent(pool, member.instanceId, id, member.id, body.reference ?? null);
    // Anonymous flag rides to the ledger row.
    const intentRow = await pool.query<{ campaign_id: string | null; member_id: string }>(
      "SELECT campaign_id, member_id FROM payment_intents WHERE id = $1", [id],
    );
    await pool.query(
      `UPDATE ledger_entries SET anonymous = $2, campaign_id = COALESCE(campaign_id, $3) WHERE id = $1`,
      [ledgerId, meta.rows[0].anonymous_flag, intentRow.rows[0]?.campaign_id ?? null],
    );
    if (intentRow.rows[0]?.campaign_id !== null) {
      await maybeReachGoal(pool, opts.hub, intentRow.rows[0]!.campaign_id!);
    }
    await record(pool, member.instanceId, meta.rows[0].member_id, "donation").catch(() => undefined);
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'money.confirm-donation',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ receiptNo })],
    );
    return { ok: true, receiptNo, ledgerId };
  });
}

const zDonate = z.object({
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  campaignId: z.string().uuid().optional(),
  anonymous: z.boolean().optional(),
});
const zCampaignCreate = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  goalMinor: z.number().int().min(100),
  currency: z.string().length(3),
  deadline: z.string().optional(),
});
const zSchedule = z.object({
  amountMinor: z.number().int().min(100),
  currency: z.string().length(3),
  frequency: z.enum(["monthly", "quarterly", "annually"]),
  campaignId: z.string().uuid().optional(),
});
const zConfirm = z.object({ reference: z.string().max(120).optional() });
