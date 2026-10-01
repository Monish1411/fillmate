"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils/cn";
import { accentIndex, initialsOf } from "@/lib/utils/format";

const ACCENTS = [
  "bg-aqua-soft text-aqua border-aqua-border",
  "bg-info-soft text-info border-info-border",
  "bg-success-soft text-success border-success-border",
  "bg-warning-soft text-warning border-warning-border",
  "bg-neutral-soft text-ink-secondary border-border",
  "bg-danger-soft text-danger border-danger-border",
];

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[9px]",
    sm: "size-7 text-[10px]",
    md: "size-9 text-[11px]",
    lg: "size-11 text-[13px]",
    xl: "size-16 text-lg",
  };

  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-semibold tracking-tight select-none",
        sizes[size],
        src ? "border-border" : ACCENTS[accentIndex(name)],
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback delayMs={0} className="flex size-full items-center justify-center">
        {initialsOf(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** Same visual language, but for anonymous / hidden contributors. */
export function AnonymousAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-sunken text-ink-muted",
        size === "sm" ? "size-7" : "size-9",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 14.5c.9-1.2 2-1.8 3.5-1.8s2.6.6 3.5 1.8" strokeLinecap="round" />
        <circle cx="9.5" cy="10" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="10" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}