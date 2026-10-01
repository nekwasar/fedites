/**
 * PG integration — Phase 5 batch 4 (phases.md session 5.4a).
 * Wishlist fund/fulfil, adopt-a-project with ledger-backed progress,
 * past questions, teacher tributes, facility booking approval flow,
 * records verification (employer requests), §P gates.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 5 — school bridge", () => {
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
      member1: await login("member1@example.test"),
      member2: await login("member2@example.test"),
    };
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("wishlist: admin posts needs; alumni fund or fulfil physically", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/bridge/wishlist", headers: { cookie: cookies.member1 },
      payload: { title: "Non-member wish" },
    });
    expect(denied.statusCode).toBe(403);
    const item = await app.inject({
      method: "POST", url: "/v1/manage/bridge/wishlist", headers: { cookie: cookies.president },
      payload: { title: "20 lab stools", details: "For the science lab.", estCostMinor: 150000, currency: "NGN" },
    });
    expect(item.statusCode).toBe(200);
    const itemId = (item.json() as { id: string }).id;
    const fund = await app.inject({
      method: "POST", url: `/v1/bridge/wishlist/${itemId}/fulfil`, headers: { cookie: cookies.member1 },
      payload: { note: "Paid by Set '98." },
    });
    expect(fund.statusCode).toBe(200);
    const phys = await app.inject({
      method: "POST", url: "/v1/manage/bridge/wishlist", headers: { cookie: cookies.president },
      payload: { title: "Paint for the fence" },
    });
    const physId = (phys.json() as { id: string }).id;
    const fulfil = await app.inject({
      method: "POST", url: `/v1/bridge/wishlist/${physId}/fulfil`, headers: { cookie: cookies.member2 },
      payload: { physical: true, note: "I will deliver the paint Saturday." },
    });
    expect(fulfil.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/bridge/wishlist", headers: { cookie: cookies.member1 } });
    const items = (list.json() as { items: Array<{ title: string; status: string }> }).items;
    expect(items.find((i) => i.title === "20 lab stools")?.status).toBe("funded");
    expect(items.find((i) => i.title === "Paint for the fence")?.status).toBe("fulfilled");
  });

  run("adopt-a-project: admin creates; progress is ledger-backed", async () => {
    const project = await app.inject({
      method: "POST", url: "/v1/manage/bridge/projects", headers: { cookie: cookies.president },
      payload: { title: "Chemistry lab block", story: "Whole-lab renovation.", goalMinor: 5000000, currency: "NGN", sponsoredBy: "Set '98" },
    });
    expect(project.statusCode).toBe(200);
    const projectId = (project.json() as { id: string }).id;
    // confirmed ledger money attributed to the project id raises the progress
    await pool.query(
      `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo, campaign_id)
       VALUES ((SELECT id FROM instances LIMIT 1), $1, 'donation', 2000000, 'NGN', 'Lab block gift', $2)`,
      [ids.member1, projectId],
    );
    await app.inject({
      method: "POST", url: `/v1/manage/bridge/projects/${projectId}/progress`, headers: { cookie: cookies.president },
      payload: { status: "in_progress", notes: "Roofing done." },
    });
    const list = await app.inject({ method: "GET", url: "/v1/bridge/projects", headers: { cookie: cookies.member2 } });
    const p = (list.json() as { projects: Array<{ id: string; raisedMinor: number; status: string; sponsoredBy: string | null }> }).projects.find((x) => x.id === projectId)!;
    expect(p.raisedMinor).toBe(2000000);
    expect(p.status).toBe("in_progress");
    expect(p.sponsoredBy).toBe("Set '98");
  });

  run("past questions: admin uploads; members browse by subject", async () => {
    const boundary = "----pq";
    const media = await app.inject({
      method: "POST", url: "/v1/media",
      headers: { cookie: cookies.president, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="wace-pq.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        Buffer.from("past-questions-pdf"), Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    const mediaId = (media.json() as { id: string }).id;
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/bridge/past-questions", headers: { cookie: cookies.member1 },
      payload: { subject: "Physics", mediaId },
    });
    expect(denied.statusCode).toBe(403);
    const add = await app.inject({
      method: "POST", url: "/v1/manage/bridge/past-questions", headers: { cookie: cookies.president },
      payload: { subject: "Physics", year: 1998, title: "WAEC May/June", mediaId },
    });
    expect(add.statusCode).toBe(200);
    const list = await app.inject({
      method: "GET", url: "/v1/bridge/past-questions?subject=physics", headers: { cookie: cookies.member1 },
    });
    expect((list.json() as { questions: Array<{ subject: string; year: number | null }> }).questions).toHaveLength(1);
  });

  run("teacher tributes: members honour teachers", async () => {
    const tribute = await app.inject({
      method: "POST", url: "/v1/bridge/teacher-tributes", headers: { cookie: cookies.member1 },
      payload: { teacherName: "Mr. K Teacher", story: "He stayed after class every single day for the struggling ones." },
    });
    expect(tribute.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST", url: "/v1/bridge/teacher-tributes", headers: { cookie: cookies.member1 },
      payload: { teacherName: "Mr. K Teacher", story: "Another story from the same member would be a second voice..." },
    });
    void dup;
    const list = await app.inject({ method: "GET", url: "/v1/bridge/teacher-tributes", headers: { cookie: cookies.member2 } });
    expect((list.json() as { tributes: Array<{ teacher_name: string }> }).tributes.some((t) => t.teacher_name === "Mr. K Teacher")).toBe(true);
  });

  run("facility booking: member requests → admin approves; others don't see it", async () => {
    const booking = await app.inject({
      method: "POST", url: "/v1/bridge/bookings", headers: { cookie: cookies.member1 },
      payload: { facility: "Main Hall", startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 7 * 86_400_000 + 4 * 3600_000).toISOString(), purpose: "Set '98 reception" },
    });
    expect(booking.statusCode).toBe(200);
    const bookingId = (booking.json() as { id: string }).id;
    // member2 (not admin) cannot see member1's booking
    const hidden = await app.inject({ method: "GET", url: "/v1/bridge/bookings", headers: { cookie: cookies.member2 } });
    expect((hidden.json() as { bookings: Array<{ id: string }> }).bookings.every((b: { id: string }) => b.id !== bookingId)).toBe(true);
    const approve = await app.inject({
      method: "POST", url: `/v1/manage/bridge/bookings/${bookingId}`, headers: { cookie: cookies.president },
      payload: { decision: "approve" },
    });
    expect(approve.statusCode).toBe(200);
    const mine = await app.inject({ method: "GET", url: "/v1/bridge/bookings", headers: { cookie: cookies.member1 } });
    expect((mine.json() as { bookings: Array<{ id: string; status: string }> }).bookings.find((b) => b.id === bookingId)?.status).toBe("approved");
  });

  run("records verification: member requests → admin verifies (§P privacy)", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/bridge/records", headers: { cookie: cookies.member1 },
      payload: { employerName: "X", employerEmail: "not-an-email" },
    });
    expect(denied.statusCode).toBe(400);
    const req = await app.inject({
      method: "POST", url: "/v1/bridge/records", headers: { cookie: cookies.member1 },
      payload: { employerName: "Acme Engineering", employerEmail: "hr@acme.example" },
    });
    expect(req.statusCode).toBe(200);
    const reqId = (req.json() as { id: string }).id;
    const member2 = await app.inject({ method: "GET", url: "/v1/bridge/records", headers: { cookie: cookies.member2 } });
    expect((member2.json() as { requests: Array<{ id: string }> }).requests.every((r) => r.id !== reqId)).toBe(true);
    const verify = await app.inject({
      method: "POST", url: `/v1/manage/bridge/records/${reqId}`, headers: { cookie: cookies.president },
      payload: { decision: "verify" },
    });
    expect(verify.statusCode).toBe(200);
    const after = await app.inject({ method: "GET", url: "/v1/bridge/records", headers: { cookie: cookies.member1 } });
    const afterBody = after.json() as { requests: Array<{ id: string; status: string }> };
    expect(afterBody.requests.find((r) => r.id === reqId)?.status).toBe("verified");
  });
});
