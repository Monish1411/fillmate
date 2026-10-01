import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/rbac";
import { listActivities } from "@/lib/repositories/activities";
import { ActivityFeedIsland } from "@/components/app/activity-feed-island";
import { Card, CardContent, SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Droplets } from "lucide-react";

export const metadata: Metadata = { title: "Activity", robots: { index: false } };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const ctx = await getAuthContext();
  const params = await searchParams;
  const tz = ctx?.user.timezone;

  if (!ctx || !ctx.roomId || !ctx.hostelId || !tz) return null;

  const before = params.before ?? new Date().toISOString();
  const page = await listActivities(
    { scopeHostelId: ctx.hostelId, roomId: ctx.roomId, limit: 40, sort: "newest", to: before },
    ctx.user.id,
  );

  const nextBefore = page.items.at(-1)?.serverTimestamp;
  const hasMore = page.total > page.items.length && Boolean(nextBefore);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">Activity</h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Room {ctx.roomNumber} · {page.total} recorded {page.total === 1 ? "refill" : "refills"}
        </p>
      </header>

      <Card>
        {page.items.length > 0 ? (
          <ActivityFeedIsland activities={page.items} timezone={tz} />
        ) : (
          <CardContent>
            <EmptyState
              icon={<Droplets />}
              title="No refills yet."
              description="Be the first person to keep the room's bottles full."
            />
          </CardContent>
        )}
      </Card>

      {hasMore ? (
        <SectionHeading
          title=""
          action={
            <a
              href={`/app/activity?before=${encodeURIComponent(nextBefore!)}`}
              className="text-[13px] font-medium text-ink-secondary hover:text-ink"
            >
              Load older activity
            </a>
          }
        />
      ) : null}
    </div>
  );
}