"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  ChartNoAxesColumn,
  Droplets,
  House,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Trophy,
  Users,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/components/session-provider";
import { useTheme } from "@/components/theme-provider";
import { useRealtime } from "@/components/realtime-provider";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RecordRefillDialogProvider,
  useRecordRefillDialog,
} from "@/components/record/record-dialog-provider";
import { RecordRefillDialog } from "@/components/record/record-flow";
import { RecordButton } from "@/components/app/record-button";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin } = useSession();
  const { resolved, toggle } = useTheme();
  const { connected } = useRealtime();

  const mainNav: NavItem[] = [
    { href: "/app", label: "Overview", Icon: LayoutDashboard },
    { href: "/app/activity", label: "Activity", Icon: Droplets },
    { href: "/app/room", label: "Room", Icon: House },
    { href: "/app/contributions", label: "Contributions", Icon: Trophy },
    { href: "/app/rotation", label: "Rotation", Icon: CalendarClock },
    { href: "/app/notifications", label: "Notifications", Icon: Bell },
  ];

  const adminNav: NavItem[] = [
    { href: "/app/admin", label: "Analytics", Icon: ChartNoAxesColumn },
    { href: "/app/admin/activity", label: "Review queue", Icon: ShieldCheck },
    { href: "/app/admin/members", label: "Members", Icon: Users },
    { href: "/app/admin/settings", label: "Hostel settings", Icon: Settings },
  ];

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <RecordRefillDialogProvider>
      <div className="min-h-dvh bg-background">
      {/* ── Desktop sidebar ───────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
        </div>

        <div className="px-3 pb-3">
          <RecordSidebarButton />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavGroup label="Overview">
            {mainNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </NavGroup>

          {isAdmin ? (
            <NavGroup label="Administration" className="mt-5">
              {adminNav.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </NavGroup>
          ) : null}

          <div className="mt-5 border-t border-border-subtle pt-3">
            <NavLink
              item={{ href: "/app/profile", label: "Profile", Icon: Users }}
              active={isActive("/app/profile")}
            />
            <NavLink
              item={{ href: "/app/settings", label: "Settings", Icon: Settings }}
              active={isActive("/app/settings")}
            />
            <Link
              href="/login"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <LogOut className="size-4" />
              Sign out
            </Link>
          </div>
        </nav>

        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
            <Avatar name={user?.displayName ?? "You"} src={user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">
                {user?.displayName ?? "Signed out"}
              </p>
              <p className="truncate text-[11.5px] text-ink-muted">
                {user?.roomNumber ? `Room ${user.roomNumber}` : user?.hostelName ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 px-1.5">
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-success" : "bg-border-strong",
              )}
              aria-hidden
            />
            <span className="text-[11px] text-ink-muted">
              {connected ? "Live updates on" : "Reconnecting…"}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/app" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
        </Link>
        <div className="flex items-center gap-1">
          {user?.roomNumber ? (
            <Badge tone="neutral" className="mr-1">
              Room {user.roomNumber}
            </Badge>
          ) : null}
          <Link
            href="/app/notifications"
            className="relative rounded-md p-2 text-ink-secondary transition-colors hover:bg-surface-sunken"
            aria-label="Notifications"
          >
            <Bell className="size-4.5" />
          </Link>
          <Link
            href="/app/profile"
            className="rounded-md p-2 text-ink-secondary transition-colors hover:bg-surface-sunken"
            aria-label="Profile"
          >
            <Avatar name={user?.displayName ?? "You"} src={user?.avatarUrl} size="sm" />
          </Link>
        </div>
      </header>

      <main id="main" className="pb-24 lg:pb-0 lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>

      <MobileNav pathname={pathname} />
      {!user ? (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 lg:hidden">
          <Button asChild size="sm">
            <Link href="/login">
              <LogIn className="size-3.5" />
              Sign in
            </Link>
          </Button>
        </div>
      ) : null}
      </div>
      <RecordRefillDialog />
    </RecordRefillDialogProvider>
  );
}


function RecordSidebarButton() {
  return <RecordButton className="w-full justify-start" size="md" />;
}

function NavGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-1", className)}>
      <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-surface-sunken text-ink"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <item.Icon className={cn("size-4", active ? "text-ink" : "text-ink-muted")} />
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

const MOBILE_NAV: NavItem[] = [
  { href: "/app", label: "Home", Icon: House },
  { href: "/app/activity", label: "Activity", Icon: Droplets },
  { href: "/app/contributions", label: "Board", Icon: Trophy },
  { href: "/app/profile", label: "Profile", Icon: Users },
];

function MobileNav({ pathname }: { pathname: string }) {
  const active = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative grid grid-cols-5 items-end px-1 pb-1 pt-1.5">
        {MOBILE_NAV.slice(0, 2).map((item) => (
          <MobileLink key={item.href} item={item} isActive={active(item.href)} />
        ))}

        <div className="flex justify-center">
          <RecordFab />
        </div>

        {MOBILE_NAV.slice(2).map((item) => (
          <MobileLink key={item.href} item={item} isActive={active(item.href)} />
        ))}
      </div>
    </nav>
  );
}

function MobileLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10.5px] font-medium transition-colors",
        isActive ? "text-ink" : "text-ink-muted",
      )}
    >
      <item.Icon className="size-4.5" />
      {item.label}
    </Link>
  );
}

function RecordFab() {
  const { open } = useRecordRefillDialog();
  return (
    <button
      type="button"
      onClick={() => open(true)}
      aria-label="Record refill"
      className={cn(
        "-mt-6 flex size-12 items-center justify-center rounded-full border border-border bg-ink text-[var(--text-on-ink)]",
        "shadow-e2 transition-transform active:scale-95 animate-pulse-ring",
      )}
    >
      <Droplets className="size-5" />
    </button>
  );
}

export { useRecordRefillDialog };