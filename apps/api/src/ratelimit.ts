/**
 * Small in-memory rate limiter for auth endpoints. Single-node v1; the shared
 * Redis limiter arrives with the staging hardening pass (6.4).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function clientKey(request: { ip: string; headers: Record<string, string | string[] | undefined> }, extra: string): string {
  return `${request.ip}:${extra}`;
}
