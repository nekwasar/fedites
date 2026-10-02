/**
 * SSR data bridge (server-side rendering on Fastify — §architecture).
 * The server renders every page with boot + route data fetched BEFORE
 * render and inlines it into the HTML shell. The client consumes the
 * inline payload once at hydration; client-side navigations run the same
 * loaders through the real API and put results into this cache BEFORE
 * the route swaps — so a loader UI never appears anywhere.
 */
export interface ShellPayload {
  boot: unknown;
  data: Record<string, unknown>;
  generatedAt: number;
}

declare global {
  interface Window { __SSR_DATA__?: ShellPayload }
}

interface CacheEntry { t: number; data: unknown }

const shell: ShellPayload | null =
  typeof window !== "undefined" && window.__SSR_DATA__ ? window.__SSR_DATA__ : null;

const cache = new Map<string, CacheEntry>(
  shell !== null ? Object.entries(shell.data).map(([k, v]) => [k, { t: shell.generatedAt, data: v }]) : [],
);

/** Freshness window for pre-hydration data (e.g. browser-back returns to a
 *  cached screen; beyond this the screen silently refetches — no loader UI). */
const MAX_AGE_MS = 60_000;

/** Consume an SSR/pre-fetched payload for a screen's first render. */
export function takeSsrData<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry === undefined) return null;
  cache.delete(key);
  if (Date.now() - entry.t > MAX_AGE_MS) return null;
  return entry.data as T;
}

/** Store freshly loaded data so the next screen mount renders instantly. */
export function putSsrData(key: string, data: unknown): void {
  cache.set(key, { t: Date.now(), data });
}

/** Boot payload inlined by the server (present on every SSR page). */
export function bootFromShell(): unknown {
  return shell !== null ? shell.boot : null;
}

export function hasSsrShell(): boolean {
  return shell !== null;
}
