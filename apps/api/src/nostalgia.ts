/**
 * Nostalgia bundle (Phase 5 batch 3, session 5.3): remember-when threads with
 * weekly prompts, recipe exchange, nostalgia radio, time capsules (sealed
 * until the milestone date — server-enforced), letters to future self
 * (future-delivery gate), anthem player + school bell (admin-uploaded
 * instance media), crest stickers/frames, birthday reminders (memorial-aware,
 * private — K5/K1), and achievement awards (admin-awarded, §P).
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireMember, requireDutyRole } from "./sessions.js";
import { z } from "zod";

function isoWeek(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function nostalgiaRoutes(app: FastifyInstance, opts: { pool: Pool }): Promise<void> {
  const { pool } = opts;

  /* ------------------------- remember-when threads --------------------- */

  /** Weekly nostalgia prompt: the current week's thread (admin or auto-create
   *  on first post) plus past threads. */
  app.get("/v1/nostalgia/remember-when", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; prompt: string; week: string; post_count: string }>(
      `SELECT t.id, t.prompt, t.week,
              (SELECT count(*) FROM remember_when_posts p WHERE p.thread_id = t.id)::text AS post_count
       FROM remember_when_threads t
       WHERE t.instance_id = $1 ORDER BY t.week DESC LIMIT 26`,
      [member.instanceId],
    );
    return { threads: res.rows.map((t) => ({ id: t.id, prompt: t.prompt, week: t.week, posts: Number(t.post_count) })) };
  });

  app.post("/v1/nostalgia/remember-when", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zRwCreate.parse(request.body);
    const week = isoWeek(new Date());
    // Auto-create this week's thread on first post (K5: a gentle weekly prompt).
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM remember_when_threads WHERE instance_id = $1 AND week = $2",
      [member.instanceId, week],
    );
    let threadId = existing.rows[0]?.id;
    if (threadId === undefined) {
      const created = await pool.query<{ id: string }>(
        `INSERT INTO remember_when_threads (instance_id, prompt, week, created_by)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [member.instanceId, body.prompt ?? "Remember when…?", week, member.id],
      );
      threadId = created.rows[0]!.id;
    }
    const post = await pool.query<{ id: string }>(
      `INSERT INTO remember_when_posts (instance_id, thread_id, author_id, story)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [member.instanceId, threadId, member.id, body.story],
    );
    return { threadId, postId: post.rows[0]!.id };
  });

  app.get("/v1/nostalgia/remember-when/:threadId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { threadId } = request.params as { threadId: string };
    const thread = await pool.query<{ prompt: string; week: string }>(
      "SELECT prompt, week FROM remember_when_threads WHERE id = $1 AND instance_id = $2",
      [threadId, member.instanceId],
    );
    if (!thread.rows[0]) return reply.status(404).send({ error: "Thread not found." });
    const posts = await pool.query<{ id: string; story: string; author_name: string; created_at: Date }>(
      `SELECT p.id, p.story, m.display_name AS author_name, p.created_at
       FROM remember_when_posts p JOIN members m ON m.id = p.author_id
       WHERE p.thread_id = $1 ORDER BY p.created_at DESC LIMIT 100`,
      [threadId],
    );
    return {
      thread: { prompt: thread.rows[0].prompt, week: thread.rows[0].week },
      stories: posts.rows.map((p) => ({ id: p.id, story: p.story, author: p.author_name, at: p.created_at })),
    };
  });

  /* --------------------------- recipe exchange -------------------------- */

  app.get("/v1/nostalgia/recipes", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; ingredients: string; steps: string; story: string | null; media_id: string | null; submitted_by_name: string }>(
      `SELECT r.id, r.title, r.ingredients, r.steps, r.story, r.media_id, m.display_name AS submitted_by_name
       FROM recipes r JOIN members m ON m.id = r.submitted_by
       WHERE r.instance_id = $1 AND r.archived_at IS NULL ORDER BY r.created_at DESC LIMIT 100`,
      [member.instanceId],
    );
    return { recipes: res.rows };
  });

  app.post("/v1/nostalgia/recipes", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zRecipe.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO recipes (instance_id, title, ingredients, steps, story, media_id, submitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [member.instanceId, body.title, body.ingredients, body.steps, body.story ?? null, body.mediaId ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /* ---------------------------- nostalgia radio ------------------------ */

  app.get("/v1/nostalgia/radio", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; artist: string | null; year: number | null; media_id: string | null; external_url: string | null; added_by_name: string }>(
      `SELECT t.id, t.title, t.artist, t.year, t.media_id, t.external_url, m.display_name AS added_by_name
       FROM radio_tracks t JOIN members m ON m.id = t.added_by
       WHERE t.instance_id = $1 ORDER BY t.created_at DESC LIMIT 200`,
      [member.instanceId],
    );
    return { tracks: res.rows };
  });

  app.post("/v1/nostalgia/radio", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zTrack.parse(request.body);
    if (body.mediaId === undefined && body.externalUrl === undefined) {
      return reply.status(400).send({ error: "Attach a recording or a link." });
    }
    const res = await pool.query<{ id: string }>(
      `INSERT INTO radio_tracks (instance_id, title, artist, year, media_id, external_url, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [member.instanceId, body.title, body.artist ?? null, body.year ?? null, body.mediaId ?? null, body.externalUrl ?? null, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  /* ------------------------ anthem + school bell ----------------------- */

  /** Instance anthem/bell: admin uploads once; every member streams from here. */
  app.get("/v1/nostalgia/anthem", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ anthem: string | null; bell: string | null }>(
      `SELECT anthem_media_id::text AS anthem, bell_media_id::text AS bell
       FROM nostalgia_config WHERE instance_id = $1`,
      [member.instanceId],
    );
    const r = res.rows[0];
    return { anthemMediaId: r?.anthem ?? null, bellMediaId: r?.bell ?? null };
  });

  app.post("/v1/manage/nostalgia/anthem", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zAnthem.parse(request.body);
    await pool.query(
      `INSERT INTO nostalgia_config (instance_id, anthem_media_id) VALUES ($1,$2)
       ON CONFLICT (instance_id) DO UPDATE SET anthem_media_id = $2`,
      [member.instanceId, body.mediaId],
    );
    return { ok: true };
  });

  app.post("/v1/manage/nostalgia/bell", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zAnthem.parse(request.body);
    await pool.query(
      `INSERT INTO nostalgia_config (instance_id, bell_media_id) VALUES ($1,$2)
       ON CONFLICT (instance_id) DO UPDATE SET bell_media_id = $2`,
      [member.instanceId, body.mediaId],
    );
    return { ok: true };
  });

  /* ---------------------- stickers & profile frames -------------------- */

  app.get("/v1/nostalgia/stickers", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; name: string; media_id: string; kind: string; mine: boolean }>(
      `SELECT s.id, s.name, s.media_id, s.kind,
              EXISTS (SELECT 1 FROM member_stickers ms WHERE ms.sticker_id = s.id AND ms.member_id = $2) AS mine
       FROM sticker_inventory s WHERE s.instance_id = $1 ORDER BY s.created_at`,
      [member.instanceId, member.id],
    );
    return { stickers: res.rows.map((s) => ({ id: s.id, name: s.name, mediaId: s.media_id, kind: s.kind, mine: s.mine })) };
  });

  app.post("/v1/manage/nostalgia/stickers", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zSticker.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO sticker_inventory (instance_id, name, media_id, kind, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, body.name, body.mediaId, body.kind, member.id],
    );
    return { id: res.rows[0]!.id };
  });

  app.post("/v1/nostalgia/stickers/:id/take", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    await pool.query(
      `INSERT INTO member_stickers (instance_id, member_id, sticker_id) VALUES ($1,$2,$3)
       ON CONFLICT (member_id, sticker_id) DO NOTHING`,
      [member.instanceId, member.id, id],
    );
    return { ok: true };
  });

  /* --------------------------- time capsules --------------------------- */

  /** Sealed until open_at — the server refuses early opens (no client gate). */
  app.get("/v1/nostalgia/capsules", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; title: string; open_at: string; opened_at: Date | null; body: string | null; media_ids: string[] | null }>(
      `SELECT id, title, open_at::text, opened_at,
              CASE WHEN open_at <= now()::date THEN body ELSE NULL END AS body,
              CASE WHEN open_at <= now()::date THEN media_ids ELSE NULL END AS media_ids
       FROM time_capsules WHERE instance_id = $1 AND member_id = $2 ORDER BY open_at`,
      [member.instanceId, member.id],
    );
    return {
      capsules: res.rows.map((c) => ({
        id: c.id, title: c.title, openAt: c.open_at, opened: c.opened_at !== null,
        sealed: c.body === null, body: c.body, mediaIds: c.media_ids,
      })),
    };
  });

  app.post("/v1/nostalgia/capsules", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zCapsule.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO time_capsules (instance_id, member_id, title, body, media_ids, open_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [member.instanceId, member.id, body.title, body.body, JSON.stringify(body.mediaIds ?? []), body.openAt],
    );
    return { id: res.rows[0]!.id };
  });

  app.post("/v1/nostalgia/capsules/:id/open", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const c = await pool.query<{ open_at: string; opened_at: Date | null; member_id: string }>(
      "SELECT open_at::text, opened_at, member_id FROM time_capsules WHERE id = $1 AND member_id = $2 AND instance_id = $3",
      [id, member.id, member.instanceId],
    );
    const capsule = c.rows[0];
    if (!capsule) return reply.status(404).send({ error: "Capsule not found." });
    if (new Date(capsule.open_at).getTime() > Date.now()) {
      return reply.status(403).send({ error: "This capsule is still sealed. Open day has not arrived." });
    }
    await pool.query("UPDATE time_capsules SET opened_at = now() WHERE id = $1 AND opened_at IS NULL", [id]);
    return { ok: true, opened: true };
  });

  /* ------------------------ letters to future self --------------------- */

  /** Future-delivery gate: body only returns when deliver_on has passed. */
  app.get("/v1/nostalgia/letters", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; deliver_on: string; delivered_at: Date | null; body: string | null }>(
      `SELECT id, deliver_on::text, delivered_at,
              CASE WHEN deliver_on <= now()::date THEN body ELSE NULL END AS body
       FROM future_letters WHERE instance_id = $1 AND member_id = $2 ORDER BY deliver_on`,
      [member.instanceId, member.id],
    );
    return {
      letters: res.rows.map((l) => ({
        id: l.id, deliverOn: l.deliver_on, delivered: l.delivered_at !== null,
        sealed: l.body === null, body: l.body,
      })),
    };
  });

  app.post("/v1/nostalgia/letters", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zLetter.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO future_letters (instance_id, member_id, body, deliver_on)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [member.instanceId, member.id, body.body, body.deliverOn],
    );
    return { id: res.rows[0]!.id };
  });

  /* ------------------------- birthday reminders ------------------------ */

  /** Private birthday list: only the member's own view; memorial members
   *  never appear (§P: no birthday pushes for the departed). */
  app.get("/v1/nostalgia/birthdays", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ display_name: string; birthday: string; days: number; set_year: number | null }>(
      `SELECT m.display_name, m.birthday::text, (m.birthday + interval '1 year' * (
          EXTRACT(year FROM now()) - EXTRACT(year FROM m.birthday)
        ) + CASE WHEN (m.birthday + interval '1 year' * (
          EXTRACT(year FROM now()) - EXTRACT(year FROM m.birthday)))::date < now()::date
          THEN interval '1 year' ELSE interval '0' END)::date - now()::date AS days,
        s.year AS set_year
       FROM members m LEFT JOIN sets s ON s.id = m.set_id
       WHERE m.instance_id = $1 AND m.birthday IS NOT NULL AND m.memorial = false
         AND m.deleted_at IS NULL AND m.visibility->>'birthday' = 'set'
         AND (m.set_id IS NULL OR m.set_id = (SELECT set_id FROM members WHERE id = $2))
       ORDER BY days LIMIT 50`,
      [member.instanceId, member.id],
    );
    return { birthdays: res.rows.map((r) => ({ name: r.display_name, setYear: r.set_year, inDays: Number(r.days) })) };
  });

  /* ------------------------- achievement awards ------------------------ */

  app.get("/v1/recognition/awards", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; member_name: string; title: string; citation: string | null; awarded_at: Date }>(
      `SELECT a.id, m.display_name AS member_name, a.title, a.citation, a.awarded_at
       FROM achievement_awards a JOIN members m ON m.id = a.member_id
       WHERE a.instance_id = $1 ORDER BY a.awarded_at DESC LIMIT 100`,
      [member.instanceId],
    );
    return { awards: res.rows };
  });

  /** Admin awards (annual ceremony, §10) — audited, reversible window. */
  app.post("/v1/manage/recognition/awards", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    if (!requireDutyRole(member)) return reply.status(403).send({ error: "Admins only." });
    const body = zAward.parse(request.body);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO achievement_awards (instance_id, member_id, title, citation, awarded_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.instanceId, body.memberId, body.title, body.citation ?? null, member.id],
    );
    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'recognition.award-ceremony',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, body.memberId, JSON.stringify({ title: body.title })],
    );
    return { id: res.rows[0]!.id };
  });
}

const zRwCreate = z.object({
  prompt: z.string().max(200).optional(),
  story: z.string().min(4).max(3000),
});
const zRecipe = z.object({
  title: z.string().min(2).max(160),
  ingredients: z.string().min(4).max(3000),
  steps: z.string().min(4).max(5000),
  story: z.string().max(1000).optional(),
  mediaId: z.string().uuid().optional(),
});
const zTrack = z.object({
  title: z.string().min(1).max(160),
  artist: z.string().max(120).optional(),
  year: z.number().int().optional(),
  mediaId: z.string().uuid().optional(),
  externalUrl: z.string().url().max(400).optional(),
});
const zAnthem = z.object({ mediaId: z.string().uuid() });
const zSticker = z.object({
  name: z.string().min(1).max(80),
  mediaId: z.string().uuid(),
  kind: z.enum(["sticker", "frame"]),
});
const zCapsule = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(4).max(20_000),
  mediaIds: z.array(z.string().uuid()).max(20).optional(),
  openAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const zLetter = z.object({
  body: z.string().min(4).max(20_000),
  deliverOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const zAward = z.object({
  memberId: z.string().uuid(),
  title: z.string().min(2).max(160),
  citation: z.string().max(1000).optional(),
});
