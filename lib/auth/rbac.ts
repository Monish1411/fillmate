import "server-only";
import { getSql } from "@/lib/db/client";
import type { UserRow } from "@/types/core";
import type { SessionUser } from "@/types/views";
import { initialsOf } from "@/lib/utils/format";
import { getAuthContext, type AuthContext } from "./session";

/**
 * Authorization guards.
 *
 * Every protected route resolves through these helpers so hostel isolation is
 * enforced in exactly one place. A student can never reach another hostel's
 * data, and can never approve their own flagged activity.
 */

export class AuthError extends Error {
  constructor(
    readonly code:
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "validation_error"
      | "rate_limited",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("unauthorized", "You need to sign in to continue.");
  return ctx;
}

export async function requireOnboarded(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.user.onboarded || !ctx.roomId) {
    throw new AuthError("forbidden", "Finish setting up your room first.");
  }
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.user.role !== "hostel_admin" && ctx.user.role !== "super_admin") {
    throw new AuthError("forbidden", "This area is for hostel administrators.");
  }
  return ctx;
}

export async function requireSuperAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.user.role !== "super_admin") {
    throw new AuthError("forbidden", "Super admin access required.");
  }
  return ctx;
}

export function isAdmin(user: Pick<UserRow, "role">): boolean {
  return user.role === "hostel_admin" || user.role === "super_admin";
}

export function isSuperAdmin(user: Pick<UserRow, "role">): boolean {
  return user.role === "super_admin";
}

/**
 * Assert the acting user may operate within `hostelId`.
 * Super admins may target any hostel; everyone else is pinned to their own.
 */
export function assertHostelScope(ctx: AuthContext, hostelId: string | null): void {
  if (ctx.user.role === "super_admin") return;
  if (!hostelId || ctx.hostelId !== hostelId) {
    throw new AuthError("forbidden", "You don't have access to this hostel.");
  }
}

/** Assert the acting user belongs to `roomId` (or admins its hostel). */
export async function assertRoomAccess(
  ctx: AuthContext,
  roomId: string,
): Promise<{ hostelId: string; memberUserIds: string[] }> {
  const sql = await getSql();
  const room = await sql.query<{ id: string; hostel_id: string }>(
    `SELECT "id", "hostel_id" FROM "rooms" WHERE "id" = ? AND "active" = 1 LIMIT 1`,
    [roomId],
  );
  const found = room[0];
  if (!found) throw new AuthError("not_found", "That room no longer exists.");

  if (ctx.user.role !== "super_admin" && ctx.hostelId !== found.hostel_id) {
    throw new AuthError("forbidden", "You don't have access to this room.");
  }

  const members = await sql.query<{ user_id: string }>(
    `SELECT "user_id" FROM "room_members" WHERE "room_id" = ?`,
    [roomId],
  );
  const memberUserIds = members.map((m) => m.user_id);

  if (!isAdmin(ctx.user) && !memberUserIds.includes(ctx.user.id)) {
    throw new AuthError("forbidden", "You are not a member of this room.");
  }

  return { hostelId: found.hostel_id, memberUserIds };
}
/**
 * Load an activity and guarantee the caller can see it.
 * Cross-hostel access returns a not-found so we never leak the existence of
 * another hostel's records.
 */
export async function assertActivityAccess(
  ctx: AuthContext,
  activityId: string,
): Promise<{
  id: string;
  user_id: string;
  hostel_id: string;
  room_id: string;
  status: string;
  review_status: string;
}> {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    user_id: string;
    hostel_id: string;
    room_id: string;
    status: string;
    review_status: string;
  }>(
    `SELECT * FROM "water_activities" WHERE "id" = ? AND "deleted_at" IS NULL LIMIT 1`,
    [activityId],
  );
  const activity = rows[0];
  if (!activity) throw new AuthError("not_found", "That activity could not be found.");

  if (ctx.user.role !== "super_admin" && ctx.hostelId !== activity.hostel_id) {
    throw new AuthError("not_found", "That activity could not be found.");
  }
  return activity;
}

/** An admin may never review their own submission (separation of duties). */
export function assertNotSelfReview(ctx: AuthContext, activityUserId: string): void {
  if (ctx.user.id === activityUserId) {
    throw new AuthError(
      "forbidden",
      "You can't review your own activity. Ask another administrator.",
    );
  }
}

/* ── Session projection for the client ───────────────────────── */

export function toSessionUser(ctx: AuthContext): SessionUser {
  const displayName =
    ctx.user.display_name?.trim() ||
    ctx.user.full_name.trim() ||
    ctx.user.email.split("@")[0]!;
  return {
    id: ctx.user.id,
    email: ctx.user.email,
    fullName: ctx.user.full_name,
    displayName,
    initials: initialsOf(displayName),
    role: ctx.user.role,
    hostelId: ctx.hostelId,
    hostelName: ctx.hostelName,
    roomId: ctx.roomId,
    roomNumber: ctx.roomNumber,
    onboarded: Boolean(ctx.user.onboarded) && Boolean(ctx.roomId),
    avatarUrl: ctx.user.avatar_url,
    theme: ctx.user.theme,
    timezone: ctx.user.timezone,
    preferences: {
      notifyRefills: Boolean(ctx.user.notify_refills),
      notifyRotation: Boolean(ctx.user.notify_rotation),
      notifyReviews: Boolean(ctx.user.notify_reviews),
      notifyWeekly: Boolean(ctx.user.notify_weekly),
      privacyShowContributions: Boolean(ctx.user.privacy_show_contributions),
      privacyShowActivity: Boolean(ctx.user.privacy_show_activity),
      privacyShowName: Boolean(ctx.user.privacy_show_name),
    },
  };
}
export { getAuthContext };
export type { AuthContext };
