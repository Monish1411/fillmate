"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/primitives";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { formatTime } from "@/lib/utils/time";
import { formatDistance } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Paged } from "@/types/api";
import type { ActivityView } from "@/types/views";

const STATUSES = ["", "verified", "needs_review", "rejected", "unavailable"] as const;
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_bottles", label: "Most bottles" },
];

export function AdminActivityTable({
  initial,
  timezone,
}: {
  initial: Paged<ActivityView>;
  timezone: string;
}) {
  const [data, setData] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [sort, setSort] = React.useState("newest");
  const [offset, setOffset] = React.useState(0);

  const load = React.useCallback(
    async (nextOffset = 0) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "25",
          offset: String(nextOffset),
          sort,
        });
        if (search) params.set("search", search);
        if (status) params.set("status", status);
        setData(await apiFetch<Paged<ActivityView>>(`/api/activities?${params}`));
        setOffset(nextOffset);
      } catch (err) {
        toast.error(err instanceof ApiClientError ? err.message : "We couldn't load activities.");
      } finally {
        setLoading(false);
      }
    },
    [search, status, sort],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => void load(0), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const rows = data.items;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or room"
            className="pl-8"
            aria-label="Search activities"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-[13px]"
          aria-label="Filter by verification status"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === "" ? "All statuses" : value.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-[13px]"
          aria-label="Sort activities"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="icon" asChild aria-label="Export CSV">
          <a href="/api/admin/export?limit=500">
            <Download className="size-4" />
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              icon={<Filter />}
              title="No activities match"
              description="Try clearing the search or changing the status filter."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] uppercase tracking-[0.04em] text-ink-muted">
                    <th className="px-4 py-2 font-medium">Student</th>
                    <th className="px-4 py-2 font-medium">Room</th>
                    <th className="px-4 py-2 font-medium">Bottles</th>
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">AI status</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {rows.map((row) => (
                    <tr key={row.id} className={cn(loading && "opacity-50")}>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar name={row.actorName} size="xs" />
                          <span className="truncate text-ink">{row.actorName}</span>
                          {row.duplicateSuspected ? (
                            <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
                              duplicate
                            </Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="tabular px-4 py-2.5 text-ink-secondary">{row.roomNumber}</td>
                      <td className="tabular px-4 py-2.5 text-ink-secondary">{row.bottleCount}</td>
                      <td className="tabular px-4 py-2.5 text-ink-secondary">
                        {formatTime(row.serverTimestamp, timezone)}
                      </td>
                      <td className="px-4 py-2.5">
                        <VerificationBadge status={row.status} />
                      </td>
                      <td className="tabular px-4 py-2.5 text-ink-muted">
                        {row.locationStatus === "unavailable"
                          ? "—"
                          : formatDistance(row.distanceMeters)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/app/admin/review/${row.id}`}>View</a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.total > data.limit ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => void load(Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <span className="tabular text-[12px] text-ink-muted">
            {offset + 1}–{Math.min(offset + data.limit, data.total)} of {data.total}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + data.limit >= data.total || loading}
            onClick={() => void load(offset + 25)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

