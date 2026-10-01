"use client";

import * as React from "react";
import { toast } from "sonner";
import { Flag, QrCode, ShieldQuestion } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/badge";
import { DetailRow } from "@/components/app/stat-tile";
import { Avatar } from "@/components/ui/avatar";
import { formatFullTimestamp, formatTime } from "@/lib/utils/time";
import { formatDistance } from "@/lib/utils/format";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { cn } from "@/lib/utils/cn";
import type { ActivityView } from "@/types/views";

const FLAG_REASONS: Record<string, string> = {
  duplicate_exact: "Duplicate photo",
  duplicate_perceptual: "Near-duplicate photo",
  submit_rate: "Very fast repeat submission",
  high_volume: "Unusual submission volume",
  no_cooler: "Cooler not detected",
  no_bottles: "Bottles not detected",
  ai_unavailable: "Verification unavailable",
  no_photo: "No photo attached",
};

const REPORT_REASONS = [
  { value: "not_them", label: "This refill looks like it belongs to someone else" },
  { value: "wrong_bottle_count", label: "The bottle count looks wrong" },
  { value: "wrong_time", label: "The time looks wrong" },
  { value: "unrelated_photo", label: "The photo looks unrelated" },
  { value: "other", label: "Something else" },
];

export function ActivityDetail({
  activity,
  open,
  onOpenChange,
}: {
  activity: ActivityView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reporting, setReporting] = React.useState(false);
  const [reason, setReason] = React.useState("not_them");
  const [busy, setBusy] = React.useState(false);

  if (!activity) return null;

  async function submitReport() {
    setBusy(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        json: { activityId: activity!.id, reason },
      });
      toast.success("Report sent", { description: "An administrator will take a look." });
      setReporting(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't send that report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refill details</DialogTitle>
          <DialogDescription>
            Everything recorded for this activity, in plain language.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
            <Avatar name={activity.actorName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {activity.isMine ? "You" : activity.actorName}
              </p>
              <p className="tabular text-[11.5px] text-ink-muted">
                Room {activity.roomNumber} · {formatTime(activity.serverTimestamp, activity.timezone)}
              </p>
            </div>
            <VerificationBadge status={activity.status} />
          </div>

          {activity.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activity.imageUrl}
              alt="Submitted evidence"
              className="aspect-4/3 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-ink-muted">
              No photo was attached to this activity.
            </div>
          )}

          <div className="divide-y divide-border-subtle rounded-lg border border-border px-3">
            <DetailRow
              label="Bottles claimed"
              value={`${activity.bottleCount}`}
            />
            <DetailRow
              label="Bottles detected"
              value={activity.bottlesDetected ?? "Not scored"}
            />
            <DetailRow
              label="Cooler detected"
              value={
                activity.coolerDetected === null
                  ? "Not scored"
                  : activity.coolerDetected
                    ? "Yes"
                    : "No"
              }
              tone={activity.coolerDetected ? "success" : activity.coolerDetected === false ? "warning" : "muted"}
            />
            <DetailRow
              label="Confidence"
              value={
                activity.confidence ? `${Math.round(activity.confidence * 100)}%` : "Not scored"
              }
            />
            <DetailRow
              label="Location"
              value={
                activity.locationStatus === "unavailable"
                  ? "Location unavailable"
                  : formatDistance(activity.distanceMeters)
              }
              tone={
                activity.locationStatus === "far"
                  ? "warning"
                  : activity.locationStatus === "near"
                    ? "success"
                    : "muted"
              }
            />
            {activity.coolerLabel ? (
              <DetailRow label="Cooler" value={activity.coolerLabel} />
            ) : null}
            {activity.qrScanned ? (
              <DetailRow
                label="Cooler QR"
                value={
                  <span className="inline-flex items-center gap-1">
                    <QrCode className="size-3.5" /> Scanned
                  </span>
                }
                tone="success"
              />
            ) : null}
            <DetailRow
              label="Server time"
              value={formatFullTimestamp(activity.serverTimestamp, activity.timezone)}
            />
          </div>

          {activity.flaggedReasons.length > 0 ? (
            <div className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-warning">
                <ShieldQuestion className="size-3.5" />
                This activity needs review
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {activity.flaggedReasons.map((code) => (
                  <li key={code} className="text-[12px] text-warning">
                    {FLAG_REASONS[code] ?? code}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {activity.reviewNote ? (
            <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
              <p className="text-[12px] font-medium text-ink-secondary">Administrator note</p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">{activity.reviewNote}</p>
            </div>
          ) : null}

          {activity.note ? (
            <p className="text-[13px] italic text-ink-muted">&ldquo;{activity.note}&rdquo;</p>
          ) : null}

          {!activity.isMine && !reporting ? (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setReporting(true)}>
              <Flag className="size-3.5" />
              Report this activity
            </Button>
          ) : null}

          {!activity.isMine && reporting ? (
            <div className="space-y-2 rounded-lg border border-border bg-surface-sunken p-3">
              <p className="text-[12.5px] font-medium text-ink">What looks wrong?</p>
              <div className="space-y-1">
                {REPORT_REASONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors",
                      reason === option.value
                        ? "border-aqua-border bg-aqua-soft text-ink"
                        : "border-border bg-surface text-ink-secondary",
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                      className="accent-[var(--brand-aqua)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setReporting(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void submitReport()} loading={busy}>
                  Send report
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

