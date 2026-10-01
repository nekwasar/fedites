/**
 * PG integration — Phase 5 batch 1 (phases.md session 5.1).
 * Enterprise bulk admin upload, member pending→approve archive flow,
 * yearbook CSV import + name search, on-this-day resurfacing, memorial
 * request → memorial state (§P) + condolence book, hall of fame.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

const IMG_A = Buffer.from("throwback-image-A-bytes");

describe("phase 5 — memory lane", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;
  let eraId: string;

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

  run("admin bulk upload: multi-file → approved archive items in one request", async () => {
    const era = await app.inject({
      method: "POST", url: "/v1/manage/memory/eras", headers: { cookie: cookies.president },
      payload: { name: "The Boarding Years", yearFrom: 1994, yearTo: 1998 },
    });
    eraId = (era.json() as { id: string }).id;

    const boundary = "----membulk";
    const parts: Buffer[] = [];
    for (const [i, name] of ["1997-sports.png", "1997-dining.png"].entries()) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`));
      parts.push(Buffer.from(`bulk-image-${i}-${name}`));
      parts.push(Buffer.from(`\r\n`));
    }
    for (const [k, v] of Object.entries({ kind: "throwback", eraId, year: "1997", caption: "Sports day, boarding years" })) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const bulk = await app.inject({
      method: "POST", url: "/v1/manage/memory/bulk",
      headers: { cookie: cookies.president, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat(parts),
    });
    expect(bulk.statusCode).toBe(200);
    expect((bulk.json() as { created: number }).created).toBe(2);

    const wall = await app.inject({
      method: "GET", url: `/v1/memory/throwbacks?eraId=${eraId}`, headers: { cookie: cookies.member1 },
    });
    const items = (wall.json() as { items: Array<{ status: string; era: string | null; year: number | null }> }).items;
    expect(items.length).toBe(2);
    expect(items.every((i) => i.status === "approved" && i.era === "The Boarding Years" && i.year === 1997)).toBe(true);
  });

  run("member upload → pending → admin approves (§P); non-admin cannot approve", async () => {
    const media = await app.inject({
      method: "POST", url: "/v1/media",
      headers: { cookie: cookies.member1, "content-type": `multipart/form-data; boundary=${Date.now()}` },
      payload: undefined,
    });
    void media;
    // simpler: member uploads via bulk-free single route with an existing media id
    const boundary = "----mm";
    const up = await app.inject({
      method: "POST", url: "/v1/media",
      headers: { cookie: cookies.member1, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`),
        IMG_A,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    const mediaId = (up.json() as { id: string }).id;
    const upload = await app.inject({
      method: "POST", url: "/v1/memory/throwbacks", headers: { cookie: cookies.member1 },
      payload: { mediaId, year: 1998, caption: "Our final year" },
    });
    expect(upload.statusCode).toBe(200);
    expect((upload.json() as { status: string }).status).toBe("pending");

    // not visible to others while pending
    const wall = await app.inject({ method: "GET", url: "/v1/memory/throwbacks", headers: { cookie: cookies.member2 } });
    expect((wall.json() as { items: Array<{ status: string }> }).items.every((i) => i.status === "approved")).toBe(true);

    // member cannot approve
    const denied = await app.inject({
      method: "POST", url: `/v1/manage/memory/queue/${(upload.json() as { id: string }).id}`,
      headers: { cookie: cookies.member1 }, payload: { decision: "approve" },
    });
    expect(denied.statusCode).toBe(403);

    const queue = await app.inject({ method: "GET", url: "/v1/manage/memory/queue", headers: { cookie: cookies.president } });
    const itemId = (queue.json() as { pending: Array<{ id: string }> }).pending[0]!.id;
    const approve = await app.inject({
      method: "POST", url: `/v1/manage/memory/queue/${itemId}`, headers: { cookie: cookies.president },
      payload: { decision: "approve" },
    });
    expect(approve.statusCode).toBe(200);
  });

  run("yearbook: register + CSV import + name search", async () => {
    const book = await app.inject({
      method: "POST", url: "/v1/manage/memory/yearbooks", headers: { cookie: cookies.president },
      payload: { year: 1998, title: "The Final Graduation" },
    });
    const bookId = (book.json() as { id: string }).id;
    const csv = "Ada President,House Mercury\nFemi Member,Science Club\nGozie Member";
    const imp = await app.inject({
      method: "POST", url: `/v1/manage/memory/yearbooks/${bookId}/names-csv`, headers: { cookie: cookies.president },
      payload: { csv },
    });
    expect((imp.json() as { imported: number }).imported).toBe(3);

    const search = await app.inject({
      method: "GET", url: `/v1/memory/yearbooks/${bookId}?q=femi`, headers: { cookie: cookies.member1 },
    });
    const entries = (search.json() as { entries: Array<{ full_name: string; section: string | null }> }).entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.full_name).toBe("Femi Member");
    expect(entries[0]!.section).toBe("Science Club");
  });

  run("hall of fame: admin-curated, visible to all", async () => {
    const hon = await app.inject({
      method: "POST", url: "/v1/manage/memory/hall-of-fame", headers: { cookie: cookies.president },
      payload: { name: "Ada President", citation: "Led the restoration of the library.", year: 2026, memberId: ids.president },
    });
    expect(hon.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/memory/hall-of-fame", headers: { cookie: cookies.member2 } });
    expect((list.json() as { honourees: Array<{ display_name: string }> }).honourees.some((h) => h.display_name === "Ada President")).toBe(true);
  });

  run("memorial: request → approval → memorial state (no logins) → condolence book", async () => {
    // member2 requests a memorial for... a member who is a platform member:
    // use teacher1 (honorary) as the deceased for the test
    const req = await app.inject({
      method: "POST", url: "/v1/memory/memorials", headers: { cookie: cookies.member1 },
      payload: { memberId: ids.teacher1, tribute: "The teacher who never gave up on us." },
    });
    expect(req.statusCode).toBe(200);
    const memorialId = (req.json() as { id: string }).id;

    // condolence before approval → refused
    const early = await app.inject({
      method: "POST", url: `/v1/memory/memorials/${memorialId}/condolences`, headers: { cookie: cookies.member1 },
      payload: { message: "Rest well, sir." },
    });
    expect(early.statusCode).toBe(404);

    const approve = await app.inject({
      method: "POST", url: `/v1/manage/memory/memorials/${memorialId}`, headers: { cookie: cookies.president },
      payload: { decision: "approve" },
    });
    expect(approve.statusCode).toBe(200);

    // memorial state: no logins for the deceased member (§P)
    const loginAttempt = await app.inject({
      method: "POST", url: "/v1/auth/login", payload: { email: "teacher1@example.test", password: "demopass123" },
    });
    expect(loginAttempt.statusCode).toBe(401);

    // condolence book now works; attendance coordination recorded
    const cond = await app.inject({
      method: "POST", url: `/v1/memory/memorials/${memorialId}/condolences`, headers: { cookie: cookies.member1 },
      payload: { message: "Rest well, sir. Thank you for everything.", attending: true },
    });
    expect(cond.statusCode).toBe(200);
    const page = await app.inject({ method: "GET", url: `/v1/memory/memorials/${memorialId}`, headers: { cookie: cookies.member1 } });
    const body = page.json() as { condolences: Array<{ attending: boolean }>; memorial: { status: string } };
    expect(body.memorial.status).toBe("approved");
    expect(body.condolences.some((c) => c.attending)).toBe(true);
  });

  run("on this day: approved memories from this day in past years resurface", async () => {
    // seed a throwback created "today" but dated 1997, plus an old post from this day last year
    await pool.query(
      `UPDATE memory_items SET created_at = now() - interval '1 year'
       WHERE id = (SELECT id FROM memory_items WHERE caption LIKE 'Sports day%' LIMIT 1)`,
    );
    await pool.query(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body, created_at)
       VALUES ((SELECT id FROM instances LIMIT 1), (SELECT id FROM groups WHERE name='Set ''98'), $1, 'post', 'A post from this day last year.', now() - interval '1 year')`,
      [ids.member1],
    );
    const res = await app.inject({ method: "GET", url: "/v1/memory/on-this-day", headers: { cookie: cookies.member1 } });
    const memories = (res.json() as { memories: Array<{ kind: string }> }).memories;
    expect(memories.some((m) => m.kind === "memory")).toBe(true);
    expect(memories.some((m) => m.kind === "post")).toBe(true);
  });
});
