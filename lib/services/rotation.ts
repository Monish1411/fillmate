import "server-only";
import { getSql } from "@/lib/db/client";
import { addDays, dayKey } from "@/lib/utils/time";
import { uuid } from "@/lib/utils/id";
import { notify } from "@/lib/repositories/notifications";
import { getRoomMembers } from "@/lib/repositories/members";
import { publish } from "@/lib/realtime/bus";
import type { RotationRow } from "@/types/activity";
import type { RotationTurn } from "@/types/views";

/**
 * Smart refill rotation.
 *
 * A deterministic, round-robin schedule is generated lazily so a new room
 * works immediately without a setup step. Members can skip, swap or volunteer;
 * every change is logged and broadcast.
 */

const HORIZON_DAYS = 14;



/** Materialise the next `HORIZON_DAYS` of turns for a room if missing. */
export async function ensureRotation(
  roomId: string,
  hostelId: string,
  tz: string,
): Promise<void> {
  const sql = await getSql();
  const members = await getRoomMembers(roomId);
  if (members.length === 0) return;

  const today = dayKey(new Date(), tz);
  const existing = await sql.query<{ scheduled_for: string }>(
    `SELECT "scheduled_for" FROM "rotation_schedules" WHERE "room_id" = ?`,
    [roomId],
  );
  const have = new Set(existing.map((r) => r.scheduled_for));

  // Continue round-robin from whoever was assigned most recently.
  const last = await sql.query<{ user_id: string }>(
    `SELECT "user_id" FROM "rotation_schedules" WHERE "room_id" = ?
      ORDER BY "scheduled_for" DESC LIMIT 1`,
    [roomId],
  );
  const lastIndex = last[0]
    ? members.findIndex((m) => m.user_id === last[0]!.user_id)
    : members.length - 1;
  let cursor = (lastIndex + 1) % members.length;

  const now = new Date().toISOString();
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    if (have.has(date)) continue;
    const assignee = members[cursor % members.length]!;
    cursor++;
    await sql
      .execute(
        `INSERT INTO "rotation_schedules"
           ("id", "room_id", "hostel_id", "scheduled_for", "user_id", "status", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, 'upcoming', ?, ?)`,
        [uuid(), roomId, hostelId, date, assignee.user_id, now, now],
      )
      // The unique index on (room_id, scheduled_for) guards races here.
      .catch(() => undefined);
  }
}

/** Upcoming turns, annotated for the current viewer. */
export async function getRotation(
  roomId: string,
  hostelId: string,
  tz: string,
  viewerId: string,
): Promise<RotationTurn[]> {
  await ensureRotation(roomId, hostelId, tz);
  const sql = await getSql();
  const today = dayKey(new Date(), tz);
  const tomorrow = addDays(today, 1);

  const rows = await sql.query<
    RotationRow & {
      full_name: string;
      display_name: string | null;
      hide: number;
      swapped_name: string | null;
    }
  >(
    `SELECT rs.*, u."full_name", u."display_name", u."privacy_show_name" AS "hide",
            sw."full_name" AS "swapped_name"
       FROM "rotation_schedules" rs
       JOIN "users" u ON u."id" = rs."user_id"
       LEFT JOIN "users" sw ON sw."id" = rs."swapped_to_user_id"
      WHERE rs."room_id" = ? AND rs."scheduled_for" >= ?
      ORDER BY rs."scheduled_for" ASC LIMIT 30`,
    [roomId, today],
  );

  return rows.map((row) => {
    const hide = !row.hide && row.user_id !== viewerId;
    const name = hide ? "A roommate" : row.display_name?.trim() || row.full_name;
    return {
      id: row.id,
      date: row.scheduled_for,
      userId: row.user_id,
      name,
      initials: hide ? "•" : initialsOfSafe(name),
      status: row.status,
      isToday: row.scheduled_for === today,
      isTomorrow: row.scheduled_for === tomorrow,
      isMe: row.user_id === viewerId,
      skipReason: row.skip_reason,
      swappedToName: row.swapped_name,
    };
  });
}

