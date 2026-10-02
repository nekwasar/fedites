/**
 * Server-side rendering on Fastify (full MPA mode):
 *  - dev: Vite runs in middleware mode inside this process; page requests
 *    render via vite.ssrLoadModule (fresh modules per request, HMR wired).
 *  - prod: the built client bundle is served statically and the built SSR
 *    bundle (web/dist/server) renders pages with the asset manifest.
 * Every GET page request: session → boot → in-process route data
 * (app.inject, real routes with the member cookie) → complete HTML.
 * Navigation is real document navigation; the client bundle only
 * hydrates interactivity. No loaders, no client-side page fetching.
 */
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { buildSessionBoot, resolveDevice, type InstanceConfig, type SessionBoot } from "@fedites/config";
import { readSessionToken, loadSessionMember } from "./sessions.js";
import { assembleRouteData, type RouteData } from "./ssr-data.js";

interface RenderFn {
  renderPage(input: {
    urlPath: string;
    session: SessionBoot;
    member: unknown;
    device: "mobile" | "desktop";
    routeData: RouteData;
    unread: number;
    clientEntry: string;
    cssAssets: string[];
    devStylesHref?: string;
  }): string;
}

const ASSET_ROUTES = ["/@vite/*", "/@fs/*", "/@id/*", "/@react-refresh", "/@react-refresh/*", "/node_modules/*", "/src/*", "/public/*", "/assets/*", "/favicon.svg", "/manifest.webmanifest"];

export async function registerSsr(
  app: FastifyInstance,
  opts: {
    pool: Pool;
    loadConfigByInstance: (instanceId: string) => Promise<InstanceConfig>;
    defaultInstanceId: string | undefined;
    mode: "dev" | "prod";
  },
): Promise<void> {
  const webRoot = fileURLToPath(new URL("../../web", import.meta.url));
  let viteServer: import("vite").ViteDevServer | null = null;
  let render: RenderFn | null = null;
  let clientEntry = "/src/main.tsx";
  let cssAssets: string[] = [];
  let devStylesHref: string | undefined;

  if (opts.mode === "dev") {
    const vite = await import("vite");
    viteServer = await vite.createServer({
      root: webRoot,
      server: { middlewareMode: true, hmr: { port: 24678, host: "127.0.0.1" } },
      appType: "custom",
    });
    // Dev FOUC fix: the stylesheet is served by Vite as a JS module, so the
    // SSR HTML links it directly (fs-served) until hydration injects it.
    devStylesHref = `/@fs${join(webRoot, "..", "..", "packages", "ui", "src", "styles.css")}`;
  } else {
    const distClient = join(webRoot, "dist", "client");
    await app.register(fastifyStatic, { root: distClient });
    const manifest = JSON.parse(readFileSync(join(distClient, ".vite", "manifest.json"), "utf8")) as Record<string, { file: string; css?: string[] }>;
    const entry = manifest["src/main.tsx"];
    if (!entry) throw new Error("SSR manifest is missing the src/main.tsx entry");
    clientEntry = `/assets/${entry.file}`;
    cssAssets = (entry.css ?? []).map((c) => `/assets/${c}`);
    const ssrModule = await import(pathToFileURL(join(webRoot, "dist", "server", "ssr.js")).href) as RenderFn;
    render = ssrModule;
  }

  const renderPageTo = async (request: FastifyRequest, reply: FastifyReply, pathname: string): Promise<FastifyReply> => {
    const cookie = request.headers.cookie ?? "";
    const sessionMember = await loadSessionMember(opts.pool, readSessionToken(request) ?? "");
    const instanceId = sessionMember?.instanceId ?? opts.defaultInstanceId
      ?? (await opts.pool.query<{ id: string }>("SELECT id FROM instances ORDER BY created_at LIMIT 1")).rows[0]?.id;
    if (!instanceId) return reply.status(500).send("no instance configured");
    const config = await opts.loadConfigByInstance(instanceId);
    const device = resolveDevice(null, /Mobile|Android|iPhone/i.test(request.headers["user-agent"] ?? ""));
    const bootMember: SessionBoot["member"] = sessionMember === null ? null : {
      id: sessionMember.id,
      displayName: sessionMember.displayName,
      roles: sessionMember.roles,
      verified: sessionMember.verification === "verified" || sessionMember.verification === "honorary",
    };
    const session = buildSessionBoot(config, { instanceId, device, member: bootMember });
    const routeData = await assembleRouteData(app, pathname, cookie);
    let unread = 0;
    if (sessionMember !== null) {
      const inbox = await pickJson(app, "/v1/notifications", cookie);
      unread = typeof (inbox as { unread?: number })?.unread === "number" ? (inbox as { unread: number }).unread : 0;
    }
    let page = (viteServer !== null
      ? (await viteServer.ssrLoadModule("/src/ssr.tsx") as RenderFn)
      : render)!.renderPage({
      urlPath: pathname,
      session,
      member: sessionMember,
      device,
      routeData,
      unread,
      clientEntry,
      cssAssets,
      devStylesHref,
    });
    // Dev: inject @vite/client + react-refresh preamble (HMR-capable hydration).
    if (viteServer !== null) page = await viteServer.transformIndexHtml(pathname, page);
    return reply.type("text/html; charset=utf-8").send(page);
  };

  // Explicit page routes (full MPA — no SPA wildcard, real document loads).
  const pagePaths: string[] = [
    "/", "/feed", "/news", "/chat", "/chats/:seg/:id", "/groups", "/groups/:id",
    "/events", "/events/:id", "/money/campaigns/:id", "/money/campaigns", "/money/ledger",
    "/memory", "/knowledge", "/nostalgia", "/bridge", "/careers", "/notifications",
    "/me", "/id", "/members/:id", "/manage", "/auth",
  ];
  for (const p of pagePaths) {
    app.get(p, async (request, reply) => renderPageTo(request, reply, request.url.split("?")[0] ?? "/"));
  }

  // Dev asset passthrough (Vite module graph, HMR client, public files).
  if (viteServer !== null) {
    const hijack = (request: FastifyRequest, reply: FastifyReply): void => {
      reply.hijack();
      viteServer!.middlewares(request.raw, reply.raw);
    };
    for (const route of ASSET_ROUTES) {
      app.get(route, async (request, reply) => hijack(request, reply));
    }
  }
}

async function pickJson(app: FastifyInstance, url: string, cookie: string): Promise<unknown> {
  const res = await app.inject({ method: "GET", url, headers: cookie !== "" ? { cookie } : {} });
  if (res.statusCode !== 200) return undefined;
  return res.json();
}
