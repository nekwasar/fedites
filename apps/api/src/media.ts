/**
 * Media library (rail 4): one organized store for feed photos, voice notes,
 * files. Phase 2 writes to local disk (MEDIA_DIR); the MinIO S3 client on the
 * VPS swaps in behind this module without touching callers.
 * Multipart is registered top-level with attachFieldsToBody:'values' so file
 * uploads arrive as buffers in request.body (no stream iterators to hang).
 */
import type { FastifyInstance } from "fastify";
import { writeFileSync, createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import type { Pool } from "pg";
import { requireMember } from "./sessions.js";

const KIND_BY_MIME: Array<[RegExp, "image" | "video" | "audio" | "file"]> = [
  [/^image\//, "image"],
  [/^video\//, "video"],
  [/^audio\//, "audio"],
];

interface FileField {
  value: Buffer;
  mimetype: string;
  filename: string;
}

export function mediaDir(): string {
  const dir = process.env.MEDIA_DIR ?? join(process.cwd(), "..", "..", "media");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function asFileField(raw: unknown): FileField | null {
  const one = Array.isArray(raw) ? raw[0] : raw;
  if (one === null || one === undefined || typeof one !== "object") return null;
  const f = one as { value?: Buffer; mimetype?: string; filename?: string };
  if (f.value !== undefined && typeof f.mimetype === "string") {
    return { value: f.value, mimetype: f.mimetype, filename: f.filename ?? "upload" };
  }
  return null;
}

export async function mediaRoutes(app: FastifyInstance, opts: { pool: Pool }): Promise<void> {
  const { pool } = opts;

  app.post("/v1/media", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = request.body as Record<string, unknown> | null;
    const file = asFileField(body?.file);
    if (!file) return reply.status(400).send({ error: "Attach a file." });

    const mime = file.mimetype;
    const kind = KIND_BY_MIME.find(([re]) => re.test(mime))?.[1] ?? "file";
    const id = randomUUID();
    const ext = extname(file.filename || "").slice(0, 10) || "";
    const relPath = `${member.instanceId}/${id}${ext}`;
    const absPath = join(mediaDir(), relPath);
    mkdirSync(join(mediaDir(), member.instanceId), { recursive: true });
    writeFileSync(absPath, file.value);
    const size = statSync(absPath).size;

    await pool.query(
      `INSERT INTO media (id, instance_id, uploader_id, kind, mime, size_bytes, storage_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, member.instanceId, member.id, kind, mime, size, relPath],
    );
    return { id, kind, mime, size };
  });

  app.get("/v1/media/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{ mime: string; storage_path: string }>(
      "SELECT mime, storage_path FROM media WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const m = res.rows[0];
    if (!m) return reply.status(404).send({ error: "Media not found." });
    const absPath = join(mediaDir(), m.storage_path);
    if (!existsSync(absPath)) return reply.status(404).send({ error: "Media file missing." });
    void reply.header("content-type", m.mime);
    return reply.send(createReadStream(absPath));
  });
}
