import { fail, ok, route } from "@/lib/http/response";
import { requireAdmin, assertHostelScope } from "@/lib/auth/rbac";
import { analyticsRangeSchema } from "@/lib/validation/schemas";
import {
  getContributionBars,
  getDailySeries,
  getHourHistogram,
  getMetrics,
  getRoomBreakdown,
  getVerificationMix,
  resolveRange,
} from "@/lib/repositories/analytics";
import type { AdminAnalyticsResponse } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const url = new URL(request.url);
  const parsed = analyticsRangeSchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  );

  const hostelId = ctx.user.role === "super_admin" ? (url.searchParams.get("hostelId") ?? ctx.hostelId) : ctx.hostelId;
  if (!hostelId) return fail("forbidden", "No hostel selected.");
  assertHostelScope(ctx, hostelId);

  const { getHostel } = await import("@/lib/repositories/hostels");
  const hostel = await getHostel(hostelId);
  const tz = hostel?.timezone ?? "Asia/Kolkata";
  const range = resolveRange(parsed.range, tz, { from: parsed.from, to: parsed.to });

  const [metrics, series, hours, contribution, verification, rooms] = await Promise.all([
    getMetrics(hostelId, range, tz),
    getDailySeries(hostelId, range, tz),
    getHourHistogram(hostelId, range, tz),
    getContributionBars(hostelId, range, ctx.user.id),
    getVerificationMix(hostelId, range),
    getRoomBreakdown(hostelId, range),
  ]);

  const busiest = hours.reduce(
    (best, h) => (h.count > (hours[best]?.count ?? -1) ? h.hour : best),
    0,
  );
  const totalActivities = verification.verified + verification.needsReview + verification.rejected + verification.unavailable;

  const response: AdminAnalyticsResponse = {
    range: { from: range.fromIso, to: range.toIso, label: range.label },
    metrics,
    series,
    hours,
    contribution,
    verification,
    rooms,
    flaggedRate:
      totalActivities > 0
        ? Math.round(
            ((verification.needsReview + verification.rejected) / totalActivities) * 100,
          )
        : 0,
    busiestHour: hours[busiest] && hours[busiest]!.count > 0 ? busiest : null,
  };

  return ok(response);
});