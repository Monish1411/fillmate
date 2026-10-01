import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BottleGauge, WaterBar } from "@/components/app/bottle-gauge";
import { roomStatusLabel, roomStatusTone } from "@/lib/utils/room-status";
import { formatTime } from "@/lib/utils/time";
import { pluralize } from "@/lib/utils/format";
import { RecordButton } from "@/components/app/record-button";
import type { RoomStatusView } from "@/types/views";

const TONE_BADGE = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
} as const;

/** The hero card on the student home screen. */
export function WaterStatusCard({
  status,
  timezone,
}: {
  status: RoomStatusView;
  timezone: string;
}) {
  const tone = roomStatusTone(status.status);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center">
        <div className="min-w-0">
          <CardTitle>Water status</CardTitle>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Room {status.roomNumber} &middot; {status.hostelName}
          </p>
        </div>
        <Badge tone={TONE_BADGE[tone]}>{roomStatusLabel(status.status)}</Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5">
              <span className="tabular text-[34px] font-semibold leading-none tracking-[-0.03em]">
                {status.filled}
              </span>
              <span className="text-[15px] text-ink-muted">/ {status.target}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {status.percent}% of today&apos;s target
            </p>
          </div>
          <BottleGauge
            filled={status.filled}
            target={status.target}
            status={status.status}
            size="md"
          />
        </div>

        <WaterBar filled={status.filled} target={status.target} status={status.status} />

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.04em] text-ink-muted">
              Last refill
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-ink">
              {status.lastRefill
                ? `${status.lastRefill.actorName} · ${formatTime(status.lastRefill.timestamp, timezone)}`
                : "No refills logged today"}
            </p>
          </div>
          {status.lastRefill ? (
            <span className="tabular shrink-0 text-[12px] text-ink-muted">
              {status.lastRefill.bottleCount}{" "}
              {pluralize(status.lastRefill.bottleCount, "bottle")}
            </span>
          ) : null}
        </div>

        <div className="flex gap-2">
          <RecordButton className="flex-1" />
          <Button variant="secondary" size="lg" asChild>
            <Link href="/app/activity">
              Activity
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>

        {status.status === "overdue" ? (
          <p className="flex items-center gap-1.5 text-[12px] text-danger">
            <Clock className="size-3.5" />
            No refill logged today. A quick photo keeps everyone in the loop.
          </p>
        ) : status.remaining === 0 ? (
          <p className="text-[12px] text-success">
            Target reached &mdash; nothing else needed today.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}