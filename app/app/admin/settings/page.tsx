import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/rbac";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { providerStatus } from "@/lib/ai";
import { HostelSettingsForm } from "@/components/admin/hostel-settings-form";

export const metadata: Metadata = { title: "Hostel settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const ctx = await requireAdmin();
  if (!ctx.hostelId) return null;
  const settings = await getHostelSettings(ctx.hostelId);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Hostel settings
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Feature flags and data policy for {ctx.hostelName}.
        </p>
      </header>
      <HostelSettingsForm initial={settings} ai={providerStatus()} />
    </div>
  );
}