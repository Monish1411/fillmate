import { fail, ok, route } from "@/lib/http/response";
import { requireOnboarded } from "@/lib/auth/rbac";
import { listRooms } from "@/lib/repositories/rooms";
import { createRoom } from "@/lib/repositories/admin-writes";
import { createRoomSchema } from "@/lib/validation/schemas";
import { logAdminAction } from "@/lib/repositories/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireOnboarded();
  if (!ctx.hostelId) return fail("forbidden", "You are not part of a hostel yet.");
  return ok(await listRooms(ctx.hostelId));
});

export const POST = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  if (!ctx.hostelId) return fail("forbidden", "You are not part of a hostel yet.");
  const body = createRoomSchema.parse(await request.json().catch(() => null));
  const room = await createRoom({
    hostelId: ctx.hostelId,
    number: body.roomNumber,
    floor: body.floor ?? null,
    bottleTarget: body.bottleTarget,
    refillDeadlineHour: body.refillDeadlineHour,
  });
  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: ctx.hostelId,
    action: "room.created",
    targetType: "room",
    targetId: room.id,
    metadata: { number: body.roomNumber },
  });
  return ok(room, { status: 201 });
});