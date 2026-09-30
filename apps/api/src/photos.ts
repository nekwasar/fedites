/**
 * Event photo wall + AI photo finder (3.3).
 *
 * §P: face search is SELF-ONLY — the query is always the caller's own
 * reference embedding, so results can only surface photos matched to the
 * caller. K3: the feature is opt-in per member; the whole face index for a
 * member is deletable anytime, taking their data with it. M5: all gates are
 * enforced here, the UI merely hides.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import { getFaceProvider, cosineSimilarity } from "./face.js";
import { record } from "./recognition.js";
import { requireMember } from "./sessions.js";
import type { InstanceConfig } from "@fedites/config";

const MATCH_THRESHOLD = 0.92;

async function isAttendee(pool: Pool, eventId: string, memberId: string): Promise<boolean> {
  const rsvp = await pool.query<{ response: string }>(
    "SELECT response FROM event_rsvps WHERE event_id = $1 AND member_id = $2",
    [eventId, memberId],
  );
  if (rsvp.rows[0] !== undefined && rsvp.rows[0].response !== "no") return true;
  const checked = await pool.query("SELECT 1 FROM event_checkins WHERE event_id = $1 AND member_id = $2", [eventId, memberId]);
  return checked.rows.length > 0;
}

export async function photoRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (id: string) => Promise<InstanceConfig>; hub: { broadcast: (rooms: string[], e: Record<string, unknown>) => void } },
): Promise<void> {
  const { pool } = opts;

  /* ----------------------------- photo wall ---------------------------- */

  /** Attendees upload (mvp §5: "attendees upload pictures"). */
  app.post("/v1/events/:id/photos", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const body = zPhotoUpload.parse(request.body);
    if (!(await isAttendee(pool, id, member.id))) {
      return reply.status(403).send({ error: "Only attendees (going, maybe, or checked in) add to the wall." });
    }
    const media = await pool.query<{ id: string; kind: string }>(
      "SELECT id, kind FROM media WHERE id = $1 AND instance_id = $2",
      [body.mediaId, member.instanceId],
    );
    if (media.rows[0]?.kind !== "image") return reply.status(400).send({ error: "Only images go on the wall." });
    const res = await pool.query<{ id: string }>(
      `INSERT INTO event_photos (instance_id, event_id, media_id, uploader_id)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [member.instanceId, id, body.mediaId, member.id],
    );
    await record(pool, member.instanceId, member.id, "photo.upload", { type: "event_photo", id: res.rows[0]!.id }).catch(() => undefined);

    // Index the photo for the face engine when the finder is enabled (M3).
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (config.instance.flags.some((f) => f.key === "events.faceFinder" && f.enabled)) {
      try {
        const provider = getFaceProvider();
        const { mediaDir } = await import("./media.js");
        const { createReadStream } = await import("node:fs");
        const pathRow = await pool.query<{ storage_path: string }>("SELECT storage_path FROM media WHERE id = $1", [body.mediaId]);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve) => {
          const stream = createReadStream(`${mediaDir()}/${pathRow.rows[0]!.storage_path}`);
          stream.on("data", (c) => chunks.push(c as Buffer));
          stream.on("end", () => resolve());
          stream.on("error", () => resolve());
        });
        const embedding = await provider.embed(Buffer.concat(chunks));
        await pool.query(
          `INSERT INTO face_index (instance_id, member_id, kind, media_id, embedding, provider)
           VALUES ($1,$2,'photo',$3,$4,$5) ON CONFLICT (member_id, media_id, kind) DO NOTHING`,
          [member.instanceId, member.id, body.mediaId, JSON.stringify(embedding), provider.name],
        );
      } catch {
        // Indexing is best-effort; the wall never fails because of it.
      }
    }

    const ev = await pool.query<{ group_id: string | null }>("SELECT group_id FROM events WHERE id = $1", [id]);
    if (ev.rows[0]?.group_id !== null) {
      opts.hub.broadcast([`group:${ev.rows[0]!.group_id}`], { type: "photo.new", eventId: id });
    }
    return { id: res.rows[0]!.id };
  });

  app.get("/v1/events/:id/photos", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{ id: string; media_id: string; uploader_name: string; uploader_id: string; created_at: Date; tags: string | null }>(
      `SELECT p.id, p.media_id, m.display_name AS uploader_name, p.uploader_id, p.created_at,
              (SELECT json_agg(json_build_object('memberId', t.tagged_member_id, 'name', tm.display_name))
               FROM photo_tags t JOIN members tm ON tm.id = t.tagged_member_id
               WHERE t.photo_id = p.id) AS tags
       FROM event_photos p JOIN members m ON m.id = p.uploader_id
       WHERE p.event_id = $1 AND p.instance_id = $2 AND p.archived_at IS NULL
       ORDER BY p.created_at DESC LIMIT 200`,
      [id, member.instanceId],
    );
    return {
      photos: res.rows.map((p) => ({
        id: p.id, mediaId: p.media_id, uploader: p.uploader_name, uploaderId: p.uploader_id,
        createdAt: p.created_at,
        tags: (p.tags as Array<{ memberId: string; name: string }> | null) ?? [],
        taggedByMe: ((p.tags as Array<{ memberId: string }> | null) ?? []).some((t) => t.memberId === member.id),
        isMine: p.uploader_id === member.id,
      })),
    };
  });

  /** Tag each other in realtime (mvp §5). Tagged member gets an inbox notice. */
  app.post("/v1/events/:id/photos/:photoId/tags", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id, photoId } = request.params as { id: string; photoId: string };
    const body = zTagCreate.parse(request.body);
    const photo = await pool.query<{ id: string }>(
      "SELECT id FROM event_photos WHERE id = $1 AND event_id = $2 AND instance_id = $3 AND archived_at IS NULL",
      [photoId, id, member.instanceId],
    );
    if (!photo.rows[0]) return reply.status(404).send({ error: "Photo not found." });
    const tagged = await pool.query<{ display_name: string }>(
      "SELECT display_name FROM members WHERE id = $1 AND instance_id = $2",
      [body.memberId, member.instanceId],
    );
    if (!tagged.rows[0]) return reply.status(404).send({ error: "Member not found." });
    const ins = await pool.query(
      `INSERT INTO photo_tags (instance_id, photo_id, tagged_member_id, tagger_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (photo_id, tagged_member_id) DO NOTHING RETURNING id`,
      [member.instanceId, photoId, body.memberId, member.id],
    );
    if (ins.rows.length === 0) return reply.status(400).send({ error: "Already tagged." });
    await pool.query(
      `INSERT INTO notifications (instance_id, member_id, kind, payload)
       VALUES ($1,$2,'system.notice',$3)`,
      [member.instanceId, body.memberId, JSON.stringify({ title: `${member.displayName} tagged you in a photo` })],
    );
    return { ok: true };
  });

  /* --------------------- AI photo finder (self-only) -------------------- */

  app.get("/v1/me/face/status", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ face_opt_in: boolean; reference: string | null }>(
      `SELECT m.face_opt_in,
              (SELECT media_id::text FROM face_index f WHERE f.member_id = m.id AND f.kind = 'reference' LIMIT 1) AS reference
       FROM members m WHERE m.id = $1`,
      [member.id],
    );
    const r = res.rows[0];
    return { optIn: r?.face_opt_in ?? false, enrolled: r?.reference !== null };
  });

  /** K3: explicit opt-in. Turning it OFF deletes the whole face index. */
  app.post("/v1/me/face/opt-in", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zOptIn.parse(request.body);
    await pool.query("UPDATE members SET face_opt_in = $1 WHERE id = $2", [body.enabled, member.id]);
    if (!body.enabled) {
      // Taking their data with them (K3).
      await pool.query("DELETE FROM face_index WHERE member_id = $1", [member.id]);
    }
    return { ok: true, optIn: body.enabled };
  });

  /** Enroll the reference selfie — the only key that can ever run a search. */
  app.post("/v1/me/face/reference", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = zReference.parse(request.body);
    const me = await pool.query<{ face_opt_in: boolean }>("SELECT face_opt_in FROM members WHERE id = $1", [member.id]);
    if (me.rows[0]?.face_opt_in !== true) {
      return reply.status(403).send({ error: "Turn on face search in your privacy settings first." });
    }
    const media = await pool.query<{ kind: string }>("SELECT kind FROM media WHERE id = $1 AND instance_id = $2", [body.mediaId, member.instanceId]);
    if (media.rows[0]?.kind !== "image") return reply.status(400).send({ error: "The reference must be a photo of you." });

    const provider = getFaceProvider();
    const { mediaDir } = await import("./media.js");
    const { createReadStream } = await import("node:fs");
    const pathRow = await pool.query<{ storage_path: string }>("SELECT storage_path FROM media WHERE id = $1", [body.mediaId]);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      const stream = createReadStream(`${mediaDir()}/${pathRow.rows[0]!.storage_path}`);
      stream.on("data", (c) => chunks.push(c as Buffer));
      stream.on("end", () => resolve());
      stream.on("error", () => resolve());
    });
    const embedding = await provider.embed(Buffer.concat(chunks));
    // Exactly one reference per member: replace, never accumulate.
    await pool.query("DELETE FROM face_index WHERE member_id = $1 AND kind = 'reference'", [member.id]);
    await pool.query(
      `INSERT INTO face_index (instance_id, member_id, kind, media_id, embedding, provider)
       VALUES ($1,$2,'reference',$3,$4,$5)`,
      [member.instanceId, member.id, body.mediaId, JSON.stringify(embedding), provider.name],
    );
    return { ok: true, provider: provider.name };
  });

  /** K3 deletion: remove the reference and every trace of the face index. */
  app.delete("/v1/me/face/reference", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    await pool.query("DELETE FROM face_index WHERE member_id = $1", [member.id]);
    return { ok: true };
  });

  /**
   * Find my photos in this event. Self-only by construction: the search runs
   * the CALLER's reference embedding against photo embeddings. §P.
   */
  app.get("/v1/events/:id/find-me", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const config = await opts.loadConfigByInstance(member.instanceId);
    if (!config.instance.flags.some((f) => f.key === "events.faceFinder" && f.enabled)) {
      return reply.status(403).send({ error: "The photo finder is switched off for this community." });
    }
    const me = await pool.query<{ face_opt_in: boolean }>("SELECT face_opt_in FROM members WHERE id = $1", [member.id]);
    if (me.rows[0]?.face_opt_in !== true) {
      return reply.status(403).send({ error: "Opt in to face search in your privacy settings to use the finder." });
    }
    const ref = await pool.query<{ embedding: number[]; provider: string }>(
      "SELECT embedding, provider FROM face_index WHERE member_id = $1 AND kind = 'reference' ORDER BY created_at DESC LIMIT 1",
      [member.id],
    );
    const reference = ref.rows[0];
    if (!reference) return reply.status(403).send({ error: "Enroll a reference selfie first." });
    const provider = getFaceProvider();
    if (provider.name !== reference.provider) {
      return reply.status(409).send({ error: "The face provider changed since you enrolled. Re-enroll your reference." });
    }

    const photos = await pool.query<{ media_id: string; embedding: number[]; photo_id: string }>(
      `SELECT f.media_id, f.embedding, p.id AS photo_id
       FROM face_index f JOIN event_photos p ON p.media_id = f.media_id
       WHERE f.instance_id = $1 AND f.kind = 'photo'
         AND EXISTS (SELECT 1 FROM event_photos ep2 WHERE ep2.media_id = f.media_id AND ep2.event_id = $2)`,
      [member.instanceId, id],
    );
    const refVec = reference.embedding as number[];
    const matches: Array<{ photoId: string; mediaId: string; score: number }> = [];
    for (const p of photos.rows) {
      const score = cosineSimilarity(refVec, p.embedding as number[]);
      if (score >= MATCH_THRESHOLD) matches.push({ photoId: p.photo_id, mediaId: p.media_id, score: Number(score.toFixed(4)) });
    }
    matches.sort((a, b) => b.score - a.score);
    return { matches };
  });
}

const zPhotoUpload = z.object({ mediaId: z.string().uuid() });
const zTagCreate = z.object({ memberId: z.string().uuid() });
const zOptIn = z.object({ enabled: z.boolean() });
const zReference = z.object({ mediaId: z.string().uuid() });
