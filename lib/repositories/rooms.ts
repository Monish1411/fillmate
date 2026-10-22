import "server-only";
import { getSql } from "@/lib/db/client";
import { DEFAULT_TZ, hourIn, startOfTodayIso } from "@/lib/utils/time";
import type { CoolerRow, RoomRow } from "@/types/core";
import type { RoomStatus, RoomStatusView } from "@/types/views";
import type { AiStatus } from "@/types/core";

/** Room + cooler lookups and the daily water-status projection. */

export async function getRoom(roomId: string): Promise<RoomRow | null> {
  const sql = await getSql();
  const rows = await sql.query<RoomRow>(`SELECT * FROM "rooms" WHERE "id" = ? LIMIT 1`, [
    roomId,
  ]);
  return rows[0] ?? null;
}

export async function listRooms(hostelId: string, includeInactive = false): Promise<RoomRow[]> {
  const sql = await getSql();
  return sql.query<RoomRow>(
    `SELECT * FROM "rooms" WHERE "hostel_id" = ? ${includeInactive ? "" : `AND "active" = TRUE`}
      ORDER BY "number" ASC`,
    [hostelId],
  );
}

export async function findRoomByNumber(
  hostelId: string,
  number: string,
): Promise<RoomRow | null> {
  const sql = await getSql();
  const rows = await sql.query<RoomRow>(
    `SELECT * FROM "rooms" WHERE "hostel_id" = ? AND LOWER("number") = LOWER(?) AND "active" = TRUE LIMIT 1`,
    [hostelId, number],
  );
  return rows[0] ?? null;
}

export async function getCoolers(
  hostelId: string,
  roomId?: string | null,
): Promise<CoolerRow[]> {
  const sql = await getSql();
  if (roomId) {
    return sql.query<CoolerRow>(
      `SELECT * FROM "coolers"
        WHERE "hostel_id" = ? AND "active" = TRUE AND ("room_id" = ? OR "room_id" IS NULL)
        ORDER BY "label" ASC`,
      [hostelId, roomId],
    );
  }
  return sql.query<CoolerRow>(
    `SELECT * FROM "coolers" WHERE "hostel_id" = ? AND "active" = TRUE ORDER BY "label" ASC`,
    [hostelId],
  );
}

export async function getCooler(coolerId: string): Promise<CoolerRow | null> {
  const sql = await getSql();
  const rows = await sql.query<CoolerRow>(`SELECT * FROM "coolers" WHERE "id" = ? LIMIT 1`, [
    coolerId,
  ]);
  return rows[0] ?? null;
}

/** Default cooler for a room: room-specific first, then the hostel cooler. */
export async function resolveCooler(
  hostelId: string,
  roomId: string,
): Promise<CoolerRow | null> {
  const coolers = await getCoolers(hostelId, roomId);
  return coolers.find((c) => c.room_id === roomId) ?? coolers[0] ?? null;
}

/* ── Daily water status ──────────────────────────────────────── */

/**
 * Counts every non-rejected submission — a bottle filled is a bottle filled,
 * whether or not a human has reviewed the photo yet.
 */
export async function getRoomStatus(
  roomId: string,
  tz: string = DEFAULT_TZ,
): Promise<RoomStatusView | null> {
  const sql = await getSql();
  const room = await sql.query<RoomRow & { hostel_name: string }>(
    `SELECT r.*, h."name" AS "hostel_name"
       FROM "rooms" r JOIN "hostels" h ON h."id" = r."hostel_id"
      WHERE r."id" = ? LIMIT 1`,
    [roomId],
  );
  const found = room[0];
  if (!found) return null;

  const todayStart = startOfTodayIso(tz);
  const target = found.bottle_target || 4;

  const totals = await sql.query<{ filled: number; refills: number; active: number }>(
    `SELECT COALESCE(SUM("bottle_count"), 0) AS "filled",
            COUNT(*) AS "refills",
            COUNT(DISTINCT "user_id") AS "active"
       FROM "water_activities"
      WHERE "room_id" = ? AND "server_timestamp" >= ? AND "status" <> 'rejected'
        AND "deleted_at" IS NULL`,
    [roomId, todayStart],
  );

  const last = await sql.query<{
    id: string;
    bottle_count: number;
    server_timestamp: string;
    status: AiStatus;
    actor: string;
    display: string | null;
    hide_name: number;
  }>(
    `SELECT a."id", a."bottle_count", a."server_timestamp", a."status",
            u."full_name" AS "actor", u."display_name" AS "display",
            u."privacy_show_name" AS "hide_name"
       FROM "water_activities" a
       JOIN "users" u ON u."id" = a."user_id"
      WHERE a."room_id" = ? AND a."deleted_at" IS NULL AND a."status" <> 'rejected'
      ORDER BY a."server_timestamp" DESC LIMIT 1`,
    [roomId],
  );

  const memberCount = await sql.query<{ total: number }>(
    `SELECT COUNT(*) AS "total" FROM "room_members" WHERE "room_id" = ?`,
    [roomId],
  );

  const filled = Number(totals[0]?.filled ?? 0);
  const remaining = Math.max(0, target - filled);
  const percent = target > 0 ? Math.min(100, Math.round((filled / target) * 100)) : 0;

  const lastRow = last[0];
  const deadlineHour = found.refill_deadline_hour ?? 21;
  const currentHour = hourIn(new Date(), tz);

  let status: RoomStatus = "needs_refill";
  if (filled >= target) status = "full";
  else if (currentHour >= deadlineHour) status = "overdue";

  return {
    roomId: found.id,
    roomNumber: found.number,
    hostelId: found.hostel_id,
    hostelName: found.hostel_name,
    target,
    filled,
    remaining,
    percent,
    status,
    lastRefill: lastRow
      ? {
          activityId: lastRow.id,
          actorName: lastRow.hide_name
            ? "A roommate"
            : (lastRow.display?.trim() || lastRow.actor),
          bottleCount: lastRow.bottle_count,
          timestamp: lastRow.server_timestamp,
          status: lastRow.status,
        }
      : null,
    memberCount: Number(memberCount[0]?.total ?? 0),
    activeToday: Number(totals[0]?.active ?? 0),
    deadlineHour,
    updatedAt: new Date().toISOString(),
  };
}

/** Total bottles this room has recorded, optionally since an instant. */
export async function getRoomTotals(
  roomId: string,
  sinceIso?: string,
): Promise<{ bottles: number; refills: number; days: number }> {
  const sql = await getSql();
  const rows = await sql.query<{ bottles: number; refills: number }>(
    `SELECT COALESCE(SUM("bottle_count"), 0) AS "bottles", COUNT(*) AS "refills"
       FROM "water_activities"
      WHERE "room_id" = ? AND "deleted_at" IS NULL AND "status" <> 'rejected'
        ${sinceIso ? `AND "server_timestamp" >= ?` : ""}`,
    sinceIso ? [roomId, sinceIso] : [roomId],
  );
  const days = sinceIso
    ? Math.max(1, Math.round((Date.now() - new Date(sinceIso).getTime()) / 86_400_000))
    : 1;
  return {
    bottles: Number(rows[0]?.bottles ?? 0),
    refills: Number(rows[0]?.refills ?? 0),
    days,
  };
}
