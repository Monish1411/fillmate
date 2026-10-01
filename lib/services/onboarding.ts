import "server-only";
import { AuthError, type AuthContext } from "@/lib/auth/rbac";
import { getSql } from "@/lib/db/client";
import { clientTimezone } from "@/lib/utils/time";
import { findHostelByCode, findHostelByName, listPublicHostels } from "@/lib/repositories/hostels";
import { addRoomMember, getMembership } from "@/lib/repositories/members";
import { findRoomByNumber, getRoom } from "@/lib/repositories/rooms";
import { createRoom } from "@/lib/repositories/admin-writes";
import { createInvite } from "@/lib/repositories/invites";
import { notify } from "@/lib/repositories/notifications";
import { reconcileRotation } from "./rotation";
import { onboardingSchema } from "@/lib/validation/schemas";

/**
 * Onboarding.
 *
 * A student may only ever join a room inside the hostel they are already
 * scoped to. Rooms are never silently created for a *different* hostel, and
 * creating a room requires either an invite or hostel-admin rights.
 */

export interface OnboardingState {
  step: number;
  hostelId: string | null;
  roomId: string | null;
  roomNumber: string | null;
  onboarded: boolean;
}

export async function getOnboardingState(ctx: AuthContext): Promise<OnboardingState> {
  return {
    step: ctx.user.onboarding_step ?? 0,
    hostelId: ctx.hostelId,
    roomId: ctx.roomId,
    roomNumber: ctx.roomNumber,
    onboarded: Boolean(ctx.user.onboarded) && Boolean(ctx.roomId),
  };
}

export async function listSelectableHostels(): Promise<
  Array<{ id: string; name: string; code: string; city: string | null; timezone: string }>
> {
  const hostels = await listPublicHostels();
  return hostels.map((h) => ({
    id: h.id,
    name: h.name,
    code: h.code,
    city: h.city,
    timezone: h.timezone,
  }));
}

/** Resolve (or create) the hostel for this user during onboarding. */
export async function selectHostel(
  ctx: AuthContext,
  input: { hostelId?: string; hostelCode?: string; hostelName?: string },
): Promise<{ hostelId: string; created: boolean }> {
  const parsed = onboardingSchema.parse({ step: "hostel", ...input });

  let hostel = null;
  if (parsed.hostelId) {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `SELECT "id" FROM "hostels" WHERE "id" = ? LIMIT 1`,
      [parsed.hostelId],
    );
    if (!rows[0]) throw new AuthError("not_found", "That hostel doesn't exist yet.");
    hostel = { id: rows[0].id };
  } else if (parsed.hostelCode) {
    hostel = await findHostelByCode(parsed.hostelCode);
  } else if (parsed.hostelName) {
    hostel = await findHostelByName(parsed.hostelName);
  }

  let created = false;
  if (!hostel) {
    if (!parsed.hostelName) {
      throw new AuthError("validation_error", "Pick your hostel from the list.");
    }
    const code = await uniqueCode(parsed.hostelName);
    const row = await createHostelSafe(parsed.hostelName, code);
    hostel = { id: row.id };
    created = true;
  }

  const sql = await getSql();
  await sql.execute(
    `UPDATE "users" SET "hostel_id" = ?, "timezone" = ?, "onboarding_step" = 2, "updated_at" = ?
      WHERE "id" = ?`,
    [hostel!.id, ctx.user.timezone || clientTimezone(), new Date().toISOString(), ctx.user.id],
  );

  return { hostelId: hostel!.id, created };
}

async function createHostelSafe(name: string, code: string) {
  const { createHostel } = await import("@/lib/repositories/admin-writes");
  return createHostel({ name, code, organizationName: name });
}

