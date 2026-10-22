/**
 * Dialect-portable SQL fragments.
 *
 * The same query text has to run on SQLite (INTEGER 0/1 booleans, TEXT JSON)
 * and PostgreSQL (native BOOLEAN, JSONB). These helpers produce fragments that
 * are valid in both dialects:
 *
 *   • `TRUE` / `FALSE` literals  — accepted by SQLite and PostgreSQL.
 *   • `IS TRUE` / `IS FALSE`      — accepted by SQLite and PostgreSQL.
 *   • `?` placeholders            — rewritten to `$n` by the Postgres driver.
 */

/** A SQL literal that is a boolean in both SQLite and PostgreSQL. */
export function boolLiteral(value: boolean): "TRUE" | "FALSE" {
  return value ? "TRUE" : "FALSE";
}

/**
 * A boolean comparison predicate, e.g. `"active" = TRUE`.
 *
 * Never use `= 1` / `= 0` against a boolean column: PostgreSQL raises
 * "operator does not exist: boolean = integer".
 */
export function boolEquals(column: string, value: boolean): string {
  return `${column} = ${boolLiteral(value)}`;
}

/**
 * A null-safe boolean comparison predicate, e.g. `"active" IS TRUE`.
 *
 * `IS TRUE` matches only rows where the column is exactly true — NULL rows
 * are excluded, exactly like `= TRUE`.
 */
export function boolIs(column: string, value: boolean): string {
  return `${column} IS ${boolLiteral(value)}`;
}

/**
 * Normalise a value read from a boolean column.
 *
 * SQLite yields 0/1 integers, PostgreSQL yields real booleans. `Boolean()`
 * maps 0/false → false and everything else (1/true) → true.
 */
export function asBool(value: unknown): boolean {
  return Boolean(value);
}

/**
 * Normalise a nullable boolean column read from the database.
 */
export function asBoolOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

/**
 * Normalise a JSON column read from the database.
 *
 * PostgreSQL's JSONB driver returns an already-parsed value; SQLite stores
 * JSON as TEXT and therefore returns a string. Both are accepted here.
 */
export function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof raw === "object") return raw as T;
  return fallback;
}

/**
 * Normalise a JSON column into a plain object.
 */
export function parseJsonObject(
  raw: unknown,
): Record<string, unknown> {
  return parseJson<Record<string, unknown>>(raw, {});
}

/**
 * Encode a value for writing into a JSON column.
 *
 * SQLite stores the text verbatim; PostgreSQL's JSONB accepts a JSON string.
 */
export function toJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * Count-safe numeric coercion — PostgreSQL returns `COUNT(*)`/`SUM()` as
 * strings for bigint columns, SQLite as numbers.
 */
export function asNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
