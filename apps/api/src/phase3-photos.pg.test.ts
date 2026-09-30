/**
 * PG integration — Phase 3 batch 2 (phases.md session 3.3).
 * Photo wall: attendee-only uploads, realtime tags + notices.
 * Face finder: K3 consent gates, stub provider match, self-only by
 * construction, deletion takes the data (§P self-search-only).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

// Two DIFFERENT images and one identical re-upload of the first.
const IMG_A = Buffer.from("fedites-demo-image-A-bytes-0192837465");
const IMG_B = Buffer.from("fedites-demo-image-B-bytes-different-content");

async function login(app: FastifyInstance, email: string | undefined): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "demopass123" } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  return res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function uploadImage(app: FastifyInstance, cookie: string | undefined, bytes: Buffer): Promise<string> {
  const boundary = "----fedites" + Date.now();
  const res = await app.inject({
    method: "POST", url: "/v1/media",
    headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="selfie.png"\r\nContent-Type: image/png\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  if (res.statusCode !== 200) throw new Error(`upload failed: ${res.body}`);
  return (res.json() as { id: string }).id;
}

describe("phase 3 — photo wall + face finder", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;
  let reunionId: string;

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
    reunionId = (await pool.query<{ id: string }>("SELECT id FROM events WHERE title = 'Set ''98 Mini Reunion'")).rows[0]!.id;
    cookies = {
      president: await login(app, "president@example.test"),
      member1: await login(app, "member1@example.test"),
      member2: await login(app, "member2@example.test"),
      member3: await login(app, "member3@example.test"),
    };
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("photo wall: only attendees upload; images only; wall lists with tags", async () => {
    // member1 RSVPs going
    await app.inject({ method: "POST", url: `/v1/events/${reunionId}/rsvp`, headers: { cookie: cookies.member1 }, payload: { response: "going" } });
    // member3 (Set '96) is not an attendee → refused
    const nonAttendeeMedia = await uploadImage(app, cookies.member3, IMG_A);
    const denied = await app.inject({
      method: "POST", url: `/v1/events/${reunionId}/photos`, headers: { cookie: cookies.member3 },
      payload: { mediaId: nonAttendeeMedia },
    });
    expect(denied.statusCode).toBe(403);

    // attendee uploads image A
    const mediaA = await uploadImage(app, cookies.member1, IMG_A);
    const upload = await app.inject({
      method: "POST", url: `/v1/events/${reunionId}/photos`, headers: { cookie: cookies.member1 },
      payload: { mediaId: mediaA },
    });
    expect(upload.statusCode).toBe(200);

    // member2 (going) tags member1 on the photo → notice lands
    const photoId = (upload.json() as { id: string }).id;
    const tag = await app.inject({
      method: "POST", url: `/v1/events/${reunionId}/photos/${photoId}/tags`, headers: { cookie: cookies.member2 },
      payload: { memberId: ids.member1 },
    });
    expect(tag.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST", url: `/v1/events/${reunionId}/photos/${photoId}/tags`, headers: { cookie: cookies.member2 },
      payload: { memberId: ids.member1 },
    });
    expect(dup.statusCode).toBe(400);
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers: { cookie: cookies.member1 } });
    expect((inbox.json() as { items: Array<{ title: string }> }).items.some((i) => i.title.includes("tagged you"))).toBe(true);

    const wall = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/photos`, headers: { cookie: cookies.member1 } });
    const photos = (wall.json() as { photos: Array<{ id: string; tags: Array<{ name: string }>; uploader: string }> }).photos;
    expect(photos).toHaveLength(1);
    expect(photos[0]!.tags.map((t) => t.name)).toContain("Femi Member");
  });

  run("K3 gates: search without opt-in or enrollment refused; opt-in flow works", async () => {
    const deniedNoOptIn = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/find-me`, headers: { cookie: cookies.member1 } });
    expect(deniedNoOptIn.statusCode).toBe(403);
    expect((deniedNoOptIn.json() as { error: string }).error).toContain("Opt in");

    const optIn = await app.inject({ method: "POST", url: "/v1/me/face/opt-in", headers: { cookie: cookies.member1 }, payload: { enabled: true } });
    expect(optIn.statusCode).toBe(200);

    const deniedNoRef = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/find-me`, headers: { cookie: cookies.member1 } });
    expect(deniedNoRef.statusCode).toBe(403);
    expect((deniedNoRef.json() as { error: string }).error).toContain("Enroll");
  });

  run("stub provider: identical-bytes photo is found by my reference", async () => {
    // member1 enrolls a reference that is byte-identical to the wall photo (IMG_A)
    const ref = await uploadImage(app, cookies.member1, IMG_A);
    const enroll = await app.inject({ method: "POST", url: "/v1/me/face/reference", headers: { cookie: cookies.member1 }, payload: { mediaId: ref } });
    expect(enroll.statusCode).toBe(200);

    const found = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/find-me`, headers: { cookie: cookies.member1 } });
    expect(found.statusCode).toBe(200);
    const matches = (found.json() as { matches: Array<{ mediaId: string; score: number }> }).matches;
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.score).toBeGreaterThanOrEqual(0.92);

    // a different image does not match
    const refB = await uploadImage(app, cookies.member1, IMG_B);
    await app.inject({ method: "POST", url: "/v1/me/face/reference", headers: { cookie: cookies.member1 }, payload: { mediaId: refB } });
    const foundB = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/find-me`, headers: { cookie: cookies.member1 } });
    expect((foundB.json() as { matches: unknown[] }).matches).toHaveLength(0);
  });

  run("self-only: member2's search uses only member2's reference", async () => {
    // member2 enrolls with IMG_B (no photo on the wall matches) → no matches,
    // even though member1's IMG_A photo exists and is indexed.
    await app.inject({ method: "POST", url: "/v1/me/face/opt-in", headers: { cookie: cookies.member2 }, payload: { enabled: true } });
    const ref2 = await uploadImage(app, cookies.member2, IMG_B);
    await app.inject({ method: "POST", url: "/v1/me/face/reference", headers: { cookie: cookies.member2 }, payload: { mediaId: ref2 } });
    const found = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/find-me`, headers: { cookie: cookies.member2 } });
    expect((found.json() as { matches: unknown[] }).matches).toHaveLength(0);
  });

  run("K3 deletion: opt-out wipes the whole face index", async () => {
    await app.inject({ method: "POST", url: "/v1/me/face/opt-in", headers: { cookie: cookies.member1 }, payload: { enabled: false } });
    const rows = await pool.query("SELECT count(*)::int AS n FROM face_index WHERE member_id = $1", [ids.member1]);
    expect(rows.rows[0]?.n).toBe(0);
    const status = await app.inject({ method: "GET", url: "/v1/me/face/status", headers: { cookie: cookies.member1 } });
    const s = status.json() as { optIn: boolean; enrolled: boolean };
    expect(s.optIn).toBe(false);
    expect(s.enrolled).toBe(false);
    const search = await app.inject({ method: "GET", url: `/v1/events/${reunionId}/find-me`, headers: { cookie: cookies.member1 } });
    expect(search.statusCode).toBe(403);
  });
});
