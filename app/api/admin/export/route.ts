import { ok, route } from "@/lib/http/response";
import { requireAdmin, assertHostelScope } from "@/lib/auth/rbac";
import { getSql } from "@/lib/db/client";
import { activityQuerySchema } from "@/lib/validation/schemas";
import { listActivities } from "@/lib/repositories/activities";
import { formatFullTimestamp } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** GET - CSV export of activity records for the admin's own hostel. */
export const GET = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const url = new URL(request.url);
  const parsed = activityQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

  const hostelId = ctx.hostelId;
  if (!hostelId) return ok("");
  assertHostelScope(ctx, hostelId);

  const tz = ctx.user.timezone;
  const page = await listActivities(
    { ...parsed, scopeHostelId: hostelId, limit: parsed.limit ?? 500 },
    ctx.user.id,
  );

  const header = [
    "Activity ID",
    "Student",
    "Email",
    "Room",
    "Bottles",
    "Submitted at",
    "Timezone",
    "Verification",
    "Confidence",
    "Cooler detected",
    "Bottles detected",
    "Duplicate suspected",
    "Review status",
    "Location",
    "QR scanned",
    "Cooler",
  ];

  const rows = page.items.map((a) => [
    a.id,
    a.actorName,
    a.isMine ? ctx.user.email : "",
    a.roomNumber,
    a.bottleCount,
    formatFullTimestamp(a.serverTimestamp, tz),
    a.timezone,
    a.status,
    a.confidence === null ? "" : `${Math.round(a.confidence * 100)}%`,
    a.coolerDetected === null ? "" : a.coolerDetected ? "yes" : "no",
    a.bottlesDetected ?? "",
    a.duplicateSuspected ? "yes" : "no",
    a.reviewStatus,
    a.locationStatus === "unavailable" ? "unavailable" : `${Math.round(a.distanceMeters ?? 0)}m`,
    a.qrScanned ? "yes" : "no",
    a.coolerLabel ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  void getSql();

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fillmate-activities-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});