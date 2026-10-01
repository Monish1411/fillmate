import { fail, ok, route } from "@/lib/http/response";
import { requireOnboarded, isAdmin } from "@/lib/auth/rbac";
import { activityQuerySchema } from "@/lib/validation/schemas";
import { listActivities } from "@/lib/repositories/activities";
import { recordRefill } from "@/lib/services/record";
import { getSql } from "@/lib/db/client";
import type { CreateActivityRequest } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — scoped, filterable activity feed. */
export const GET = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  const url = new URL(request.url);
  const parsed = activityQuerySchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  );

  // Students only ever see rooms they belong to.
  const sql = await getSql();
  const allowedRoomIds = isAdmin(ctx.user)
    ? null
    : (
        await sql.query<{ room_id: string }>(
          `SELECT "room_id" FROM "room_members" WHERE "user_id" = ?`,
          [ctx.user.id],
        )
      ).map((r) => r.room_id);

  const requestedHostel = parsed.hostelId;
  if (requestedHostel && ctx.user.role !== "super_admin" && requestedHostel !== ctx.hostelId) {
    return fail("forbidden", "You don't have access to this hostel.");
  }

  const page = await listActivities(
    {
      ...parsed,
      scopeHostelId: ctx.user.role === "super_admin" && requestedHostel
        ? requestedHostel
        : (ctx.hostelId!),
      allowedRoomIds,
    },
    ctx.user.id,
  );

  return ok(page);
});

/** POST — record a refill. The core write path of the product. */
export const POST = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  const body = (await request.json().catch(() => null)) as CreateActivityRequest | null;
  if (!body) return fail("validation_error", "We couldn't read that request.");

  const result = await recordRefill(body, ctx);
  return ok(result, { status: 201 });
});