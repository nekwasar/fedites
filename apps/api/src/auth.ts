/**
 * Auth routes (1.1): signup (invite code), login (+2FA), logout, session,
 * 2FA setup/enable/disable. Security: scrypt hashes, hashed session tokens,
 * rate limiting. §P: signup requires an invite code from a verified member.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { signupBodySchema, loginBodySchema } from "@fedites/config";
import { hashPassword, verifyPassword, passwordProblems } from "./password.js";
import { generateTotpSecret, verifyTotp, otpauthUrl } from "./totp.js";
import {
  createSession, revokeSession, sessionCookie, clearSessionCookie,
  readSessionToken, requireMember, type SessionMember,
} from "./sessions.js";
import { rateLimit, clientKey } from "./ratelimit.js";

const totpBody = z.object({ code: z.string().min(6).max(10) });

export async function authRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (instanceId: string) => Promise<import("@fedites/config").InstanceConfig> },
): Promise<void> {
  const { pool } = opts;

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Check the highlighted fields, then try again.",
        details: err.issues.map((i: { path: (string | number)[]; message: string }) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.status(status).send({ error: status >= 500 ? "Something went wrong on our side. Try again shortly." : err.message });
  });

  app.decorate("pg", pool);

  /* ---------------- signup: invite code -> pending member ---------------- */

  app.post("/v1/auth/signup", async (request, reply) => {
    if (!rateLimit(clientKey(request, "signup"), 10, 60_000)) {
      return reply.status(429).send({ error: "Too many attempts. Wait a minute, then try again." });
    }
    const body = signupBodySchema.parse(request.body);

    const problems = passwordProblems(body.password);
    if (problems.length > 0) return reply.status(400).send({ error: `Password: ${problems.join("; ")}.` });

    const instanceRes = await pool.query<{ id: string }>(
      "SELECT id FROM instances ORDER BY created_at LIMIT 1",
    );
    const instance = instanceRes.rows[0];
    if (!instance) return reply.status(503).send({ error: "No school instance is set up yet." });

    const codeRes = await pool.query<{ id: string; created_by: string }>(
      `SELECT id, created_by FROM invite_codes
       WHERE instance_id = $1 AND code = $2 AND used_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())`,
      [instance.id, body.inviteCode],
    );
    const code = codeRes.rows[0];
    if (!code) return reply.status(400).send({ error: "That invite code is not valid. Ask a verified member for a fresh one." });

    const inviter = await pool.query<{ verification: string }>(
      "SELECT verification FROM members WHERE id = $1",
      [code.created_by],
    );
    if (inviter.rows[0]?.verification !== "verified" && inviter.rows[0]?.verification !== "honorary") {
      return reply.status(400).send({ error: "That invite code belongs to an unverified member." });
    }

    const emailTaken = await pool.query("SELECT 1 FROM members WHERE instance_id = $1 AND email = $2", [instance.id, body.email.toLowerCase()]);
    if (emailTaken.rows.length > 0) return reply.status(409).send({ error: "That email already has an account. Sign in instead." });

    let setId: string | null = null;
    if (body.setYear !== undefined) {
      const setRes = await pool.query<{ id: string }>("SELECT id FROM sets WHERE instance_id = $1 AND year = $2", [instance.id, body.setYear]);
      setId = setRes.rows[0]?.id ?? null;
      if (!setId) return reply.status(400).send({ error: "That set year does not exist yet. Leave it out and ask the admin to assign it." });
    }

    const passwordHash = await hashPassword(body.password);
    const memberRes = await pool.query<{ id: string }>(
      `INSERT INTO members (instance_id, set_id, display_name, email, password_hash, verification)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
      [instance.id, setId, body.displayName, body.email.toLowerCase(), passwordHash],
    );
    const memberId = memberRes.rows[0]!.id;
    await pool.query("UPDATE invite_codes SET used_by = $1, used_at = now() WHERE id = $2", [memberId, code.id]);

    // Vouching requests go to setmates in-app (spec §11 verification UX).
    if (setId) {
      const setmates = await pool.query<{ id: string }>(
        `SELECT DISTINCT m.id FROM members m
         WHERE m.instance_id = $1 AND m.set_id = $2 AND m.id <> $3
           AND m.verification IN ('verified','honorary')`,
        [instance.id, setId, memberId],
      );
      for (const s of setmates.rows) {
        await pool.query(
          `INSERT INTO notifications (instance_id, member_id, kind, payload)
           VALUES ($1,$2,'verification.vouch-request',$3)`,
          [instance.id, s.id, JSON.stringify({ memberId, memberName: body.displayName })],
        );
      }
    }

    return reply.status(201).send({ memberId, status: "pending" });
  });

  /* -------------------------------- login -------------------------------- */

  app.post("/v1/auth/login", async (request, reply) => {
    if (!rateLimit(clientKey(request, "login"), 10, 60_000)) {
      return reply.status(429).send({ error: "Too many attempts. Wait a minute, then try again." });
    }
    const body = loginBodySchema.parse(request.body);
    const res = await pool.query<{
      id: string; instance_id: string; display_name: string; verification: SessionMember["verification"];
      password_hash: string | null; totp_enabled: boolean; totp_secret: string | null; email: string; phone: string | null;
    }>(
      `SELECT id, instance_id, display_name, verification, password_hash, totp_enabled, totp_secret, email, phone
       FROM members WHERE email = $1 AND deleted_at IS NULL AND memorial = false AND verification <> 'rejected'`,
      [body.email.toLowerCase()],
    );
    const m = res.rows[0];
    const ok = m?.password_hash ? await verifyPassword(body.password, m.password_hash) : false;
    if (!m || !ok) return reply.status(401).send({ error: "Email or password is incorrect." });

    if (m.totp_enabled) {
      if (!body.totp) return reply.status(401).send({ error: "totp-required", totpRequired: true });
      if (!m.totp_secret || !verifyTotp(m.totp_secret, body.totp)) {
        return reply.status(401).send({ error: "That authentication code is not valid. Check your authenticator app.", totpRequired: true });
      }
    }

    const { token } = await createSession(pool, m.instance_id, m.id, request.headers["user-agent"]);
    void reply.header("set-cookie", sessionCookie(token, process.env.NODE_ENV === "production"));
    return {
      token,
      member: { id: m.id, displayName: m.display_name, verification: m.verification, roles: [] as string[] },
    };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const token = readSessionToken(request);
    if (token) await revokeSession(pool, token);
    void reply.header("set-cookie", clearSessionCookie());
    return { ok: true };
  });

  /* ------------------------------- session ------------------------------- */

  app.get("/v1/auth/session", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const rolesRes = await pool.query<{ key: string }>(
      `SELECT r.key FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.member_id = $1`,
      [member.id],
    );
    member.roles = rolesRes.rows.map((r) => r.key);
    return { member };
  });

  /* --------------------------------- 2FA --------------------------------- */

  app.post("/v1/auth/2fa/setup", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const secret = generateTotpSecret();
    await pool.query("UPDATE members SET totp_secret = $1 WHERE id = $2", [secret, member.id]);
    const config = await opts.loadConfigByInstance(member.instanceId);
    return { secret, otpauthUrl: otpauthUrl(secret, member.email, config.instance.shortName) };
  });

  app.post("/v1/auth/2fa/enable", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { code } = totpBody.parse(request.body);
    const res = await pool.query<{ totp_secret: string | null }>("SELECT totp_secret FROM members WHERE id = $1", [member.id]);
    const secret = res.rows[0]?.totp_secret;
    if (!secret) return reply.status(400).send({ error: "Start 2FA setup first." });
    if (!verifyTotp(secret, code)) return reply.status(400).send({ error: "That code is not valid. Try the next one." });
    await pool.query("UPDATE members SET totp_enabled = true WHERE id = $1", [member.id]);
    return { ok: true };
  });

  app.post("/v1/auth/2fa/disable", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { code } = totpBody.parse(request.body);
    const res = await pool.query<{ totp_secret: string | null }>("SELECT totp_secret FROM members WHERE id = $1", [member.id]);
    const secret = res.rows[0]?.totp_secret;
    if (!secret || !verifyTotp(secret, code)) return reply.status(400).send({ error: "That code is not valid." });
    await pool.query("UPDATE members SET totp_enabled = false, totp_secret = NULL WHERE id = $1", [member.id]);
    return { ok: true };
  });
}
