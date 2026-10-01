import { fail, ok, route } from "@/lib/http/response";
import { requireOnboarded } from "@/lib/auth/rbac";
import { getRotation, skipTurn, swapTurn, claimTurn } from "@/lib/services/rotation";
import { rotationSwapSchema } from "@/lib/validation/schemas";
import { getRoomMembers } from "@/lib/repositories/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireOnboarded();
  if (!ctx.roomId || !ctx.hostelId) return ok([]);
  return ok(await getRotation(ctx.roomId, ctx.hostelId, ctx.user.timezone, ctx.user.id));
});

export const POST = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  if (!ctx.roomId || !ctx.hostelId) {
    return fail("forbidden", "Join a room before managing the rotation.");
  }
  const body = rotationSwapSchema.parse(await request.json().catch(() => null));

  if (body.action === "skip") {
    await skipTurn(ctx.roomId, ctx.hostelId, body.date, ctx.user.id, body.reason);
  } else if (body.action === "swap") {
    if (!body.targetUserId) return fail("validation_error", "Pick a roommate to swap with.");
    const members = await getRoomMembers(ctx.roomId);
    if (!members.some((m) => m.user_id === body.targetUserId)) {
      return fail("forbidden", "That person isn't in your room.");
    }
    await swapTurn(ctx.roomId, ctx.hostelId, body.date, ctx.user.id, body.targetUserId);
  } else {
    await claimTurn(ctx.roomId, ctx.hostelId, body.date, ctx.user.id);
  }

  const rotation = await getRotation(ctx.roomId, ctx.hostelId, ctx.user.timezone, ctx.user.id);
  return ok(rotation);
});