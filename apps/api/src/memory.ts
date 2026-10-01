/**
 * Memory Lane (Phase 5 batch 1, session 5.1): throwback archive, yearbook
 * digitization + name search, on-this-day, hall of fame, memorial pages.
 *
 * §P: members upload, admins approve into the official archive. The admin
 * path is the enterprise workhorse: multi-file bulk upload, yearbook PDF
 * + CSV name import — every datum admin-uploadable smoothly (white-label
 * content seeding, configuration.md §7).
 * Memorial state (§P): approval sets members.memorial — no logins (session
 * loader already excludes memorial members), no birthday pushes (push senders
 * check memorial), content preserved read-only.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";

export async function memoryRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<import("@fedites/config").InstanceConfig> },
): Promise<void> {
  const { pool } = opts;

  /* ------------------------------- eras -------------------------------- */

  app.get("/v1/memory/eras", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query("SELECT id, name, year_from, year_to FROM memory_eras WHERE instance_id = $1 ORDER BY year_from", [member.instanceId]);
    return { eras: res.rows };
  });

  app.post("/v1/manage/memory/eras", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zEra.parse(request.body);
    const res = await pool.query<{ id: string }>(
      "INSERT INTO memory_eras (instance_id, name, year_from, year_to) VALUES ($1,$2,$3,$4) RETURNING id",
      [member.instanceId, body.name, body.yearFrom ?? null, body.yearTo ?? null],
    );
    return { id: res.rows[0]!.id };
  });

  /* --------------------------- throwback wall -------------------------- */

  app.get("/v1/memory/throwbacks", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { eraId, year } = request.query as { eraId?: string; year?: string };
    const res = await pool.query<{ id: string; media_id: string; year: number | null; caption: string | null; status: string; era_name: string | null; uploader_name: string; uploader_id: string }>(
      `SELECT i.id, i.media_id, i.year, i.caption, i.status, e.name AS era_name, m.display_name AS uploader_name, i.uploaded_by
       FROM memory_items i
       LEFT JOIN memory_eras e ON e.id = i.era_id
       JOIN members m ON m.id = i.uploaded_by
       WHERE i.instance_id = $1 AND i.kind = 'throwback'
         AND (i.status = 'approved' OR i.uploaded_by = $2)
         AND ($3::uuid IS NULL OR i.era_id = $3::uuid)
         AND ($4::int IS NULL OR i.year = $4::int)
       ORDER BY i.year DESC NULLS LAST, i.created_at DESC LIMIT 100`,
      [member.instanceId, member.id, eraId ?? null, year ?? null],
    );
    return {
      items: res.rows.map((r) => ({
        id: r.id, mediaId: r.media_id, year: r.year, caption: r.caption,
        status: r.status, era: r.era_name, uploader: r.uploader_name,
        mine: r.uploader_id === member.id,
      })),
    };
  });

  /** Member upload → pending (§P). Admins may also upload via this route. */
  app.post("/v1/memory/throwbacks", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zThrowback.parse(request.body);
    const isAdmin = requireDutyRole(member);
    const res = await pool.query<{ id: string; status: string }>(
      `INSERT INTO memory_items (instance_id, kind, media_id, era_id, year, caption, uploaded_by, status)
       VALUES ($1,'throwback',$2,$3,$4,$5,$6,$7) RETURNING id, status`,
      [member.instanceId, body.mediaId, body.eraId ?? null, body.year ?? null, body.caption ?? null, member.id, isAdmin ? "approved" : "pending"],
    );
    return { id: res.rows[0]!.id, status: res.rows[0]!.status };
  });

  /* ------------------------------ yearbooks ---------------------------- */

  app.get("/v1/memory/yearbooks", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; year: number; title: string | null; media_id: string | null; entry_count: string }>(
      `SELECT y.id, y.year, y.title, y.media_id,
              (SELECT count(*) FROM yearbook_entries e WHERE e.yearbook_id = y.id)::text AS entry_count
       FROM yearbooks y WHERE y.instance_id = $1 ORDER BY y.year DESC`,
      [member.instanceId],
    );
    return { yearbooks: res.rows.map((y) => ({ id: y.id, year: y.year, title: y.title, mediaId: y.media_id, entryCount: Number(y.entry_count) })) };
  });

  app.get("/v1/memory/yearbooks/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const { q } = request.query as { q?: string };
    const book = await pool.query<{ id: string; year: number; title: string | null; media_id: string | null }>(
      "SELECT id, year, title, media_id FROM yearbooks WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const b = book.rows[0];
    if (!b) return reply.status(404).send({ error: "Yearbook not found." });
    const term = `%${(q ?? "").toLowerCase()}%`;
    const entries = await pool.query<{ id: string; full_name: string; section: string | null }>(
      `SELECT id, full_name, section FROM yearbook_entries
       WHERE yearbook_id = $1 AND ($2 = '%%' OR LOWER(full_name) LIKE $2 OR LOWER(COALESCE(section,'')) LIKE $2)
       ORDER BY full_name LIMIT 500`,
      [id, term],
    );
    return { yearbook: { id: b.id, year: b.year, title: b.title, mediaId: b.media_id }, entries: entries.rows };
  });

  /* ----------------------------- hall of fame -------------------------- */

  app.get("/v1/memory/hall-of-fame", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; display_name: string; citation: string; year: number | null; media_id: string | null }>(
      "SELECT id, display_name, citation, year, media_id FROM hall_of_fame WHERE instance_id = $1 ORDER BY year DESC NULLS LAST, created_at DESC",
      [member.instanceId],
    );
    return { honourees: res.rows };
  });

  /* ------------------------------ memorials ---------------------------- */

  /** Member requests a memorial page; family confirmation is by admins (§P). */
  app.post("/v1/memory/memorials", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zMemorialRequest.parse(request.body);
    const target = await pool.query<{ id: string; memorial: boolean }>(
      "SELECT id, memorial FROM members WHERE id = $1 AND instance_id = $2",
      [body.memberId, member.instanceId],
    );
    if (!target.rows[0]) return reply.status(404).send({ error: "Member not found." });
    if (target.rows[0].memorial) return reply.status(400).send({ error: "A memorial page already exists." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO memorial_pages (instance_id, member_id, requested_by, tribute)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [member.instanceId, body.memberId, member.id, body.tribute ?? null],
    );
    // Duty holders get the approval request in-app.
    const admins = await pool.query<{ id: string }>(
      `SELECT DISTINCT m.id FROM members m JOIN member_roles mr ON mr.member_id = m.id JOIN roles r ON r.id = mr.role_id
       WHERE m.instance_id = $1 AND r.key IN ('president','secretary')`,
      [member.instanceId],
    );
    for (const a of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (instance_id, member_id, kind, payload)
         VALUES ($1,$2,'system.notice',$3)`,
        [member.instanceId, a.id, JSON.stringify({ title: "Memorial page requested", memorialId: res.rows[0]!.id })],
      );
    }
    return { id: res.rows[0]!.id, status: "requested" };
  });

  /** Memorial page: tribute + condolence book + funeral coordination. */
  app.get("/v1/memory/memorials/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const page = await pool.query<{ id: string; member_id: string; member_name: string; set_year: number | null; tribute: string | null; status: string; funeral_date: string | null }>(
      `SELECT p.id, p.member_id, m.display_name AS member_name, s.year AS set_year, p.tribute, p.status, p.funeral_date::text
       FROM memorial_pages p JOIN members m ON m.id = p.member_id
       LEFT JOIN sets s ON s.id = m.set_id
       WHERE p.id = $1 AND p.instance_id = $2`,
      [id, member.instanceId],
    );
    const pageRow = page.rows[0];
    if (!pageRow) return reply.status(404).send({ error: "Memorial not found." });
    const condolences = await pool.query<{ id: string; message: string; attending: boolean; member_name: string; created_at: Date }>(
      `SELECT c.id, c.message, c.attending, m.display_name AS member_name, c.created_at
       FROM memorial_condolences c JOIN members m ON m.id = c.member_id
       WHERE c.memorial_id = $1 AND c.archived_at IS NULL ORDER BY c.created_at DESC`,
      [id],
    );
    return {
      memorial: {
        id: pageRow.id, memberName: pageRow.member_name, setYear: pageRow.set_year,
        tribute: pageRow.tribute, status: pageRow.status, funeralDate: pageRow.funeral_date,
      },
      condolences: condolences.rows.map((c) => ({
        id: c.id, message: c.message, attending: c.attending,
        name: c.member_name, at: c.created_at,
      })),
    };
  });

  /** Condolence book + funeral attendance coordination (mvp §10). */
  app.post("/v1/memory/memorials/:id/condolences", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zCondolence.parse(request.body);
    const page = await pool.query("SELECT 1 FROM memorial_pages WHERE id = $1 AND instance_id = $2 AND status = 'approved'", [id, member.instanceId]);
    if (page.rows.length === 0) return reply.status(404).send({ error: "Approved memorial not found." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO memorial_condolences (instance_id, memorial_id, member_id, message, attending)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, id, member.id, body.message, body.attending ?? false],
    );
    return { id: res.rows[0]!.id };
  });

  /* ======================= ADMIN WORKBENCH (bulk) ======================= */

  /**
   * Multi-file bulk upload: images + era + year + shared caption. Every file
   * becomes an approved archive item in one request — the enterprise seeding
   * path (configuration.md §7).
   */
  app.post("/v1/manage/memory/bulk", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });

    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.status(400).send({ error: "Attach files and metadata." });
    const rawFiles = body.files;
    const asFile = (one: unknown): { value: Buffer; mimetype: string; filename: string } | null => {
      if (one === null || one === undefined || typeof one !== "object") return null;
      const f = one as { value?: Buffer; mimetype?: string; filename?: string };
      if (f.value !== undefined && typeof f.mimetype === "string") {
        return { value: f.value, mimetype: f.mimetype, filename: f.filename ?? "upload" };
      }
      return null;
    };
    const files = (Array.isArray(rawFiles) ? rawFiles : rawFiles !== undefined ? [rawFiles] : [])
      .map(asFile)
      .filter((f): f is { value: Buffer; mimetype: string; filename: string } => f !== null);
    if (files.length === 0) return reply.status(400).send({ error: "Attach at least one file." });

    // Non-file fields arrive as part objects ({ value }) under attachFieldsToBody.
    const fieldValue = (v: unknown): string => {
      if (v !== null && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
        return String((v as { value: unknown }).value);
      }
      return v === undefined || v === null ? "" : String(v);
    };
    const kind = fieldValue(body.kind) || "throwback";
    const eraId = fieldValue(body.eraId) || null;
    const year = fieldValue(body.year) ? Number(fieldValue(body.year)) : null;
    const caption = fieldValue(body.caption) || null;
    const { mediaDir } = await import("./media.js");
    const { writeFileSync, mkdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { randomUUID } = await import("node:crypto");

    const created: string[] = [];
    const mediaIds: string[] = [];
    for (const file of files) {
      const mediaId = randomUUID();
      const ext = (file.filename || "").split(".").pop()?.slice(0, 8) ?? "";
      const relPath = `${member.instanceId}/${mediaId}${ext}`;
      const dir = mediaDir();
      mkdirSync(join(dir, member.instanceId), { recursive: true });
      writeFileSync(join(dir, relPath), file.value);
      const mime = file.mimetype || "application/octet-stream";
      await pool.query(
        `INSERT INTO media (id, instance_id, uploader_id, kind, mime, size_bytes, storage_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [mediaId, member.instanceId, member.id, mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "file", mime, statSync(join(dir, relPath)).size, relPath],
      );
      mediaIds.push(mediaId);
      const item = await pool.query<{ id: string }>(
        `INSERT INTO memory_items (instance_id, kind, media_id, era_id, year, caption, uploaded_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'approved') RETURNING id`,
        [member.instanceId, kind, mediaId, eraId, year, caption, member.id],
      );
      created.push(item.rows[0]!.id);
    }
    return { created: created.length, ids: created, mediaIds };
  });

  /** Yearbook: register the book (media optional), then CSV name import. */
  app.post("/v1/manage/memory/yearbooks", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zYearbook.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO yearbooks (instance_id, year, title, media_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, body.year, body.title ?? null, body.mediaId ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /** CSV name import: one name per line; optional "Name,Section". */
  app.post("/v1/manage/memory/yearbooks/:id/names-csv", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zNamesCsv.parse(request.body ?? {});
    const book = await pool.query("SELECT 1 FROM yearbooks WHERE id = $1 AND instance_id = $2", [id, member.instanceId]);
    if (book.rows.length === 0) return reply.status(404).send({ error: "Yearbook not found." });
    const csv = body.csv ?? "";
    const names = zNamesCsv.parse({ csv }).csv.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    let count = 0;
    for (const line of names) {
      const [name, section] = line.split(",").map((s) => s.trim());
      if (name === undefined || name.length === 0) continue;
      await pool.query(
        "INSERT INTO yearbook_entries (instance_id, yearbook_id, full_name, section) VALUES ($1,$2,$3,$4)",
        [member.instanceId, id, name, section ?? null],
      );
      count += 1;
    }
    return { imported: count };
  });

  /** Hall of fame: single entry + CSV bulk (Name,Citation,Year). */
  app.post("/v1/manage/memory/hall-of-fame", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zHonouree.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO hall_of_fame (instance_id, member_id, display_name, citation, year, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.memberId ?? null, body.name, body.citation, body.year ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /* --------------------- approval queues + memorials -------------------- */

  app.get("/v1/manage/memory/queue", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; media_id: string; caption: string | null; uploader_name: string; created_at: Date }>(
      `SELECT i.id, i.media_id, i.caption, m.display_name AS uploader_name, i.created_at
       FROM memory_items i JOIN members m ON m.id = i.uploaded_by
       WHERE i.instance_id = $1 AND i.status = 'pending' ORDER BY i.created_at`,
      [member.instanceId],
    );
    return { pending: res.rows };
  });

  app.post("/v1/manage/memory/queue/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zQueueDecision.parse(request.body);
    const res = await pool.query(
      "UPDATE memory_items SET status = $1, decided_by = $2 WHERE id = $3 AND instance_id = $4 AND status = 'pending' RETURNING id",
      [body.decision === "approve" ? "approved" : "declined", member.id, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Pending item not found." });
    return { ok: true };
  });

  app.get("/v1/manage/memory/memorials", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; member_name: string; requested_by_name: string; tribute: string | null; status: string }>(
      `SELECT p.id, dm.display_name AS member_name, rm.display_name AS requested_by_name, p.tribute, p.status
       FROM memorial_pages p
       JOIN members dm ON dm.id = p.member_id
       JOIN members rm ON rm.id = p.requested_by
       WHERE p.instance_id = $1 AND p.status = 'requested' ORDER BY p.created_at`,
      [member.instanceId],
    );
    return { requests: res.rows };
  });

  /** Approval = entering memorial state (§P): no logins, no birthday pushes,
   *  content preserved read-only. Decline keeps the member untouched. */
  app.post("/v1/manage/memory/memorials/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zMemorialDecision.parse(request.body);
    const page = await pool.query<{ member_id: string }>(
      "SELECT member_id FROM memorial_pages WHERE id = $1 AND instance_id = $2 AND status = 'requested'",
      [id, member.instanceId],
    );
    if (!page.rows[0]) return reply.status(404).send({ error: "Requested memorial not found." });
    if (body.decision === "approve") {
      await pool.query(
        "UPDATE memorial_pages SET status = 'approved', decided_by = $1 WHERE id = $2",
        [member.id, id],
      );
      // Memorial state: sessions already exclude memorial members (no logins).
      await pool.query("UPDATE members SET memorial = true, memorial_at = now() WHERE id = $1", [page.rows[0].member_id]);
      await pool.query("UPDATE sessions SET revoked_at = now() WHERE member_id = $1 AND revoked_at IS NULL", [page.rows[0].member_id]);
      await pool.query(
        `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
         VALUES ($1,$2,'memory.memorial-approved',$3, now() + interval '30 days', '{}')`,
        [member.instanceId, member.id, page.rows[0].member_id],
      );
    } else {
      await pool.query(
        "UPDATE memorial_pages SET status = 'declined', decided_by = $1 WHERE id = $2",
        [member.id, id],
      );
    }
    return { ok: true };
  });

  /* ---------------------------- on this day ---------------------------- */

  /** Resurface approved memories from this month/day across all years. */
  app.get("/v1/memory/on-this-day", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; media_id: string | null; caption: string | null; year: number | null; kind: string }>(
      `SELECT * FROM (
         SELECT i.id, i.media_id, i.caption, i.year, 'memory' AS kind
         FROM memory_items i
         WHERE i.instance_id = $1 AND i.status = 'approved'
           AND EXTRACT(month FROM i.created_at) = EXTRACT(month FROM now())
           AND EXTRACT(day FROM i.created_at) = EXTRACT(day FROM now())
         UNION ALL
         SELECT p.id, NULL::uuid, p.body, EXTRACT(year FROM p.created_at)::int, 'post'
         FROM activity_posts p
         WHERE p.instance_id = $1 AND p.archived_at IS NULL AND p.kind IN ('post','photo')
           AND p.group_id IS NOT NULL
           AND EXTRACT(month FROM p.created_at) = EXTRACT(month FROM now())
           AND EXTRACT(day FROM p.created_at) = EXTRACT(day FROM now())
           AND EXTRACT(year FROM p.created_at) < EXTRACT(year FROM now())
       ) u LIMIT 20`,
      [member.instanceId],
    );
    return { memories: res.rows };
  });
}

const zEra = z.object({
  name: z.string().min(1).max(80),
  yearFrom: z.number().int().optional(),
  yearTo: z.number().int().optional(),
});
const zThrowback = z.object({
  mediaId: z.string().uuid(),
  eraId: z.string().uuid().optional(),
  year: z.number().int().optional(),
  caption: z.string().max(300).optional(),
});
const zYearbook = z.object({
  year: z.number().int().min(1900).max(2100),
  title: z.string().max(120).optional(),
  mediaId: z.string().uuid().optional(),
});
const zNamesCsv = z.object({ csv: z.string().max(200_000) });
const zHonouree = z.object({
  name: z.string().min(2).max(120),
  citation: z.string().min(4).max(1000),
  year: z.number().int().optional(),
  memberId: z.string().uuid().optional(),
});
const zMemorialRequest = z.object({
  memberId: z.string().uuid(),
  tribute: z.string().max(1000).optional(),
});
const zCondolence = z.object({
  message: z.string().min(2).max(1000),
  attending: z.boolean().optional(),
});
const zQueueDecision = z.object({ decision: z.enum(["approve", "decline"]) });
const zMemorialDecision = z.object({ decision: z.enum(["approve", "decline"]) });
