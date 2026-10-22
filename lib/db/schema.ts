/**
 * Portable schema definition.
 *
 * One source of truth → two dialects:
 *   • `sqlite`   — built-in zero-config driver for local dev & demo
 *   • `postgres` — production (Supabase / Neon / Vercel Postgres)
 *
 * Portability rules that keep both dialects in sync:
 *   • ids are TEXT UUIDs generated in the application layer
 *   • timestamps are ISO-8601 UTC strings (lexicographically sortable)
 *   • booleans are 0/1 integers in SQLite, native booleans in Postgres
 *   • JSON payloads are TEXT in SQLite, JSONB in Postgres
 */

export type Dialect = "sqlite" | "postgres";

export type ColumnKind = "id" | "text" | "int" | "real" | "bool" | "ts" | "json" | "ref";

export interface ColumnDef {
  name: string;
  kind: ColumnKind;
  /** For `kind: "ref"` — the table this column points at. */
  ref?: string;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  /** Multi-column unique constraint (column name is ignored). */
  uniqueWith?: string[];
  index?: boolean;
  /** Postgres-only length hint. */
  length?: number;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  indexes?: string[][];
}

const t = (
  name: string,
  kind: ColumnKind,
  extra: Partial<ColumnDef> = {},
): ColumnDef => ({ name, kind, ...extra });

