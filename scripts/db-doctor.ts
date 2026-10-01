/**
 * Database doctor - `npm run db:doctor`
 *
 * Tells you exactly which driver is active, whether the schema is applied,
 * what the connection can actually do, and what is missing for production.
 */
import { getSql, migrate, dbDialect, ensureSchema } from "../lib/db/client";
import { TABLES } from "../lib/db/schema";
import { env } from "../lib/env";
import { providerStatus } from "../lib/ai";

const ok = (m: string) => console.log(`  [ok]   ${m}`);
const warn = (m: string) => console.log(`  [warn] ${m}`);
const bad = (m: string) => console.log(`  [!!]   ${m}`);
const info = (m: string) => console.log(`         ${m}`);

function mask(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    const user = url.username ? `${url.username}@` : "";
    return `${user}…${url.host}${url.pathname}`;
  } catch {
    return "set (unparseable)";
  }
}

async function main() {
  console.log("\nFillMate database doctor\n" + "=".repeat(60));

  /* -- configuration ------------------------------------------ */
  console.log("\nConfiguration");
  const dialect = dbDialect();
  if (env.databaseUrl) {
    ok(`PostgreSQL driver selected`);
    info(`DATABASE_URL = ${mask(env.databaseUrl)}`);
  } else {
    warn("SQLite driver selected (DATABASE_URL is empty)");
    info("Fine for local dev, demos and CI.");
    info("NOT suitable for serverless or multi-instance production.");
  }
  info(`storage   = ${env.supabaseEnabled ? "Supabase Storage" : "local filesystem"}`);
  const ai = providerStatus();
  info(`ai        = ${ai.id} (${ai.live ? "live" : "local checks only"})`);

  /* -- connectivity -------------------------------------------- */
  console.log("\nConnectivity");
  const sql = await getSql();

  const tables =
    dialect === "sqlite"
      ? await sql.query<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
      : await sql.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
        );

  const present = new Set(
    tables.map((t) => ("name" in t ? t.name : t.table_name)),
  );
  const missing = TABLES.filter((t) => !present.has(t.name)).map((t) => t.name);

  if (missing.length === 0) {
    ok(`schema complete - ${TABLES.length} tables present`);
  } else {
    warn(`schema incomplete - ${missing.length} table(s) missing`);
    info(`missing: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`);
    info("fix with:  npm run db:setup");
  }

  /* -- read/write ---------------------------------------------- */
  console.log("\nRead / write");
  try {
    const probe = await sql.query<{ n: number }>(
      dialect === "sqlite"
        ? `SELECT COUNT(*) AS n FROM "users"`
        : `SELECT COUNT(*) AS n FROM "users"`,
    );
    ok(`SELECT works (users = ${probe[0]?.n ?? 0} rows)`);
  } catch (err) {
    bad(`SELECT failed: ${(err as Error).message}`);
    info("fix with:  npm run db:setup");
  }

  try {
    const probe = await sql.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM "water_activities"`,
    );
    ok(`activity table reachable (${probe[0]?.n ?? 0} rows)`);
  } catch (err) {
    bad(`activity table unreachable: ${(err as Error).message}`);
  }

  /* -- write probe (transactional rollback) -------------------- */
  try {
    await sql.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO "realtime_events" ("id", "type", "payload", "created_at") VALUES (?,?,?,?)`,
        ["doctor-probe", "doctor", "{}", new Date().toISOString()],
      );
      throw new Error("rollback");
    }).catch((e) => {
      if (!/rollback/.test(String(e?.message))) throw e;
    });
    ok("transactional write works (probe rolled back)");
  } catch (err) {
    bad(`write probe failed: ${(err as Error).message}`);
  }

  /* -- timezone sanity ------------------------------------------ */
  try {
    await sql.query(
      dialect === "sqlite" ? `SELECT 1` : `SELECT now() AT TIME ZONE 'UTC'`,
    );
    ok("server clock reachable");
  } catch {
    warn("could not read the server clock");
  }

  /* -- production checklist ------------------------------------ */
  console.log("\n" + "=".repeat(60));
  if (!env.databaseUrl) {
    console.log("\nTo use a real database, set one of:\n");
    console.log("  Supabase      postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres");
    console.log("  Neon          postgresql://<user>:<pw>@ep-xxx.aws.neon.tech/neondb?sslmode=require");
    console.log("  Vercel Postgres  postgresql://<vercel-generated>");
    console.log("  Railway / Render / any Postgres\n");
    console.log("Then:  npm run db:setup   (applies all migrations)\n");
  }

  if (!env.sessionSecret || env.sessionSecret.includes("change-me")) {
    bad("SESSION_SECRET is not set to a strong value");
  } else {
    ok("SESSION_SECRET configured");
  }

  if (!ai.live) {
    warn("No AI vision provider connected");
    info("Refills will be saved as 'needs review' instead of auto-verified.");
    info("Set AI_PROVIDER + AI_API_KEY to enable verification.");
  } else {
    ok(`AI provider live (${ai.id})`);
  }

  if (env.isProduction && env.demoMode) {
    warn("NEXT_PUBLIC_DEMO_MODE should be false in production");
  }

  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nDatabase doctor failed:", err);
  process.exit(1);
});