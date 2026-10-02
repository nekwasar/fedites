/**
 * SSR integration — the built app serves complete server-rendered pages
 * with boot + route data inlined, and the API stays untouched.
 */
import { it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

let pool: Pool;
let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  if (!url) return;
  process.env.SSR_ENABLED = "1";
  process.env.SSR_MODE = "dev";
  pool = createPool(url);
  await migrate(pool);
  await seed(pool);
  const instanceId = (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id;
  const members = await pool.query<{ id: string; email: string }>("SELECT id, email FROM members WHERE instance_id = $1", [instanceId]);
  for (const m of members.rows) {
    await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
  }
  app = await buildApp({ pool, defaultInstanceId: instanceId });
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member1@example.test", password: "demopass123" } });
  cookie = `fedites_session=${(login.json() as { token: string }).token}`;
});

afterAll(async () => {
  if (url) {
    delete process.env.SSR_ENABLED;
    delete process.env.SSR_MODE;
    await pool.end();
  }
});

run("signed-out request renders the public landing as HTML", async () => {
  const res = await app.inject({ method: "GET", url: "/" });
  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toContain("text/html");
  expect(res.body).toContain("window.__PAGE__=");
  expect(res.body).not.toContain("\"member\":null,\"unread\":0,\"data\":{}},\"unread\"");
});

run("signed-in request renders groups home with server data", { timeout: 20_000 }, async () => {
  const res = await app.inject({ method: "GET", url: "/", headers: { cookie } });
  expect(res.statusCode).toBe(200);
  const body = res.body;
  expect(body).toContain("window.__PAGE__=");
  // The screen content is rendered server-side with data
  expect(body.includes("My groups") || body.includes("Find your people")).toBe(true);
});

run("chat list renders server-side with threads + presence payload", async () => {
  const res = await app.inject({ method: "GET", url: "/chat", headers: { cookie } });
  expect(res.statusCode).toBe(200);
  expect(res.body).toContain('"chat.list"');
  expect(res.body).toContain('"presence"');
});

run("the API surface stays JSON (SSR never intercepts /v1)", async () => {
  const res = await app.inject({ method: "GET", url: "/v1/health" });
  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toContain("application/json");
});
