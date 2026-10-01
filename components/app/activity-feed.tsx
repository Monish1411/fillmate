import * as React from "react";
import { Droplets, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar, AnonymousAvatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/ui/badge";
import { formatDayLabel, formatRelative, formatTime } from "@/lib/utils/time";
import { formatDistance } from "@/lib/utils/format";
import type { ActivityView } from "@/types/views";

/** One row in the room activity feed. */
export function ActivityItem({
  activity,
  timezone,
  onSelect,
  compact,
  className,
}: {
  activity: ActivityView;
  timezone: string;
  onSelect?: (activity: ActivityView) => void;
  compact?: boolean;
  className?: string;
}) {
  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      {...(onSelect ? { type: "button" as const, onClick: () => onSelect(activity) } : {})}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        onSelect && "hover:bg-surface-sunken",
        className,
      )}
    >
      {activity.actorHidden ? (
        <AnonymousAvatar size="sm" />
      ) : (
        <Avatar name={activity.actorName} src={activity.actorAvatar ?? null} size="sm" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-ink">
          <span className="font-medium">
            {activity.isMine ? "You" : activity.actorName}
          </span>{" "}
          filled{" "}
          <span className="tabular font-medium">
            {activity.bottleCount} {activity.bottleCount === 1 ? "bottle" : "bottles"}
          </span>
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-muted">
          <time dateTime={activity.serverTimestamp} className="tabular">
            {compact
              ? formatRelative(activity.serverTimestamp)
              : formatTime(activity.serverTimestamp, timezone)}
          </time>
          {activity.locationStatus !== "unavailable" ? (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" aria-hidden />
              {formatDistance(activity.distanceMeters)}
            </span>
          ) : null}
          {!compact && activity.note ? (
            <span className="truncate italic opacity-80">&ldquo;{activity.note}&rdquo;</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <VerificationBadge status={activity.status} showIcon={false} />
        {activity.isMine ? (
          <Droplets className="size-3 text-ink-muted/60" aria-hidden />
        ) : null}
      </div>
    </Wrapper>
  );
}

/** Groups activities by local day, as in a real timeline. */
export function ActivityFeed({
  activities,
  timezone,
  onSelect,
  compact,
  className,
}: {
  activities: ActivityView[];
  timezone: string;
  onSelect?: (activity: ActivityView) => void;
  compact?: boolean;
  className?: string;
}) {
  const groups = new Map<string, ActivityView[]>();
  for (const activity of activities) {
    const key = formatDayLabel(activity.serverTimestamp, timezone);
    const list = groups.get(key) ?? [];
    list.push(activity);
    groups.set(key, list);
  }

  return (
    <div className={cn("divide-y divide-border-subtle", className)}>
      {[...groups.entries()].map(([day, items]) => (
        <div key={day}>
          <p className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {day}
          </p>
          <div className="pb-1">
            {items.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                timezone={timezone}
                onSelect={onSelect}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}