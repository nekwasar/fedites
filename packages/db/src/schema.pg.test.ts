/**
 * PG-backed test (runs only when TEST_DATABASE_URL is set — see test:pg).
 * Verifies session 0.2 demo gate: migrations apply and the seed populates
 * a fake school with all rails.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPool, migrate } from "./client.js";
import { seed } from "./seed.js";
import type { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("rails schema", () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!url) return;
    pool = createPool(url);
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("migrates and seeds the fake school", async () => {
    const ran = await migrate(pool);
    expect(ran.length).toBeGreaterThanOrEqual(1);
    const result = await seed(pool);

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
    );
    const names = new Set(tables.rows.map((r) => r.table_name));
    for (const t of ["instances","config_documents","members","sets","roles","member_roles","groups","group_members","activity_posts","messages","events","ledger_entries","notifications","audit_log","vouches","invite_codes"]) {
      expect(names.has(t), t).toBe(true);
    }

    // every rail table carries instance_id (white-label law)
    const railTables = [...names].filter((t) => !["instances","schema_migrations"].includes(t));
    for (const t of railTables) {
      const cols = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1`,
        [t],
      );
      expect(cols.rows.map((r) => r.column_name), t).toContain("instance_id");
    }

    // 6 group types seeded
    const types = await pool.query<{ type: string }>(
      "SELECT DISTINCT type FROM groups WHERE instance_id=$1", [result.instanceId],
    );
    expect(new Set(types.rows.map((r) => r.type)).size).toBe(6);

    // 3 sets seeded
    const sets = await pool.query("SELECT count(*)::int AS n FROM sets WHERE instance_id=$1", [result.instanceId]);
    expect(sets.rows[0]?.n).toBe(3);
  });
});
