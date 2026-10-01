import { fail, ok, route } from "@/lib/http/response";
import { requireAuth, AuthError } from "@/lib/auth/rbac";
import { headers } from "next/headers";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { reportSchema } from "@/lib/validation/schemas";
import { createReport } from "@/lib/repositories/reports";
import { assertActivityAccess } from "@/lib/auth/rbac";
import { notifyAdmins } from "@/lib/repositories/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_COPY: Record<string, string> = {
  not_them: "This refill looks like it belongs to someone else",
  wrong_bottle_count: "The bottle count looks wrong",
  wrong_time: "The time looks wrong",
  unrelated_photo: "The photo looks unrelated",
  other: "Something else",
};

export const POST = route(async (request: Request) => {
  const ctx = await requireAuth();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`report:${ctx.user.id}:${ip}`, LIMITS.write).allowed) {
    return fail("rate_limited", "Too many reports. Try again shortly.");
  }

  const body = reportSchema.parse(await request.json().catch(() => null));
  const activity = await assertActivityAccess(ctx, body.activityId);
  if (activity.user_id === ctx.user.id) {
    throw new AuthError("validation_error", "You can't report your own refill.");
  }

  const report = await createReport({
    reporterUserId: ctx.user.id,
    activityId: body.activityId,
    roomId: activity.room_id,
    hostelId: activity.hostel_id,
    reason: body.reason,
    details: body.details ?? null,
  });

  await notifyAdmins(activity.hostel_id, {
    type: "report_filed",
    title: "A roommate reported an activity",
    body: REASON_COPY[body.reason] ?? "A roommate flagged a refill for review.",
    activityId: body.activityId,
    roomId: activity.room_id,
    category: "reviews",
  });

  return ok({ id: report.id, status: report.status }, { status: 201 });
});