import "server-only";
import { getSql } from "@/lib/db/client";
import { initialsOf } from "@/lib/utils/format";
import type { MemberContribution, RoomRole } from "@/types/views";

/** Room membership and per-member contribution totals. */

export interface RoomMemberRecord {
  user_id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role_in_room: RoomRole;
  privacy_show_name: number;
  privacy_show_contributions: number;
  joined_at: string;
  last_seen_at: string | null;
  role: string;
}

export async function getRoomMembers(roomId: string): Promise<RoomMemberRecord[]> {
  const sql = await getSql();
  return sql.query<RoomMemberRecord>(
    `SELECT rm."user_id", u."full_name", u."display_name", u."email", u."phone",
            u."avatar_url", rm."role_in_room", u."privacy_show_name",
            u."privacy_show_contributions", rm."joined_at", u."last_seen_at",
            u."role"
       FROM "room_members" rm
       JOIN "users" u ON u."id" = rm."user_id"
      WHERE rm."room_id" = ?
      ORDER BY rm."joined_at" ASC`,
    [roomId],
  );
}

export async function getMembership(
  roomId: string,
  userId: string,
): Promise<{ role_in_room: RoomRole } | null> {
  const sql = await getSql();
  const rows = await sql.query<{ role_in_room: RoomRole }>(
    `SELECT "role_in_room" FROM "room_members" WHERE "room_id" = ? AND "user_id" = ? LIMIT 1`,
    [roomId, userId],
  );
  return rows[0] ?? null;
}

/**
 * Per-member contribution totals since `sinceIso`, honouring each member's
 * privacy settings. A student can always see their own numbers.
 */
export async function getRoomContributions(
  roomId: string,
  viewerId: string,
  sinceIso?: string,
): Promise<MemberContribution[]> {
  const sql = await getSql();
  const since = sinceIso ?? "1970-01-01T00:00:00.000Z";

  const rows = await sql.query<{
    user_id: string;
    full_name: string;
    display_name: string | null;
    avatar_url: string | null;
    role_in_room: RoomRole;
    privacy_show_name: number;
    privacy_show_contributions: number;
    fills: number;
    bottles: number;
    last_activity_at: string | null;
  }>(
    `SELECT rm."user_id", u."full_name", u."display_name", u."avatar_url",
            rm."role_in_room", u."privacy_show_name", u."privacy_show_contributions",
            COALESCE(a."fills", 0) AS "fills",
            COALESCE(a."bottles", 0) AS "bottles",
            a."last_activity_at"
       FROM "room_members" rm
       JOIN "users" u ON u."id" = rm."user_id"
       LEFT JOIN (
            SELECT "user_id", COUNT(*) AS "fills", SUM("bottle_count") AS "bottles",
                   MAX("server_timestamp") AS "last_activity_at"
              FROM "water_activities"
             WHERE "room_id" = ? AND "deleted_at" IS NULL AND "status" <> 'rejected'
               AND "server_timestamp" >= ?
             GROUP BY "user_id"
       ) a ON a."user_id" = rm."user_id"
      WHERE rm."room_id" = ?
      ORDER BY "bottles" DESC, a."last_activity_at" DESC`,
    [roomId, since, roomId],
  );

  return rows.map((row) => {
    const hideNumbers = !row.privacy_show_contributions && row.user_id !== viewerId;
    const hideName = !row.privacy_show_name && row.user_id !== viewerId;
    const name = hideName ? "A roommate" : row.display_name?.trim() || row.full_name;
    return {
      userId: row.user_id,
      name: hideNumbers ? "Contribution private" : name,
      initials: hideName ? "•" : initialsOf(name),
      isMe: row.user_id === viewerId,
      roomRole: row.role_in_room ?? "member",
      fills: hideNumbers ? 0 : Number(row.fills ?? 0),
      bottles: hideNumbers ? 0 : Number(row.bottles ?? 0),
      lastActivityAt: row.last_activity_at,
      hidden: hideNumbers,
      avatarUrl: row.avatar_url,
    };
  });
}

export async function addRoomMember(
  roomId: string,
  hostelId: string,
  userId: string,
  roleInRoom: RoomRole = "member",
): Promise<boolean> {
  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(
    `SELECT "id" FROM "room_members" WHERE "room_id" = ? AND "user_id" = ? LIMIT 1`,
    [roomId, userId],
  );
  if (existing[0]) return false;
  const { uuid } = await import("@/lib/utils/id");
  await sql.execute(
    `INSERT INTO "room_members" ("id", "room_id", "user_id", "hostel_id", "role_in_room", "joined_at")
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), roomId, userId, hostelId, roleInRoom, new Date().toISOString()],
  );
  return true;
}

export async function removeRoomMember(roomId: string, userId: string): Promise<boolean> {
  const sql = await getSql();
  const changes = await sql.execute(
    `DELETE FROM "room_members" WHERE "room_id" = ? AND "user_id" = ?`,
    [roomId, userId],
  );
  return changes > 0;
}