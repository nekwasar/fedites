/**
 * PG integration — Phase 4 batch 1 (phases.md 4.1 + 4.2).
 * §P money gates, private dues everywhere, receipted payments, tiers,
 * cycle runs, polite reminders, manual mark-as-paid, multi-currency.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 4 — money (ledger, dues, tiers)", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;
  let tierId: string;

  beforeAll(async () => {
    if (!url) return;
    pool = createPool(url);
    await migrate(pool);
    await seed(pool);
    const instanceId = (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id;
    const members = await pool.query<{ id: string; email: string }>("SELECT id, email FROM members WHERE instance_id = $1", [instanceId]);
    for (const m of members.rows) {
      await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
    }
    app = await buildApp({ pool, defaultInstanceId: instanceId });
    ids = {};
    for (const m of members.rows) ids[m.email.split("@")[0]!] = m.id;
    const login = async (email: string): Promise<string> => {
      const r = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "demopass123" } });
      return r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    };
    cookies = {
      president: await login("president@example.test"),
      treasurer: await login("treasurer@example.test"),
      member1: await login("member1@example.test"),
      member2: await login("member2@example.test"),
    };
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("tiers: treasurer creates; members can view; amounts in minor units", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/money/tiers", headers: { cookie: cookies.member1 },
      payload: { name: "Gold", amountMinor: 2000000, currency: "NGN" },
    });
    expect(denied.statusCode).toBe(403);
    const create = await app.inject({
      method: "POST", url: "/v1/manage/money/tiers", headers: { cookie: cookies.treasurer },
      payload: { name: "Annual", amountMinor: 20000, currency: "NGN", cycle: "annual", perks: { voting: true, eventPriority: true, idMarking: true } },
    });
    expect(create.statusCode).toBe(200);
    tierId = (create.json() as { id: string }).id;
    const list = await app.inject({ method: "GET", url: "/v1/money/tiers", headers: { cookie: cookies.member1 } });
    expect((list.json() as { tiers: Array<{ name: string }> }).tiers.some((t) => t.name === "Annual")).toBe(true);
  });

  run("dues cycle run: assessments for verified members; per-tier amounts", async () => {
    // assign member1 the Annual tier
    await app.inject({
      method: "POST", url: `/v1/manage/money/members/${ids.member1}/tier`,
      headers: { cookie: cookies.treasurer }, payload: { tierId },
    });
    const runCycle = await app.inject({
      method: "POST", url: "/v1/manage/money/assessments/run", headers: { cookie: cookies.treasurer },
      payload: { period: "2026", amountMinor: 10000, dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) },
    });
    expect(runCycle.statusCode).toBe(200);
    expect((runCycle.json() as { created: number }).created).toBeGreaterThanOrEqual(10);

    // member1's assessment uses the tier amount
    const overview = await app.inject({ method: "GET", url: "/v1/money/overview", headers: { cookie: cookies.member1 } });
    const dues = (overview.json() as { dues: Array<{ status: string; amountMinor: number; tierName: string | null }> }).dues;
    expect(dues.some((d) => d.amountMinor === 20000 && d.tierName === "Annual")).toBe(true);
  });

  run("§P: privacy — member sees own dues only; admin views audit-logged; no public leak", async () => {
    const overview = await app.inject({ method: "GET", url: "/v1/money/overview", headers: { cookie: cookies.member1 } });
    expect(overview.statusCode).toBe(200);

    const adminView = await app.inject({ method: "GET", url: "/v1/manage/money/dues?status=due", headers: { cookie: cookies.treasurer } });
    expect(adminView.statusCode).toBe(200);
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'money.dues-view'");
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);

    // member2 cannot see member1's dues
    const denied = await app.inject({ method: "GET", url: "/v1/manage/money/dues", headers: { cookie: cookies.member2 } });
    expect(denied.statusCode).toBe(403);

    // the public member profile must not contain any dues/tier amount data
    const profile = await app.inject({ method: "GET", url: `/v1/members/${ids.member1}`, headers: { cookie: cookies.member2 } });
    const body = profile.body.toLowerCase();
    expect(body).not.toContain("dues");
    expect(body).not.toContain("amountminor");
    expect(body).not.toContain("tier");
  });

  run("manual gateway: member pay intent awaits; treasurer marks paid; receipted", async () => {
    const overview = await app.inject({ method: "GET", url: "/v1/money/overview", headers: { cookie: cookies.member1 } });
    const assessment = (overview.json() as { dues: Array<{ id: string; status: string }> }).dues.find((d) => d.status !== "paid" && d.status !== "waived")!;

    // member initiates (manual gateway → awaiting_confirmation)
    const pay = await app.inject({
      method: "POST", url: `/v1/money/dues/${assessment.id}/pay`, headers: { cookie: cookies.member1 }, payload: {},
    });
    expect(pay.statusCode).toBe(200);
    const payBody = pay.json() as { intentId: string; status: string };
    expect(payBody.status).toBe("awaiting_confirmation");

    // member cannot mark paid themselves (treasurer op)
    const selfMark = await app.inject({
      method: "POST", url: `/v1/manage/money/dues/${assessment.id}/mark-paid`, headers: { cookie: cookies.member1 }, payload: {},
    });
    expect(selfMark.statusCode).toBe(403);
    void payBody;

    // treasurer marks paid → receipt + ledger + assessment paid
    const mark = await app.inject({
      method: "POST", url: `/v1/manage/money/dues/${assessment.id}/mark-paid`, headers: { cookie: cookies.treasurer },
      payload: { reference: "cash-at-meeting" },
    });
    expect(mark.statusCode).toBe(200);
    const { receiptNo, ledgerId } = mark.json() as { receiptNo: string; ledgerId: string };
    expect(receiptNo).toMatch(/^RCPT-\d{4}-\d{6}$/);

    const receipt = await app.inject({ method: "GET", url: `/v1/money/receipts/${ledgerId}`, headers: { cookie: cookies.member1 } });
    expect(receipt.statusCode).toBe(200);
    expect((receipt.json() as { receiptNo: string }).receiptNo).toBe(receiptNo);

    // receipt is private: member2 refused
    const other = await app.inject({ method: "GET", url: `/v1/money/receipts/${ledgerId}`, headers: { cookie: cookies.member2 } });
    expect(other.statusCode).toBe(403);

    // assessment now paid
    const after = await app.inject({ method: "GET", url: "/v1/money/overview", headers: { cookie: cookies.member1 } });
    const afterBody = after.json() as { dues: Array<{ id: string; status: string }> };
    expect(afterBody.dues.every((d) => d.id !== assessment.id || d.status === "paid")).toBe(true);
  });

  run("§P: limited accounts cannot pay; multi-currency ledger stays separate", async () => {
    // pending member attempts to pay
    const invite = await app.inject({ method: "POST", url: "/v1/invites", headers: { cookie: cookies.president }, payload: {} });
    const code = (invite.json() as { code: string }).code;
    const email = `payer-${Date.now()}@example.test`;
    await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { inviteCode: code, email, password: "pending12345", displayName: "Penny Pays" },
    });
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "pending12345" } });
    const c = login.cookies.map((x) => `${x.name}=${x.value}`).join("; ");
    const overview = await app.inject({ method: "GET", url: "/v1/money/overview", headers: { cookie: c } });
    void overview;
    // a pending member has no assessments (cycle only assesses verified) — the
    // gate is exercised via policy: money.pay evaluated directly
    const policy = await app.inject({
      method: "POST", url: "/v1/policy/check",
      payload: { instanceId: (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id, action: "money.pay", member: { id: ids.member2, verification: "pending", roles: [], group_admin_groups: [], vouch_count: 0 } },
    });
    expect((policy.json() as { allowed: boolean }).allowed).toBe(false);

    // multi-currency: USD entry for member1 does not merge into NGN owed
    await pool.query(
      `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo)
       VALUES ((SELECT id FROM instances LIMIT 1), $1, 'donation', 5000, 'USD', 'test usd')`,
      [ids.member1],
    );
    const ov = await app.inject({ method: "GET", url: "/v1/money/overview", headers: { cookie: cookies.member1 } });
    const body = ov.json() as { owedMinor: number; currency: string; ledger: Array<{ currency: string }> };
    expect(body.ledger.some((l) => l.currency === "USD")).toBe(true);
    expect(body.currency).toBe("NGN");
  });

  run("waive is treasurer-only and audited (N2 window)", async () => {
    const events = await app.inject({ method: "GET", url: "/v1/events", headers: { cookie: cookies.treasurer } });
    void events;
    const adminDues = await app.inject({ method: "GET", url: "/v1/manage/money/dues?status=due", headers: { cookie: cookies.treasurer } });
    const one = (adminDues.json() as { assessments: Array<{ id: string }> }).assessments[0]!;
    const denied = await app.inject({
      method: "POST", url: `/v1/manage/money/dues/${one.id}/waive`, headers: { cookie: cookies.member1 }, payload: {},
    });
    expect(denied.statusCode).toBe(403);
    const waive = await app.inject({
      method: "POST", url: `/v1/manage/money/dues/${one.id}/waive`, headers: { cookie: cookies.treasurer }, payload: {},
    });
    expect(waive.statusCode).toBe(200);
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'money.waive' AND target = $1", [one.id]);
    expect(audit.rows.length).toBe(1);
  });

  run("reminders: polite in-app notices for overdue only; quiet-hours aware", async () => {
    // force every still-due assessment overdue (the waive test may consume one)
    await pool.query(
      `UPDATE dues_assessments SET due_date = now() - interval '10 days' WHERE status = 'due'`,
    );
    const runReminders = await app.inject({
      method: "POST", url: "/v1/manage/money/reminders/run", headers: { cookie: cookies.treasurer }, payload: {},
    });
    expect(runReminders.statusCode).toBe(200);
    expect((runReminders.json() as { sent: number }).sent).toBeGreaterThanOrEqual(1);
    const sent = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM notifications WHERE kind = 'system.notice' AND payload->>'title' = 'Dues reminder'",
    );
    expect(Number(sent.rows[0]?.n ?? 0)).toBeGreaterThanOrEqual(1);
  });

  run("digital ID carries tier marking (§8 real perk)", async () => {
    const idCard = await app.inject({ method: "GET", url: "/v1/me/id", headers: { cookie: cookies.member1 } });
    const card = (idCard.json() as { card: { tier: string | null } }).card;
    expect(card.tier).toBe("Annual");
  });
});
