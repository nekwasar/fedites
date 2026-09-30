/**
 * Fedites API — Phase 1: auth rails + config service.
 * Session boot still serves the config document (configuration.md §8);
 * everything identity now flows through server-enforced permissions (M5).
 */
import Fastify, { type FastifyInstance } from "fastify";
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

  const loadConfigForName = async (shortName: string): Promise<InstanceConfig> => {
    const res = await deps.pool.query<{ id: string }>(
      "SELECT id FROM instances WHERE short_name = $1 LIMIT 1",
      [shortName],
    );
    const id = res.rows[0]?.id;
    if (!id) throw new Error(`instance ${shortName} not found`);
    return loadConfigByInstance(id);
  };
  void loadConfigForName;

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

      // Demo preview session (flag-gated, M3): Studio previews only.
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
  await app.register(authRoutes, { pool: deps.pool, loadConfigByInstance });
  await app.register(verificationRoutes, { pool: deps.pool });
  await app.register(profileRoutes, { pool: deps.pool, loadConfigByInstance, publicAppUrl });
  await app.register(manageRoutes, { pool: deps.pool });
  await app.register(policyRoutes, { loadConfig: loadConfigByInstance });

  return app;
}

export async function start(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  const app = await buildApp({ pool, defaultInstanceId: process.env.DEFAULT_INSTANCE_ID });
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: "0.0.0.0" });
}

const invoked = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (invoked) {
  start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
