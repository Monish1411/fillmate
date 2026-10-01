import "server-only";
import { getSql } from "@/lib/db/client";
import { DEFAULT_FEATURES, type FeatureConfig, type FeatureFlag } from "@/types/core";
import type { HostelRow, OrganizationRow } from "@/types/core";

export interface HostelSettings extends FeatureConfig {
  retentionDays: number;
  aiConfidenceThreshold: number;
  cooldownSeconds: number;
  minPhotoDimension: number;
}

export const DEFAULT_HOSTEL_SETTINGS: HostelSettings = {
  ...DEFAULT_FEATURES,
  retentionDays: 90,
  aiConfidenceThreshold: 0.7,
  cooldownSeconds: 8,
  minPhotoDimension: 320,
};

export function parseSettings(raw: string | null | undefined): HostelSettings {
  if (!raw) return { ...DEFAULT_HOSTEL_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<HostelSettings>;
    return { ...DEFAULT_HOSTEL_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_HOSTEL_SETTINGS };
  }
}

export async function getHostel(hostelId: string): Promise<HostelRow | null> {
  const sql = await getSql();
  const rows = await sql.query<HostelRow>(
    `SELECT * FROM "hostels" WHERE "id" = ? LIMIT 1`,
    [hostelId],
  );
  return rows[0] ?? null;
}

export async function listHostels(): Promise<HostelRow[]> {
  const sql = await getSql();
  return sql.query<HostelRow>(`SELECT * FROM "hostels" ORDER BY "name" ASC`);
}

export async function getOrganization(orgId: string): Promise<OrganizationRow | null> {
  const sql = await getSql();
  const rows = await sql.query<OrganizationRow>(
    `SELECT * FROM "organizations" WHERE "id" = ? LIMIT 1`,
    [orgId],
  );
  return rows[0] ?? null;
}

/**
 * Hostels a user may act in.
 * Students see their own; admins see theirs; super admins see everything.
 */
export async function listScopedHostels(user: {
  role: string;
  hostel_id: string | null;
}): Promise<HostelRow[]> {
  if (user.role === "super_admin") return listHostels();
  if (!user.hostel_id) return [];
  const hostel = await getHostel(user.hostel_id);
  return hostel ? [hostel] : [];
}

/** Publicly listable hostels for the onboarding picker (name + code only). */
export async function listPublicHostels(): Promise<
  Array<{ id: string; name: string; code: string; city: string | null; timezone: string; bottle_target: number }>
> {
  const sql = await getSql();
  return sql.query(
    `SELECT "id", "name", "code", "city", "timezone", "bottle_target"
       FROM "hostels" ORDER BY "name" ASC`,
  );
}

export async function findHostelByCode(code: string): Promise<HostelRow | null> {
  const sql = await getSql();
  const rows = await sql.query<HostelRow>(
    `SELECT * FROM "hostels" WHERE LOWER("code") = LOWER(?) LIMIT 1`,
    [code],
  );
  return rows[0] ?? null;
}

export async function findHostelByName(name: string): Promise<HostelRow | null> {
  const sql = await getSql();
  const rows = await sql.query<HostelRow>(
    `SELECT * FROM "hostels" WHERE LOWER("name") = LOWER(?) LIMIT 1`,
    [name],
  );
  return rows[0] ?? null;
}

export async function updateHostelSettings(
  hostelId: string,
  patch: Partial<HostelSettings>,
): Promise<HostelSettings> {
  const sql = await getSql();
  const hostel = await getHostel(hostelId);
  if (!hostel) throw new Error("Hostel not found");
  const current = parseSettings(hostel.settings);
  const next: HostelSettings = { ...current, ...patch };
  await sql.execute(`UPDATE "hostels" SET "settings" = ? WHERE "id" = ?`, [
    JSON.stringify(next),
    hostelId,
  ]);
  return next;
}

export async function getHostelSettings(hostelId: string): Promise<HostelSettings> {
  const hostel = await getHostel(hostelId);
  return parseSettings(hostel?.settings);
}

export function isFeatureEnabled(settings: HostelSettings, flag: FeatureFlag): boolean {
  return settings[flag] !== false;
}

/* ── System settings (super admin) ───────────────────────────── */

export async function getSystemSetting<T = Record<string, unknown>>(
  key: string,
  fallback: T,
): Promise<T> {
  const sql = await getSql();
  const rows = await sql.query<{ value: string }>(
    `SELECT "value" FROM "system_settings" WHERE "key" = ? LIMIT 1`,
    [key],
  );
  if (!rows[0]) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(rows[0].value) as T) };
  } catch {
    return fallback;
  }
}

export async function setSystemSetting(
  key: string,
  value: unknown,
  updatedBy: string | null,
): Promise<void> {
  const sql = await getSql();
  const existing = await sql.query<{ key: string }>(
    `SELECT "key" FROM "system_settings" WHERE "key" = ? LIMIT 1`,
    [key],
  );
  const payload = JSON.stringify(value ?? {});
  if (existing[0]) {
    await sql.execute(
      `UPDATE "system_settings" SET "value" = ?, "updated_by" = ?, "updated_at" = ? WHERE "key" = ?`,
      [payload, updatedBy, new Date().toISOString(), key],
    );
    return;
  }
  await sql.execute(
    `INSERT INTO "system_settings" ("key", "value", "updated_by", "updated_at") VALUES (?, ?, ?, ?)`,
    [key, payload, updatedBy, new Date().toISOString()],
  );
}