import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/rbac";
import { getRoomContributions, getRoomMembers } from "@/lib/repositories/members";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { ContributionList } from "@/components/app/contribution-list";
import { StatTile } from "@/components/app/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Trophy } from "lucide-react";
import { startOfTodayIso } from "@/lib/utils/time";

export const metadata: Metadata = { title: "Contributions", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const ctx = await getAuthContext();
  if (!ctx?.roomId || !ctx.hostelId) return null;

  const settings = await getHostelSettings(ctx.hostelId);
  if (!settings.leaderboard) {
    return (
      <div className="space-y-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Room contributions
        </h1>
        <EmptyState
          icon={<Trophy />}
          title="Contributions are turned off"
          description="Your hostel admin has disabled the contribution board for this room."
        />
      </div>
    );
  }

  const monthStart = startOfTodayIso(ctx.user.timezone);
  const [members, contributions] = await Promise.all([
    getRoomMembers(ctx.roomId),
    getRoomContributions(ctx.roomId, ctx.user.id, monthStart),
  ]);

  const visible = contributions.filter((c) => !c.hidden);
  const totalBottles = visible.reduce((sum, c) => sum + c.bottles, 0);
  const activeCount = visible.filter((c) => c.fills > 0).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Room contributions
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Refills recorded by your room in the last 30 days. Facts, not scores.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Bottles" value={totalBottles} tone="accent" />
        <StatTile label="Refills" value={visible.reduce((s, c) => s + c.fills, 0)} />
        <StatTile label="Active" value={activeCount} unit={`/ ${members.length}`} />
        <StatTile label="Hidden" value={contributions.filter((c) => c.hidden).length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ContributionList members={contributions} />
        </CardContent>
      </Card>

      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        FillMate records what happened, not who is at fault. Members can hide
        their numbers in settings at any time &mdash; a private entry still shows
        in the list, just without numbers.
      </p>
    </div>
  );
}