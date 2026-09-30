/**
 * Roles & permissions (1.4) + Manage shell endpoints + notification inbox.
 * M5: the server refuses, the UI merely hides. Admin role changes are
 * audit-logged and reversible for 30 days (N2).
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { roleBodySchema } from "@fedites/config";
import { requireMember, requireDutyRole } from "./sessions.js";

const DUTY = new Set(["president", "treasurer", "secretary", "moderator", "editor"]);

export async function manageRoutes(
  app: FastifyInstance,
  opts: { pool: Pool },
): Promise<void> {
  const { pool } = opts;

  app.get("/v1/manage/overview", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{
      pending: string; limited: string; verified: string; honorary: string; groups: string; events: string;
    }>(
      `SELECT
         (SELECT count(*) FROM members WHERE instance_id=$1 AND verification='pending')::text AS pending,
         (SELECT count(*) FROM members WHERE instance_id=$1 AND verification='limited')::text AS limited,
         (SELECT count(*) FROM members WHERE instance_id=$1 AND verification='verified')::text AS verified,
         (SELECT count(*) FROM members WHERE instance_id=$1 AND verification='honorary')::text AS honorary,
         (SELECT count(*) FROM groups WHERE instance_id=$1)::text AS groups,
         (SELECT count(*) FROM events WHERE instance_id=$1)::text AS events`,
      [member.instanceId],
    );
    return { stats: res.rows[0] };
  });

  app.get("/v1/roles", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ key: string }>("SELECT key FROM roles WHERE instance_id = $1 ORDER BY key", [member.instanceId]);
    return { roles: res.rows.map((r) => r.key) };
  });

  app.get("/v1/members/:id/roles", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const res = await pool.query<{ key: string }>(
      `SELECT r.key FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.member_id = $1`,
      [id],
    );
    return { roles: res.rows.map((r) => r.key) };
  });

  app.post("/v1/members/:id/roles", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = roleBodySchema.parse(request.body);
    if (id === member.id && DUTY.has(body.roleKey)) {
      return reply.status(400).send({ error: "Ask another admin to change your own duty roles." });
    }
    const role = await pool.query<{ id: string }>("SELECT id FROM roles WHERE instance_id = $1 AND key = $2", [member.instanceId, body.roleKey]);
    const roleId = role.rows[0]?.id;
    if (!roleId) return reply.status(404).send({ error: "Role not found." });
    const target = await pool.query<{ id: string }>("SELECT id FROM members WHERE id = $1 AND instance_id = $2", [id, member.instanceId]);
    if (!target.rows[0]) return reply.status(404).send({ error: "Member not found." });
    await pool.query(
      `INSERT INTO member_roles (instance_id, member_id, role_id) VALUES ($1,$2,$3)
       ON CONFLICT (instance_id, member_id, role_id) DO NOTHING`,
      [member.instanceId, id, roleId],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'role.assign',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ role: body.roleKey })],
    );
    await pool.query(
      `INSERT INTO notifications (instance_id, member_id, kind, payload)
       VALUES ($1,$2,'roles.changed',$3)`,
      [member.instanceId, id, JSON.stringify({ roles: `+${body.roleKey}` })],
    );
    return { ok: true };
  });

  app.delete("/v1/members/:id/roles/:roleKey", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id, roleKey } = request.params as { id: string; roleKey: string };
    await pool.query(
      `DELETE FROM member_roles mr USING roles r
       WHERE mr.role_id = r.id AND mr.member_id = $1 AND r.key = $2 AND mr.instance_id = $3`,
      [id, roleKey, member.instanceId],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'role.remove',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ role: roleKey })],
    );
    await pool.query(
      `INSERT INTO notifications (instance_id, member_id, kind, payload)
       VALUES ($1,$2,'roles.changed',$3)`,
      [member.instanceId, id, JSON.stringify({ roles: `-${roleKey}` })],
    );
    return { ok: true };
  });

  /* ------------------------- notification inbox -------------------------- */

  app.get("/v1/notifications", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; kind: string; payload: Record<string, unknown>; read_at: Date | null; created_at: Date }>(
      `SELECT id, kind, payload, read_at, created_at FROM notifications
       WHERE instance_id = $1 AND member_id = $2 ORDER BY created_at DESC LIMIT 50`,
      [member.instanceId, member.id],
    );
    const items = res.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: typeof r.payload.title === "string" ? r.payload.title : "Notice",
      payload: r.payload,
      read: r.read_at !== null,
      createdAt: r.created_at,
    }));
    return { items, unread: items.filter((i) => !i.read).length };
  });

  app.post("/v1/notifications/:id/read", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    await pool.query(
      "UPDATE notifications SET read_at = now() WHERE id = $1 AND member_id = $2 AND read_at IS NULL",
      [id, member.id],
    );
    return { ok: true };
  });

  app.post("/v1/notifications/read-all", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    await pool.query(
      "UPDATE notifications SET read_at = now() WHERE member_id = $1 AND read_at IS NULL",
      [member.id],
    );
    return { ok: true };
  });
}
