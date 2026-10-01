"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search, Shield, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/primitives";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { useDebounced } from "@/hooks/use-media-query";
import { formatRelative } from "@/lib/utils/time";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  roomNumber: string | null;
  roomId: string | null;
  fills: number;
  bottles: number;
  lastActivityAt: string | null;
  lastSeenAt: string | null;
}

export function MembersManager({ initial }: { initial: Member[] }) {
  const [members, setMembers] = React.useState(initial);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const debounced = useDebounced(search, 250);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    fetch(`/api/admin/members?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok) setMembers(json.data);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  async function toggleRole(member: Member) {
    const next = member.role === "student" ? "hostel_admin" : "student";
    try {
      await apiFetch("/api/admin/members", {
        method: "PUT",
        json: { email: member.email, role: next },
      });
      toast.success(next === "hostel_admin" ? "Promoted to admin" : "Role updated");
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: next } : m)));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't update that role.");
    }
  }

  async function remove(member: Member) {
    if (!member.roomId) return;
    try {
      await apiFetch(`/api/admin/members?userId=${member.id}&roomId=${member.roomId}`, {
        method: "DELETE",
      });
      toast.success(`${member.name} removed from the room`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't remove that member.");
    }
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="pl-8"
          aria-label="Search members"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && members.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              compact
              icon={<UserCog />}
              title="No members found"
              description="Students appear here once they sign up with your hostel code."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={member.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{member.name}</p>
                    <p className="truncate text-[11.5px] text-ink-muted">
                      {member.email}
                      {member.roomNumber ? ` · Room ${member.roomNumber}` : " · No room"}
                    </p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="tabular text-[13px] text-ink">{member.bottles}</p>
                    <p className="text-[11px] text-ink-muted">
                      {member.lastActivityAt ? formatRelative(member.lastActivityAt) : "no activity"}
                    </p>
                  </div>

                  <Badge tone={member.role === "student" ? "neutral" : "accent"}>
                    {member.role === "student" ? "Student" : "Admin"}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Toggle admin role for ${member.name}`}
                    onClick={() => void toggleRole(member)}
                  >
                    <Shield className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${member.name} from the room`}
                    onClick={() => void remove(member)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-[12px] text-ink-muted">
        Removing someone from a room deletes their membership, not their history.
      </p>
    </div>
  );
}