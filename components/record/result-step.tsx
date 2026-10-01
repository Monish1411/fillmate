"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, CircleAlert, Clock, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatTime } from "@/lib/utils/time";
import { formatDistance } from "@/lib/utils/format";
import type { CreateActivityResponse } from "@/types/api";

/**
 * Confirmation screen.
 *
 * States exactly what the system concluded — including when it is unsure. We
 * never claim certainty we do not have.
 */
export function ResultStep({
  result,
  onClose,
}: {
  result: CreateActivityResponse;
  onClose: () => void;
}) {
  const { activity, verification, roomStatus } = result;
  const verified = verification.verified;
  const uncertain = !verified;

  return (
    <div className="p-5">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full"
        style={{
          background: verified
            ? "var(--success-soft)"
            : uncertain
              ? "var(--warning-soft)"
              : "var(--neutral-soft)",
        }}
      >
        {verified ? (
          <Check className="size-7 text-success" strokeWidth={2.5} />
        ) : (
          <Clock className="size-7 text-warning" strokeWidth={2.2} />
        )}
      </motion.div>

      <div className="text-center">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
          {verified ? "Refill verified" : "Refill recorded"}
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {activity.bottleCount} {activity.bottleCount === 1 ? "bottle" : "bottles"} •{" "}
          {formatTime(activity.serverTimestamp, activity.timezone)}
        </p>
      </div>

      <dl className="mt-5 divide-y divide-border-subtle rounded-lg border border-border">
        <Row
          label="AI verification"
          value={
            verified ? "Verified" : uncertain ? "Needs review" : "Saved for review"
          }
          tone={verified ? "success" : uncertain ? "warning" : "muted"}
        />
        <Row
          label="Cooler detected"
          value={
            verification.cooler_detected
              ? "Yes"
              : verification.cooler_detected === false && !verified
                ? "Not detected"
                : "Not scored"
          }
          tone={verification.cooler_detected ? "success" : "muted"}
        />
        <Row
          label="Bottles detected"
          value={
            verification.bottles_detected > 0
              ? String(verification.bottles_detected)
              : "Not scored"
          }
          tone={
            verification.bottles_detected === activity.bottleCount ? "success" : "muted"
          }
        />
        <Row
          label="Confidence"
          value={
            verification.confidence > 0
              ? `${Math.round(verification.confidence * 100)}%`
              : "Not scored"
          }
          tone="muted"
        />
        <Row
          label="Location"
          value={
            activity.locationStatus === "unavailable"
              ? "Location unavailable"
              : formatDistance(activity.distanceMeters)
          }
          tone={
            activity.locationStatus === "far" ? "warning" : activity.locationStatus === "near" ? "success" : "muted"
          }
        />
      </dl>

      {uncertain ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-[12.5px] leading-relaxed text-warning">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{verification.reason}</span>
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-success-border bg-success-soft px-3 py-2 text-[12.5px] leading-relaxed text-success">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          <span>{verification.reason}</span>
        </p>
      )}

      {roomStatus ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
          <p className="text-[13px] text-ink-secondary">Added to room activity</p>
          <p className="tabular text-[13px] font-semibold text-ink">
            {roomStatus.filled} / {roomStatus.target} today
          </p>
        </div>
      ) : null}

      <Button size="lg" className="mt-4 w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "tabular text-[13px] font-medium",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export { MapPin };