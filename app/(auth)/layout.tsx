import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to FillMate.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
      <header className="relative flex h-14 items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
        </Link>
      </header>
      <main id="main" className="relative flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="relative px-4 py-6 text-center text-[12px] text-ink-muted">
        Accountability without conflict.
      </footer>
    </div>
  );
}