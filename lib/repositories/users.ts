import "server-only";
import { getSql } from "@/lib/db/client";
import { addDays, dayKey, startOfDayIso } from "@/lib/utils/time";
import type { ContributionStats } from "@/types/views";
import type { UserRow } from "@/types/core";

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const sql = await getSql();
  const rows = await sql.query<UserRow>(
    `SELECT * FROM "users" WHERE LOWER("email") = LOWER(?) LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const sql = await getSql();
  const rows = await sql.query<UserRow>(`SELECT * FROM "users" WHERE "id" = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export type HostelUser = UserRow & {
  room_number: string | null;
  room_id: string | null;
  fills: number;
  bottles: number;
  last_activity_at: string | null;
};

export async function listHostelUsers(
  hostelId: string,
  options: { search?: string; role?: string; limit?: number } = {},
): Promise<HostelUser[]> {
  const sql = await getSql();
  const where = [`u."hostel_id" = ?`];
  const params: Array<string | number> = [hostelId];

  if (options.search) {
    where.push(
      `(LOWER(u."full_name") LIKE ? OR LOWER(u."email") LIKE ? OR LOWER(u."display_name") LIKE ?)`,
    );
    const like = `%${options.search.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (options.role) {
    where.push(`u."role" = ?`);
    params.push(options.role);
  }

  return sql.query<HostelUser>(
    `SELECT u.*, r."number" AS "room_number", rm."room_id" AS "room_id",
            COALESCE(a."fills", 0) AS "fills", COALESCE(a."bottles", 0) AS "bottles",
            a."last_activity_at"
       FROM "users" u
       LEFT JOIN "room_members" rm ON rm."user_id" = u."id"
       LEFT JOIN "rooms" r ON r."id" = rm."room_id"
       LEFT JOIN (
            SELECT "user_id", COUNT(*) AS "fills", SUM("bottle_count") AS "bottles",
                   MAX("server_timestamp") AS "last_activity_at"
              FROM "water_activities"
             WHERE "deleted_at" IS NULL AND "status" <> 'rejected'
             GROUP BY "user_id"
       ) a ON a."user_id" = u."id"
      WHERE ${where.join(" AND ")}
      ORDER BY u."full_name" ASC
      LIMIT ?`,
    [...params, options.limit ?? 200],
  );
}
/** Lifetime + periodised contribution numbers for one student. */
export async function getContributionStats(
  userId: string,
  tz: string,
): Promise<ContributionStats> {
  const sql = await getSql();
  const weekAgo = startOfDayIso(addDays(dayKey(new Date(), tz), -6), tz);
  const monthBack = new Date(Date.now() - 29 * 86_400_000);
  const monthStart = startOfDayIso(dayKey(monthBack, tz), tz);

  const rows = await sql.query<{
    fills: number;
    bottles: number;
    week_fills: number;
    month_fills: number;
    verified: number;
    scored: number;
    first_at: string | null;
  }>(
    `SELECT
       COUNT(*) AS "fills",
       COALESCE(SUM("bottle_count"), 0) AS "bottles",
       COALESCE(SUM(CASE WHEN "server_timestamp" >= ? THEN 1 ELSE 0 END), 0) AS "week_fills",
       COALESCE(SUM(CASE WHEN "server_timestamp" >= ? THEN 1 ELSE 0 END), 0) AS "month_fills",
       COALESCE(SUM(CASE WHEN "status" = 'verified' THEN 1 ELSE 0 END), 0) AS "verified",
       COALESCE(SUM(CASE WHEN "ai_confidence" IS NOT NULL THEN 1 ELSE 0 END), 0) AS "scored",
       MIN("server_timestamp") AS "first_at"
     FROM "water_activities"
    WHERE "user_id" = ? AND "deleted_at" IS NULL AND "status" <> 'rejected'`,
    [weekAgo, monthStart, userId],
  );

  const row = rows[0];
  const fills = Number(row?.fills ?? 0);
  const firstAt = row?.first_at ? new Date(row.first_at).getTime() : Date.now();
  const daysActive = Math.max(1, Math.round((Date.now() - firstAt) / 86_400_000) + 1);
  const scored = Number(row?.scored ?? 0);
  const verified = Number(row?.verified ?? 0);

  return {
    fills,
    weekFills: Number(row?.week_fills ?? 0),
    monthFills: Number(row?.month_fills ?? 0),
    bottles: Number(row?.bottles ?? 0),
    avgPerDay: Math.round((fills / daysActive) * 10) / 10,
    // When nothing has been scored yet, we do not claim a percentage.
    verificationRate: scored > 0 ? Math.round((verified / scored) * 100) : 100,
    streak: await computeStreak(userId, tz),
  };
}

/** Consecutive days (ending today or yesterday) with at least one refill. */
async function computeStreak(userId: string, tz: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ day: string }>(
    `SELECT "server_timestamp" AS "day" FROM "water_activities"
      WHERE "user_id" = ? AND "deleted_at" IS NULL AND "status" <> 'rejected'
      ORDER BY "server_timestamp" DESC LIMIT 180`,
    [userId],
  );
  if (rows.length === 0) return 0;

  const days = new Set(rows.map((r) => dayKey(r.day, tz)));
  const today = dayKey(new Date(), tz);
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function updateUserProfile(
  userId: string,
  fields: Record<string, string | number | null>,
): Promise<void> {
  const sql = await getSql();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const assignments = keys.map((k) => `"${k}" = ?`).join(", ");
  await sql.execute(
    `UPDATE "users" SET ${assignments}, "updated_at" = ? WHERE "id" = ?`,
    [
      ...keys.map((k) => fields[k] as string | number | null),
      new Date().toISOString(),
      userId,
    ],
  );
}

/** Members of a hostel who recorded activity in the last N days. */
export async function countActiveStudents(hostelId: string, days = 7): Promise<number> {
  const sql = await getSql();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await sql.query<{ total: number }>(
    `SELECT COUNT(DISTINCT "user_id") AS "total" FROM "water_activities"
      WHERE "hostel_id" = ? AND "server_timestamp" >= ? AND "deleted_at" IS NULL`,
    [hostelId, since],
  );
  return Number(rows[0]?.total ?? 0);
}