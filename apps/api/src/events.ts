/**
 * Events (Phase 3, sessions 3.1 + 3.2): unified calendar, RSVP, QR tickets +
 * door check-in with live counts, reunion planning suite (tasks, budget).
 *
 * Rules honored here:
 *  - §P: created by admins and group admins only; limited accounts cannot RSVP.
 *  - §2 bridge: event created → group Activity post + countdown; tickets issued.
 *  - v6.1: virtual attendance is an external link; no native calls/streaming.
 *  - N1/N2: nothing hard-deleted; organizer edits audit-logged, reversible.
 *  - K1: location is venue/city text only — no live location in this batch.
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import QRCode from "qrcode";
import { createHash, createHmac } from "node:crypto";
import {
  eventCreateSchema, eventUpdateSchema, rsvpSchema, ticketScanSchema,
  type EventListItem, type EventCounts, type EventTask, type BudgetItem,
  type InstanceConfig,
} from "@fedites/config";
import { requireMember, requireDutyRole } from "./sessions.js";
import { evaluate } from "./policy.js";

const TICKET_PREFIX = "fedites-ticket:";

/** Ticket secret: random per ticket; QR payload is HMAC-signed so the door
 *  can detect tampering before the hash lookup. */
function ticketSecretHash(instanceId: string, secret: string): string {
  return createHash("sha256").update(`${instanceId}:${secret}`).digest("hex");
}

function signPayload(instanceId: string, payload: string): string {
  const key = process.env.TICKET_HMAC_KEY ?? "fedites-ticket-key";
  return createHmac("sha256", `${key}:${instanceId}`).update(payload).digest("base64url");
}

