/**
 * PG integration — Phase 3 batch 3 (phases.md session 3.4).
 * One recognition ledger: badges from thresholds, founding window, private
 * weekly streaks; intents capture; classmates rail; tune-more affinity
 * ordering; manual award duty-gated.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 3 — recognition + personalization", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let instanceId: string;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;
  let set98: string | undefined;

  beforeAll(async () => {
    if (!url) return;
    pool = createPool(url);
    await migrate(pool);
    await seed(pool);
    instanceId = (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id;
    const members = await pool.query<{ id: string; email: string }>("SELECT id, email FROM members WHERE instance_id = $1", [instanceId]);
    for (const m of members.rows) {
      await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
    }
    app = await buildApp({ pool, defaultInstanceId: instanceId });
    ids = {};
    for (const m of members.rows) ids[m.email.split("@")[0]!] = m.id;
    const groups = await pool.query<{ id: string; name: string }>("SELECT id, name FROM groups WHERE instance_id = $1", [instanceId]);
    for (const g of groups.rows) ids[g.name] = g.id;
    set98 = ids["Set '98"]!;
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

  run("first post earns points + first-post badge; ledger is the one source", async () => {
    const post = await app.inject({
      method: "POST", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 },
      payload: { kind: "post", body: "First post for recognition." },
    });
    expect(post.statusCode).toBe(200);
    const me = await app.inject({ method: "GET", url: "/v1/recognition/me", headers: { cookie: cookies.member1 } });
    const body = me.json() as { points: number; badges: Array<{ badge: string }>; streak: { current: number } };
    expect(body.points).toBeGreaterThanOrEqual(5);
    expect(body.badges.some((b) => b.badge === "first-post")).toBe(true);
    expect(body.streak.current).toBeGreaterThanOrEqual(1);
  });

  run("conversationalist badge at 10 comments", async () => {
    const detail = await app.inject({ method: "GET", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member2 } });
    const postId = (detail.json() as { items: Array<{ id: string }> }).items[0]!.id;
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: "POST", url: `/v1/activity/${postId}/comments`, headers: { cookie: cookies.member2 },
        payload: { body: `Comment number ${i + 1}.` },
      });
    }
    const me = await app.inject({ method: "GET", url: "/v1/recognition/me", headers: { cookie: cookies.member2 } });
    expect((me.json() as { badges: Array<{ badge: string }> }).badges.some((b) => b.badge === "conversationalist")).toBe(true);
  });

  run("verified badge + founding status awarded on verification", async () => {
    // president was seeded verified directly — award path: verify a new member
    const invite = await app.inject({ method: "POST", url: "/v1/invites", headers: { cookie: cookies.president }, payload: {} });
    const code = (invite.json() as { code: string }).code;
    const email = `founder-${Date.now()}@example.test`;
    const signup = await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { inviteCode: code, email, password: "founder12345", displayName: "Fola Founder" },
    });
    const memberId = (signup.json() as { memberId: string }).memberId;
    const decision = await app.inject({
      method: "POST", url: "/v1/verification/decision", headers: { cookie: cookies.president },
      payload: { memberId, decision: "verify" },
    });
    expect(decision.statusCode).toBe(200);
    const badges = await pool.query<{ badge: string }>(
      "SELECT badge FROM member_badges WHERE member_id = $1 ORDER BY badge",
      [memberId],
    );
    const keys = badges.rows.map((b) => b.badge);
    expect(keys).toContain("verified");
    expect(keys).toContain("founding"); // instance is < 30 days old
  });

  run("manual award is duty-gated and audited", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/recognition/award", headers: { cookie: cookies.member1 },
      payload: { memberId: ids.member2, badge: "founding" },
    });
    expect(denied.statusCode).toBe(403);
    const award = await app.inject({
      method: "POST", url: "/v1/recognition/award", headers: { cookie: cookies.president },
      payload: { memberId: ids.member2, badge: "founding" },
    });
    expect(award.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST", url: "/v1/recognition/award", headers: { cookie: cookies.president },
      payload: { memberId: ids.member2, badge: "founding" },
    });
    expect(dup.statusCode).toBe(400);
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'recognition.award' AND target = $1", [ids.member2]);
    expect(audit.rows.length).toBe(1);
  });

  run("public member recognition shows badges, never points (K2)", async () => {
    const res = await app.inject({ method: "GET", url: `/v1/members/${ids.member1}/recognition`, headers: { cookie: cookies.member2 } });
    const body = res.json() as { badges: unknown[]; points?: number };
    expect(Array.isArray(body.badges)).toBe(true);
    expect(body.points).toBeUndefined();
  });

  run("intents capture + classmates rail + tune-more ordering", async () => {
    // intents
    const setIntents = await app.inject({
      method: "POST", url: "/v1/me/intents", headers: { cookie: cookies.member1 },
      payload: { intents: ["network", "events"] },
    });
    expect(setIntents.statusCode).toBe(200);
    const getIntents = await app.inject({ method: "GET", url: "/v1/me/intents", headers: { cookie: cookies.member1 } });
    expect((getIntents.json() as { intents: string[] }).intents).toEqual(["network", "events"]);

    // classmates rail: member1 is Set '98; other '98 members exist without DMs
    const feed = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member1 } });
    const rails = (feed.json() as { rails: Array<{ key: string; items: Array<{ name: string }> }> }).rails;
    const classmates = rails.find((r) => r.key === "classmates");
    expect(classmates).toBeTruthy();
    expect(classmates!.items.length).toBeGreaterThanOrEqual(1);

    // dismiss retires it
    await app.inject({ method: "POST", url: "/v1/feed/rails/classmates/dismiss", headers: { cookie: cookies.member1 }, payload: {} });
    const feed2 = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member1 } });
    expect((feed2.json() as { rails: Array<{ key: string }> }).rails.every((r) => r.key !== "classmates")).toBe(true);

    // tune-more: an older post from a boosted group floats above a newer one
    // member1 posts in Set '98 (t0), then in Mercury House (t0+2s, not boosted)
    const older = await app.inject({
      method: "POST", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 },
      payload: { kind: "post", body: "BOOSTED-OLDER-POST" },
    });
    await new Promise((r) => setTimeout(r, 1500));
    const house = ids["Apollo House"]; // member1 (Femi) is Apollo
    const newer = await app.inject({
      method: "POST", url: `/v1/groups/${house}/activity`, headers: { cookie: cookies.member1 },
      payload: { kind: "post", body: "PLAIN-NEWER-POST" },
    });
    expect(older.statusCode).toBe(200);
    expect(newer.statusCode).toBe(200);
    const tune = await app.inject({
      method: "POST", url: `/v1/groups/${set98}/tune`, headers: { cookie: cookies.member1 },
      payload: { more: true },
    });
    expect((tune.json() as { affinity: number }).affinity).toBe(1);
    const feed3 = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member1 } });
    const items = (feed3.json() as { items: Array<{ body: string | null }> }).items;
    const boosted = items.findIndex((i) => i.body === "BOOSTED-OLDER-POST");
    const plain = items.findIndex((i) => i.body === "PLAIN-NEWER-POST");
    expect(boosted).toBeGreaterThanOrEqual(0);
    expect(plain).toBeGreaterThanOrEqual(0);
    expect(boosted, "boosted older post should rank above the newer plain post").toBeLessThan(plain);
  });
});
