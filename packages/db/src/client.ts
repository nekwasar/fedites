/**
 * Postgres client + migration runner + session store (phases.md 0.2).
 * Migrations are plain SQL files applied in order and recorded in
 * schema_migrations. No ORM magic — the schema file is the source of truth.
 */
import { Pool, type PoolClient } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}

export async function migrate(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = new Set(
      (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
    );
    const dir = join(__dirname, "..", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const ran: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        ran.push(file);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${file} failed: ${String(e)}`);
      }
    }
    return ran;
  } finally {
    client.release();
  }
}

export async function waitForDb(pool: Pool, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("database never became ready");
}

export type Tx = PoolClient;

export async function withTx<T>(pool: Pool, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
