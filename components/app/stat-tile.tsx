import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Stat tile - the compact numeric unit used across dashboards.
 * Numbers use tabular figures so they do not jitter as they update.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
  className?: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    accent: "text-aqua",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface px-3.5 py-3 shadow-e1",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-ink-muted">
        {icon ? <span className="[&_svg]:size-3.5">{icon}</span> : null}
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.04em]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn("tabular text-[22px] font-semibold leading-none tracking-[-0.02em]", valueTone)}
        >
          {value}
        </span>
        {unit ? <span className="text-[12px] text-ink-muted">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[11.5px] text-ink-muted">{hint}</div> : null}
    </div>
  );
}

/** Dense key/value row for detail panels. */
export function DetailRow({
  label,
  value,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "muted";
  className?: string;
}) {
  const valueTone =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : tone === "muted"
            ? "text-ink-muted"
            : "";

  return (
    <div className={cn("flex items-center justify-between gap-4 py-2", className)}>
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className={cn("tabular text-[13px] font-medium text-ink", valueTone)}>{value}</span>
    </div>
  );
}