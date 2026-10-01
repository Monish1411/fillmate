"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-location";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const online = useOnline();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted shadow-e1">
        {online ? <RotateCw className="size-5" /> : <WifiOff className="size-5" />}
      </span>
      <div className="space-y-2">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
          {online ? "Something went wrong" : "You're offline"}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-muted">
          {online
            ? "We couldn't load this page. Try again — nothing was lost."
            : "Check your connection and we'll pick up where you left off."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" asChild>
          <Link href="/app">Go to dashboard</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="tabular text-[11.5px] text-ink-muted">Reference {error.digest}</p>
      ) : null}
    </div>
  );
}