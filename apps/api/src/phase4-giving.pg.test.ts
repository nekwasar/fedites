/**
 * PG integration — Phase 4 batch 2 (phases.md session 4.3).
 * Donations (§P gate), campaigns with progress + goal completion (F6 marker),
 * donor wall with anonymous toggle (§P, K2), transparent ledger that never
 * shows dues, CSV download, recurring schedules.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 4 — giving (campaigns, wall, transparent ledger)", () => {
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

  run("campaigns: duty-only creation; members see open list with progress", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/money/campaigns", headers: { cookie: cookies.member1 },
      payload: { title: "Rooftop fund", goalMinor: 500000, currency: "NGN" },
    });
    expect(denied.statusCode).toBe(403);
    const create = await app.inject({
      method: "POST", url: "/v1/manage/money/campaigns", headers: { cookie: cookies.president },
      payload: { title: "Science Lab Roof", description: "Fix the lab roof before the rains.", goalMinor: 500000, currency: "NGN" },
    });
    expect(create.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/money/campaigns", headers: { cookie: cookies.member1 } });
    const campaigns = (list.json() as { campaigns: Array<{ id: string; raisedMinor: number; progress: number }> }).campaigns;
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]!.raisedMinor).toBe(0);
    expect(campaigns[0]!.progress).toBe(0);
  });

  run("§P: pending member cannot donate; verified member can", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/money/donate", headers: { cookie: cookies.member1 },
      payload: { amountMinor: 100000, currency: "NGN" },
    });
    // member1 is verified → allowed
    expect(denied.statusCode).toBe(200);
    const pendingPolicy = await app.inject({
      method: "POST", url: "/v1/policy/check",
      payload: { instanceId: (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id, action: "money.pay", member: { id: ids.member2, verification: "pending", roles: [], group_admin_groups: [], vouch_count: 0 } },
    });
    expect((pendingPolicy.json() as { allowed: boolean }).allowed).toBe(false);
  });

  run("donations: intent → treasurer confirm → ledger + wall + progress + F6 marker", async () => {
    const campaigns = await app.inject({ method: "GET", url: "/v1/money/campaigns", headers: { cookie: cookies.member1 } });
    const campaignId = (campaigns.json() as { campaigns: Array<{ id: string }> }).campaigns[0]!.id;

    // anonymous donation
    const donate = await app.inject({
      method: "POST", url: `/v1/money/campaigns/${campaignId}/donate`, headers: { cookie: cookies.member1 },
      payload: { amountMinor: 300000, currency: "NGN", anonymous: true },
    });
    expect(donate.statusCode).toBe(200);

    // named donation from member2
    const donate2 = await app.inject({
      method: "POST", url: `/v1/money/campaigns/${campaignId}/donate`, headers: { cookie: cookies.member2 },
      payload: { amountMinor: 250000, currency: "NGN", anonymous: false },
    });
    expect(donate2.statusCode).toBe(200);

    // treasurer confirms everything awaiting (incl. member1's general gift)
    const queue = await app.inject({ method: "GET", url: "/v1/manage/money/intents", headers: { cookie: cookies.treasurer } });
    const intents = (queue.json() as { intents: Array<{ id: string }> }).intents;
    expect(intents.length).toBeGreaterThanOrEqual(2);
    for (const intent of intents) {
      const confirm = await app.inject({
        method: "POST", url: `/v1/manage/money/intents/${intent.id}/confirm`, headers: { cookie: cookies.treasurer },
        payload: {},
      });
      expect(confirm.statusCode).toBe(200);
    }

    // goal 500000 reached by 550000 → F6 marker set
    const detail = await app.inject({ method: "GET", url: "/v1/money/campaigns", headers: { cookie: cookies.member1 } });
    const done = (detail.json() as { campaigns: Array<{ goalReached: boolean; raisedMinor: number; progress: number }> }).campaigns[0]!;
    expect(done.raisedMinor).toBe(550000);
    expect(done.progress).toBe(100);
    expect(done.goalReached).toBe(true);
    const marker = await pool.query("SELECT goal_reached_at FROM campaigns WHERE id = $1", [campaignId]);
    expect(marker.rows[0]?.goal_reached_at).toBeTruthy();

    // donor wall: names by default, anonymous respected, NO amounts (K2)
    const donors = await app.inject({ method: "GET", url: `/v1/money/campaigns/${campaignId}/donors`, headers: { cookie: cookies.member1 } });
    const list = (donors.json() as { donors: Array<{ name: string }> }).donors;
    expect(list.some((d) => d.name === "Anonymous friend")).toBe(true);
    expect(list.some((d) => d.name === "Gozie Member")).toBe(true);
    expect(JSON.stringify(list).toLowerCase()).not.toContain("amount");
  });

  run("transparent ledger: donations visible, dues never; CSV export works", async () => {
    // member1 has a dues payment (private_ledger = true) — must not appear
    const ledger = await app.inject({ method: "GET", url: "/v1/money/transparent-ledger", headers: { cookie: cookies.member1 } });
    const body = ledger.json() as { rows: Array<{ kind: string; payer: string | null }>; totals: Record<string, number> };
    expect(body.rows.every((r) => r.kind !== "dues")).toBe(true);
    expect(body.rows.some((r) => r.kind === "campaign" || r.kind === "donation")).toBe(true);
    expect(Object.keys(body.totals).length).toBeGreaterThanOrEqual(1);

    // anonymous donor stays anonymous in the ledger
    const anonRow = body.rows.find((r) => r.kind === "campaign" && r.payer === "Anonymous friend");
    expect(anonRow).toBeTruthy();

    const csv = await app.inject({ method: "GET", url: "/v1/money/transparent-ledger?format=csv", headers: { cookie: cookies.member1 } });
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body).toContain("kind,amount_minor,currency");
  });

  run("recurring schedule: create → treasurer run → intent + notice; cancel works", async () => {
    const create = await app.inject({
      method: "POST", url: "/v1/money/schedules", headers: { cookie: cookies.member1 },
      payload: { amountMinor: 50000, currency: "NGN", frequency: "monthly" },
    });
    expect(create.statusCode).toBe(200);
    // force due
    await pool.query("UPDATE donation_schedules SET next_date = now() - interval '1 day' WHERE member_id = $1", [ids.member1]);
    const run = await app.inject({ method: "POST", url: "/v1/manage/money/schedules/run", headers: { cookie: cookies.treasurer }, payload: {} });
    expect((run.json() as { created: number }).created).toBeGreaterThanOrEqual(1);
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers: { cookie: cookies.member1 } });
    expect((inbox.json() as { items: Array<{ title: string }> }).items.some((i) => i.title.includes("recurring gift"))).toBe(true);
    const schedules = await app.inject({ method: "GET", url: "/v1/money/schedules", headers: { cookie: cookies.member1 } });
    const schedule = (schedules.json() as { schedules: Array<{ id: string; nextDate: string }> }).schedules[0]!;
    expect(new Date(schedule.nextDate).getTime()).toBeGreaterThan(Date.now());
    const cancel = await app.inject({ method: "DELETE", url: `/v1/money/schedules/${schedule.id}`, headers: { cookie: cookies.member1 } });
    expect(cancel.statusCode).toBe(200);
  });
});