function initialsOfSafe(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ── Member actions ──────────────────────────────────────────── */

/** Mark a turn as unavailable and hand it to the next member. */
export async function skipTurn(
  roomId: string,
  hostelId: string,
  date: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const sql = await getSql();
  await sql.execute(
    `UPDATE "rotation_schedules"
        SET "status" = 'skipped', "skip_reason" = ?, "updated_at" = ?
      WHERE "room_id" = ? AND "scheduled_for" = ? AND "user_id" = ?`,
    [reason?.slice(0, 200) ?? null, new Date().toISOString(), roomId, date, userId],
  );
  await republish(roomId, hostelId, date);
}

/** Offer a turn to a specific roommate. */
export async function swapTurn(
  roomId: string,
  hostelId: string,
  date: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const sql = await getSql();
  const updated = await sql.execute(
    `UPDATE "rotation_schedules"
        SET "user_id" = ?, "swapped_to_user_id" = ?, "status" = 'swapped', "updated_at" = ?
      WHERE "room_id" = ? AND "scheduled_for" = ? AND "user_id" = ?`,
    [toUserId, fromUserId, new Date().toISOString(), roomId, date, fromUserId],
  );
  if (updated === 0) return;

  await notify({
    userId: toUserId,
    hostelId,
    roomId,
    type: "rotation_swap_request",
    title: "A roommate passed you their refill turn",
    body: `You're now on the schedule for ${date}.`,
    category: "rotation",
  });
  await republish(roomId, hostelId, date);
}

/** Volunteer to take over today's turn. */
export async function claimTurn(
  roomId: string,
  hostelId: string,
  date: string,
  userId: string,
): Promise<void> {
  const sql = await getSql();
  await sql.execute(
    `UPDATE "rotation_schedules"
        SET "user_id" = ?, "status" = 'swapped', "updated_at" = ?
      WHERE "room_id" = ? AND "scheduled_for" = ?`,
    [userId, new Date().toISOString(), roomId, date],
  );
  await republish(roomId, hostelId, date);
}

/** Called by the refill flow — closes today's turn for whoever filled. */
export async function completeRotationForActivity(
  roomId: string,
  userId: string,
  activityId: string,
): Promise<void> {
  const sql = await getSql();
  const { dayKey } = await import("@/lib/utils/time");
  const tz = await resolveRoomTimezone(roomId);
  await sql
    .execute(
      `UPDATE "rotation_schedules"
          SET "status" = 'completed', "completed_activity_id" = ?, "updated_at" = ?
        WHERE "room_id" = ? AND "scheduled_for" = ? AND "status" <> 'completed'`,
      [activityId, new Date().toISOString(), roomId, dayKey(new Date(), tz)],
    )
    .catch(() => undefined);
}

async function resolveRoomTimezone(roomId: string): Promise<string> {
  const sql = await getSql();
  const rows = await sql.query<{ timezone: string }>(
    `SELECT h."timezone" FROM "rooms" r JOIN "hostels" h ON h."id" = r."hostel_id"
      WHERE r."id" = ? LIMIT 1`,
    [roomId],
  );
  return rows[0]?.timezone ?? "Asia/Kolkata";
}

async function republish(roomId: string, hostelId: string, date: string): Promise<void> {
  await publish("rotation.updated", { hostelId, roomId }, { date });
}

/** Daily reminders for the person whose turn it is. */
export async function sendRotationReminders(): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ room_id: string; hostel_id: string; user_id: string; scheduled_for: string }>(
    `SELECT rs."room_id", rs."hostel_id", rs."user_id", rs."scheduled_for"
       FROM "rotation_schedules" rs
       JOIN "rooms" r ON r."id" = rs."room_id"
       JOIN "hostels" h ON h."id" = rs."hostel_id"
      WHERE rs."scheduled_for" IN (?, ?)
        AND rs."status" NOT IN ('completed', 'skipped')`,
    [
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    ],
  );

  let sent = 0;
  for (const row of rows) {
    const isToday = row.scheduled_for === new Date().toISOString().slice(0, 10);
    await notify({
      userId: row.user_id,
      hostelId: row.hostel_id,
      roomId: row.room_id,
      type: isToday ? "rotation_today" : "rotation_tomorrow",
      title: isToday ? "It's your refill turn today" : "Your refill turn is tomorrow",
      body: isToday
        ? "Take a photo when you fill the bottles — it takes about 10 seconds."
        : "A quick heads-up so your roommates aren't left guessing.",
      category: "rotation",
    });
    sent++;
  }
  return sent;
}

/** Reassign any turn whose assignee is no longer a member of the room. */
export async function reconcileRotation(roomId: string): Promise<void> {
  const sql = await getSql();
  await sql.execute(
    `DELETE FROM "rotation_schedules"
      WHERE "room_id" = ? AND "status" = 'upcoming'
        AND "user_id" NOT IN (SELECT "user_id" FROM "room_members" WHERE "room_id" = ?)`,
    [roomId, roomId],
  );
}
