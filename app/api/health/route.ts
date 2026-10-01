import { ok, route } from "@/lib/http/response";
import { dbDialect, getSql } from "@/lib/db/client";
import { providerStatus } from "@/lib/ai";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const sql = await getSql();
  const dialect = dbDialect();

  const tables =
    dialect === "sqlite"
      ? await sql.query<Record<string, string>>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
      : await sql
          .query<Record<string, string>>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
          )
          .catch(() => [] as Array<Record<string, string>>);

  return ok({
    status: "ok",
    database: dialect,
    tables: tables.length,
    ai: providerStatus(),
    storage: env.supabaseEnabled ? "supabase" : "local",
    realtime: "sse",
    time: new Date().toISOString(),
  });
});