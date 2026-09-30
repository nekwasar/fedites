import { createPool, migrate } from "./client.js";
import { seed } from "./seed.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "migrate";
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = createPool(url);
  try {
    if (command === "migrate") {
      const ran = await migrate(pool);
      console.log(ran.length > 0 ? `applied: ${ran.join(", ")}` : "up to date");
    } else if (command === "seed") {
      await migrate(pool);
      const result = await seed(pool);
      console.log(`seeded instance ${result.instanceId}`);
    } else {
      throw new Error(`unknown command: ${command}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
