import { cn } from "@/lib/utils/cn";

/** The FillMate mark: a bottle silhouette with a fill line. */
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        d="M9.25 1.75h5.5v4.9l3.2 5.9A5.6 5.6 0 0 1 19.1 16.8v3.4a2.9 2.9 0 0 1-2.9 2.9H7.8a2.9 2.9 0 0 1-2.9-2.9v-3.4a5.6 5.6 0 0 1 1.15-4.25l3.2-5.9V1.75Z"
        className="fill-aqua-soft stroke-aqua"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.9 14.6h14.2v2.1a5.6 5.6 0 0 1-1.15 4.25l-3.2 5.9V22.1H9.25V23h5.5v-1.15"
        className="hidden"
      />
      <rect
        x="4.9"
        y="14.4"
        width="14.2"
        height="7.5"
        rx="1.2"
        className="fill-aqua"
        opacity="0.9"
      />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[15px] font-semibold tracking-[-0.02em]", className)}>
      FillMate
    </span>
  );
}