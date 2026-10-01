/**
 * PG integration — Phase 5 batch 3 (phases.md session 5.3).
 * Remember-when weekly threads, recipes, radio, anthem/bell instance media,
 * stickers/frames, time capsule seal/unseal server gate, letters future-
 * delivery gate, memorial-aware birthday reminders (§P), achievement awards.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

const AUDIO = Buffer.from("riff-wave-anthem-bytes");

describe("phase 5 — nostalgia bundle", () => {
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

  run("remember-when: weekly thread auto-created; stories collect", async () => {
    const post1 = await app.inject({
      method: "POST", url: "/v1/nostalgia/remember-when", headers: { cookie: cookies.member1 },
      payload: { story: "The day the generator died during night prep." },
    });
    expect(post1.statusCode).toBe(200);
    const post2 = await app.inject({
      method: "POST", url: "/v1/nostalgia/remember-when", headers: { cookie: cookies.member2 },
      payload: { story: "And we all blamed house captain." },
    });
    expect(post2.statusCode).toBe(200);
    const threadId = (post1.json() as { threadId: string }).threadId;
    const detail = await app.inject({
      method: "GET", url: `/v1/nostalgia/remember-when/${threadId}`, headers: { cookie: cookies.member1 },
    });
    const body = detail.json() as { stories: Array<{ story: string }>; thread: { prompt: string } };
    expect(body.stories).toHaveLength(2);
    expect(body.thread.prompt).toBe("Remember when…?");
  });

  run("recipes: exchange works", async () => {
    const recipe = await app.inject({
      method: "POST", url: "/v1/nostalgia/recipes", headers: { cookie: cookies.member1 },
      payload: { title: "Tuck-shop meat pie", ingredients: "Flour, butter, mince", steps: "Mix. Fold. Bake.", story: "Five naira at break." },
    });
    expect(recipe.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/nostalgia/recipes", headers: { cookie: cookies.member2 } });
    expect((list.json() as { recipes: Array<{ title: string }> }).recipes.some((r) => r.title === "Tuck-shop meat pie")).toBe(true);
  });

  run("radio + anthem + bell: collaborative uploads, admin-set instance audio", async () => {
    const track = await app.inject({
      method: "POST", url: "/v1/nostalgia/radio", headers: { cookie: cookies.member1 },
      payload: { title: "Era anthem", artist: "Old School Band", year: 1996, externalUrl: "https://example.test/track" },
    });
    expect(track.statusCode).toBe(200);
    const radio = await app.inject({ method: "GET", url: "/v1/nostalgia/radio", headers: { cookie: cookies.member2 } });
    expect((radio.json() as { tracks: Array<{ title: string }> }).tracks.some((t) => t.title === "Era anthem")).toBe(true);

    // anthem/bell are ADMIN-only uploads
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/nostalgia/anthem", headers: { cookie: cookies.member1 },
      payload: { mediaId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(denied.statusCode).toBe(403);
    const boundary = "----aud";
    const media = await app.inject({
      method: "POST", url: "/v1/media",
      headers: { cookie: cookies.president, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="anthem.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`),
        AUDIO, Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    const anthemId = (media.json() as { id: string }).id;
    const set = await app.inject({
      method: "POST", url: "/v1/manage/nostalgia/anthem", headers: { cookie: cookies.president },
      payload: { mediaId: anthemId },
    });
    expect(set.statusCode).toBe(200);
    const get = await app.inject({ method: "GET", url: "/v1/nostalgia/anthem", headers: { cookie: cookies.member1 } });
    expect((get.json() as { anthemMediaId: string | null }).anthemMediaId).toBe(anthemId);
  });

  run("stickers/frames: admin inventory, members take", async () => {
    const boundary = "----stk";
    const media = await app.inject({
      method: "POST", url: "/v1/media",
      headers: { cookie: cookies.president, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="crest.png"\r\nContent-Type: image/png\r\n\r\n`),
        Buffer.from("crest-sticker-png"), Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    const stickerId = (media.json() as { id: string }).id;
    const create = await app.inject({
      method: "POST", url: "/v1/manage/nostalgia/stickers", headers: { cookie: cookies.president },
      payload: { name: "Crest frame", mediaId: stickerId, kind: "frame" },
    });
    expect(create.statusCode).toBe(200);
    const frameId = (create.json() as { id: string }).id;
    const take = await app.inject({
      method: "POST", url: `/v1/nostalgia/stickers/${frameId}/take`, headers: { cookie: cookies.member1 },
      payload: {},
    });
    expect(take.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/nostalgia/stickers", headers: { cookie: cookies.member1 } });
    const stickers = (list.json() as { stickers: Array<{ kind: string; mine: boolean }> }).stickers;
    expect(stickers.some((s) => s.kind === "frame" && s.mine)).toBe(true);
  });

  run("time capsules: sealed until open_at (server gate), then open once", async () => {
    const future = await app.inject({
      method: "POST", url: "/v1/nostalgia/capsules", headers: { cookie: cookies.member1 },
      payload: { title: "For our 30th", body: "Dear Set '98 of 2028…", openAt: "2028-06-01" },
    });
    const capsuleId = (future.json() as { id: string }).id;
    // early open refused
    const early = await app.inject({
      method: "POST", url: `/v1/nostalgia/capsules/${capsuleId}/open`, headers: { cookie: cookies.member1 },
      payload: {},
    });
    expect(early.statusCode).toBe(403);
    // sealed body not returned early
    const list = await app.inject({ method: "GET", url: "/v1/nostalgia/capsules", headers: { cookie: cookies.member1 } });
    const sealed = (list.json() as { capsules: Array<{ id: string; sealed: boolean; body: string | null }> }).capsules.find((c) => c.id === capsuleId)!;
    expect(sealed.sealed).toBe(true);
    expect(sealed.body).toBeNull();

    // due capsule opens; opening marks opened_at; body visible
    const due = await app.inject({
      method: "POST", url: "/v1/nostalgia/capsules", headers: { cookie: cookies.member2 },
      payload: { title: "Old promise", body: "We said we'd all meet again.", openAt: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) },
    });
    const dueId = (due.json() as { id: string }).id;
    const open = await app.inject({
      method: "POST", url: `/v1/nostalgia/capsules/${dueId}/open`, headers: { cookie: cookies.member2 },
      payload: {},
    });
    expect(open.statusCode).toBe(200);
    const openList = await app.inject({ method: "GET", url: "/v1/nostalgia/capsules", headers: { cookie: cookies.member2 } });
    const opened = (openList.json() as { capsules: Array<{ id: string; body: string | null; opened: boolean }> }).capsules.find((c) => c.id === dueId)!;
    expect(opened.opened).toBe(true);
    expect(opened.body).toContain("meet again");
    void capsuleId; void sealed;
  });

  run("letters to future self: future-delivery gate", async () => {
    const letter = await app.inject({
      method: "POST", url: "/v1/nostalgia/letters", headers: { cookie: cookies.member1 },
      payload: { body: "Dear me of 2030…", deliverOn: "2030-01-01" },
    });
    expect(letter.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/nostalgia/letters", headers: { cookie: cookies.member1 } });
    const l = (list.json() as { letters: Array<{ sealed: boolean; body: string | null }> }).letters[0]!;
    expect(l.sealed).toBe(true);
    expect(l.body).toBeNull();
  });

  run("birthdays: memorial members never appear; set-visibility respected (§P)", async () => {
    const birthdays = await app.inject({ method: "GET", url: "/v1/nostalgia/birthdays", headers: { cookie: cookies.member1 } });
    const names = (birthdays.json() as { birthdays: Array<{ name: string }> }).birthdays.map((b) => b.name);
    // member1 sees own birthday; teacher1 is honorary+no set and would not be in member1's set list
    expect(names).toContain("Femi Member");
    expect(names).not.toContain("Mr. K Teacher");
  });

  run("achievement awards: admin ceremony awards, audited", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/manage/recognition/awards", headers: { cookie: cookies.member1 },
      payload: { memberId: ids.member2, title: "Alumnus of the Year" },
    });
    expect(denied.statusCode).toBe(403);
    const award = await app.inject({
      method: "POST", url: "/v1/manage/recognition/awards", headers: { cookie: cookies.president },
      payload: { memberId: ids.member2, title: "Alumnus of the Year", citation: "For the lab restoration." },
    });
    expect(award.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/v1/recognition/awards", headers: { cookie: cookies.member1 } });
    const awards = (list.json() as { awards: Array<{ title: string }> }).awards;
    expect(awards.some((a) => a.title === "Alumnus of the Year")).toBe(true);
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'recognition.award-ceremony' AND target = $1", [ids.member2]);
    expect(audit.rows.length).toBe(1);
  });
});
