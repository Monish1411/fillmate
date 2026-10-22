import "server-only";
import { getSql } from "@/lib/db/client";
import { addDays, dayKey, hourIn, startOfDayIso, startOfTodayIso } from "@/lib/utils/time";
import { initialsOf } from "@/lib/utils/format";
import type {
  AdminMetrics,
  AnalyticsPoint,
  ContributionBar,
  HourBucket,
  VerificationDonut,
} from "@/types/views";

/**
 * Admin analytics.
 *
 * Every query is bounded by a hostel id supplied by the authorization layer,
 * so a hostel admin physically cannot chart another hostel's data.
 */

export interface AnalyticsRange {
  fromIso: string;
  toIso: string;
  label: string;
  days: number;
}

export function resolveRange(
  range: "today" | "7d" | "30d" | "custom",
  tz: string,
  custom?: { from?: string; to?: string },
): AnalyticsRange {
  const today = dayKey(new Date(), tz);
  if (range === "today") {
    return { fromIso: startOfDayIso(today, tz), toIso: new Date().toISOString(), label: "Today", days: 1 };
  }
  if (range === "custom" && custom?.from && custom?.to) {
    const from = startOfDayIso(custom.from, tz);
    const to = new Date(
      new Date(startOfDayIso(custom.to, tz)).getTime() + 86_399_000,
    ).toISOString();
    const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
    return { fromIso: from, toIso: to, label: `${custom.from} – ${custom.to}`, days };
  }
  const days = range === "30d" ? 30 : 7;
  return {
    fromIso: startOfDayIso(addDays(today, -(days - 1)), tz),
    toIso: new Date().toISOString(),
    label: `Last ${days} days`,
    days,
  };
}

