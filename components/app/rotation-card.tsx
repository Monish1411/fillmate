"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Check, ChevronRight, CircleSlash } from "lucide-react";
import type { RotationTurn } from "@/types/views";

export function RotationCard({ turns, className }: { turns: RotationTurn[]; className?: string }) {
  const upcoming = turns.slice(0, 5);

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Smart refill rotation</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Who&apos;s up next</p>
          </div>
          <a href="/app/rotation" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-secondary hover:text-ink">
            Manage
            <ChevronRight className="size-3.5" />
          </a>
        </div>

        <ul className="mt-3 divide-y divide-border-subtle">
          {upcoming.map((turn) => (
            <li key={`${turn.date}-${turn.userId}`} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-16 shrink-0">
                <p className={cn("text-[12px] font-medium", turn.isToday ? "text-aqua" : "text-ink-muted")}>
                  {turn.isToday ? "Today" : formatDayShort(turn.date)}
                </p>
              </div>
              <Avatar name={turn.name} size="sm" />
              <p className="min-w-0 flex-1 truncate text-[13px] text-ink">{turn.isMe ? "You" : turn.name}</p>
              {turn.status === "completed" ? (
                <Badge tone="success"><Check className="size-3" />Done</Badge>
              ) : turn.status === "skipped" ? (
                <Badge tone="neutral"><CircleSlash className="size-3" />Skipped</Badge>
              ) : turn.isToday ? (
                <Badge tone="accent">Up next</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function formatDayShort(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
