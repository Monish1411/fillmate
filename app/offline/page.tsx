import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
        </div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
          You&rsquo;re offline
        </h1>
        <p className="max-w-sm text-[14px] leading-relaxed text-ink-muted">
          FillMate needs a connection to record a refill or load the room feed.
          We&rsquo;ll sync as soon as you&rsquo;re back.
        </p>
        <Button asChild>
          <Link href="/app">Try again</Link>
        </Button>
      </div>
    </div>
  );
}