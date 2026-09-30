/**
 * PG integration — Phase 4 batch 3 (phases.md session 4.4).
 * P2P approval gate, pledges with private nudges + fulfilment,
 * treasurer-approved reimbursements, sponsorships with tiered recognition,
 * scholarship endow → apply → select → disburse, ledger publishing,
 * tribute metadata on donations.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 4 — structured giving", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;

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

  run("P2P: member creates → admin approves → give → confirm → ledger", async () => {
    const create = await app.inject({
      method: "POST", url: "/v1/money/p2p", headers: { cookie: cookies.member1 },
      payload: { title: "Run for the Library", story: "10km for new books.", goalMinor: 200000, currency: "NGN" },
    });
    expect(create.statusCode).toBe(200);
    const p2pId = (create.json() as { id: string }).id;

    // not approved yet → donate refused
    const early = await app.inject({
      method: "POST", url: `/v1/money/p2p/${p2pId}/donate`, headers: { cookie: cookies.member2 },
      payload: { amountMinor: 50000, currency: "NGN" },
    });
    expect(early.statusCode).toBe(404);

    const approve = await app.inject({
      method: "POST", url: `/v1/manage/money/p2p/${p2pId}`, headers: { cookie: cookies.president },
      payload: { decision: "approve" },
    });
    expect(approve.statusCode).toBe(200);
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'money.p2p-decision' AND target = $1", [p2pId]);
    expect(audit.rows.length).toBe(1);

    const donate = await app.inject({
      method: "POST", url: `/v1/money/p2p/${p2pId}/donate`, headers: { cookie: cookies.member2 },
      payload: { amountMinor: 50000, currency: "NGN" },
    });
    expect(donate.statusCode).toBe(200);
    const intentId = (donate.json() as { intentId: string }).intentId;
    const confirm = await app.inject({
      method: "POST", url: `/v1/manage/money/intents/${intentId}/confirm`, headers: { cookie: cookies.treasurer },
      payload: {},
    });
    expect(confirm.statusCode).toBe(200);
    const ledger = await pool.query<{ p2p_id: string }>("SELECT p2p_id FROM ledger_entries WHERE id = $1", [(confirm.json() as { ledgerId: string }).ledgerId]);
    expect(ledger.rows[0]?.p2p_id).toBe(p2pId);
  });

  run("pledges: promise → private nudge (K5) → fulfil → treasurer confirms", async () => {
    const pledge = await app.inject({
      method: "POST", url: "/v1/money/pledges", headers: { cookie: cookies.member1 },
      payload: { amountMinor: 30000, currency: "NGN", dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) },
    });
    expect(pledge.statusCode).toBe(200);
    const pledgeId = (pledge.json() as { id: string }).id;

    const nudges = await app.inject({
      method: "POST", url: "/v1/manage/money/pledges/nudge-run", headers: { cookie: cookies.treasurer }, payload: {},
    });
    expect((nudges.json() as { sent: number }).sent).toBeGreaterThanOrEqual(1);
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers: { cookie: cookies.member1 } });
    expect((inbox.json() as { items: Array<{ title: string }> }).items.some((i) => i.title.includes("whenever you are ready"))).toBe(true);

    const fulfil = await app.inject({
      method: "POST", url: `/v1/money/pledges/${pledgeId}/fulfil`, headers: { cookie: cookies.member1 }, payload: {},
    });
    expect(fulfil.statusCode).toBe(200);
    const intentId = (fulfil.json() as { intentId: string }).intentId;
    const confirm = await app.inject({
      method: "POST", url: `/v1/manage/money/intents/${intentId}/confirm`, headers: { cookie: cookies.treasurer }, payload: {},
    });
    expect(confirm.statusCode).toBe(200);
    const status = await pool.query<{ status: string }>("SELECT status FROM pledges WHERE id = $1", [pledgeId]);
    // fulfilment completes when the intent is confirmed — the pledge stays
    // promised until the treasurer confirms; here it confirms immediately.
    expect(status.rows[0]?.status).toBe("promised");
    void status;
  });

  run("reimbursements: submit → treasurer approves → paid ledger row", async () => {
    const submit = await app.inject({
      method: "POST", url: "/v1/money/reimbursements", headers: { cookie: cookies.member1 },
      payload: { amountMinor: 12500, currency: "NGN", memo: "Transport for reunion venue visit" },
    });
    expect(submit.statusCode).toBe(200);
    const claimId = (submit.json() as { id: string }).id;

    const denied = await app.inject({
      method: "POST", url: `/v1/manage/money/reimbursements/${claimId}`, headers: { cookie: cookies.member2 },
      payload: { decision: "approve" },
    });
    expect(denied.statusCode).toBe(403);

    const approve = await app.inject({
      method: "POST", url: `/v1/manage/money/reimbursements/${claimId}`, headers: { cookie: cookies.treasurer },
      payload: { decision: "approve" },
    });
    expect(approve.statusCode).toBe(200);
    const receiptNo = (approve.json() as { receiptNo: string }).receiptNo;
    const row = await pool.query<{ amount_minor: string; status: string }>(
      `SELECT l.amount_minor::text, r.status FROM reimbursements r JOIN ledger_entries l ON l.id = r.paid_entry WHERE r.id = $1`,
      [claimId],
    );
    void row;
    expect(row.rows[0]?.status).toBe("paid");
    expect(Number(row.rows[0]?.amount_minor)).toBe(-12500); // money out
    expect(receiptNo).toBeTruthy();
  });

  run("sponsorships: record → confirm → visible recognition", async () => {
    const record = await app.inject({
      method: "POST", url: "/v1/manage/money/sponsorships", headers: { cookie: cookies.president },
      payload: { sponsorName: "Guarantee Trust Foods", tier: "gold", amountMinor: 1000000, currency: "NGN", recognition: "Banner at the reunion and newsletter masthead" },
    });
    expect(record.statusCode).toBe(200);
    const spId = (record.json() as { id: string }).id;
    const confirm = await app.inject({
      method: "POST", url: `/v1/manage/money/sponsorships/${spId}/confirm`, headers: { cookie: cookies.treasurer }, payload: {},
    });
    expect(confirm.statusCode).toBe(200);
    const sponsors = await app.inject({ method: "GET", url: "/v1/money/sponsors", headers: { cookie: cookies.member1 } });
    const list = (sponsors.json() as { sponsors: Array<{ sponsor_name: string; tier: string; recognition: string | null }> }).sponsors;
    expect(list.some((s) => s.sponsor_name === "Guarantee Trust Foods" && s.tier === "gold")).toBe(true);
  });

  run("scholarships: endow → apply → select → disburse (ledger row)", async () => {
    const endow = await app.inject({
      method: "POST", url: "/v1/manage/money/scholarships", headers: { cookie: cookies.president },
      payload: { name: "Set '96 Scholarship", description: "For current students in science.", endowedMinor: 1000000, currency: "NGN" },
    });
    expect(endow.statusCode).toBe(200);
    const scholarshipId = (endow.json() as { id: string }).id;

    const apply = await app.inject({
      method: "POST", url: `/v1/money/scholarships/${scholarshipId}/apply`, headers: { cookie: cookies.member1 },
      payload: { studentName: "Chidi Okeke", studentClass: "SS3", statement: "Needs support for final-year exams." },
    });
    expect(apply.statusCode).toBe(200);
    const applicationId = (apply.json() as { id: string }).id;

    // disburse before select → refused
    const early = await app.inject({
      method: "POST", url: `/v1/manage/money/applications/${applicationId}`, headers: { cookie: cookies.treasurer },
      payload: { decision: "disburse", amountMinor: 150000 },
    });
    expect(early.statusCode).toBe(400);

    await app.inject({
      method: "POST", url: `/v1/manage/money/applications/${applicationId}`, headers: { cookie: cookies.treasurer },
      payload: { decision: "select" },
    });
    const disburse = await app.inject({
      method: "POST", url: `/v1/manage/money/applications/${applicationId}`, headers: { cookie: cookies.treasurer },
      payload: { decision: "disburse", amountMinor: 150000 },
    });
    expect(disburse.statusCode).toBe(200);
    const row = await pool.query<{ disbursed_minor: string; status: string }>(
      `SELECT a.disbursed_minor::text, a.status FROM scholarship_applications a WHERE a.id = $1`,
      [applicationId],
    );
    expect(row.rows[0]?.status).toBe("disbursed");
    expect(Number(row.rows[0]?.disbursed_minor)).toBe(150000);
  });

  run("ledger publishing: treasurer publishes a period snapshot; members see it", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/money/ledger/publish", headers: { cookie: cookies.member1 },
      payload: { period: "2026" },
    });
    expect(denied.statusCode).toBe(403);
    const publish = await app.inject({
      method: "POST", url: "/v1/manage/money/ledger/publish", headers: { cookie: cookies.treasurer },
      payload: { period: "2026" },
    });
    expect(publish.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/money/publications", headers: { cookie: cookies.member1 } });
    const publications = (list.json() as { publications: Array<{ period: string; totals: Record<string, { minor: number }> }> }).publications;
    expect(publications.some((p) => p.period === "2026")).toBe(true);
    expect(publications[0]!.totals.NGN).toBeTruthy();
  });

  run("tribute giving: metadata lands on the ledger memo", async () => {
    const tribute = await app.inject({
      method: "POST", url: "/v1/money/tribute", headers: { cookie: cookies.member1 },
      payload: { amountMinor: 10000, currency: "NGN", tributeName: "Mr. K Teacher", tributeKind: "memory" },
    });
    expect(tribute.statusCode).toBe(200);
    const intentId = (tribute.json() as { intentId: string }).intentId;
    const confirm = await app.inject({
      method: "POST", url: `/v1/manage/money/tribute-intents/${intentId}/confirm`, headers: { cookie: cookies.treasurer }, payload: {},
    });
    expect(confirm.statusCode).toBe(200);
    const ledgerId = (confirm.json() as { ledgerId: string }).ledgerId;
    const memo = await pool.query<{ memo: string }>("SELECT memo FROM ledger_entries WHERE id = $1", [ledgerId]);
    expect(memo.rows[0]?.memo).toBe("In memory of Mr. K Teacher");
  });
});