export async function getMetrics(
  hostelId: string,
  range: AnalyticsRange,
  tz: string,
): Promise<AdminMetrics> {
  const sql = await getSql();
  const todayStart = startOfTodayIso(tz);

  const counts = await sql.query<{
    total_students: number;
    total_rooms: number;
    today_refills: number;
    bottles: number;
    verified: number;
    scored: number;
    flagged: number;
    pending: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM "users" WHERE "hostel_id" = ?) AS "total_students",
       (SELECT COUNT(*) FROM "rooms" WHERE "hostel_id" = ? AND "active" = TRUE) AS "total_rooms",
       COALESCE(SUM(CASE WHEN "server_timestamp" >= ? THEN 1 ELSE 0 END), 0) AS "today_refills",
       COALESCE(SUM("bottle_count"), 0) AS "bottles",
       COALESCE(SUM(CASE WHEN "status" = 'verified' THEN 1 ELSE 0 END), 0) AS "verified",
       COALESCE(SUM(CASE WHEN "ai_confidence" IS NOT NULL THEN 1 ELSE 0 END), 0) AS "scored",
       COALESCE(SUM(CASE WHEN "duplicate_suspected" = TRUE THEN 1 ELSE 0 END), 0) AS "flagged",
       COALESCE(SUM(CASE WHEN "review_status" = 'pending' THEN 1 ELSE 0 END), 0) AS "pending"
     FROM "water_activities"
    WHERE "hostel_id" = ? AND "deleted_at" IS NULL
      AND "server_timestamp" >= ? AND "server_timestamp" <= ?`,
    [hostelId, hostelId, todayStart, hostelId, range.fromIso, range.toIso],
  );

  const row = counts[0];
  const scored = Number(row?.scored ?? 0);
  const verified = Number(row?.verified ?? 0);
  const totalStudents = Number(row?.total_students ?? 0);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const active = await sql.query<{ total: number }>(
    `SELECT COUNT(DISTINCT "user_id") AS "total" FROM "water_activities"
      WHERE "hostel_id" = ? AND "server_timestamp" >= ? AND "deleted_at" IS NULL`,
    [hostelId, since],
  );
  const activeStudents = Number(active[0]?.total ?? 0);

  return {
    totalStudents,
    activeStudents,
    todayRefills: Number(row?.today_refills ?? 0),
    bottlesFilled: Number(row?.bottles ?? 0),
    verificationRate: scored > 0 ? Math.round((verified / scored) * 100) : 100,
    flaggedActivities: Number(row?.flagged ?? 0),
    pendingReview: Number(row?.pending ?? 0),
    participationRate:
      totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0,
    totalRooms: Number(row?.total_rooms ?? 0),
  };
}

export async function getDailySeries(
  hostelId: string,
  range: AnalyticsRange,
  tz: string,
): Promise<AnalyticsPoint[]> {
  const sql = await getSql();
  const rows = await sql.query<{ at: string; refills: number; bottles: number }>(
    `SELECT "server_timestamp" AS "at", COUNT(*) AS "refills", SUM("bottle_count") AS "bottles"
       FROM "water_activities"
      WHERE "hostel_id" = ? AND "deleted_at" IS NULL
        AND "server_timestamp" >= ? AND "server_timestamp" <= ?
      GROUP BY 1`,
    [hostelId, range.fromIso, range.toIso],
  );

  const buckets = new Map<string, AnalyticsPoint>();
  const startKey = dayKey(range.fromIso, tz);
  for (let i = 0; i < range.days; i++) {
    const key = addDays(startKey, i);
    buckets.set(key, { date: key, label: key, refills: 0, bottles: 0 });
  }
  for (const row of rows) {
    const key = dayKey(row.at, tz);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.refills += Number(row.refills ?? 0);
    bucket.bottles += Number(row.bottles ?? 0);
  }
  return Array.from(buckets.values()).map((b) => ({
    ...b,
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      day: "numeric",
      month: "short",
    }).format(new Date(`${b.date}T12:00:00Z`)),
  }));
}

export async function getHourHistogram(
  hostelId: string,
  range: AnalyticsRange,
  tz: string,
): Promise<HourBucket[]> {
  const sql = await getSql();
  const rows = await sql.query<{ at: string }>(
    `SELECT "server_timestamp" AS "at" FROM "water_activities"
      WHERE "hostel_id" = ? AND "deleted_at" IS NULL
        AND "server_timestamp" >= ? AND "server_timestamp" <= ?`,
    [hostelId, range.fromIso, range.toIso],
  );

  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const row of rows) {
    buckets[hourIn(row.at, tz)]!.count += 1;
  }
  return buckets;
}

export async function getContributionBars(
  hostelId: string,
  range: AnalyticsRange,
  viewerId: string,
  limit = 10,
): Promise<ContributionBar[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    user_id: string;
    full_name: string;
    display_name: string | null;
    privacy_show_contributions: number;
    fills: number;
    bottles: number;
  }>(
    `SELECT u."id" AS "user_id", u."full_name", u."display_name",
            u."privacy_show_contributions",
            COUNT(a."id") AS "fills",
            COALESCE(SUM(a."bottle_count"), 0) AS "bottles"
       FROM "users" u
       LEFT JOIN "water_activities" a
         ON a."user_id" = u."id" AND a."deleted_at" IS NULL
        AND a."server_timestamp" >= ? AND a."server_timestamp" <= ?
      WHERE u."hostel_id" = ?
      GROUP BY u."id"
      ORDER BY "bottles" DESC
      LIMIT ?`,
    [range.fromIso, range.toIso, hostelId, limit],
  );

  return rows
    .filter((r) => r.privacy_show_contributions || r.user_id === viewerId)
    .map((row) => {
      const name = row.display_name?.trim() || row.full_name;
      return {
        label: initialsOf(name),
        name: row.user_id === viewerId ? "You" : name,
        fills: Number(row.fills ?? 0),
        bottles: Number(row.bottles ?? 0),
        isMe: row.user_id === viewerId,
      };
    });
}

export async function getVerificationMix(
  hostelId: string,
  range: AnalyticsRange,
): Promise<VerificationDonut> {
  const sql = await getSql();
  const rows = await sql.query<{ status: string; total: number }>(
    `SELECT "status", COUNT(*) AS "total" FROM "water_activities"
      WHERE "hostel_id" = ? AND "deleted_at" IS NULL
        AND "server_timestamp" >= ? AND "server_timestamp" <= ?
      GROUP BY "status"`,
    [hostelId, range.fromIso, range.toIso],
  );
  const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.total)]));
  return {
    verified: map.verified ?? 0,
    needsReview: map.needs_review ?? 0,
    rejected: map.rejected ?? 0,
    unavailable: map.unavailable ?? 0,
  };
}

export async function getRoomBreakdown(
  hostelId: string,
  range: AnalyticsRange,
): Promise<
  Array<{
    roomId: string;
    roomNumber: string;
    members: number;
    bottles: number;
    refills: number;
    lastRefillAt: string | null;
  }>
> {
  const sql = await getSql();
  return sql.query(
    `SELECT r."id" AS "room_id", r."number" AS "room_number",
            (SELECT COUNT(*) FROM "room_members" m WHERE m."room_id" = r."id") AS "members",
            COALESCE((SELECT SUM(w."bottle_count") FROM "water_activities" w
              WHERE w."room_id" = r."id" AND w."deleted_at" IS NULL
                AND w."server_timestamp" >= ? AND w."server_timestamp" <= ?), 0) AS "bottles",
            COALESCE((SELECT COUNT(*) FROM "water_activities" w
              WHERE w."room_id" = r."id" AND w."deleted_at" IS NULL
                AND w."server_timestamp" >= ? AND w."server_timestamp" <= ?), 0) AS "refills",
            (SELECT MAX(w."server_timestamp") FROM "water_activities" w
              WHERE w."room_id" = r."id" AND w."deleted_at" IS NULL
                AND w."server_timestamp" >= ? AND w."server_timestamp" <= ?) AS "last_refill_at"
       FROM "rooms" r
      WHERE r."hostel_id" = ? AND r."active" = TRUE
      ORDER BY "bottles" DESC`,
    [range.fromIso, range.toIso, hostelId],
  );
}