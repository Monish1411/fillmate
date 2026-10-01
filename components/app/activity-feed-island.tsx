"use client";

import * as React from "react";
import { ActivityFeed } from "@/components/app/activity-feed";
import { ActivityDetail } from "@/components/app/activity-detail";
import type { ActivityView } from "@/types/views";

/** Feed + detail dialog, kept together so selection state stays local. */
export function ActivityFeedIsland({
  activities,
  timezone,
}: {
  activities: ActivityView[];
  timezone: string;
}) {
  const [selected, setSelected] = React.useState<ActivityView | null>(null);

  return (
    <>
      <ActivityFeed
        activities={activities}
        timezone={timezone}
        onSelect={setSelected}
      />
      <ActivityDetail
        activity={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
