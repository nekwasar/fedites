/**
 * PG integration test — Phase 1 walking skeleton (phases.md Phase gate):
 * one real member verified end-to-end, admin can approve and assign roles,
 * 2FA works, contact reveals are logged, a role change sticks.
 * Runs only when TEST_DATABASE_URL is set.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { createPool, migrate } from "@fedites/db";
import { seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { totpCode } from "./totp.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

interface Newbie { memberId: string; email: string; cookie: string }
let newbie: Newbie | undefined;

describe("phase 1 rails", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let instanceId: string;
  let presidentId: string;
  let presidentCookie: string;
  let femiId: string;

  beforeAll(async () => {
    if (!url) return;
    pool = createPool(url);
    await migrate(pool);
    const result = await seed(pool);
    // seed() is idempotent: on a pre-seeded DB it returns the existing
    // instance with empty maps — resolve demo members from the DB instead.
    instanceId = result.instanceId || (await pool.query<{ id: string }>("SELECT id FROM instances ORDER BY created_at LIMIT 1")).rows[0]!.id;

    const { hashPassword } = await import("./password.js");
    const members = await pool.query<{ id: string; email: string }>(
      "SELECT id, email FROM members WHERE instance_id = $1",
      [instanceId],
    );
    for (const m of members.rows) {
      await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
      if (m.email === "president@example.test") presidentId = m.id;
      if (m.email === "member1@example.test") femiId = m.id;
    }
    expect(presidentId).toBeTruthy();
    expect(femiId).toBeTruthy();

    app = await buildApp({ pool, defaultInstanceId: instanceId });
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("1.1 — member account exists securely (signup, login, session)", async () => {
    // president creates an invite code
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "president@example.test", password: "demopass123" } });
    expect(login.statusCode).toBe(200);
    presidentCookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const invite = await app.inject({ method: "POST", url: "/v1/invites", headers: { cookie: presidentCookie }, payload: {} });
    expect(invite.statusCode).toBe(200);
    const code = (invite.json() as { code: string }).code;

    const email = `newbie-${randomUUID().slice(0, 8)}@example.test`;
    const signup = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { inviteCode: code, email, password: "newbiepass123", displayName: "Ngozi Newmember", setYear: 1998 } });
    expect(signup.statusCode).toBe(201);
    const { memberId } = signup.json() as { memberId: string };

    // bad code rejected
    const bad = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { inviteCode: "NOPE-0000", email: `x${randomUUID().slice(0, 6)}@example.test`, password: "whatever123", displayName: "Bad Code" } });
    expect(bad.statusCode).toBe(400);

    // pending members can log in (read-only) and get a session
    const nl = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "newbiepass123" } });
    expect(nl.statusCode).toBe(200);
    const newbieCookie = nl.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: newbieCookie } });
    expect(session.statusCode).toBe(200);
    expect((session.json() as { member: { verification: string } }).member.verification).toBe("pending");

    // logout revokes (use a second login so the stored session stays valid)
    const logoutRes = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "newbiepass123" } });
    const secondCookie = logoutRes.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { cookie: secondCookie } });
    const after = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: secondCookie } });
    expect(after.statusCode).toBe(401);

    // store for later steps
    newbie = { memberId, email, cookie: nl.cookies.map((c) => `${c.name}=${c.value}`).join("; ") };
  });

  run("1.2 — code → admin activates → setmates vouch ×3 → verified as Set '98", async () => {
    const state = newbie!;
    const { memberId, cookie } = state;

    // pending members cannot post in groups (policy at API)
    const denied = await app.inject({ method: "POST", url: "/v1/policy/check", payload: { instanceId, action: "group.post", member: { id: memberId, verification: "pending", roles: [], group_admin_groups: [], vouch_count: 0 } } });
    expect((denied.json() as { allowed: boolean }).allowed).toBe(false);

    // admin sees the queue and activates the signup (admin approval queue)
    const queue = await app.inject({ method: "GET", url: "/v1/verification/queue", headers: { cookie: presidentCookie } });
    expect(queue.statusCode).toBe(200);
    expect((queue.json() as { queue: Array<{ id: string }> }).queue.some((q) => q.id === memberId)).toBe(true);

    const activate = await app.inject({ method: "POST", url: "/v1/verification/decision", headers: { cookie: presidentCookie }, payload: { memberId, decision: "activate" } });
    expect(activate.statusCode).toBe(200);
    expect((activate.json() as { status: string }).status).toBe("limited");

    // limited member: group posts allowed, DMs/money/RSVP not (§P)
    for (const [action, allowed] of [["group.post", true], ["dm.send", false], ["money.pay", false], ["event.rsvp", false]] as const) {
      const check = await app.inject({ method: "POST", url: "/v1/policy/check", payload: { instanceId, action, member: { id: memberId, verification: "limited", roles: [], group_admin_groups: [], vouch_count: 0 } } });
      expect((check.json() as { allowed: boolean }).allowed, action).toBe(allowed);
    }

    // three setmates of Set '98 identify the new member (vouching)
    const setmates = await pool.query<{ email: string }>(
      `SELECT m.email FROM members m JOIN sets s ON s.id = m.set_id
       WHERE s.year = 1998 AND m.verification IN ('verified','honorary') AND m.email <> $1 LIMIT 3`,
      [state.email],
    );
    expect(setmates.rows.length).toBeGreaterThanOrEqual(3);
    for (const sm of setmates.rows) {
      const l = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: sm.email, password: "demopass123" } });
      const c = l.cookies.map((x) => `${x.name}=${x.value}`).join("; ");
      const vouch = await app.inject({ method: "POST", url: "/v1/verification/vouch", headers: { cookie: c }, payload: { memberId } });
      expect(vouch.statusCode).toBe(200);
    }

    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } });
    expect((session.json() as { member: { verification: string } }).member.verification).toBe("verified");

    // vouching is invisible: member view of another member exposes no vouch data
    const publicView = await app.inject({ method: "GET", url: `/v1/members/${presidentId}`, headers: { cookie } });
    expect(publicView.body).not.toContain("vouch");
    expect(publicView.body).not.toContain("voucher");
  });

  run("1.2 — admin override verifies directly, honorary works", async () => {
    const invite = await app.inject({ method: "POST", url: "/v1/invites", headers: { cookie: presidentCookie }, payload: {} });
    const code = (invite.json() as { code: string }).code;
    const email = `override-${randomUUID().slice(0, 8)}@example.test`;
    const s = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { inviteCode: code, email, password: "override123", displayName: "Ola Override" } });
    const memberId = (s.json() as { memberId: string }).memberId;
    const override = await app.inject({ method: "POST", url: "/v1/verification/decision", headers: { cookie: presidentCookie }, payload: { memberId, decision: "verify" } });
    expect((override.json() as { status: string }).status).toBe("verified");
  });

  run("1.3 — profile, privacy, logged contact reveal, family links, ID card", async () => {
    const state = newbie!;

    // profile builder
    const patch = await app.inject({ method: "PATCH", url: "/v1/me", headers: { cookie: state.cookie }, payload: { city: "Lagos", profession: "Engineer", favoriteMemory: "Inter-house sports 1998", visibility: { contact: "private", birthday: "private" } } });
    expect(patch.statusCode).toBe(200);

    // contact is private: another member sees no email until reveal
    const view = await app.inject({ method: "GET", url: `/v1/members/${femiId}`, headers: { cookie: state.cookie } });
    const viewBody = view.json() as { contactVisible: boolean; email: string | null };
    expect(viewBody.contactVisible).toBe(false);
    expect(viewBody.email).toBeNull();

    // reveal is logged and notifies the owner
    const reveal = await app.inject({ method: "POST", url: `/v1/members/${femiId}/reveal-contact`, headers: { cookie: state.cookie } });
    expect(reveal.statusCode).toBe(200);
    expect((reveal.json() as { email: string }).email).toContain("@example.test");
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'contact.reveal' AND target = $1", [femiId]);
    expect(audit.rows.length).toBeGreaterThan(0);
    const femiNotifs = await pool.query("SELECT 1 FROM notifications WHERE member_id = $1 AND kind = 'contact.revealed'", [femiId]);
    expect(femiNotifs.rows.length).toBeGreaterThan(0);

    // private family link
    const link = await app.inject({ method: "POST", url: "/v1/me/family-links", headers: { cookie: state.cookie }, payload: { relatedEmail: "member3@example.test", relation: "cousin" } });
    expect(link.statusCode).toBe(200);
    const links = await app.inject({ method: "GET", url: "/v1/me/family-links", headers: { cookie: state.cookie } });
    expect((links.json() as { links: unknown[] }).links.length).toBe(1);

    // digital ID: card + QR svg, no emojis
    const idCard = await app.inject({ method: "GET", url: "/v1/me/id", headers: { cookie: state.cookie } });
    expect(idCard.statusCode).toBe(200);
    const card = idCard.json() as { card: { verification: string; profileUrl: string }; qrSvg: string };
    expect(card.card.verification).toBe("verified");
    expect(card.qrSvg).toContain("<svg");
    expect(card.qrSvg).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  run("1.1 — 2FA: enable, login requires code, wrong code rejected, disable", async () => {
    const l = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member3@example.test", password: "demopass123" } });
    const c = l.cookies.map((x) => `${x.name}=${x.value}`).join("; ");
    const setup = await app.inject({ method: "POST", url: "/v1/auth/2fa/setup", headers: { cookie: c } });
    const { secret } = setup.json() as { secret: string };
    const code = totpCode(secret, Math.floor(Date.now() / 1000 / 30));
    const enable = await app.inject({ method: "POST", url: "/v1/auth/2fa/enable", headers: { cookie: c }, payload: { code } });
    expect(enable.statusCode).toBe(200);

    // login now requires the TOTP code
    const noTotp = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member3@example.test", password: "demopass123" } });
    expect((noTotp.json() as { totpRequired?: boolean }).totpRequired).toBe(true);
    const badTotp = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member3@example.test", password: "demopass123", totp: "000000" } });
    expect(badTotp.statusCode).toBe(401);
    const good = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member3@example.test", password: "demopass123", totp: totpCode(secret, Math.floor(Date.now() / 1000 / 30)) } });
    expect(good.statusCode).toBe(200);

    const disable = await app.inject({ method: "POST", url: "/v1/auth/2fa/disable", headers: { cookie: good.cookies.map((x) => `${x.name}=${x.value}`).join("; ") }, payload: { code: totpCode(secret, Math.floor(Date.now() / 1000 / 30)) } });
    expect(disable.statusCode).toBe(200);
  });

  run("1.4 — admin sees Manage; a role change sticks; inbox works", async () => {
    // non-admin denied
    const denied = await app.inject({ method: "GET", url: "/v1/manage/overview", headers: { cookie: newbie!.cookie } });
    expect(denied.statusCode).toBe(403);

    const overview = await app.inject({ method: "GET", url: "/v1/manage/overview", headers: { cookie: presidentCookie } });
    expect(overview.statusCode).toBe(200);

    // assign secretary role to the newbie
    const state = newbie!;
    const assign = await app.inject({ method: "POST", url: `/v1/members/${state.memberId}/roles`, headers: { cookie: presidentCookie }, payload: { roleKey: "secretary" } });
    expect(assign.statusCode).toBe(200);

    // role change sticks in the session (Manage appears)
    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: state.cookie } });
    expect((session.json() as { member: { roles: string[] } }).member.roles).toContain("secretary");

    // audit logged, reversible window set (N2)
    const audit = await pool.query("SELECT reversible_until FROM audit_log WHERE action = 'role.assign' AND target = $1", [state.memberId]);
    expect(audit.rows[0]?.reversible_until).toBeTruthy();

    // notification inbox received the role change
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers: { cookie: state.cookie } });
    const body = inbox.json() as { items: Array<{ kind: string }>; unread: number };
    expect(body.items.some((i) => i.kind === "roles.changed")).toBe(true);

    const del = await app.inject({ method: "DELETE", url: `/v1/members/${state.memberId}/roles/secretary`, headers: { cookie: presidentCookie } });
    expect(del.statusCode).toBe(200);
    const after = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: state.cookie } });
    expect((after.json() as { member: { roles: string[] } }).member.roles).not.toContain("secretary");
  });
});
