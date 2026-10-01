import { fail, ok, route } from "@/lib/http/response";
import { requireAdmin, assertHostelScope, assertRoomAccess } from "@/lib/auth/rbac";
import { listHostelUsers, findUserByEmail } from "@/lib/repositories/users";
import { setUserRole } from "@/lib/repositories/admin-writes";
import { removeRoomMember } from "@/lib/repositories/members";
import { reconcileRotation } from "@/lib/services/rotation";
import { logAdminAction } from "@/lib/repositories/reports";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const url = new URL(request.url);
  const hostelId = url.searchParams.get("hostelId") ?? ctx.hostelId;
  if (!hostelId) return fail("forbidden", "No hostel selected.");
  assertHostelScope(ctx, hostelId);

  const users = await listHostelUsers(hostelId, {
    search: url.searchParams.get("search") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
  });

  return ok(
    users.map((u) => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      roomNumber: u.room_number,
      roomId: u.room_id,
      fills: Number(u.fills ?? 0),
      bottles: Number(u.bottles ?? 0),
      lastActivityAt: u.last_activity_at,
      lastSeenAt: u.last_seen_at,
    })),
  );
});

const roleSchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "hostel_admin"]).default("student"),
});

export const PUT = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const body = roleSchema.parse(await request.json().catch(() => null));

  const user = await findUserByEmail(body.email);
  if (!user) return fail("not_found", "No account with that email.");
  if (user.id === ctx.user.id) {
    return fail("forbidden", "You can't change your own role.");
  }
  assertHostelScope(ctx, user.hostel_id);

  await setUserRole(user.id, body.role);
  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: user.hostel_id,
    action: "user.role_changed",
    targetType: "user",
    targetId: user.id,
    metadata: { role: body.role },
  });
  return ok({ role: body.role });
});

export const DELETE = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const roomId = url.searchParams.get("roomId");
  if (!userId || !roomId) return fail("validation_error", "Missing user or room.");

  const { hostelId } = await assertRoomAccess(ctx, roomId);
  const removed = await removeRoomMember(roomId, userId);
  if (removed) {
    await reconcileRotation(roomId);
    await logAdminAction({
      actorUserId: ctx.user.id,
      actorName: ctx.user.full_name,
      hostelId,
      action: "member.removed",
      targetType: "user",
      targetId: userId,
      metadata: { roomId },
    });
  }
  return ok({ removed });
});