"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { DetailRow } from "@/components/app/stat-tile";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { formatFullTimestamp } from "@/lib/utils/time";
import { formatDistance } from "@/lib/utils/format";
import type { ActivityView } from "@/types/views";

const FLAG_COPY: Record<string, string> = {
  duplicate_exact: "This exact photo was already submitted as evidence.",
  duplicate_perceptual: "A visually very similar photo was submitted recently.",
  submit_rate: "Another refill was logged within seconds of this one.",
  high_volume: "An unusually high number of bottles in a short window.",
  no_cooler: "A water cooler was not visible in the photo.",
  no_bottles: "No water bottles were visible in the photo.",
  ai_unavailable: "The reviewer could not be reached.",
  no_photo: "No photo was attached.",
};

export function ReviewPanel({
  activity,
  canReview,
}: {
  activity: ActivityView;
  canReview: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function decide(decision: "approved" | "rejected" | "re_upload_requested") {
    setBusy(decision);
    try {
      await apiFetch(`/api/admin/activities/${activity.id}/review`, {
        method: "POST",
        json: { decision, note: note.trim() || undefined },
      });
      toast.success(
        decision === "approved"
          ? "Activity approved"
          : decision === "rejected"
            ? "Activity rejected"
            : "Re-upload requested",
      );
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't save that decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={activity.actorName} src={activity.actorAvatar} size="md" />
          <div>
            <p className="text-[15px] font-semibold text-ink">{activity.actorName}</p>
            <p className="tabular text-[12.5px] text-ink-muted">Room {activity.roomNumber}</p>
          </div>
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
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-ink-muted">
          No photo attached to this activity.
        </div>
      )}

      <div className="divide-y divide-border-subtle rounded-lg border border-border px-3">
        <DetailRow label="Bottles claimed" value={activity.bottleCount} />
        <DetailRow
          label="Bottles detected"
          value={activity.bottlesDetected ?? "Not scored"}
          tone={activity.bottlesDetected === activity.bottleCount ? "success" : "muted"}
        />
        <DetailRow
          label="Cooler"
          value={
            activity.coolerDetected === null
              ? "Not detected / not scored"
              : activity.coolerDetected
                ? "Detected"
                : "Not detected"
          }
          tone={activity.coolerDetected ? "success" : "warning"}
        />
        <DetailRow
          label="Confidence"
          value={activity.confidence ? `${Math.round(activity.confidence * 100)}%` : "Not scored"}
        />
        <DetailRow
          label="Location"
          value={
            activity.locationStatus === "unavailable"
              ? "Location unavailable"
              : formatDistance(activity.distanceMeters)
          }
          tone={activity.locationStatus === "far" ? "warning" : "muted"}
        />
        <DetailRow
          label="Server time"
          value={formatFullTimestamp(activity.serverTimestamp, activity.timezone)}
        />
      </div>

      {activity.flaggedReasons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Why this was flagged</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {activity.flaggedReasons.map((code) => (
              <p key={code} className="text-[13px] text-ink-secondary">
                {FLAG_COPY[code] ?? code}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Field
              label="Note"
              optional
              htmlFor="review-note"
              hint="Shared with the student."
            >
              <Textarea
                id="review-note"
                value={note}
                maxLength={400}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Cooler was visible but the photo was too dark to confirm the count."
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button onClick={() => void decide("approved")} loading={busy === "approved"}>
                <Check className="size-4" />
                Approve
              </Button>
              <Button
                variant="secondary"
                onClick={() => void decide("re_upload_requested")}
                loading={busy === "re_upload_requested"}
              >
                <RefreshCw className="size-4" />
                Re-upload
              </Button>
              <Button
                variant="ghost"
                onClick={() => void decide("rejected")}
                loading={busy === "rejected"}
              >
                <X className="size-4" />
                Reject
              </Button>
            </div>
            <p className="text-[12px] text-ink-muted">
              Every decision is written to the admin audit log with your name and time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Badge tone="neutral">You cannot review your own activity</Badge>
      )}
    </div>
  );
}