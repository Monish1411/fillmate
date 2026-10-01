import "server-only";
import { getSql } from "@/lib/db/client";
import { evidenceUrls } from "@/lib/storage";
import { initialsOf } from "@/lib/utils/format";
import type { ActivityQuery, Paged } from "@/types/api";
import type { WaterActivityRow } from "@/types/activity";
import type { ActivityView } from "@/types/views";

/**
 * Activity reads.
 *
 * Every query is scoped by hostel at the SQL level — authorization is never a
 * post-filter, so a cross-hostel request cannot return rows at all.
 */

export interface JoinedActivity extends WaterActivityRow {
  actor_full_name: string;
  actor_display_name: string | null;
  actor_avatar: string | null;
  actor_hide_name: number;
  room_number: string;
  cooler_label: string | null;
  storage_key: string | null;
  image_id: string | null;
}

export const SELECT_ACTIVITY = `
  SELECT a.*,
         u."full_name"    AS "actor_full_name",
         u."display_name" AS "actor_display_name",
         u."avatar_url"   AS "actor_avatar",
         u."privacy_show_name" AS "actor_hide_name",
         r."number"       AS "room_number",
         c."label"        AS "cooler_label",
         i."storage_key"  AS "storage_key",
         i."id"           AS "image_id"
    FROM "water_activities" a
    JOIN "users" u ON u."id" = a."user_id"
    JOIN "rooms" r ON r."id" = a."room_id"
    LEFT JOIN "coolers" c ON c."id" = a."cooler_id"
    LEFT JOIN "activity_images" i ON i."activity_id" = a."id"`;

export function parseFlags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function hydrateActivities(
  rows: JoinedActivity[],
  viewerId: string,
): Promise<ActivityView[]> {
  const urls = await evidenceUrls(rows.map((r) => r.storage_key));
  return rows.map((row, index) => {
    const hideName = !row.actor_hide_name && row.user_id !== viewerId;
    const name = hideName
      ? "A roommate"
      : row.actor_display_name?.trim() || row.actor_full_name;
    return {
      id: row.id,
      userId: row.user_id,
      actorName: name,
      actorInitials: hideName ? "•" : initialsOf(name),
      actorHidden: hideName,
      actorAvatar: hideName ? null : row.actor_avatar,
      hostelId: row.hostel_id,
      roomId: row.room_id,
      roomNumber: row.room_number,
      coolerId: row.cooler_id,
      coolerLabel: row.cooler_label,
      bottleCount: row.bottle_count,
      status: row.status,
      reviewStatus: row.review_status,
      confidence: row.ai_confidence,
      coolerDetected: row.cooler_detected === null ? null : Boolean(row.cooler_detected),
      bottlesDetected: row.bottles_detected,
      fillingContextDetected:
        row.filling_context_detected === null
          ? null
          : Boolean(row.filling_context_detected),
      duplicateSuspected: Boolean(row.duplicate_suspected),
      locationStatus: row.location_status,
      distanceMeters: row.distance_from_cooler_m,
      locationAccuracy: row.location_accuracy,
      qrScanned: Boolean(row.qr_scanned),
      serverTimestamp: row.server_timestamp,
      timezone: row.timezone,
      note: row.note,
      imageKey: row.storage_key,
      imageUrl: urls[index] ?? null,
      sha256: row.image_hash,
      flaggedReasons: parseFlags(row.flagged_reasons),
      reviewNote: row.review_note,
      isMine: row.user_id === viewerId,
    };
  });
}

export interface ScopedQuery extends ActivityQuery {
  /** Server-enforced scope. Always required. */
  scopeHostelId: string;
  /** When set, results are limited to these rooms. */
  allowedRoomIds?: string[] | null;
}

