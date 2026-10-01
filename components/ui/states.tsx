import * as React from "react";
import { cn } from "@/lib/utils/cn";

/* ── Empty state ──────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-sunken/50 text-center",
        compact ? "px-5 py-8" : "px-6 py-14",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted shadow-e1">
          {icon}
        </div>
      ) : null}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ── Error state ──────────────────────────────────────────────── */

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this. Check your connection and try again.",
  action,
  className,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-danger-border bg-danger-soft/50 px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-[14px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-secondary">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ── Offline banner ───────────────────────────────────────────── */

export function OfflineBanner() {
  return (
    <div className="border-b border-warning-border bg-warning-soft px-4 py-2 text-center text-[12px] text-warning">
      You&apos;re offline. We&apos;ll sync when you&apos;re back.
    </div>
  );
}