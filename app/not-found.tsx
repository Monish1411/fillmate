import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
        </div>
        <p className="tabular text-[48px] font-semibold leading-none tracking-[-0.04em] text-ink">404</p>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
          We couldn&rsquo;t find that page
        </h1>
        <p className="max-w-sm text-[14px] leading-relaxed text-ink-muted">
          The link may be old, or the room may have been removed. Head back and we&rsquo;ll
          get you sorted.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/app">Open FillMate</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}