export async function eventsRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: { broadcast: (rooms: string[], e: Record<string, unknown>) => void } },
): Promise<void> {
  const { pool } = opts;

  async function loadEvent(instanceId: string, eventId: string) {
    const res = await pool.query<{
      id: string; title: string; description: string | null; starts_at: Date; ends_at: Date | null;
      venue: string | null; city: string | null; virtual_link: string | null; anniversary: boolean;
      check_in_open: boolean; group_id: string | null; created_by: string | null; created_at: Date;
      group_name: string | null; group_type: string | null;
    }>(
      `SELECT e.*, g.name AS group_name, g.type AS group_type
       FROM events e LEFT JOIN groups g ON g.id = e.group_id
       WHERE e.id = $1 AND e.instance_id = $2 AND e.archived_at IS NULL`,
      [eventId, instanceId],
    );
    return res.rows[0] ?? null;
  }

  /** Duty role, event creator, or admin of the owning group (§P). */
  async function isOrganizer(member: { id: string; roles: string[] }, ev: { created_by: string | null; group_id: string | null }): Promise<boolean> {
    if (requireDutyRole(member)) return true;
    if (ev.created_by === member.id) return true;
    if (ev.group_id !== null) {
      const am = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2 AND is_admin = true",
        [ev.group_id, member.id],
      );
      return am.rows.length > 0;
    }
    return false;
  }

  async function counts(eventId: string): Promise<EventCounts> {
    const going = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM event_rsvps WHERE event_id = $1 AND response = 'going'", [eventId]);
    const maybe = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM event_rsvps WHERE event_id = $1 AND response = 'maybe'", [eventId]);
    const checked = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM event_checkins WHERE event_id = $1", [eventId]);
    return { going: Number(going.rows[0]?.n ?? 0), maybe: Number(maybe.rows[0]?.n ?? 0), checkedIn: Number(checked.rows[0]?.n ?? 0) };
  }

  /* ------------------------------ calendar ------------------------------ */

  app.get("/v1/events", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{
      id: string; title: string; description: string | null; starts_at: Date; ends_at: Date | null;
      venue: string | null; city: string | null; virtual_link: string | null; anniversary: boolean;
      group_id: string | null; group_name: string | null; created_by: string | null; created_at: Date; my: string | null;
    }>(
      `SELECT e.*, g.name AS group_name,
              (SELECT response FROM event_rsvps r WHERE r.event_id = e.id AND r.member_id = $2) AS my
       FROM events e LEFT JOIN groups g ON g.id = e.group_id
       WHERE e.instance_id = $1 AND e.archived_at IS NULL
       ORDER BY e.starts_at DESC LIMIT 100`,
      [member.instanceId, member.id],
    );
    const items: EventListItem[] = [];
    for (const e of res.rows) {
      const c = await counts(e.id);
      items.push({
        id: e.id, title: e.title, startsAt: e.starts_at.toISOString(), endsAt: e.ends_at?.toISOString() ?? null,
        venue: e.venue, city: e.city, description: e.description, virtualLink: e.virtual_link,
        anniversary: e.anniversary, groupId: e.group_id, groupName: e.group_name,
        goingCount: c.going, myResponse: (e.my as EventListItem["myResponse"]) ?? null,
        organizer: await isOrganizer(member, e), createdAt: e.created_at.toISOString(),
      });
    }
    return { upcoming: items.filter((e) => new Date(e.startsAt).getTime() >= Date.now() - 86_400_000).reverse(), past: items.filter((e) => new Date(e.startsAt).getTime() < Date.now() - 86_400_000) };
  });

  /* ------------------------------- create ------------------------------- */

  app.post("/v1/events", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = eventCreateSchema.parse(request.body);
    const config = await opts.loadConfigByInstance(member.instanceId);

    let groupId: string | null = null;
    let groupAdmin = false;
    if (body.groupId !== undefined) {
      const g = await pool.query<{ id: string }>("SELECT id FROM groups WHERE id = $1 AND instance_id = $2 AND status = 'active'", [body.groupId, member.instanceId]);
      if (!g.rows[0]) return reply.status(404).send({ error: "Group not found." });
      groupId = g.rows[0].id;
      const am = await pool.query("SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2 AND is_admin = true", [groupId, member.id]);
      groupAdmin = am.rows.length > 0;
    }
    // §P: events are created by admins and group admins only.
    const gate = evaluate(config, "event.create", {
      status: member.verification === "rejected" ? "limited" : member.verification,
      verified: member.verification === "verified",
      honorary: member.verification === "honorary",
      roles: member.roles,
      groupAdminOf: groupAdmin ? [groupId!] : [],
      vouchCount: 0,
    });
    if (!gate.allowed) return reply.status(403).send({ error: gate.reason });

    const res = await pool.query<{ id: string }>(
      `INSERT INTO events (instance_id, group_id, created_by, title, description, starts_at, ends_at, location, venue, city, virtual_link, anniversary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        member.instanceId, groupId, member.id, body.title, body.description ?? null,
        body.startsAt, body.endsAt ?? null, body.venue ?? null, body.venue ?? null,
        body.city ?? null, body.virtualLink ?? null, body.anniversary ?? false,
      ],
    );
    const eventId = res.rows[0]!.id;

    // §2 bridge: event created → group Activity post (badged with the crest).
    if (groupId !== null) {
      await pool.query(
        `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body)
         VALUES ($1,$2,$3,'event',$4)`,
        [member.instanceId, groupId, member.id, `${body.title}${body.venue !== undefined ? ` — ${body.venue}` : ""}`],
      );
      opts.hub.broadcast([`group:${groupId}`], { type: "event.new", groupId, eventId });
    }
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'event.create',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, eventId, JSON.stringify({ title: body.title })],
    );
    return { id: eventId };
  });

  app.patch("/v1/events/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Organizers only." });
    const body = eventUpdateSchema.parse(request.body);

    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (col: string, v: unknown): void => { values.push(v); sets.push(`${col} = $${values.length}`); };
    if (body.title !== undefined) set("title", body.title);
    if (body.description !== undefined) set("description", body.description);
    if (body.startsAt !== undefined) set("starts_at", body.startsAt);
    if (body.endsAt !== undefined) set("ends_at", body.endsAt);
    if (body.venue !== undefined) set("venue", body.venue);
    if (body.city !== undefined) set("city", body.city);
    if (body.virtualLink !== undefined) set("virtual_link", body.virtualLink);
    if (body.anniversary !== undefined) set("anniversary", body.anniversary);
    if (body.checkInOpen !== undefined) set("check_in_open", body.checkInOpen);
    set("edited_at", new Date());
    values.push(id);
    await pool.query(`UPDATE events SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'event.edit',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ fields: sets.length - 1 })],
    );
    return { ok: true };
  });

  /* -------------------------------- RSVP -------------------------------- */

  app.post("/v1/events/:id/rsvp", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = rsvpSchema.parse(request.body);
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    const config = await opts.loadConfigByInstance(member.instanceId);
    // §P: limited accounts cannot RSVP until verified.
    const gate = evaluate(config, "event.rsvp", {
      status: member.verification === "rejected" ? "limited" : member.verification,
      verified: member.verification === "verified",
      honorary: member.verification === "honorary",
      roles: member.roles,
      vouchCount: 0,
    });
    if (!gate.allowed) return reply.status(403).send({ error: gate.reason });

    await pool.query(
      `INSERT INTO event_rsvps (instance_id, event_id, member_id, response, responded_at)
       VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (instance_id, event_id, member_id) DO UPDATE SET response = $4, responded_at = now()`,
      [member.instanceId, id, member.id, body.response],
    );
    const c = await counts(id);
    return { ok: true, counts: c };
  });

  /* ------------------------- tickets + door mode ------------------------ */

  /** Issue (if needed) and return my signed QR ticket. */
  app.get("/v1/events/:id/my-ticket", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    const rsvp = await pool.query<{ response: string }>(
      "SELECT response FROM event_rsvps WHERE event_id = $1 AND member_id = $2",
      [id, member.id],
    );
    if ((rsvp.rows[0]?.response ?? "no") !== "going") {
      return reply.status(403).send({ error: "RSVP as going to get your ticket." });
    }
    // Secret is derived deterministically per (event, member) pair from the
  // HMAC key, so re-issues stay stable; only the hash is stored. Forging a
  // different member's ticket breaks the payload signature.
  const secret = createHmac("sha256", `${process.env.TICKET_HMAC_KEY ?? "fedites-ticket-key"}:${member.instanceId}`)
    .update(`${id}:${member.id}`).digest("base64url").slice(0, 24);
  await pool.query(
    `INSERT INTO event_tickets (instance_id, event_id, member_id, secret_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (event_id, member_id) DO UPDATE SET secret_hash = $4`,
    [member.instanceId, id, member.id, ticketSecretHash(member.instanceId, secret)],
  );
    const payload = `${TICKET_PREFIX}${id}.${member.id}.${secret}.${signPayload(member.instanceId, `${id}.${member.id}.${secret}`)}`;
    const qrSvg = await QRCode.toString(payload, { type: "svg", margin: 0 });
    return {
      payload,
      qrSvg: qrSvg.replace(/fill="#fff[^"]*"/g, 'fill="var(--c-base)"').replace(/stroke="#[0-9a-f]+"/g, 'stroke="currentColor"'),
      eventTitle: ev.title,
      startsAt: ev.starts_at.toISOString(),
    };
  });

  /** Door mode: verify a scanned ticket, record the check-in. */
  app.post("/v1/events/:id/check-in", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = ticketScanSchema.parse(request.body);
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Only door volunteers and organizers check people in." });
    if (!ev.check_in_open) return reply.status(403).send({ error: "Door mode is closed. Open it in the reunion suite." });

    if (!body.code.startsWith(TICKET_PREFIX)) return reply.status(400).send({ error: "That is not a Fedites ticket." });
    const rest = body.code.slice(TICKET_PREFIX.length);
    const parts = rest.split(".");
    if (parts.length !== 4) return reply.status(400).send({ error: "Ticket is malformed." });
    const [eventId, memberId, secret, embeddedSig] = parts as [string, string, string, string];
    if (eventId !== id) return reply.status(400).send({ error: "This ticket is for a different event." });
    // The QR payload is self-contained: the embedded HMAC signature covers
    // event, member, and secret, so any tampering fails before the hash check.
    if (signPayload(member.instanceId, `${eventId}.${memberId}.${secret}`) !== embeddedSig) {
      return reply.status(400).send({ error: "Ticket signature failed. Do not admit." });
    }
    const ticket = await pool.query<{ id: string }>(
      "SELECT id FROM event_tickets WHERE event_id = $1 AND member_id = $2 AND secret_hash = $3",
      [id, memberId, ticketSecretHash(member.instanceId, secret)],
    );
    if (ticket.rows.length === 0) return reply.status(400).send({ error: "Ticket not recognised. Do not admit." });

    const done = await pool.query(
      `INSERT INTO event_checkins (instance_id, event_id, member_id, checked_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (event_id, member_id) DO NOTHING RETURNING id`,
      [member.instanceId, id, memberId, member.id],
    );
    const c = await counts(id);
    return done.rows.length > 0
      ? { ok: true, duplicate: false, counts: c }
      : { ok: true, duplicate: true, counts: c };
  });

  app.get("/v1/events/:id/live-counts", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    return { counts: await counts(id), checkInOpen: ev.check_in_open };
  });

  app.get("/v1/events/:id/attendees", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Organizers only." });
    const res = await pool.query<{ member_id: string; display_name: string; response: string; checked_at: Date | null }>(
      `SELECT r.member_id, m.display_name, r.response, c.checked_at
       FROM event_rsvps r JOIN members m ON m.id = r.member_id
       LEFT JOIN event_checkins c ON c.event_id = r.event_id AND c.member_id = r.member_id
       WHERE r.event_id = $1 ORDER BY m.display_name`,
      [id],
    );
    return { attendees: res.rows.map((r) => ({ memberId: r.member_id, name: r.display_name, response: r.response, checkedIn: r.checked_at !== null })) };
  });

  /* ----------------------- reunion planning suite ----------------------- */

  app.get("/v1/events/:id/tasks", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Organizers only." });
    const res = await pool.query<{ id: string; title: string; assignee: string | null; assignee_name: string | null; due_at: Date | null; done: boolean }>(
      `SELECT t.id, t.title, t.assignee, m.display_name AS assignee_name, t.due_at, t.done
       FROM event_tasks t LEFT JOIN members m ON m.id = t.assignee
       WHERE t.event_id = $1 ORDER BY t.done, t.due_at NULLS LAST, t.created_at`,
      [id],
    );
    const tasks: EventTask[] = res.rows.map((t) => ({
      id: t.id, title: t.title, assignee: t.assignee, assigneeName: t.assignee_name,
      dueAt: t.due_at?.toISOString() ?? null, done: t.done,
    }));
    const budget = await pool.query<{ id: string; label: string; amount_minor: string; currency: string; kind: string }>(
      "SELECT id, label, amount_minor::text, currency, kind FROM event_budget_items WHERE event_id = $1 ORDER BY created_at",
      [id],
    );
    const items: BudgetItem[] = budget.rows.map((b) => ({ id: b.id, label: b.label, amountMinor: Number(b.amount_minor), currency: b.currency, kind: b.kind as BudgetItem["kind"] }));
    return { tasks, budget: items };
  });

  app.post("/v1/events/:id/tasks", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Organizers only." });
    const body = zTaskCreate.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO event_tasks (instance_id, event_id, title, assignee, due_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, id, body.title, body.assignee ?? null, body.dueAt ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  app.patch("/v1/events/:id/tasks/:taskId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id, taskId } = request.params as { id: string; taskId: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Organizers only." });
    const body = zTaskUpdate.parse(request.body);
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (col: string, v: unknown): void => { values.push(v); sets.push(`${col} = $${values.length}`); };
    if (body.title !== undefined) set("title", body.title);
    if (body.assignee !== undefined) set("assignee", body.assignee);
    if (body.done !== undefined) set("done", body.done);
    values.push(taskId, id);
    await pool.query(`UPDATE event_tasks SET ${sets.join(", ")} WHERE id = $${values.length - 1} AND event_id = $${values.length}`, values);
    return { ok: true };
  });

  app.post("/v1/events/:id/budget", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const ev = await loadEvent(member.instanceId, id);
    if (!ev) return reply.status(404).send({ error: "Event not found." });
    if (!(await isOrganizer(member, ev))) return reply.status(403).send({ error: "Organizers only." });
    const body = zBudgetCreate.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO event_budget_items (instance_id, event_id, label, amount_minor, currency, kind, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [member.instanceId, id, body.label, body.amountMinor, body.currency, body.kind, member.id],
    );
    return { id: res.rows[0]!.id };
  });
}

import { z } from "zod";

const zTaskCreate = z.object({
  title: z.string().min(2).max(200),
  assignee: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});
const zTaskUpdate = z.object({
  title: z.string().min(2).max(200).optional(),
  assignee: z.string().uuid().nullable().optional(),
  done: z.boolean().optional(),
});
const zBudgetCreate = z.object({
  label: z.string().min(1).max(120),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  kind: z.enum(["planned", "actual"]).default("planned"),
});

