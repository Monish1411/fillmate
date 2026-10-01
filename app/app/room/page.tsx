import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/rbac";
import { getRoomStatus, getRoomTotals } from "@/lib/repositories/rooms";
import { getRoomContributions, getRoomMembers } from "@/lib/repositories/members";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { ContributionList } from "@/components/app/contribution-list";
import { InvitePanel } from "@/components/app/invite-panel";
import { StatTile } from "@/components/app/stat-tile";
import { WaterBar } from "@/components/app/bottle-gauge";
import { Card, CardContent, SectionHeading } from "@/components/ui/card";
import { roomStatusLabel, roomStatusTone } from "@/lib/utils/room-status";
import { Badge } from "@/components/ui/badge";
import { startOfTodayIso } from "@/lib/utils/time";

export const metadata: Metadata = { title: "Room", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE = { success: "success", warning: "warning", danger: "danger", neutral: "neutral" } as const;

export default async function RoomPage() {
  const ctx = await getAuthContext();
  if (!ctx?.roomId || !ctx.hostelId) return null;

  const tz = ctx.user.timezone;
  const monthStart = startOfTodayIso(tz);
  const [status, members, contributions, totals, settings] = await Promise.all([
    getRoomStatus(ctx.roomId, tz),
    getRoomMembers(ctx.roomId),
    getRoomContributions(ctx.roomId, ctx.user.id, monthStart),
    getRoomTotals(ctx.roomId, monthStart),
    getHostelSettings(ctx.hostelId),
  ]);

  if (!status) return null;
  const tone = roomStatusTone(status.status);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">
            Room {status.roomNumber}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.025em] text-ink">
            {roomStatusLabel(status.status)}
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">{status.hostelName}</p>
        </div>
        <Badge tone={TONE[tone]}>{status.filled} / {status.target} today</Badge>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                Today&rsquo;s target
              </p>
              <p className="tabular mt-1 text-[22px] font-semibold text-ink">{status.target}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">Completed</p>
              <p className="tabular mt-1 text-[22px] font-semibold text-ink">{status.filled}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">Remaining</p>
              <p className="tabular mt-1 text-[22px] font-semibold text-ink">{status.remaining}</p>
            </div>
          </div>
          <WaterBar filled={status.filled} target={status.target} status={status.status} />
          <p className="text-[12.5px] text-ink-muted">
            {status.activeToday} of {status.memberCount}{" "}
            {status.memberCount === 1 ? "member has" : "members have"} logged a refill today.
          </p>
        </CardContent>
      </Card>

      <section>
        <SectionHeading
          title="Room contribution"
          description={`${totals.bottles} bottles recorded in the last 30 days`}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Bottles" value={totals.bottles} tone="accent" />
          <StatTile label="Refills" value={totals.refills} />
          <StatTile label="Active" value={contributions.filter((c) => c.fills > 0).length} unit={`/ ${members.length}`} />
          <StatTile label="Daily avg" value={Math.round((totals.bottles / Math.max(1, totals.days)) * 10) / 10} unit="bottles" />
        </div>
      </section>

      <section>
        <SectionHeading title="Members" description="Neutral activity stats, not a ranking" />
        <Card>
          <ContributionList members={contributions} />
        </Card>
      </section>

      {settings.invites ? (
        <section>
          <SectionHeading
            title="Invite your roommates"
            description="Share a link so everyone can log refills"
          />
          <InvitePanel roomId={ctx.roomId} />
        </section>
      ) : null}
    </div>
  );
}