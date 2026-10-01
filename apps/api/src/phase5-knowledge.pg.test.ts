/**
 * PG integration — Phase 5 batch 2 (phases.md session 5.2).
 * Wiki with full revision history + lock + revert (N1), slang dictionary
 * member submissions with admin approval, history timeline, spotlights,
 * long-form articles with admin screening.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 5 — knowledge & voices", () => {
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

  run("wiki: create → edit → revision history → revert (nothing lost)", async () => {
    const create = await app.inject({
      method: "PUT", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.member1 },
      payload: { title: "The Houses", body: "Mercury, Vulcan and Apollo competed every term." },
    });
    expect(create.statusCode).toBe(200);

    const edit = await app.inject({
      method: "PUT", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.member2 },
      payload: { body: "Mercury, Vulcan and Apollo competed every term. Vulcan dominated athletics.", note: "Added athletics note" },
    });
    expect(edit.statusCode).toBe(200);

    const page = await app.inject({ method: "GET", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.member1 } });
    const body = page.json() as { page: { body: string }; history: Array<{ id: string; note: string | null }> };
    expect(body.page.body).toContain("Vulcan dominated");
    expect(body.history.length).toBe(2);

    // revert to the first revision → a NEW revision with the old body
    const first = body.history[1]!;
    const revert = await app.inject({
      method: "POST", url: "/v1/wiki/pages/houses/revert/" + first.id, headers: { cookie: cookies.member1 },
      payload: {},
    });
    expect(revert.statusCode).toBe(200);
    const after = await app.inject({ method: "GET", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.member1 } });
    const afterBody = after.json() as { page: { body: string }; history: Array<unknown> };
    expect(afterBody.page.body).toContain("competed every term.");
    expect(afterBody.page.body).not.toContain("Vulcan dominated");
    expect(afterBody.history.length).toBe(3); // revert = new revision
  });

  run("wiki lock: locked page refuses member edits, admins can edit", async () => {
    const page = await app.inject({ method: "GET", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.president } });
    const pageId = (page.json() as { page: { id: string } }).page.id;
    await app.inject({
      method: "POST", url: "/v1/manage/wiki/pages/" + pageId + "/lock", headers: { cookie: cookies.president },
      payload: { locked: true },
    });
    const denied = await app.inject({
      method: "PUT", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.member1 },
      payload: { body: "vandalism attempt" },
    });
    expect(denied.statusCode).toBe(403);
    const adminEdit = await app.inject({
      method: "PUT", url: "/v1/wiki/pages/houses", headers: { cookie: cookies.president },
      payload: { body: "Admin-maintained history of the houses." },
    });
    expect(adminEdit.statusCode).toBe(200);
  });

  run("slang dictionary: member submission pending → admin approves → searchable", async () => {
    const submit = await app.inject({
      method: "POST", url: "/v1/slang", headers: { cookie: cookies.member1 },
      payload: { term: "Jacking", meaning: "Skipping afternoon prep sneakily.", example: "He was caught jacking behind the labs." },
    });
    expect(submit.statusCode).toBe(200);
    expect((submit.json() as { status: string }).status).toBe("pending");

    // not in dictionary while pending
    const before = await app.inject({ method: "GET", url: "/v1/slang?q=jacking", headers: { cookie: cookies.member2 } });
    expect((before.json() as { terms: unknown[] }).terms).toHaveLength(0);

    const queue = await app.inject({ method: "GET", url: "/v1/manage/slang", headers: { cookie: cookies.president } });
    const termId = (queue.json() as { pending: Array<{ id: string }> }).pending[0]!.id;
    const approve = await app.inject({
      method: "POST", url: `/v1/manage/slang/${termId}`, headers: { cookie: cookies.president },
      payload: { decision: "approve" },
    });
    expect(approve.statusCode).toBe(200);
    const after = await app.inject({ method: "GET", url: "/v1/slang?q=jacking", headers: { cookie: cookies.member2 } });
    const terms = (after.json() as { terms: Array<{ term: string; meaning: string }> }).terms;
    expect(terms).toHaveLength(1);
    expect(terms[0]!.meaning).toContain("prep");
  });

  run("timeline: admin-curated, chronological", async () => {
    await app.inject({ method: "POST", url: "/v1/manage/timeline", headers: { cookie: cookies.president }, payload: { year: 1954, title: "School founded" } });
    await app.inject({ method: "POST", url: "/v1/manage/timeline", headers: { cookie: cookies.president }, payload: { year: 1978, title: "First national trophy", story: "The hockey team brought home the cup." } });
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/timeline", headers: { cookie: cookies.member1 },
      payload: { year: 1990, title: "Member event" },
    });
    expect(denied.statusCode).toBe(403);
    const res = await app.inject({ method: "GET", url: "/v1/timeline", headers: { cookie: cookies.member1 } });
    const events = (res.json() as { events: Array<{ year: number; title: string }> }).events;
    expect(events.map((e) => e.year)).toEqual([1954, 1978]);
  });

  run("spotlights: admin publishes; visible to members", async () => {
    const create = await app.inject({
      method: "POST", url: "/v1/manage/spotlights", headers: { cookie: cookies.president },
      payload: { memberId: ids.member1, interview: "Q: First job? A: Apprentice engineer at fifteen.", publish: true },
    });
    expect(create.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/spotlights", headers: { cookie: cookies.member2 } });
    expect((list.json() as { spotlights: Array<{ member_name: string }> }).spotlights.some((s) => s.member_name === "Femi Member")).toBe(true);
  });

  run("articles: member submits → admin publishes; declined stays hidden", async () => {
    const submit = await app.inject({
      method: "POST", url: "/v1/articles", headers: { cookie: cookies.member1 },
      payload: { title: "Fifteen Years After the Gate", body: "Walking out of the gate in 1998 felt final. It was not." },
    });
    expect(submit.statusCode).toBe(200);
    expect((submit.json() as { status: string }).status).toBe("submitted");

    const before = await app.inject({ method: "GET", url: "/v1/articles", headers: { cookie: cookies.member2 } });
    expect((before.json() as { articles: unknown[] }).articles).toHaveLength(0);

    const queue = await app.inject({ method: "GET", url: "/v1/manage/articles", headers: { cookie: cookies.president } });
    const articleId = (queue.json() as { submitted: Array<{ id: string }> }).submitted[0]!.id;
    const publish = await app.inject({
      method: "POST", url: `/v1/manage/articles/${articleId}`, headers: { cookie: cookies.president },
      payload: { decision: "publish" },
    });
    expect(publish.statusCode).toBe(200);
    const after = await app.inject({ method: "GET", url: "/v1/articles", headers: { cookie: cookies.member2 } });
    expect((after.json() as { articles: Array<{ title: string }> }).articles.some((a) => a.title === "Fifteen Years After the Gate")).toBe(true);
  });
});
