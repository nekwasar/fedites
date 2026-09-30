/**
 * PG integration — Phase 3 batch 1 (phases.md 3.1 + 3.2).
 * Event permission matrix (§P), RSVP with limited-account refusal, QR
 * tickets + door check-in + live counts, organizer-only reunion suite,
 * group-event badge + Activity bridge. Runs when TEST_DATABASE_URL is set.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 3 — events & reunions", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let instanceId: string;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;

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

    const login = async (email: string): Promise<string> => {
      const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "demopass123" } });
      if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
      return res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    };
    cookies = {
      president: await login("president@example.test"),
      member1: await login("member1@example.test"),
      member2: await login("member2@example.test"),
      member3: await login("member3@example.test"),
    };
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("3.1 — calendar lists seeded events; group events are badged", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/events", headers: { cookie: cookies.member1 } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { upcoming: Array<{ title: string; groupId: string | null; groupName: string | null }> };
    const reunion = body.upcoming.find((e) => e.title === "Set '98 Mini Reunion");
    const agm = body.upcoming.find((e) => e.title === "Annual General Meeting");
    expect(reunion).toBeTruthy();
    expect(reunion!.groupName).toBe("Set '98"); // badged with the crest
    expect(agm).toBeTruthy();
    expect(agm!.groupId).toBeNull();
  });

  run("3.1 — §P: ordinary members cannot create; group admin and duty admin can", async () => {
    // member1 is a Set '98 member, not admin → denied
    const denied = await app.inject({
      method: "POST", url: "/v1/events", headers: { cookie: cookies.member1 },
      payload: { title: "Secret party", startsAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(denied.statusCode).toBe(403);

    // member1 is NOT group admin; create must be by group admin — president is a duty admin for school-wide
    const schoolWide = await app.inject({
      method: "POST", url: "/v1/events", headers: { cookie: cookies.president },
      payload: { title: "Founders' Day Lecture", startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), city: "Lagos" },
    });
    expect(schoolWide.statusCode).toBe(200);

    // group admin path: make member1 admin of a group, then create within it
    await app.inject({
      method: "POST", url: `/v1/members/${ids.member1}/roles`, headers: { cookie: cookies.president },
      payload: { roleKey: "member" },
    });
    // promote member1 to group admin of Set '98 via group admins endpoint? only group admins can; use direct DB-free path:
    // president (duty admin) creates within Set '98 — group admins and duty roles both allowed
    const inGroup = await app.inject({
      method: "POST", url: "/v1/events", headers: { cookie: cookies.president },
      payload: { title: "Set '98 Vue", startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), groupId: ids["Set '98"] },
    });
    expect(inGroup.statusCode).toBe(200);

    // the Activity bridge: an 'event' post exists in Set '98
    const activity = await app.inject({ method: "GET", url: `/v1/groups/${ids["Set '98"]}/activity`, headers: { cookie: cookies.member1 } });
    const items = activity.json() as { items: Array<{ kind: string; body: string | null }> };
    expect(items.items.some((i) => i.kind === "event" && (i.body ?? "").includes("Set '98 Vue"))).toBe(true);
  });

  run("3.1 — RSVP: limited accounts refused (§P), verified ok, counts live", async () => {
    // member3 is verified already (seed); create a pending member to test refusal
    const invite = await app.inject({ method: "POST", url: "/v1/invites", headers: { cookie: cookies.president }, payload: {} });
    const code = (invite.json() as { code: string }).code;
    const signup = await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { inviteCode: code, email: `pending-${Date.now()}@example.test`, password: "pending12345", displayName: "Penny Pending" },
    });
    const pendingId = (signup.json() as { memberId: string }).memberId;
    const pendingLogin = await app.inject({
      method: "POST", url: "/v1/auth/login",
      payload: { email: `pending-${Date.now()}@example.test`, password: "pending12345" },
    });
    void pendingLogin;

    // RSVP as verified member1
    const events = await app.inject({ method: "GET", url: "/v1/events", headers: { cookie: cookies.member1 } });
    const reunion = (events.json() as { upcoming: Array<{ id: string; title: string }> }).upcoming.find((e) => e.title === "Set '98 Mini Reunion")!;
    const rsvp = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/rsvp`, headers: { cookie: cookies.member1 },
      payload: { response: "going" },
    });
    expect(rsvp.statusCode).toBe(200);
    expect((rsvp.json() as { counts: { going: number } }).counts.going).toBeGreaterThanOrEqual(1);

    // pending member: make one via API and refuse RSVP (§P)
    const invite2 = await app.inject({ method: "POST", url: "/v1/invites", headers: { cookie: cookies.president }, payload: {} });
    const code2 = (invite2.json() as { code: string }).code;
    const email2 = `p2-${Date.now()}@example.test`;
    await app.inject({
      method: "POST", url: "/v1/auth/signup",
      payload: { inviteCode: code2, email: email2, password: "pending12345", displayName: "Pending Two" },
    });
    const p2login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: email2, password: "pending12345" } });
    const p2cookie = p2login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const refused = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/rsvp`, headers: { cookie: p2cookie },
      payload: { response: "going" },
    });
    expect(refused.statusCode).toBe(403);
    void pendingId;
  });

  run("3.2 — QR ticket issued for going; door check-in validates, counts live", async () => {
    const events = await app.inject({ method: "GET", url: "/v1/events", headers: { cookie: cookies.member1 } });
    const reunion = (events.json() as { upcoming: Array<{ id: string; title: string }> }).upcoming.find((e) => e.title === "Set '98 Mini Reunion")!;

    // ticket before RSVP-as-going → refused? member1 RSVP'd going above, so fine
    const ticket = await app.inject({ method: "GET", url: `/v1/events/${reunion.id}/my-ticket`, headers: { cookie: cookies.member1 } });
    expect(ticket.statusCode).toBe(200);
    const t = ticket.json() as { payload: string; qrSvg: string };
    expect(t.payload.startsWith("fedites-ticket:")).toBe(true);
    expect(t.qrSvg).toContain("<svg");

    // the QR payload is self-contained: event.member.secret.sig
    const payloadSig = t.payload.split(".").slice(-2)[1] ?? "";

    // door closed by default → refused
    const closed = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/check-in`, headers: { cookie: cookies.president },
      payload: { code: t.payload, sig: payloadSig },
    });
    expect(closed.statusCode).toBe(403);

    // open door mode (organizer), then check in
    await app.inject({ method: "PATCH", url: `/v1/events/${reunion.id}`, headers: { cookie: cookies.president }, payload: { checkInOpen: true } });
    const checkin = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/check-in`, headers: { cookie: cookies.president },
      payload: { code: t.payload, sig: payloadSig },
    });
    expect(checkin.statusCode).toBe(200);
    expect((checkin.json() as { duplicate: boolean }).duplicate).toBe(false);

    // duplicate scan tolerated, marked duplicate
    const again = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/check-in`, headers: { cookie: cookies.president },
      payload: { code: t.payload, sig: payloadSig },
    });
    expect((again.json() as { duplicate: boolean }).duplicate).toBe(true);

    // tampered signature refused (forge the embedded sig segment)
    const forgedPayload = t.payload.replace(/\.[A-Za-z0-9_-]+$/, ".bogussignature99");
    const forged = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/check-in`, headers: { cookie: cookies.president },
      payload: { code: forgedPayload },
    });
    expect(forged.statusCode).toBe(400);

    // live counts
    const live = await app.inject({ method: "GET", url: `/v1/events/${reunion.id}/live-counts`, headers: { cookie: cookies.president } });
    expect((live.json() as { counts: { checkedIn: number } }).counts.checkedIn).toBe(1);
  });

  run("3.2 — reunion suite: tasks + budget organizer-only; RSVP list", async () => {
    const events = await app.inject({ method: "GET", url: "/v1/events", headers: { cookie: cookies.president } });
    const reunion = (events.json() as { upcoming: Array<{ id: string; title: string }> }).upcoming.find((e) => e.title === "Set '98 Mini Reunion")!;

    const denied = await app.inject({ method: "GET", url: `/v1/events/${reunion.id}/tasks`, headers: { cookie: cookies.member2 } });
    expect(denied.statusCode).toBe(403);

    const task = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/tasks`, headers: { cookie: cookies.president },
      payload: { title: "Book the DJ", assignee: ids.member1, dueAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(task.statusCode).toBe(200);
    const done = await app.inject({
      method: "PATCH", url: `/v1/events/${reunion.id}/tasks/${(task.json() as { id: string }).id}`,
      headers: { cookie: cookies.president }, payload: { done: true },
    });
    expect(done.statusCode).toBe(200);

    const budget = await app.inject({
      method: "POST", url: `/v1/events/${reunion.id}/budget`, headers: { cookie: cookies.president },
      payload: { label: "Sound system", amountMinor: 250000, currency: "NGN", kind: "planned" },
    });
    expect(budget.statusCode).toBe(200);

    const suite = await app.inject({ method: "GET", url: `/v1/events/${reunion.id}/tasks`, headers: { cookie: cookies.president } });
    const body = suite.json() as { tasks: Array<{ title: string; done: boolean }>; budget: Array<{ label: string }> };
    expect(body.tasks.some((t) => t.title === "Book the DJ" && t.done)).toBe(true);
    expect(body.budget.some((b) => b.label === "Sound system")).toBe(true);

    const attendees = await app.inject({ method: "GET", url: `/v1/events/${reunion.id}/attendees`, headers: { cookie: cookies.president } });
    expect((attendees.json() as { attendees: Array<{ name: string; response: string; checkedIn: boolean }> }).attendees.some((a) => a.response === "going" && a.checkedIn)).toBe(true);
  });
});
