/**
 * Face embedding provider (3.3) — pluggable behind one interface.
 *
 * STUB (default): embeddings are deterministic vectors derived from the
 * image bytes (sha256-seeded). Honest limitation: the stub only matches
 * identical or near-identical image bytes — it does NOT detect faces. It
 * exists so the full product surface (consent, index, self-only search,
 * deletion) ships and demos now; a real provider (insightface / cloud API)
 * implements the same interface and drops in via FACE_PROVIDER env without
 * touching callers.
 */
import { createHash } from "node:crypto";

export interface FaceEmbeddingProvider {
  readonly name: string;
  /** Embed an image into a provider-specific vector. */
  embed(image: Buffer): Promise<number[]>;
}

/** Cosine similarity — the comparison contract every provider shares. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

class StubProvider implements FaceEmbeddingProvider {
  readonly name = "stub";

  async embed(image: Buffer): Promise<number[]> {
    // 64 dims from rolling sha256 of the bytes — stable per content.
    const dims: number[] = [];
    let round = 0;
    while (dims.length < 64) {
      const h = createHash("sha256").update(image).update(`:${round}`).digest();
      for (const byte of h) {
        dims.push((byte - 127.5) / 127.5);
        if (dims.length === 64) break;
      }
      round += 1;
    }
    return dims;
  }
}

class RemoteProvider implements FaceEmbeddingProvider {
  readonly name = "remote";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- real provider reads the bytes once FACE_PROVIDER_URL exists
  async embed(_image: Buffer): Promise<number[]> {
    // A real deployment points FACE_PROVIDER_URL at an embedding service
    // (e.g. an insightface sidecar) and posts the bytes. Intentionally not
    // implemented in this build — the stub ships first (M3 flag).
    throw new Error("Remote face provider not configured in this build");
  }
}

export function getFaceProvider(): FaceEmbeddingProvider {
  switch (process.env.FACE_PROVIDER) {
    case "remote": return new RemoteProvider();
    default: return new StubProvider();
  }
}
