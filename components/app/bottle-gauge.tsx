"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import type { RoomStatus } from "@/types/views";

/**
 * Bottle gauge - the product's signature visual.
 * Filled bottles are drawn as clean silhouettes; empty ones stay as outlines.
 */
export function BottleGauge({
  filled,
  target,
  status,
  size = "md",
  className,
  animate = true,
}: {
  filled: number;
  target: number;
  status: RoomStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}) {
  const dims = {
    sm: { w: 16, h: 38, gap: 4 },
    md: { w: 22, h: 52, gap: 5 },
    lg: { w: 30, h: 72, gap: 6 },
  }[size];

  const total = Math.max(target, filled, 1);
  const tone =
    status === "full"
      ? "fill:aqua"
      : status === "overdue"
        ? "fill:danger"
        : "fill:warning";

  return (
    <div
      className={cn("flex items-end", className)}
      role="img"
      aria-label={`${filled} of ${target} bottles filled`}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isFilled = index < filled;
        return (
          <svg
            key={index}
            width={dims.w}
            height={dims.h}
            viewBox="0 0 24 60"
            fill="none"
            className="shrink-0"
            aria-hidden
          >
            {animate ? (
              <motion.path
                d="M9 2h6v7l4.2 7.4A6 6 0 0 1 20.4 22v30a6 6 0 0 1-6 6H9.6a6 6 0 0 1-6-6V22a6 6 0 0 1 1.2-5.6L9 9V2Z"
                strokeWidth="1.6"
                strokeLinejoin="round"
                initial={{ opacity: 0, y: 6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { delay: index * 0.045, duration: 0.32, ease: [0.16, 1, 0.3, 1] },
                }}
                className={
                  isFilled
                    ? tone === "fill:aqua"
                      ? "fill-gauge-fill stroke-gauge-fill"
                      : tone === "fill:warning"
                        ? "fill-[color-mix(in_oklab,var(--warning)_26%,transparent)] stroke-[var(--warning)]"
                        : "fill-[color-mix(in_oklab,var(--danger)_24%,transparent)] stroke-[var(--danger)]"
                    : "fill-transparent stroke-gauge-empty"
                }
              />
            ) : (
              <path
                d="M9 2h6v7l4.2 7.4A6 6 0 0 1 20.4 22v30a6 6 0 0 1-6 6H9.6a6 6 0 0 1-6-6V22a6 6 0 0 1 1.2-5.6L9 9V2Z"
                strokeWidth="1.6"
                strokeLinejoin="round"
                className={
                  isFilled
                    ? "fill-gauge-fill stroke-gauge-fill"
                    : "fill-transparent stroke-gauge-empty"
                }
              />
            )}
          </svg>
        );
      })}
    </div>
  );
}

/** Compact linear meter used in list rows and the room card header. */
export function WaterBar({
  filled,
  target,
  status,
  className,
}: {
  filled: number;
  target: number;
  status: RoomStatus;
  className?: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((filled / target) * 100)) : 0;
  const barColor =
    status === "full"
      ? "bg-gauge-fill"
      : status === "overdue"
        ? "bg-danger"
        : "bg-warning";

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gauge-empty", className)}
      role="progressbar"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-label={`${filled} of ${target} bottles`}
    >
      <motion.div
        className={cn("h-full rounded-full", barColor)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}