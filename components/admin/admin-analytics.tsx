"use client";

import * as React from "react";
import { Activity, BarChart, Clock, ChartPie, ShieldCheck, TrendingUp, Users } from "lucide-react";
import {
  Bar as RBar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie as RPie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/primitives";
import { StatTile } from "@/components/app/stat-tile";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/utils/format";
import type { AdminAnalyticsResponse } from "@/types/api";

const VERIFICATION_COLORS = {
  verified: "var(--success)",
  needsReview: "var(--warning)",
  rejected: "var(--error)",
  unavailable: "var(--border-strong)",
};

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export function AdminAnalytics({
  initial,
  exportHref,
}: {
  initial: AdminAnalyticsResponse | null;
  exportHref: string;
}) {
  const [range, setRange] = React.useState("7d");
  const [data, setData] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok) setData(json.data);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const { metrics, series, verification, contribution, rooms, hours, flaggedRate, busiestHour } =
    data;

  const donutData = [
    { key: "verified", name: "Verified", value: verification.verified },
    { key: "needsReview", name: "Needs review", value: verification.needsReview },
    { key: "rejected", name: "Rejected", value: verification.rejected },
    { key: "unavailable", name: "Not scored", value: verification.unavailable },
  ].filter((d) => d.value > 0);

  const busiestHourData = hours
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={range} onValueChange={setRange}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.value} value={r.value}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          {loading ? <Skeleton className="h-9 w-28 rounded-md" /> : null}
          <Button variant="secondary" size="sm" asChild>
            <a href={`${exportHref}`}>Export CSV</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students" value={metrics.totalStudents} hint={`${metrics.totalRooms} rooms`} />
        <StatTile
          label="Active students"
          value={metrics.activeStudents}
          hint={`${metrics.participationRate}% participation`}
          icon={<Users />}
        />
        <StatTile label="Today's refills" value={metrics.todayRefills} icon={<Activity />} />
        <StatTile label="Bottles filled" value={metrics.bottlesFilled} tone="accent" />
        <StatTile
          label="Verification rate"
          value={`${metrics.verificationRate}%`}
          tone={metrics.verificationRate >= 90 ? "success" : "warning"}
          icon={<ShieldCheck />}
          hint={`${flaggedRate}% needed review`}
        />
        <StatTile
          label="Pending review"
          value={metrics.pendingReview}
          tone={metrics.pendingReview > 0 ? "warning" : "neutral"}
          icon={<Clock />}
        />
        <StatTile label="Flagged" value={metrics.flaggedActivities} tone="danger" />
        <StatTile
          label="Busiest hour"
          value={busiestHour === null ? "—" : `${busiestHour}:00`}
          icon={<TrendingUp />}
          hint="Local time"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily refill activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RBarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 500 }}
                />
                <RBar dataKey="bottles" name="Bottles" fill="var(--brand-aqua)" radius={[4, 4, 0, 0]} />
                <RBar dataKey="refills" name="Refills" fill="var(--gauge-fill-soft)" radius={[4, 4, 0, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartPie className="size-4 text-ink-muted" />
              Verification status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <RPie data={donutData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72}>
                    {donutData.map((entry) => (
                      <Cell key={entry.key} fill={VERIFICATION_COLORS[entry.key as keyof typeof VERIFICATION_COLORS]} />
                    ))}
                  </RPie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </RPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="size-4 text-ink-muted" />
              Bottle contribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RBarChart
                  data={contribution}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <RBar dataKey="bottles" name="Bottles" radius={[0, 4, 4, 0]}>
                    {contribution.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.isMe ? "var(--brand-aqua)" : "var(--gauge-fill-soft)"}
                      />
                    ))}
                  </RBar>
                </RBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room activity</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] uppercase tracking-[0.04em] text-ink-muted">
                  <th className="px-4 py-2 font-medium">Room</th>
                  <th className="px-4 py-2 font-medium">Members</th>
                  <th className="px-4 py-2 font-medium">Bottles</th>
                  <th className="px-4 py-2 font-medium">Refills</th>
                  <th className="px-4 py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rooms.map((room) => (
                  <tr key={room.roomId}>
                    <td className="px-4 py-2.5 font-medium text-ink">{room.roomNumber}</td>
                    <td className="tabular px-4 py-2.5 text-ink-secondary">{room.members}</td>
                    <td className="tabular px-4 py-2.5 text-ink-secondary">{room.bottles}</td>
                    <td className="tabular px-4 py-2.5 text-ink-secondary">{room.refills}</td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {formatPercent(
                        metrics.bottlesFilled > 0
                          ? (room.bottles / metrics.bottlesFilled) * 100
                          : 0,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {busiestHourData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-ink-muted" />
              Most active hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={busiestHourData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h: number) => `${h}:00`}
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(h: number) => `${h}:00 – ${h + 1}:00`}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Refills"
                    stroke="var(--brand-aqua)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--brand-aqua)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}