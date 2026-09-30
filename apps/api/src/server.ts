/**
 * Fedites API (phases.md 0.1/0.2): config service + session boot.
 * "API returns config at session boot" (configuration.md §8) — this endpoint
 * serves the typed, versioned config document with the resolved view.
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

export interface ApiDeps {
  pool: Pool;
  defaultInstanceId: string | undefined;
}

interface InstanceRow {
  id: string;
  document: unknown;
}

export async function buildApp(deps: ApiDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS ?? "*").split(","),
  });

  async function loadPublishedConfig(instanceId: string): Promise<InstanceConfig> {
    const res = await deps.pool.query<InstanceRow>(
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

  /**
   * Session boot. Device resolution happens here (server-side UA sniff) so
   * mobile/desktop nav geometry comes pre-resolved; the client can override
   * for Studio preview frames via ?device=.
   */
  app.get<{ Querystring: { instance?: string; device?: string; member?: string } }>(
    "/v1/config",
    async (request, reply): Promise<SessionBoot> => {
      const instanceId = request.query.instance ?? deps.defaultInstanceId;
      if (!instanceId) {
        return reply.status(500).send({ error: "no instance configured" });
      }
      const device: Device =
        request.query.device === "mobile" || request.query.device === "desktop"
          ? request.query.device
          : /Mobile|Android|iPhone/i.test(request.headers["user-agent"] ?? "")
            ? "mobile"
            : "desktop";

      const config = await loadPublishedConfig(instanceId);

      // Demo preview session (flag-gated, M3): real auth arrives in Phase 1.
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

  await app.register(policyRoutes, { loadConfig: loadPublishedConfig });

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