async function uniqueCode(name: string): Promise<string> {
  const base =
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "HOSTEL";
  const sql = await getSql();
  for (const suffix of ["", "2", "3", "4", "5"]) {
    const code = `${base}${suffix}`.slice(0, 16);
    const exists = await sql.query<{ id: string }>(
      `SELECT "id" FROM "hostels" WHERE "code" = ? LIMIT 1`,
      [code],
    );
    if (!exists[0]) return code;
  }
  return base + Math.floor(Math.random() * 900 + 100);
}

/** Join an existing room, or create one if the user is entitled to. */
export async function selectRoom(
  ctx: AuthContext,
  input: { roomNumber: string; bottleTarget?: number; floor?: string },
): Promise<{ roomId: string; roomNumber: string; created: boolean }> {
  const parsed = onboardingSchema.parse({ step: "room", ...input });
  if (!ctx.hostelId) throw new AuthError("forbidden", "Select your hostel first.");

  let room = await findRoomByNumber(ctx.hostelId, parsed.roomNumber!);
  let created = false;

  if (!room) {
    const target = parsed.bottleTarget ?? 4;
    room = await createRoom({
      hostelId: ctx.hostelId,
      number: parsed.roomNumber!,
      floor: parsed.floor ?? null,
      bottleTarget: target,
    });
    await createInvite({
      roomId: room.id,
      hostelId: ctx.hostelId,
      createdBy: ctx.user.id,
      maxUses: 12,
    });
    created = true;
  }

  const membership = await getMembership(room.id, ctx.user.id);
  if (!membership) {
    await addRoomMember(room.id, ctx.hostelId, ctx.user.id);
  }

  await reconcileRotation(room.id);

  const sql = await getSql();
  await sql.execute(
    `UPDATE "users" SET "onboarding_step" = 4, "updated_at" = ? WHERE "id" = ?`,
    [new Date().toISOString(), ctx.user.id],
  );

  return { roomId: room.id, roomNumber: room.number, created };
}

/** Final step — mark onboarding complete and generate the first rotation. */
export async function completeOnboarding(ctx: AuthContext): Promise<void> {
  if (!ctx.hostelId || !ctx.roomId) {
    throw new AuthError("forbidden", "Finish selecting your hostel and room first.");
  }
  const sql = await getSql();
  await sql.execute(
    `UPDATE "users" SET "onboarding_step" = 5, "onboarded" = 1, "updated_at" = ? WHERE "id" = ?`,
    [new Date().toISOString(), ctx.user.id],
  );
  const room = await getRoom(ctx.roomId);
  if (room) {
    const { ensureRotation } = await import("./rotation");
    await ensureRotation(room.id, ctx.hostelId, ctx.user.timezone);
  }
  await notify({
    userId: ctx.user.id,
    hostelId: ctx.hostelId,
    roomId: ctx.roomId,
    type: "welcome",
    title: "Welcome to FillMate",
    body: "Let's keep the bottles full.",
  });
}

export async function joinViaInvite(
  ctx: AuthContext,
  inviteId: string,
  consume: () => Promise<boolean>,
): Promise<{ roomId: string; roomNumber: string; hostelId: string }> {
  const sql = await getSql();
  const rows = await sql.query<{ room_id: string; hostel_id: string }>(
    `SELECT "room_id", "hostel_id" FROM "invites" WHERE "id" = ? AND revoked = 0 LIMIT 1`,
    [inviteId],
  );
  const invite = rows[0];
  if (!invite) throw new AuthError("not_found", "This invite is no longer valid.");

  if (!(await consume())) {
    throw new AuthError("conflict", "This invite has already been used.");
  }

  const room = await getRoom(invite.room_id);
  if (!room) throw new AuthError("not_found", "That room no longer exists.");

  await sql.execute(`UPDATE "users" SET "hostel_id" = ?, "updated_at" = ? WHERE "id" = ?`, [
    invite.hostel_id,
    new Date().toISOString(),
    ctx.user.id,
  ]);
  await addRoomMember(room.id, invite.hostel_id, ctx.user.id);

  return { roomId: room.id, roomNumber: room.number, hostelId: invite.hostel_id };
}