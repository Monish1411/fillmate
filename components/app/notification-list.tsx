"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  Check,
  Droplets,
  Flag,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { apiFetch } from "@/lib/http/client";
import { formatRelative } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { NotificationRow } from "@/types/activity";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  refill_recorded: Droplets,
  target_reached: Check,
  room_overdue: Bell,
  rotation_today: CalendarClock,
  rotation_tomorrow: CalendarClock,
  activity_flagged: ShieldCheck,
  activity_approved: ShieldCheck,
  activity_rejected: ShieldCheck,
  reupload_requested: ShieldCheck,
  report_filed: Flag,
  report_resolved: Flag,
  welcome: Sparkles,
  room_joined: Users,
};

export function NotificationList({
  initialItems,
}: {
  initialItems: NotificationRow[];
  initialUnread?: number;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const [busy, setBusy] = React.useState(false);

  async function markAll() {
    setBusy(true);
    try {
      await apiFetch("/api/notifications", { method: "PATCH", json: { all: true } });
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bell />}
        title="No notifications yet"
        description="Refills, rotation turns and review decisions will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {unread > 0 ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => void markAll()} loading={busy}>
            <Check className="size-3.5" />
            Mark all read
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border-subtle">
            {items.map((item) => {
              const Icon = ICONS[item.type] ?? Bell;
              const isUnread = !item.read_at;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3",
                    isUnread && "bg-aqua-soft/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      isUnread
                        ? "border-aqua-border bg-aqua-soft text-aqua"
                        : "border-border bg-surface-sunken text-ink-muted",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[13.5px] leading-snug",
                        isUnread ? "font-medium text-ink" : "text-ink-secondary",
                      )}
                    >
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">{item.body}</p>
                    ) : null}
                  </div>
                  <time className="tabular shrink-0 text-[11.5px] text-ink-muted">
                    {formatRelative(item.created_at)}
                  </time>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}