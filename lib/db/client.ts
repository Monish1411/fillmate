import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Dialect } from "./schema";
import { renderSchema } from "./schema";

/**
 * Dual-driver SQL access layer.
 *
 *  â€¢ Postgres (`pg`)  â€” used whenever DATABASE_URL is set.
 *  â€¢ SQLite           â€” Node's built-in `node:sqlite`, used otherwise so the
 *                       app is fully runnable with zero configuration.
 *
 * Both drivers speak the same SQL: `?` placeholders, double-quoted
 * identifiers, ISO-8601 UTC text timestamps.
 */

export type SqlParam = string | number | boolean | null | undefined | Uint8Array;

export interface SqlDriver {
  readonly dialect: Dialect;
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  execute(sql: string, params?: SqlParam[]): Promise<number>;
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
  close(): void;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/* â”€â”€ Postgres driver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

class PostgresDriver implements SqlDriver {
  readonly dialect: Dialect = "postgres";

  constructor(
    private readonly pool: {
      query: (
        sql: string,
        params?: unknown[],
      ) => Promise<{ rows: unknown[]; rowCount: number | null }>;
      end: () => Promise<void>;
    },
  ) {}

  /** Rewrite `?` placeholders to `$n` without touching quoted strings. */
  private toPgSql(sql: string): string {
    let out = "";
    let inString = false;
    let quote = "";
    let n = 0;
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (inString) {
        out += ch;
        if (ch === quote) {
          if (sql[i + 1] === quote) {
            out += quote;
            i++;
          } else inString = false;
        }
        continue;
      }
      if (ch === "'" || ch === '"') {
        inString = true;
        quote = ch;
        out += ch;
        continue;
      }
      if (ch === "?") {
        out += `$${++n}`;
        continue;
      }
      out += ch;
    }
    return out;
  }

  private normalize(params: SqlParam[]) {
    return params.map((p) => {
      if (p === undefined) return null;
      if (p instanceof Date) return p.toISOString();
      return p;
    });
  }

  private static revive<T>(rows: unknown[]): T[] {
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        out[k] = v instanceof Date ? v.toISOString() : v;
      }
      return out as T;
    });
  }

  async query<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []) {
    const res = await this.pool.query(this.toPgSql(sql), this.normalize(params));
    return PostgresDriver.revive<T>(res.rows);
  }

  async execute(sql: string, params: SqlParam[] = []) {
    const res = await this.pool.query(this.toPgSql(sql), this.normalize(params));
    return res.rowCount ?? 0;
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    const client = (await (
      this.pool as unknown as { connect: () => Promise<unknown> }
    ).connect()) as {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
      release: () => void;
    };
    const scoped = new PostgresDriver(client as never);
    await client.query("BEGIN");
    try {
      const result = await fn(scoped);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release?.();
    }
  }

  async close() {
    await this.pool.end();
  }
}
/* â”€â”€ SQLite driver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface SqliteDatabase {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint };
  };
  exec(sql: string): void;
  close(): void;
}

class SqliteDriver implements SqlDriver {
  readonly dialect: Dialect = "sqlite";

  constructor(private readonly db: SqliteDatabase) {}

  private static coerce(p: SqlParam): string | number | bigint | null | Uint8Array {
    if (p === undefined || p === null) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    if (typeof p === "object") return JSON.stringify(p);
    return p;
  }

  async query<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []) {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params.map(SqliteDriver.coerce));
    // node:sqlite returns null-prototype objects â€” copy into plain objects.
    return rows.map((r) => ({ ...(r as Record<string, unknown>) })) as T[];
  }

  async execute(sql: string, params: SqlParam[] = []) {
    const stmt = this.db.prepare(sql);
    const res = stmt.run(...params.map(SqliteDriver.coerce));
    return Number(res.changes ?? 0);
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  close() {
    this.db.close();
  }
}

/* â”€â”€ Singleton & migrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const GLOBAL_KEY = Symbol.for("fillmate.sql.driver");
type GlobalWithDriver = typeof globalThis & { [GLOBAL_KEY]?: SqlDriver };

let driverPromise: Promise<SqlDriver> | null = null;

export function getSql(): Promise<SqlDriver> {
  const g = globalThis as GlobalWithDriver;
  if (g[GLOBAL_KEY]) return Promise.resolve(g[GLOBAL_KEY]);
  if (!driverPromise) driverPromise = createDriver();
  return driverPromise;
}

async function createDriver(): Promise<SqlDriver> {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (connectionString) {
    const pg = await import("pg");
    const Pool = (pg.default ?? pg).Pool;
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err: Error) => {
      console.error("[fillmate:db] idle client error", err?.message ?? err);
    });
    const driver = new PostgresDriver(pool as never);
    (globalThis as GlobalWithDriver)[GLOBAL_KEY] = driver;
    return driver;
  }

  const { DatabaseSync } = await import("node:sqlite");
  const dir = path.join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const file = process.env.SQLITE_PATH
    ? path.resolve(process.cwd(), process.env.SQLITE_PATH)
    : path.join(dir, "fillmate.db");
  const db = new DatabaseSync(file) as unknown as SqliteDatabase;
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  const driver = new SqliteDriver(db);
  (globalThis as GlobalWithDriver)[GLOBAL_KEY] = driver;
  return driver;
}

/* Constraints that live outside the column DSL. */
const EXTRA_DDL: Record<Dialect, string[]> = {
  sqlite: [
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_room_members_room_user" ON "room_members" ("room_id", "user_id");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_rotation_room_day" ON "rotation_schedules" ("room_id", "scheduled_for");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_achievements_user_key" ON "achievements" ("user_id", "key");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_email_lower" ON "users" ("email");',
  ],
  postgres: [
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_room_members_room_user" ON "room_members" ("room_id", "user_id");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_rotation_room_day" ON "rotation_schedules" ("room_id", "scheduled_for");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ux_achievements_user_key" ON "achievements" ("user_id", "key");',
    'CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON users (lower(email));',
  ],
};

let migrated = false;

/** Idempotent â€” safe to call on every cold start. */
export async function migrate(): Promise<{ dialect: Dialect; applied: number }> {
  const sql = await getSql();
  const statements = [...renderSchema(sql.dialect), ...EXTRA_DDL[sql.dialect]];
  for (const statement of statements) {
    try {
      await sql.execute(statement);
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (/already exists/i.test(msg)) continue;
      throw new DatabaseError(`Migration failed: ${msg}`, err);
    }
  }
  migrated = true;
  return { dialect: sql.dialect, applied: statements.length };
}

export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  await migrate();
}

export function dbDialect(): Dialect {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "sqlite";
}

/** True only for the zero-config local SQLite environment. */
export function isDemoEnvironment(): boolean {
return process.env.NEXT_PUBLIC_DEMO_MODE !== "false" && dbDialect() === "sqlite";
}