export const TABLES: TableDef[] = [
  {
    name: "organizations",
    columns: [
      t("id", "id"),
      t("name", "text"),
      t("slug", "text", { unique: true, index: true }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "hostels",
    columns: [
      t("id", "id"),
      t("organization_id", "ref", { ref: "organizations", index: true }),
      t("name", "text"),
      t("code", "text", { unique: true, index: true }),
      t("city", "text", { nullable: true }),
      t("timezone", "text", { default: "'Asia/Kolkata'" }),
      t("bottle_target", "int", { default: 4 }),
      t("refill_deadline_hour", "int", { default: 21 }),
      t("settings", "json", { default: "'{}'" }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "users",
    columns: [
      t("id", "id"),
      t("email", "text", { unique: true, index: true }),
      t("password_hash", "text", { nullable: true }),
      t("full_name", "text"),
      t("display_name", "text", { nullable: true }),
      t("phone", "text", { nullable: true }),
      t("avatar_url", "text", { nullable: true }),
      t("role", "text", { default: "'student'" }),
      t("hostel_id", "ref", { ref: "hostels", nullable: true, index: true }),
      t("email_verified", "bool", { default: 0 }),
      t("onboarding_step", "int", { default: 0 }),
      t("onboarded", "bool", { default: 0 }),
      t("theme", "text", { default: "'system'" }),
      t("timezone", "text", { default: "'Asia/Kolkata'" }),
      t("notify_refills", "bool", { default: 1 }),
      t("notify_rotation", "bool", { default: 1 }),
      t("notify_reviews", "bool", { default: 1 }),
      t("notify_weekly", "bool", { default: 0 }),
      t("privacy_show_contributions", "bool", { default: 1 }),
      t("privacy_show_activity", "bool", { default: 1 }),
      t("privacy_show_name", "bool", { default: 1 }),
      t("created_at", "ts", { default: "now" }),
      t("updated_at", "ts", { default: "now" }),
      t("last_seen_at", "ts", { nullable: true }),
    ],
  },
  {
    name: "rooms",
    columns: [
      t("id", "id"),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("number", "text"),
      t("floor", "text", { nullable: true }),
      t("bottle_target", "int", { default: 4 }),
      t("refill_deadline_hour", "int", { default: 21 }),
      t("invite_code", "text", { unique: true, index: true }),
      t("active", "bool", { default: 1 }),
      t("created_at", "ts", { default: "now" }),
    ],
    indexes: [["hostel_id", "number"]],
  },
  {
    name: "room_members",
    columns: [
      t("id", "id"),
      t("room_id", "ref", { ref: "rooms", index: true }),
      t("user_id", "ref", { ref: "users", index: true }),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("role_in_room", "text", { default: "'member'" }),
      t("joined_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "coolers",
    columns: [
      t("id", "id"),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("room_id", "ref", { ref: "rooms", nullable: true, index: true }),
      t("label", "text"),
      t("qr_code", "text", { nullable: true, unique: true }),
      t("latitude", "real", { nullable: true }),
      t("longitude", "real", { nullable: true }),
      t("allowed_radius_m", "real", { default: 60 }),
      t("location_enforced", "bool", { default: 0 }),
      t("active", "bool", { default: 1 }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "water_activities",
    columns: [
      t("id", "id"),
      t("user_id", "ref", { ref: "users", index: true }),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("room_id", "ref", { ref: "rooms", index: true }),
      t("cooler_id", "ref", { ref: "coolers", nullable: true }),
      t("bottle_count", "int"),
      t("status", "text", { default: "'needs_review'" }),
      t("ai_confidence", "real", { nullable: true }),
      t("cooler_detected", "bool", { nullable: true }),
      t("bottles_detected", "int", { nullable: true }),
      t("filling_context_detected", "bool", { nullable: true }),
      t("duplicate_suspected", "bool", { default: 0 }),
      t("duplicate_of", "ref", { ref: "water_activities", nullable: true }),
      t("image_hash", "text", { nullable: true, index: true }),
      t("perceptual_hash", "text", { nullable: true, index: true }),
      t("latitude", "real", { nullable: true }),
      t("longitude", "real", { nullable: true }),
      t("location_accuracy", "real", { nullable: true }),
      t("distance_from_cooler_m", "real", { nullable: true }),
      t("location_status", "text", { default: "'unavailable'" }),
      t("qr_scanned", "bool", { default: 0 }),
      t("client_timestamp", "ts", { nullable: true }),
      t("server_timestamp", "ts", { default: "now", index: true }),
      t("timezone", "text", { default: "'Asia/Kolkata'" }),
      t("note", "text", { nullable: true }),
      t("review_status", "text", { default: "'not_required'" }),
      t("reviewed_by", "ref", { ref: "users", nullable: true }),
      t("reviewed_at", "ts", { nullable: true }),
      t("review_note", "text", { nullable: true }),
      t("flagged_reasons", "text", { nullable: true }),
      t("deleted_at", "ts", { nullable: true }),
      t("created_at", "ts", { default: "now" }),
      t("updated_at", "ts", { default: "now" }),
    ],
    indexes: [
      ["room_id", "server_timestamp"],
      ["hostel_id", "server_timestamp"],
    ],
  },
  {
    name: "activity_images",
    columns: [
      t("id", "id"),
      t("activity_id", "ref", { ref: "water_activities", index: true }),
      t("storage_key", "text"),
      t("storage_provider", "text", { default: "'local'" }),
      t("mime_type", "text"),
      t("byte_size", "int"),
      t("width", "int", { nullable: true }),
      t("height", "int", { nullable: true }),
      t("sha256", "text", { index: true }),
      t("phash", "text", { nullable: true, index: true }),
      t("retention_until", "ts", { nullable: true }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "ai_verifications",
    columns: [
      t("id", "id"),
      t("activity_id", "ref", { ref: "water_activities", nullable: true, index: true }),
      t("provider", "text"),
      t("model", "text"),
      t("status", "text"),
      t("confidence", "real", { nullable: true }),
      t("cooler_detected", "bool", { nullable: true }),
      t("bottles_detected", "int", { nullable: true }),
      t("filling_context_detected", "bool", { nullable: true }),
      t("duplicate_suspected", "bool", { default: 0 }),
      t("reason", "text", { nullable: true }),
      t("raw_response", "text", { nullable: true }),
      t("latency_ms", "int", { nullable: true }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "notifications",
    columns: [
      t("id", "id"),
      t("user_id", "ref", { ref: "users", index: true }),
      t("hostel_id", "ref", { ref: "hostels", nullable: true }),
      t("room_id", "ref", { ref: "rooms", nullable: true }),
      t("type", "text"),
      t("title", "text"),
      t("body", "text", { nullable: true }),
      t("activity_id", "ref", { ref: "water_activities", nullable: true }),
      t("read_at", "ts", { nullable: true }),
      t("created_at", "ts", { default: "now", index: true }),
    ],
  },
  {
    name: "rotation_schedules",
    columns: [
      t("id", "id"),
      t("room_id", "ref", { ref: "rooms", index: true }),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("user_id", "ref", { ref: "users", index: true }),
      t("scheduled_for", "text", { index: true }),
      t("status", "text", { default: "'upcoming'" }),
      t("swapped_to_user_id", "ref", { ref: "users", nullable: true }),
      t("skip_reason", "text", { nullable: true }),
      t("completed_activity_id", "ref", { ref: "water_activities", nullable: true }),
      t("created_at", "ts", { default: "now" }),
      t("updated_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "reports",
    columns: [
      t("id", "id"),
      t("reporter_user_id", "ref", { ref: "users", index: true }),
      t("activity_id", "ref", { ref: "water_activities", index: true }),
      t("room_id", "ref", { ref: "rooms", index: true }),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("reason", "text"),
      t("details", "text", { nullable: true }),
      t("status", "text", { default: "'open'" }),
      t("resolution", "text", { nullable: true }),
      t("resolved_by", "ref", { ref: "users", nullable: true }),
      t("resolved_at", "ts", { nullable: true }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "admin_actions",
    columns: [
      t("id", "id"),
      t("actor_user_id", "ref", { ref: "users", index: true }),
      t("actor_name", "text", { nullable: true }),
      t("hostel_id", "ref", { ref: "hostels", nullable: true }),
      t("action", "text", { index: true }),
      t("target_type", "text", { nullable: true }),
      t("target_id", "text", { nullable: true }),
      t("metadata", "text", { nullable: true }),
      t("ip", "text", { nullable: true }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "sessions",
    columns: [
      t("id", "id"),
      t("user_id", "ref", { ref: "users", index: true }),
      t("token_hash", "text", { unique: true, index: true }),
      t("user_agent", "text", { nullable: true }),
      t("ip", "text", { nullable: true }),
      t("expires_at", "ts", { index: true }),
      t("created_at", "ts", { default: "now" }),
      t("last_used_at", "ts", { nullable: true }),
    ],
  },
  {
    name: "invites",
    columns: [
      t("id", "id"),
      t("code", "text", { unique: true, index: true }),
      t("room_id", "ref", { ref: "rooms", index: true }),
      t("hostel_id", "ref", { ref: "hostels", index: true }),
      t("created_by", "ref", { ref: "users", nullable: true }),
      t("max_uses", "int", { default: 12 }),
      t("uses", "int", { default: 0 }),
      t("expires_at", "ts", { nullable: true }),
      t("revoked", "bool", { default: 0 }),
      t("created_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "achievements",
    columns: [
      t("id", "id"),
      t("user_id", "ref", { ref: "users", index: true }),
      t("hostel_id", "ref", { ref: "hostels", nullable: true }),
      t("key", "text"),
      t("title", "text"),
      t("description", "text", { nullable: true }),
      t("earned_at", "ts", { default: "now" }),
    ],
  },
  {
    name: "realtime_events",
    columns: [
      t("id", "id"),
      t("hostel_id", "ref", { ref: "hostels", nullable: true, index: true }),
      t("room_id", "ref", { ref: "rooms", nullable: true, index: true }),
      t("type", "text"),
      t("payload", "text"),
      t("created_at", "ts", { default: "now", index: true }),
    ],
  },
  {
    name: "system_settings",
    columns: [
      t("key", "text", { unique: true }),
      t("value", "json", { default: "'{}'" }),
      t("updated_by", "ref", { ref: "users", nullable: true }),
      t("updated_at", "ts", { default: "now" }),
    ],
  },
];
/* ── DDL rendering ───────────────────────────────────────────── */

function renderDefault(
  d: string | number | boolean,
  dialect: Dialect,
  kind?: ColumnKind,
): string {
  if (d === "now") {
    // SQLite stores ISO text via strftime; Postgres has native now()
    return dialect === "postgres" ? "CURRENT_TIMESTAMP" : "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
  }

  // Boolean columns are BOOLEAN in Postgres, which rejects integer literals
  // like `DEFAULT 0` / `DEFAULT 1`. Render the native literals instead.
  if (kind === "bool") {
    const truthy = typeof d === "boolean" ? d : Number(d) !== 0;
    if (dialect === "postgres") return truthy ? "TRUE" : "FALSE";
    return truthy ? "1" : "0";
  }

  if (typeof d === "number") return String(d);
  return String(d);
}

function columnSql(col: ColumnDef, dialect: Dialect): string {
  const pg = dialect === "postgres";
  const parts: string[] = [`"${col.name}"`];

  // Ids are TEXT in both dialects: the app generates UUID strings, which
  // keeps the SQLite and PostgreSQL drivers byte-for-byte compatible.
  if (col.kind === "id") return `${parts[0]} TEXT PRIMARY KEY`;

  switch (col.kind) {
    case "text":
      parts.push(pg && col.length ? `VARCHAR(${col.length})` : "TEXT");
      break;
    case "int":
      parts.push("INTEGER");
      break;
    case "real":
      parts.push(pg ? "DOUBLE PRECISION" : "REAL");
      break;
    case "bool":
      parts.push(pg ? "BOOLEAN" : "INTEGER");
      break;
    case "ts":
      parts.push(pg ? "TIMESTAMPTZ" : "TEXT");
      break;
    case "json":
      parts.push(pg ? "JSONB" : "TEXT");
      break;
    case "ref":
      // TEXT in both dialects so foreign keys match the parent id column.
      parts.push("TEXT");
      break;
  }

  if (col.default !== undefined) {
    parts.push(`DEFAULT ${renderDefault(col.default, dialect, col.kind)}`);
  }
  if (!col.nullable && col.default === undefined) parts.push("NOT NULL");
  if (col.kind === "ref" && col.ref) {
    parts.push(`REFERENCES "${col.ref}"("id") ON DELETE CASCADE`);
  }
  return parts.join(" ");
}

export function renderCreateTable(table: TableDef, dialect: Dialect): string {
  const cols = table.columns.map((c) => `  ${columnSql(c, dialect)}`);

  if (dialect === "postgres") {
    for (const col of table.columns) {
      if (col.uniqueWith?.length) {
        cols.push(
          `  UNIQUE ("${col.name}", ${col.uniqueWith.map((c) => `"${c}"`).join(", ")})`,
        );
      }
    }
  }

  return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${cols.join(",\n")}\n);`;
}

export function renderIndexes(table: TableDef, dialect: Dialect): string[] {
  const out: string[] = [];
  const pg = dialect === "postgres";
  const exists = pg ? "" : " IF NOT EXISTS";

  for (const col of table.columns) {
    if (col.uniqueWith?.length) {
      const name = `ux_${table.name}_${[col.name, ...col.uniqueWith].join("_")}`;
      const list = [col.name, ...col.uniqueWith].map((c) => `"${c}"`).join(", ");
      out.push(`CREATE UNIQUE INDEX${exists} "${name}" ON "${table.name}" (${list});`);
    }
    if (col.index) {
      out.push(
        `CREATE INDEX${exists} "ix_${table.name}_${col.name}" ON "${table.name}" ("${col.name}");`,
      );
    }
  }

  for (const group of table.indexes ?? []) {
    const name = `ix_${table.name}_${group.join("_")}`;
    const list = group.map((c) => `"${c}"`).join(", ");
    out.push(`CREATE INDEX${exists} "${name}" ON "${table.name}" (${list});`);
  }

  if (pg) {
    for (const col of table.columns) {
      if (col.kind === "ref") {
        const name = `ix_${table.name}_${col.name}`;
        if (!out.some((s) => s.includes(`"${name}"`))) {
          out.push(`CREATE INDEX "${name}" ON "${table.name}" ("${col.name}");`);
        }
      }
    }
  }

  return out;
}

export function renderSchema(dialect: Dialect): string[] {
  const statements: string[] = [];
  for (const table of TABLES) statements.push(renderCreateTable(table, dialect));
  for (const table of TABLES) statements.push(...renderIndexes(table, dialect));
  return statements;
}