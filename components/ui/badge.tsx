import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, CircleAlert, Clock, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AiStatus, ReviewStatus } from "@/types/core";

/* ── Badge ────────────────────────────────────────────────────── */

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-sunken text-ink-secondary",
        success: "border-success-border bg-success-soft text-success",
        warning: "border-warning-border bg-warning-soft text-warning",
        danger: "border-danger-border bg-danger-soft text-danger",
        info: "border-info-border bg-info-soft text-info",
        accent: "border-aqua-border bg-aqua-soft text-aqua",
        ink: "border-transparent bg-ink text-[var(--text-on-ink)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* ── Verification badge ───────────────────────────────────────── */

const STATUS_META: Record<
  AiStatus,
  { label: string; tone: NonNullable<BadgeProps["tone"]>; Icon: typeof Check }
> = {
  verified: { label: "Verified", tone: "success", Icon: Check },
  needs_review: { label: "Needs review", tone: "warning", Icon: Clock },
  rejected: { label: "Rejected", tone: "danger", Icon: CircleAlert },
  unavailable: { label: "Saved for review", tone: "neutral", Icon: ShieldQuestion },
};

export function VerificationBadge({
  status,
  className,
  showIcon = true,
}: {
  status: AiStatus;
  className?: string;
  showIcon?: boolean;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.needs_review;
  return (
    <Badge tone={meta.tone} className={className}>
      {showIcon ? <meta.Icon className="size-3" aria-hidden /> : null}
      {meta.label}
    </Badge>
  );
}

export function reviewBadgeTone(status: ReviewStatus): BadgeProps["tone"] {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "pending":
    case "re_upload_requested":
      return "warning";
    default:
      return "neutral";
  }
}

/* ── Dot ──────────────────────────────────────────────────────── */

export function Dot({
  tone = "neutral",
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
}) {
  const colors: Record<string, string> = {
    neutral: "bg-ink-muted",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    accent: "bg-aqua",
  };
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", colors[tone], className)}
    />
  );
}