import "server-only";
import type { AuthContext } from "@/lib/auth/rbac";
import { notifyAdmins, notifyRoom } from "@/lib/repositories/notifications";
import { getContributionStats } from "@/lib/repositories/users";
import { publish } from "@/lib/realtime/bus";
import { completeRotationForActivity } from "./rotation";
import { maybeAwardAchievements } from "./achievements";
import type { HostelSettings } from "@/lib/repositories/hostels";
import type { AiStatus, RoomRow } from "@/types/core";
import type { RoomStatusView } from "@/types/views";

/**
 * Everything that happens *after* the activity is safely stored.
 *
 * All of it is best-effort: a notification failure must never turn a
 * successful refill into an error for the student who did the work.
 */

interface SideEffectInput {
  ctx: AuthContext;
  room: RoomRow;
  activityId: string;
  bottleCount: number;
  status: AiStatus;
  roomStatus: RoomStatusView | null;
  timezone: string;
  settings: HostelSettings;
}

export async function runPostRecordSideEffects(input: SideEffectInput): Promise<void> {
  const { ctx, room, activityId, bottleCount, status, roomStatus, settings } = input;
  const actorName = ctx.user.display_name?.trim() || ctx.user.full_name;

  await Promise.allSettled([
    announceRefill(ctx, room, activityId, bottleCount, status),
    targetReached(ctx, room, activityId, bottleCount, roomStatus),
    closeRotation(ctx, room.id, activityId),
    awardBadges(ctx, settings),
    remindAdmins(ctx, room, activityId, status, settings),
    broadcastStatus(ctx, room, roomStatus),
  ]);

  void actorName;
}

async function announceRefill(
  ctx: AuthContext,
  room: RoomRow,
  activityId: string,
  bottleCount: number,
  status: AiStatus,
): Promise<void> {
  if (!ctx.hostelId) return;
  await notifyRoom(
    room.id,
    ctx.hostelId,
    {
      type: "refill_recorded",
      title: `${bottleCount} bottle${bottleCount === 1 ? "" : "s"} filled`,
      body:
        status === "verified"
          ? "Photo verified automatically."
          : "Saved — an administrator will confirm the photo.",
      activityId,
      category: "refills",
    },
    { excludeUserId: ctx.user.id },
  );
}

async function targetReached(
  ctx: AuthContext,
  room: RoomRow,
  activityId: string,
  bottleCount: number,
  roomStatus: RoomStatusView | null,
): Promise<void> {
  if (!ctx.hostelId || !roomStatus) return;
  if (roomStatus.status !== "full") return;

  // Only celebrate when the target is crossed by this very submission.
  const previous = roomStatus.filled - bottleCount;
  if (previous >= roomStatus.target) return;

  await notifyRoom(room.id, ctx.hostelId, {
    type: "target_reached",
    title: `Room ${room.number} reached today's target`,
    body: `${roomStatus.filled} bottles logged. Nothing else needed today.`,
    activityId,
    category: "refills",
  });

  void publish("room.status", { hostelId: ctx.hostelId, roomId: room.id }, {
    status: roomStatus.status,
    filled: roomStatus.filled,
    target: roomStatus.target,
  });
}

async function closeRotation(
  ctx: AuthContext,
  roomId: string,
  activityId: string,
): Promise<void> {
  await completeRotationForActivity(roomId, ctx.user.id, activityId);
}

async function awardBadges(ctx: AuthContext, settings: HostelSettings): Promise<void> {
  const stats = await getContributionStats(ctx.user.id, ctx.user.timezone);
  const earned = await maybeAwardAchievements(
    ctx.user.id,
    ctx.hostelId,
    { fills: stats.fills, bottles: stats.bottles, streak: stats.streak },
    { enabled: settings.gamification },
  );
  if (earned.length > 0) {
    await publish(
      "notification",
      { hostelId: ctx.hostelId, roomId: ctx.roomId, userId: ctx.user.id },
      { reason: "achievement", keys: earned.map((a) => a.key) },
    );
  }
}

async function remindAdmins(
  ctx: AuthContext,
  room: RoomRow,
  activityId: string,
  status: AiStatus,
  settings: HostelSettings,
): Promise<void> {
  if (!ctx.hostelId) return;
  if (status === "verified" && settings.leaderboard) return;
  if (status === "unavailable" && !settings.ai_verification) return;

  await notifyAdmins(ctx.hostelId, {
    type: "activity_flagged",
    title: `Activity needs review · Room ${room.number}`,
    body:
      status === "unavailable"
        ? "Verification was unavailable, so this refill is waiting on you."
        : "The photo could not be verified automatically.",
    activityId,
    roomId: room.id,
    category: "reviews",
  });
}

async function broadcastStatus(
  ctx: AuthContext,
  room: RoomRow,
  roomStatus: RoomStatusView | null,
): Promise<void> {
  if (!ctx.hostelId || !roomStatus) return;
  await publish("room.status", { hostelId: ctx.hostelId, roomId: room.id }, {
    status: roomStatus.status,
    filled: roomStatus.filled,
    target: roomStatus.target,
    percent: roomStatus.percent,
    remaining: roomStatus.remaining,
  });
}

/** Members with no activity today — used by the gentle daily digest. */
export async function findInactiveMembers(roomId: string, tz: string): Promise<string[]> {
  const { getRoomMembers } = await import("@/lib/repositories/members");
  const { getSql } = await import("@/lib/db/client");
  const { startOfTodayIso } = await import("@/lib/utils/time");

  const members = await getRoomMembers(roomId);
  if (members.length === 0) return [];

  const sql = await getSql();
  const rows = await sql.query<{ user_id: string }>(
    `SELECT DISTINCT "user_id" FROM "water_activities"
      WHERE "room_id" = ? AND "server_timestamp" >= ? AND "deleted_at" IS NULL`,
    [roomId, startOfTodayIso(tz)],
  );
  const active = new Set(rows.map((r) => r.user_id));
  return members.filter((m) => !active.has(m.user_id)).map((m) => m.user_id);
}