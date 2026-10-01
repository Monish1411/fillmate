import Link from "next/link";
import { ArrowRight, Flame, TrendingUp, Users } from "lucide-react";
import { getAuthContext } from "@/lib/auth/rbac";
import { getDashboard } from "@/lib/services/dashboard";
import { WaterStatusCard } from "@/components/app/water-status-card";
import { ActivityFeed } from "@/components/app/activity-feed";
import { StatTile } from "@/components/app/stat-tile";
import { RotationCard } from "@/components/app/rotation-card";
import { ContributionList } from "@/components/app/contribution-list";
import { Card, CardContent, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/primitives";
import { firstName } from "@/lib/utils/format";
import { formatDayLabel, greeting } from "@/lib/utils/time";
import type { DashboardData } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const data = await getDashboard(ctx);
  return <Dashboard data={data} timezone={ctx.user.timezone} name={firstName(ctx.user.display_name ?? ctx.user.full_name)} />;
}

function Dashboard({
  data,
  timezone,
  name,
}: {
  data: DashboardData;
  timezone: string;
  name: string;
}) {
  const today = formatDayLabel(new Date(), timezone);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink sm:text-[26px]">
          {greeting()}, {name}
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          {data.roomStatus
            ? `Room ${data.roomStatus.roomNumber} · ${data.roomStatus.hostelName} · ${today}`
            : "Here's your hostel's water activity."}
        </p>
      </header>

      {data.roomStatus ? (
        <WaterStatusCard status={data.roomStatus} timezone={timezone} />
      ) : (
        <Skeleton className="h-56 w-full rounded-xl" />
      )}

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Your fills"
            value={data.stats.fills}
            icon={<TrendingUp />}
            hint={`${data.stats.weekFills} this week`}
          />
          <StatTile
            label="Bottles"
            value={data.stats.bottles}
            tone="accent"
            icon={<DropletIcon />}
            hint={`${data.stats.avgPerDay}/day average`}
          />
          <StatTile
            label="Streak"
            value={data.stats.streak}
            unit={data.stats.streak === 1 ? "day" : "days"}
            icon={<Flame />}
            tone="warning"
            hint={data.stats.streak > 0 ? "Keep it going" : "Start one today"}
          />
          <StatTile
            label="Room today"
            value={data.roomSummary.fillsToday}
            unit="active"
            icon={<Users />}
            hint={`${data.roomSummary.totalMembers} members`}
          />
        </div>
      </section>

      {data.rotation.length > 0 && data.features.rotation ? (
        <RotationCard turns={data.rotation} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHeading
            title="Room activity"
            description="Live updates as they happen"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/activity">
                  See all
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
          <Card>
            {data.recentActivity.length > 0 ? (
              <ActivityFeed activities={data.recentActivity} timezone={timezone} />
            ) : (
              <CardContent>
                <EmptyState
                  compact
                  icon={<DropletIcon />}
                  title="No refills yet."
                  description="Be the first person to keep the room's bottles full."
                />
              </CardContent>
            )}
          </Card>
        </section>

        <section className="lg:col-span-2">
          <SectionHeading
            title="Room contributions"
            description="Neutral activity stats"
            action={
              data.features.leaderboard ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/contributions">
                    All
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
                ) : null
            }
          />
          <Card>
            {data.contributions.length > 0 ? (
              <ContributionList members={data.contributions} />
            ) : (
              <CardContent>
                <EmptyState
                  compact
                  title="Invite your roommates"
                  description="Contributions appear once your room has members."
                />
              </CardContent>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function DropletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5">
      <path d="M12 3.5s5.5 6 5.5 9.7a5.5 5.5 0 1 1-11 0C6.5 9.5 12 3.5 12 3.5Z" strokeLinejoin="round" />
    </svg>
  );
}