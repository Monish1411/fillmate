/**
 * Database bootstrap.
 *
 *   npm run db:setup            apply migrations + create the super admin
 *   npm run db:reset -- --reset drop everything and start clean
 *   npm run demo:reset          reset + seed realistic demo data
 */
import { migrate, getSql, dbDialect } from "../lib/db/client";
import { TABLES } from "../lib/db/schema";
import { ensureSuperAdmin } from "../lib/services/auth-service";

async function main() {
  const reset = process.argv.includes("--reset");
  const shouldSeed = process.argv.includes("--seed");

  if (reset) {
    const sql = await getSql();
    console.log(`[fillmate] dropping ${TABLES.length} tables from ${dbDialect()}...`);
    for (const table of [...TABLES].reverse()) {
      await sql.execute(`DROP TABLE IF EXISTS "${table.name}"`).catch(() => undefined);
    }
  }

  const result = await migrate();
  console.log(`[fillmate] schema ready (${result.dialect}, ${result.applied} statements)`);

  const created = await ensureSuperAdmin(
    process.env.SUPER_ADMIN_EMAIL ?? "",
    process.env.SUPER_ADMIN_PASSWORD ?? "",
  );
  if (created) {
    console.log("[fillmate] super admin created from SUPER_ADMIN_* env vars");
  }

  if (shouldSeed) {
    const { runSeed } = await import("./seed");
    await runSeed();
  }

  console.log("[fillmate] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[fillmate] setup failed:", err);
  process.exit(1);
});