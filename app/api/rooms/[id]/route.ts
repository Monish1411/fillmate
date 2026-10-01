import { ok, route } from "@/lib/http/response";
import { requireAuth, assertRoomAccess } from "@/lib/auth/rbac";
import { getRoom, getRoomStatus, getRoomTotals } from "@/lib/repositories/rooms";
import { getRoomContributions, getRoomMembers } from "@/lib/repositories/members";
import { getHostelSettings } from "@/lib/repositories/hostels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const ctx = await requireAuth();
    const { id } = await context.params;
    const { hostelId } = await assertRoomAccess(ctx, id);

    const room = await getRoom(id);
    if (!room) return ok(null);

    const [status, members, contributions, totals, settings] = await Promise.all([
      getRoomStatus(id, ctx.user.timezone),
      getRoomMembers(id),
      getRoomContributions(id, ctx.user.id),
      getRoomTotals(id),
      getHostelSettings(hostelId),
    ]);

    return ok({ room, status, members, contributions, totals, settings });
  },
);