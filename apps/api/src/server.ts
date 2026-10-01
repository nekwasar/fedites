/**
 * Fedites API — Phase 2: the daily loop. Config service + auth rails (P0/P1)
 * now joined by the group engine, Activity, realtime chat, News, Feed, and
 * moderation v1. Enforcement stays at the API (M5); realtime only notifies.
 */
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import { Pool } from "pg";
import {
  buildSessionBoot,
  instanceConfigSchema,
  type SessionBoot,
  type Device,
  type InstanceConfig,
} from "@fedites/config";
import { policyRoutes } from "./policy-routes.js";
import { authRoutes } from "./auth.js";
import { verificationRoutes } from "./verification.js";
import { profileRoutes } from "./profile.js";
import { manageRoutes } from "./manage.js";
import { groupsRoutes } from "./groups.js";
import { activityRoutes } from "./activity.js";
import { newsRoutes } from "./news.js";
import { chatRoutes } from "./chat.js";
import { feedRoutes } from "./feed.js";
import { moderationRoutes } from "./moderation.js";
import { mediaRoutes } from "./media.js";
import { eventsRoutes } from "./events.js";
import { recognitionRoutes } from "./recognition-routes.js";
import { moneyRoutes } from "./money.js";
import { givingRoutes } from "./giving.js";
import { structuredRoutes } from "./structured.js";
import { memoryRoutes } from "./memory.js";
import { knowledgeRoutes } from "./knowledge.js";
import { photoRoutes } from "./photos.js";
import { Hub } from "./ws.js";

export interface ApiDeps {
  pool: Pool;
  defaultInstanceId: string | undefined;
}

export async function buildApp(deps: ApiDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  app.decorate("pg", deps.pool);

  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS ?? "*").split(","),
    credentials: true,
  });
  // Top-level so every route context (media, memory bulk) accepts multipart.
  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: { fileSize: 25 * 1024 * 1024 },
    // Consume the file stream once here; routes read part.value (buffer).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin part type lacks the buffer slot
    onFile: async (part: any) => { part.value = await part.toBuffer(); },
  });

  async function loadConfigByInstance(instanceId: string): Promise<InstanceConfig> {
    const res = await deps.pool.query<{ document: unknown }>(
      `SELECT c.document FROM config_documents c
       WHERE c.instance_id = $1 AND c.status = 'published'
       ORDER BY c.version DESC LIMIT 1`,
      [instanceId],
    );
    const row = res.rows[0];
    if (!row) throw new Error(`no published config for instance ${instanceId}`);
    return instanceConfigSchema.parse(row.document);
  }

  app.get("/v1/health", async () => ({ ok: true }));

  app.get<{ Querystring: { instance?: string; device?: string; member?: string } }>(
    "/v1/config",
    async (request, reply): Promise<SessionBoot> => {
      let instanceId = request.query.instance ?? deps.defaultInstanceId;
      if (!instanceId && request.query.instance === undefined) {
        const fallback = await deps.pool.query<{ id: string }>("SELECT id FROM instances ORDER BY created_at LIMIT 1");
        instanceId = fallback.rows[0]?.id;
      }
      if (!instanceId) {
        return reply.status(500).send({ error: "no instance configured" });
      }
      const device: Device =
        request.query.device === "mobile" || request.query.device === "desktop"
          ? request.query.device
          : /Mobile|Android|iPhone/i.test(request.headers["user-agent"] ?? "")
            ? "mobile"
            : "desktop";

      const config = await loadConfigByInstance(instanceId);

      let member: SessionBoot["member"] = null;
      if (request.query.member && config.instance.flags.some((f) => f.key === "demo.previewSession" && f.enabled)) {
        const res = await deps.pool.query<{
          id: string; display_name: string; verification: string; roles: string[];
        }>(
          `SELECT m.id, m.display_name, m.verification,
                  COALESCE(json_agg(r.key) FILTER (WHERE r.key IS NOT NULL), '[]'::json) AS roles
           FROM members m
           LEFT JOIN member_roles mr ON mr.member_id = m.id
           LEFT JOIN roles r ON r.id = mr.role_id
           WHERE m.id = $1 AND m.instance_id = $2 AND m.memorial = false AND m.deleted_at IS NULL
           GROUP BY m.id, m.display_name, m.verification`,
          [request.query.member, instanceId],
        );
        const row = res.rows[0];
        if (row) {
          member = {
            id: row.id,
            displayName: row.display_name,
            roles: row.roles,
            verified: row.verification === "verified" || row.verification === "honorary",
          };
        }
      }

      return buildSessionBoot(config, { instanceId, device, member });
    },
  );

  const publicAppUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:5173";
  const hub = new Hub();
  const pool = deps.pool;

  await app.register(authRoutes, { pool, loadConfigByInstance });
  await app.register(verificationRoutes, { pool });
  await app.register(profileRoutes, { pool, loadConfigByInstance, publicAppUrl });
  await app.register(manageRoutes, { pool });
  await app.register(groupsRoutes, { pool, loadConfigByInstance });
  await app.register(activityRoutes, { pool, loadConfigByInstance, hub });
  await app.register(newsRoutes, { pool, loadConfigByInstance });
  await app.register(chatRoutes, { pool, loadConfigByInstance, hub });
  await app.register(feedRoutes, { pool });
  await app.register(moderationRoutes, { pool });
  await app.register(mediaRoutes, { pool });
  await app.register(eventsRoutes, { pool, loadConfigByInstance, hub });
  await app.register(recognitionRoutes, { pool });
  await app.register(moneyRoutes, { pool, loadConfigByInstance, hub });
  await app.register(givingRoutes, { pool, loadConfigByInstance, hub });
  await app.register(structuredRoutes, { pool, loadConfigByInstance, hub });
  await app.register(memoryRoutes, { pool, loadConfigByInstance });
  await app.register(knowledgeRoutes, { pool });
  await app.register(photoRoutes, { pool, loadConfigByInstance, hub });
  await app.register(policyRoutes, { loadConfig: loadConfigByInstance });

  // Realtime hub attaches when the underlying server starts (start() below
  // or the host app calling listen). Expose for tests.
  app.decorate("hub", hub);
  app.decorate("attachHub", () => hub.attach(app.server, pool));

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    hub: Hub;
    attachHub: () => unknown;
  }
}

export async function start(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  const app = await buildApp({ pool, defaultInstanceId: process.env.DEFAULT_INSTANCE_ID });
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: "0.0.0.0" });
  app.attachHub();
}

const invoked = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (invoked) {
  start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
