/**
 * Sessions (1.1): opaque random tokens; only the SHA-256 hash is stored.
 * Delivered as an HttpOnly SameSite=Lax cookie; 30-day expiry; revocable.
 */
import { randomBytes, createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

export const SESSION_COOKIE = "fedites_session";
const SESSION_TTL_DAYS = 30;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export interface SessionMember {
  id: string;
  instanceId: string;
  displayName: string;
  verification: "pending" | "limited" | "verified" | "honorary" | "rejected";
  roles: string[];
  totpEnabled: boolean;
  email: string;
  phone: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    member?: SessionMember;
  }
}

export async function createSession(
  pool: Pool,
  instanceId: string,
  memberId: string,
  userAgent: string | undefined,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO sessions (instance_id, member_id, token_hash, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [instanceId, memberId, hashToken(token), userAgent ?? null, expiresAt],
  );
  return { token, expiresAt };
}

export async function revokeSession(pool: Pool, token: string): Promise<void> {
  await pool.query(
    "UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(token)],
  );
}

export async function loadSessionMember(pool: Pool, token: string): Promise<SessionMember | null> {
  const res = await pool.query<{
    id: string; instance_id: string; display_name: string; verification: SessionMember["verification"];
    totp_enabled: boolean; email: string; phone: string | null; roles: string[] | null;
  }>(
    `SELECT m.id, m.instance_id, m.display_name, m.verification, m.totp_enabled, m.email, m.phone,
            COALESCE(json_agg(r.key) FILTER (WHERE r.key IS NOT NULL), '[]'::json) AS roles
     FROM sessions s
     JOIN members m ON m.id = s.member_id
     LEFT JOIN member_roles mr ON mr.member_id = m.id
     LEFT JOIN roles r ON r.id = mr.role_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
       AND m.memorial = false AND m.deleted_at IS NULL AND m.verification <> 'rejected'
     GROUP BY m.id`,
    [hashToken(token)],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    instanceId: row.instance_id,
    displayName: row.display_name,
    verification: row.verification,
    roles: row.roles ?? [],
    totpEnabled: row.totp_enabled,
    email: row.email,
    phone: row.phone,
  };
}

export function readSessionToken(request: FastifyRequest): string | null {
  const cookie = request.headers.cookie;
  if (cookie) {
    const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
    if (match?.[1]) return match[1];
  }
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireMember(request: FastifyRequest, reply: FastifyReply): Promise<SessionMember | null> {
  const token = readSessionToken(request);
  if (token) {
    const pool = (request.server as unknown as { pg: Pool }).pg;
    const member = await loadSessionMember(pool, token);
    if (member) return member;
  }
  void reply.status(401).send({ error: "sign in required" });
  return null;
}

export function requireDutyRole(member: SessionMember): boolean {
  const duty = new Set(["president", "treasurer", "secretary", "moderator", "editor"]);
  return member.roles.some((r) => duty.has(r));
}
