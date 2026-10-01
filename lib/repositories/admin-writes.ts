import "server-only";
import { getSql } from "@/lib/db/client";
import { shortCode, uuid } from "@/lib/utils/id";
import { DEFAULT_HOSTEL_SETTINGS } from "@/lib/repositories/hostels";
import type { CoolerRow, HostelRow, OrganizationRow, RoomRow } from "@/types/core";

/** Administrative writes. Callers must have already passed the RBAC guards. */

export async function createOrganization(name: string): Promise<OrganizationRow> {
  const sql = await getSql();
  const id = uuid();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "org";
  await sql.execute(
    `INSERT INTO "organizations" ("id", "name", "slug", "created_at") VALUES (?, ?, ?, ?)`,
    [id, name, `${slug}-${id.slice(0, 6)}`, new Date().toISOString()],
  );
  return { id, name, slug: `${slug}-${id.slice(0, 6)}`, created_at: new Date().toISOString() };
}

export async function createHostel(params: {
  name: string;
  code: string;
  city?: string | null;
  timezone?: string;
  organizationName?: string;
  organizationId?: string;
}): Promise<HostelRow> {
  const sql = await getSql();
  const organizationId =
    params.organizationId ?? (await createOrganization(params.organizationName ?? params.name)).id;
  const id = uuid();
  const now = new Date().toISOString();

  await sql.execute(
    `INSERT INTO "hostels"
       ("id", "organization_id", "name", "code", "city", "timezone",
        "bottle_target", "refill_deadline_hour", "settings", "created_at")
     VALUES (?, ?, ?, ?, ?, ?, 4, 21, ?, ?)`,
    [
      id,
      organizationId,
      params.name,
      params.code.toUpperCase(),
      params.city ?? null,
      params.timezone ?? "Asia/Kolkata",
      JSON.stringify(DEFAULT_HOSTEL_SETTINGS),
      now,
    ],
  );

  return {
    id,
    organization_id: organizationId,
    name: params.name,
    code: params.code.toUpperCase(),
    city: params.city ?? null,
    timezone: params.timezone ?? "Asia/Kolkata",
    bottle_target: 4,
    refill_deadline_hour: 21,
    settings: JSON.stringify(DEFAULT_HOSTEL_SETTINGS),
    created_at: now,
  };
}

export async function createRoom(params: {
  hostelId: string;
  number: string;
  floor?: string | null;
  bottleTarget?: number;
  refillDeadlineHour?: number;
}): Promise<RoomRow> {
  const sql = await getSql();
  const id = uuid();
  const now = new Date().toISOString();
  const inviteCode = await uniqueRoomCode();

  await sql.execute(
    `INSERT INTO "rooms"
       ("id", "hostel_id", "number", "floor", "bottle_target",
        "refill_deadline_hour", "invite_code", "active", "created_at")
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      params.hostelId,
      params.number,
      params.floor ?? null,
      params.bottleTarget ?? 4,
      params.refillDeadlineHour ?? 21,
      inviteCode,
      now,
    ],
  );

  return {
    id,
    hostel_id: params.hostelId,
    number: params.number,
    floor: params.floor ?? null,
    bottle_target: params.bottleTarget ?? 4,
    refill_deadline_hour: params.refillDeadlineHour ?? 21,
    invite_code: inviteCode,
    active: 1,
    created_at: now,
  };
}

async function uniqueRoomCode(): Promise<string> {
  const sql = await getSql();
  for (let i = 0; i < 6; i++) {
    const code = shortCode(5);
    const exists = await sql.query<{ id: string }>(
      `SELECT "id" FROM "rooms" WHERE "invite_code" = ? LIMIT 1`,
      [code],
    );
    if (!exists[0]) return code;
  }
  return shortCode(8);
}

export async function updateRoom(
  roomId: string,
  patch: {
    number?: string;
    floor?: string | null;
    bottleTarget?: number;
    refillDeadlineHour?: number;
    active?: boolean;
  },
): Promise<void> {
  const sql = await getSql();
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.number !== undefined) {
    sets.push(`"number" = ?`);
    params.push(patch.number);
  }
  if (patch.floor !== undefined) {
    sets.push(`"floor" = ?`);
    params.push(patch.floor ?? null);
  }
  if (patch.bottleTarget !== undefined) {
    sets.push(`"bottle_target" = ?`);
    params.push(patch.bottleTarget);
  }
  if (patch.refillDeadlineHour !== undefined) {
    sets.push(`"refill_deadline_hour" = ?`);
    params.push(patch.refillDeadlineHour);
  }
  if (patch.active !== undefined) {
    sets.push(`"active" = ?`);
    params.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) return;
  await sql.execute(`UPDATE "rooms" SET ${sets.join(", ")} WHERE "id" = ?`, [...params, roomId]);
}

export async function createCooler(params: {
  hostelId: string;
  roomId?: string | null;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  allowedRadiusM?: number;
  locationEnforced?: boolean;
}): Promise<CoolerRow> {
  const sql = await getSql();
  const id = uuid();
  const now = new Date().toISOString();
  await sql.execute(
    `INSERT INTO "coolers"
       ("id", "hostel_id", "room_id", "label", "qr_code", "latitude", "longitude",
        "allowed_radius_m", "location_enforced", "active", "created_at")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      params.hostelId,
      params.roomId ?? null,
      params.label,
      shortCode(8),
      params.latitude ?? null,
      params.longitude ?? null,
      params.allowedRadiusM ?? 60,
      params.locationEnforced ? 1 : 0,
      now,
    ],
  );
  return {
    id,
    hostel_id: params.hostelId,
    room_id: params.roomId ?? null,
    label: params.label,
    qr_code: null,
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
    allowed_radius_m: params.allowedRadiusM ?? 60,
    location_enforced: params.locationEnforced ? 1 : 0,
    active: 1,
    created_at: now,
  };
}

export async function updateCooler(
  coolerId: string,
  patch: {
    label?: string;
    latitude?: number | null;
    longitude?: number | null;
    allowedRadiusM?: number;
    locationEnforced?: boolean;
    active?: boolean;
  },
): Promise<void> {
  const sql = await getSql();
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.label !== undefined) {
    sets.push(`"label" = ?`);
    params.push(patch.label);
  }
  if (patch.latitude !== undefined) {
    sets.push(`"latitude" = ?`);
    params.push(patch.latitude);
  }
  if (patch.longitude !== undefined) {
    sets.push(`"longitude" = ?`);
    params.push(patch.longitude);
  }
  if (patch.allowedRadiusM !== undefined) {
    sets.push(`"allowed_radius_m" = ?`);
    params.push(patch.allowedRadiusM);
  }
  if (patch.locationEnforced !== undefined) {
    sets.push(`"location_enforced" = ?`);
    params.push(patch.locationEnforced ? 1 : 0);
  }
  if (patch.active !== undefined) {
    sets.push(`"active" = ?`);
    params.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) return;
  await sql.execute(`UPDATE "coolers" SET ${sets.join(", ")} WHERE "id" = ?`, [...params, coolerId]);
}

export async function deactivateCooler(coolerId: string): Promise<void> {
  const sql = await getSql();
  await sql.execute(`UPDATE "coolers" SET "active" = 0 WHERE "id" = ?`, [coolerId]);
}

export async function setUserRole(
  userId: string,
  role: "student" | "hostel_admin" | "super_admin",
): Promise<void> {
  const sql = await getSql();
  await sql.execute(`UPDATE "users" SET "role" = ?, "updated_at" = ? WHERE "id" = ?`, [
    role,
    new Date().toISOString(),
    userId,
  ]);
}