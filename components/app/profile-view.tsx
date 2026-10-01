"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Droplets,
  Flame,
  Medal,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/app/stat-tile";
import { Button } from "@/components/ui/button";
import { formatMonthYear } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { AchievementView, ContributionStats } from "@/types/views";

const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  droplets: Droplets,
  "calendar-check": CalendarCheck,
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
};

export function ProfileView({
  user,
  stats,
  roomBottles,
  achievements,
  gamification,
}: {
  user: {
    id: string;
    name: string;
    fullName: string;
    initials: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    roomNumber: string | null;
    hostelName: string | null;
    memberSince: string;
  };
  stats: ContributionStats;
  roomBottles: number;
  achievements: AchievementView[];
  gamification: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4 pt-5">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-semibold tracking-[-0.025em] text-ink">
              {user.name}
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {user.roomNumber ? <Badge tone="neutral">Room {user.roomNumber}</Badge> : null}
              {user.hostelName ? <Badge tone="neutral">{user.hostelName}</Badge> : null}
              {user.role !== "student" ? (
                <Badge tone="accent">
                  {user.role === "super_admin" ? "Super admin" : "Hostel admin"}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Your contribution
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Bottles" value={stats.bottles} tone="accent" icon={<Droplets />} />
          <StatTile label="Activities" value={stats.fills} icon={<TrendingUp />} />
          <StatTile label="This week" value={stats.weekFills} />
          <StatTile
            label="Verification"
            value={`${stats.verificationRate}%`}
            tone={stats.verificationRate >= 90 ? "success" : "warning"}
            icon={<ShieldCheck />}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="This month" value={stats.monthFills} />
          <StatTile label="Per day" value={stats.avgPerDay} unit="avg" />
          <StatTile
            label="Streak"
            value={stats.streak}
            unit={stats.streak === 1 ? "day" : "days"}
            tone="warning"
            icon={<Flame />}
          />
          <StatTile label="Room total" value={roomBottles} />
        </div>
      </section>

      {gamification ? (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Milestones
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {achievements.map((achievement) => {
              const Icon = ACHIEVEMENT_ICONS[achievement.icon] ?? Medal;
              const earned = Boolean(achievement.earnedAt);
              return (
                <Card
                  key={achievement.key}
                  className={cn(earned ? "" : "opacity-60")}
                >
                  <CardContent className="flex items-start gap-3 pt-4">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                        earned
                          ? "border-aqua-border bg-aqua-soft text-aqua"
                          : "border-border bg-surface-sunken text-ink-muted",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">{achievement.title}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {achievement.description}
                      </p>
                      {earned ? (
                        <p className="mt-1 text-[11.5px] text-aqua">
                          Earned {achievement.earnedAt ? formatMonthYear(achievement.earnedAt) : ""}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <dl className="divide-y divide-border-subtle">
            <Row label="Member since" value={formatMonthYear(user.memberSince)} />
            {user.phone ? <Row label="Phone" value={user.phone} /> : null}
          </dl>
          <Button variant="secondary" size="sm" className="w-full" asChild>
            <Link href="/app/settings">Manage settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="tabular text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}

