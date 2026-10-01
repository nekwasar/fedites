/**
 * Knowledge & voices (Phase 5 batch 2, session 5.2): school wiki with full
 * revision history (revert = new revision — N1), slang dictionary (member
 * submissions, admin-approved), history timeline (admin-curated), alumni
 * spotlights (admin-published), long-form articles (member-written,
 * admin-screened). M5: all moderation enforced at the API.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";

export async function knowledgeRoutes(app: FastifyInstance, opts: { pool: Pool }): Promise<void> {
  const { pool } = opts;

  /* ------------------------------- wiki -------------------------------- */

  app.get("/v1/wiki/pages", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { q } = request.query as { q?: string };
    const term = `%${(q ?? "").toLowerCase()}%`;
    const res = await pool.query<{ id: string; slug: string; title: string; locked: boolean; updated_at: Date }>(
      `SELECT w.id, w.slug, w.title, w.locked, r.created_at AS updated_at
       FROM wiki_pages w
       JOIN wiki_revisions r ON r.page_id = w.id
       WHERE w.instance_id = $1 AND w.archived_at IS NULL
         AND ($2 = '%%' OR LOWER(w.title) LIKE $2)
         AND r.created_at = (SELECT max(r2.created_at) FROM wiki_revisions r2 WHERE r2.page_id = w.id)
       ORDER BY updated_at DESC LIMIT 100`,
      [member.instanceId, term],
    );
    return { pages: res.rows };
  });

  /** Current page = latest revision; full history preserved. */
  app.get("/v1/wiki/pages/:slug", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { slug } = request.params as { slug: string };
    const page = await pool.query<{ id: string; slug: string; title: string; locked: boolean; body: string; author_name: string; updated_at: Date }>(
      `SELECT w.id, w.slug, w.title, w.locked, r.body, m.display_name AS author_name, r.created_at AS updated_at
       FROM wiki_pages w
       JOIN wiki_revisions r ON r.page_id = w.id
       JOIN members m ON m.id = r.author_id
       WHERE w.instance_id = $1 AND w.slug = $2 AND w.archived_at IS NULL
         AND r.created_at = (SELECT max(r2.created_at) FROM wiki_revisions r2 WHERE r2.page_id = w.id)`,
      [member.instanceId, slug],
    );
    const p = page.rows[0];
    if (!p) return reply.status(404).send({ error: "Page not found." });
    const revisions = await pool.query<{ id: string; author_name: string; note: string | null; created_at: Date }>(
      `SELECT r.id, m.display_name AS author_name, r.note, r.created_at
       FROM wiki_revisions r JOIN members m ON m.id = r.author_id
       WHERE r.page_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [p.id],
    );
    return {
      page: { id: p.id, slug: p.slug, title: p.title, locked: p.locked, body: p.body, lastAuthor: p.author_name, updatedAt: p.updated_at },
      history: revisions.rows,
    };
  });

  /** Create or edit: every save is a new revision; locked pages are admin-only. */
  app.put("/v1/wiki/pages/:slug", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { slug } = request.params as { slug: string };
    const body = zWikiSave.parse(request.body);
    const isAdmin = requireDutyRole(member);
    const existing = await pool.query<{ id: string; title: string; locked: boolean }>(
      "SELECT id, title, locked FROM wiki_pages WHERE instance_id = $1 AND slug = $2 AND archived_at IS NULL",
      [member.instanceId, slug],
    );
    if (existing.rows[0]?.locked === true && !isAdmin) {
      return reply.status(403).send({ error: "This page is locked by the admins." });
    }
    let pageId: string;
    if (existing.rows[0] === undefined) {
      const created = await pool.query<{ id: string }>(
        "INSERT INTO wiki_pages (instance_id, slug, title, created_by) VALUES ($1,$2,$3,$4) RETURNING id",
        [member.instanceId, slug, body.title, member.id],
      );
      pageId = created.rows[0]!.id;
    } else {
      pageId = existing.rows[0].id;
      if (body.title !== undefined && body.title !== existing.rows[0].title) {
        await pool.query("UPDATE wiki_pages SET title = $1 WHERE id = $2", [body.title, pageId]);
      }
    }
    await pool.query(
      `INSERT INTO wiki_revisions (instance_id, page_id, author_id, body, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [member.instanceId, pageId, member.id, body.body, body.note ?? null],
    );
    return { ok: true, slug };
  });

  /** Revert = restore an old revision as a NEW revision (nothing lost, N1). */
  app.post("/v1/wiki/pages/:slug/revert/:revisionId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { slug, revisionId } = request.params as { slug: string; revisionId: string };
    const isAdmin = requireDutyRole(member);
    const page = await pool.query<{ id: string; locked: boolean; title: string }>(
      "SELECT id, locked, title FROM wiki_pages WHERE instance_id = $1 AND slug = $2 AND archived_at IS NULL",
      [member.instanceId, slug],
    );
    const p = page.rows[0];
    if (!p) return reply.status(404).send({ error: "Page not found." });
    if (p.locked && !isAdmin) return reply.status(403).send({ error: "This page is locked by the admins." });
    const rev = await pool.query<{ body: string }>(
      "SELECT body FROM wiki_revisions WHERE id = $1 AND page_id = $2",
      [revisionId, p.id],
    );
    if (!rev.rows[0]) return reply.status(404).send({ error: "Revision not found." });
    await pool.query(
      `INSERT INTO wiki_revisions (instance_id, page_id, author_id, body, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [member.instanceId, p.id, member.id, rev.rows[0].body, `Reverted to an earlier revision`],
    );
    return { ok: true };
  });

  app.post("/v1/manage/wiki/pages/:id/lock", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zLock.parse(request.body);
    await pool.query("UPDATE wiki_pages SET locked = $1 WHERE id = $2 AND instance_id = $3", [body.locked, id, member.instanceId]);
    return { ok: true };
  });

  /* --------------------------- slang dictionary ------------------------ */

  app.get("/v1/slang", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { q } = request.query as { q?: string };
    const term = `%${(q ?? "").toLowerCase()}%`;
    const res = await pool.query<{ id: string; term: string; meaning: string; example: string | null; submitted_by_name: string }>(
      `SELECT s.id, s.term, s.meaning, s.example, m.display_name AS submitted_by_name
       FROM slang_terms s JOIN members m ON m.id = s.submitted_by
       WHERE s.instance_id = $1 AND s.status = 'approved'
         AND ($2 = '%%' OR LOWER(s.term) LIKE $2 OR LOWER(s.meaning) LIKE $2)
       ORDER BY s.term LIMIT 200`,
      [member.instanceId, term],
    );
    return { terms: res.rows };
  });

  /** Member submits; admins approve into the dictionary. */
  app.post("/v1/slang", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zSlang.parse(request.body);
    const isAdmin = requireDutyRole(member);
    const res = await pool.query<{ id: string; status: string }>(
      `INSERT INTO slang_terms (instance_id, term, meaning, example, submitted_by, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
      [member.instanceId, body.term, body.meaning, body.example ?? null, member.id, isAdmin ? "approved" : "pending"],
    );
    const row = res.rows[0]!;
    return { id: row.id, status: row.status };
  });

  app.get("/v1/manage/slang", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; term: string; meaning: string; example: string | null; submitted_by_name: string }>(
      `SELECT s.id, s.term, s.meaning, s.example, m.display_name AS submitted_by_name
       FROM slang_terms s JOIN members m ON m.id = s.submitted_by
       WHERE s.instance_id = $1 AND s.status = 'pending' ORDER BY s.created_at`,
      [member.instanceId],
    );
    return { pending: res.rows };
  });

  app.post("/v1/manage/slang/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zSlangDecision.parse(request.body);
    const res = await pool.query(
      `UPDATE slang_terms SET status = $1, decided_by = $2
       WHERE id = $3 AND instance_id = $4 AND status = 'pending' RETURNING id`,
      [body.decision === "approve" ? "approved" : "declined", member.id, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Pending term not found." });
    return { ok: true };
  });

  /* --------------------------- history timeline ------------------------ */

  app.get("/v1/timeline", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; year: number; title: string; story: string | null; media_id: string | null }>(
      `SELECT id, year, title, story, media_id FROM timeline_events
       WHERE instance_id = $1 AND archived_at IS NULL ORDER BY year, created_at`,
      [member.instanceId],
    );
    return { events: res.rows };
  });

  app.post("/v1/manage/timeline", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zTimeline.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO timeline_events (instance_id, year, title, story, media_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, body.year, body.title, body.story ?? null, body.mediaId ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /* ---------------------------- spotlights ----------------------------- */

  app.get("/v1/spotlights", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; member_name: string; interview: string; published_at: Date }>(
      `SELECT s.id, m.display_name AS member_name, s.interview, s.published_at
       FROM spotlights s JOIN members m ON m.id = s.member_id
       WHERE s.instance_id = $1 AND s.status = 'published'
       ORDER BY s.published_at DESC LIMIT 20`,
      [member.instanceId],
    );
    return { spotlights: res.rows };
  });

  app.post("/v1/manage/spotlights", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zSpotlight.parse(request.body);
    const res = await pool.query<{ id: string; status: string }>(
      `INSERT INTO spotlights (instance_id, member_id, interview, status, published_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
      [member.instanceId, body.memberId, body.interview, body.publish === false ? "draft" : "published", body.publish === false ? null : new Date(), member.id],
    );
    const row = res.rows[0]!;
    return { id: row.id, status: row.status };
  });

  /* ------------------------- long-form articles ------------------------ */

  app.get("/v1/articles", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; body: string; author_name: string; published_at: Date }>(
      `SELECT a.id, a.title, a.body, m.display_name AS author_name, a.published_at
       FROM articles a JOIN members m ON m.id = a.author_id
       WHERE a.instance_id = $1 AND a.status = 'published'
       ORDER BY a.published_at DESC LIMIT 50`,
      [member.instanceId],
    );
    return { articles: res.rows };
  });

  /** Member writes; admin screens before publication (§P archive pattern). */
  app.post("/v1/articles", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zArticle.parse(request.body);
    const isAdmin = requireDutyRole(member);
    const res = await pool.query<{ id: string; status: string }>(
      `INSERT INTO articles (instance_id, author_id, title, body, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
      [member.instanceId, member.id, body.title, body.body, isAdmin ? "published" : "submitted", isAdmin ? new Date() : null],
    );
    const row = res.rows[0]!;
    return { id: row.id, status: row.status };
  });

  app.get("/v1/manage/articles", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const res = await pool.query<{ id: string; title: string; body: string; author_name: string }>(
      `SELECT a.id, a.title, a.body, m.display_name AS author_name
       FROM articles a JOIN members m ON m.id = a.author_id
       WHERE a.instance_id = $1 AND a.status = 'submitted' ORDER BY a.created_at`,
      [member.instanceId],
    );
    return { submitted: res.rows };
  });

  app.post("/v1/manage/articles/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const { id } = request.params as { id: string };
    const body = zArticleDecision.parse(request.body);
    const status = body.decision === "publish" ? "published" : "declined";
    const res = await pool.query(
      `UPDATE articles SET status = $1, decided_by = $2, published_at = $3
       WHERE id = $4 AND instance_id = $5 AND status = 'submitted' RETURNING id`,
      [status, member.id, status === "published" ? new Date() : null, id, member.instanceId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: "Submitted article not found." });
    return { ok: true, status };
  });
}

const zWikiSave = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(50_000),
  note: z.string().max(200).optional(),
});
const zLock = z.object({ locked: z.boolean() });
const zSlang = z.object({
  term: z.string().min(1).max(80),
  meaning: z.string().min(2).max(500),
  example: z.string().max(300).optional(),
});
const zSlangDecision = z.object({ decision: z.enum(["approve", "decline"]) });
const zTimeline = z.object({
  year: z.number().int().min(1800).max(2100),
  title: z.string().min(2).max(160),
  story: z.string().max(2000).optional(),
  mediaId: z.string().uuid().optional(),
});
const zSpotlight = z.object({
  memberId: z.string().uuid(),
  interview: z.string().min(10).max(20_000),
  publish: z.boolean().optional(),
});
const zArticle = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(10).max(100_000),
});
const zArticleDecision = z.object({ decision: z.enum(["publish", "decline"]) });
