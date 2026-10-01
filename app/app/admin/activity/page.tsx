import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/rbac";
import { listActivities } from "@/lib/repositories/activities";
import { AdminActivityTable } from "@/components/admin/admin-activity-table";

export const metadata: Metadata = { title: "Activities", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const ctx = await requireAdmin();
  if (!ctx.hostelId) return null;

  const page = await listActivities(
    { scopeHostelId: ctx.hostelId, limit: 25, sort: "newest" },
    ctx.user.id,
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Activity review
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Search, filter and review every refill recorded in your hostel.
        </p>
      </header>
      <AdminActivityTable initial={page} timezone={ctx.user.timezone} />
    </div>
  );
}