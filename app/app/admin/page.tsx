import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/rbac";
import { getHostel } from "@/lib/repositories/hostels";
import {
  getContributionBars,
  getDailySeries,
  getHourHistogram,
  getMetrics,
  getRoomBreakdown,
  getVerificationMix,
  resolveRange,
} from "@/lib/repositories/analytics";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import type { AdminAnalyticsResponse } from "@/types/api";

export const metadata: Metadata = { title: "Admin analytics", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await requireAdmin();
  const hostelId = ctx.hostelId;
  if (!hostelId) redirect("/app");

  const hostel = await getHostel(hostelId);
  const tz = hostel?.timezone ?? "Asia/Kolkata";
  const range = resolveRange("7d", tz);

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
  const totalActivities =
    verification.verified +
    verification.needsReview +
    verification.rejected +
    verification.unavailable;

  const initial: AdminAnalyticsResponse = {
    range: { from: range.fromIso, to: range.toIso, label: range.label },
    metrics,
    series,
    hours,
    contribution,
    verification,
    rooms,
    flaggedRate:
      totalActivities > 0
        ? Math.round(((verification.needsReview + verification.rejected) / totalActivities) * 100)
        : 0,
    busiestHour: hours[busiest] && hours[busiest]!.count > 0 ? busiest : null,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          {hostel?.name ?? "Hostel"} analytics
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Participation, verification and flagged activity.
        </p>
      </header>
      <AdminAnalytics initial={initial} exportHref="/api/admin/export?limit=500" />
    </div>
  );
}