"use client";

import { Check, CircleAlert, Clock, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { PositionState } from "@/hooks/use-location";

/**
 * Optional location signal.
 *
 * Always opt-in and never blocking: a student who declines still records a
 * refill, we simply record "Location unavailable" instead of a distance.
 */
export function LocationRow({
  permission,
  unavailableReason,
  onRequest,
  disabled,
}: {
  permission: PositionState;
  unavailableReason: string | null;
  onRequest: () => void;
  disabled?: boolean;
}) {
  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2">
        <LocateFixed className="size-4 shrink-0 text-success" />
        <p className="text-[12.5px] text-ink-secondary">
          Location shared — adds a proximity check to this record.
        </p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" />
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          {unavailableReason ??
            "Location access is off. Your refill still counts — we'll mark it as location unavailable."}
        </p>
      </div>
    );
  }

  if (permission === "unsupported") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2">
        <MapPin className="size-4 shrink-0 text-ink-muted" />
        <p className="text-[12.5px] text-ink-muted">
          This device doesn&apos;t share location. No problem — verification still works.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken px-3 py-2">
      <p className="text-[12.5px] text-ink-muted">
        Share location for an extra proximity check
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRequest}
        disabled={disabled}
        className={cn("shrink-0")}
      >
        Enable
      </Button>
    </div>
  );
}

/* ── Icons re-exported for result step convenience ─────────────── */
export { Check, CircleAlert, Clock };