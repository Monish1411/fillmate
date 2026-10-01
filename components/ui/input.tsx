"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils/cn";

/* ── Label ────────────────────────────────────────────────────── */

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-[13px] font-medium text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/* ── Input ────────────────────────────────────────────────────── */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, type, invalid, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    aria-invalid={invalid || undefined}
    className={cn(
      "h-10 w-full rounded-md border border-border bg-surface px-3 text-[14px] text-ink shadow-e1",
      "placeholder:text-ink-muted",
      "transition-[border-color,box-shadow] duration-150",
      "hover:border-border-strong",
      "focus:border-aqua focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-aqua)_28%,transparent)]",
      "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
      invalid && "border-danger focus:border-danger",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-[14px] text-ink shadow-e1",
      "placeholder:text-ink-muted transition-[border-color,box-shadow] duration-150",
      "hover:border-border-strong",
      "focus:border-aqua focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-aqua)_28%,transparent)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ── Field wrapper ────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  optional,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor}>{label}</Label>
          {optional ? <span className="text-[11px] text-ink-muted">Optional</span> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}