export async function listActivities(
  query: ScopedQuery,
  viewerId: string,
): Promise<Paged<ActivityView>> {
  const sql = await getSql();
  const where: string[] = [`a."deleted_at" IS NULL`, `a."hostel_id" = ?`];
  const params: Array<string | number> = [query.scopeHostelId];

  if (query.roomId) {
    where.push(`a."room_id" = ?`);
    params.push(query.roomId);
  } else if (query.allowedRoomIds) {
    if (query.allowedRoomIds.length === 0) {
      return { items: [], total: 0, limit: 0, offset: 0 };
    }
    where.push(`a."room_id" IN (${query.allowedRoomIds.map(() => "?").join(",")})`);
    params.push(...query.allowedRoomIds);
  }

  if (query.userId) {
    where.push(`a."user_id" = ?`);
    params.push(query.userId);
  }
  if (query.status) {
    where.push(`a."status" = ?`);
    params.push(query.status);
  }
  if (query.reviewStatus) {
    where.push(`a."review_status" = ?`);
    params.push(query.reviewStatus);
  }
  if (query.from) {
    where.push(`a."server_timestamp" >= ?`);
    params.push(query.from);
  }
  if (query.to) {
    where.push(`a."server_timestamp" <= ?`);
    params.push(query.to);
  }
  if (query.minBottles !== undefined) {
    where.push(`a."bottle_count" >= ?`);
    params.push(query.minBottles);
  }
  if (query.maxBottles !== undefined) {
    where.push(`a."bottle_count" <= ?`);
    params.push(query.maxBottles);
  }
  if (query.search) {
    where.push(
      `(LOWER(u."full_name") LIKE ? OR LOWER(u."display_name") LIKE ? OR LOWER(r."number") LIKE ?)`,
    );
    const like = `%${query.search.toLowerCase()}%`;
    params.push(like, like, like);
  }

  const whereSql = where.join(" AND ");
  const order =
    query.sort === "oldest"
      ? `a."server_timestamp" ASC`
      : query.sort === "most_bottles"
        ? `a."bottle_count" DESC, a."server_timestamp" DESC`
        : `a."server_timestamp" DESC`;

  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;

  const countRows = await sql.query<{ total: number }>(
    `SELECT COUNT(*) AS "total" FROM "water_activities" a
       JOIN "users" u ON u."id" = a."user_id"
       JOIN "rooms" r ON r."id" = a."room_id"
      WHERE ${whereSql}`,
    params,
  );

  const rows = await sql.query<JoinedActivity>(
    `${SELECT_ACTIVITY} WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: await hydrateActivities(rows, viewerId),
    total: Number(countRows[0]?.total ?? 0),
    limit,
    offset,
  };
}

export async function getActivityById(
  activityId: string,
  viewerId: string,
): Promise<ActivityView | null> {
  const sql = await getSql();
  const rows = await sql.query<JoinedActivity>(
    `${SELECT_ACTIVITY} WHERE a."id" = ? AND a."deleted_at" IS NULL LIMIT 1`,
    [activityId],
  );
  if (!rows[0]) return null;
  const hydrated = await hydrateActivities(rows, viewerId);
  return hydrated[0] ?? null;
}

/** Raw row for internal jobs (rotation linking, reviews, cron sweeps). */
export async function getActivityRow(
  activityId: string,
): Promise<WaterActivityRow | null> {
  const sql = await getSql();
  const rows = await sql.query<WaterActivityRow>(
    `SELECT * FROM "water_activities" WHERE "id" = ? LIMIT 1`,
    [activityId],
  );
  return rows[0] ?? null;
}

/** Activities newer than `sinceIso` scoped to a room — powers live updates. */
export async function listRoomActivities(
  roomId: string,
  sinceIso: string,
  viewerId: string,
  limit = 15,
): Promise<ActivityView[]> {
  const sql = await getSql();
  const rows = await sql.query<JoinedActivity>(
    `${SELECT_ACTIVITY}
      WHERE a."room_id" = ? AND a."deleted_at" IS NULL AND a."server_timestamp" > ?
        AND a."status" <> 'rejected'
      ORDER BY a."server_timestamp" DESC LIMIT ?`,
    [roomId, sinceIso, limit],
  );
  return hydrateActivities(rows, viewerId);
}

/** Soft delete — the row stays for audit, evidence is removed separately. */
export async function softDeleteActivity(activityId: string): Promise<void> {
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql.execute(
    `UPDATE "water_activities" SET "deleted_at" = ?, "updated_at" = ? WHERE "id" = ?`,
    [now, now, activityId],
  );
}
