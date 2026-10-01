"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCopyToClipboard } from "@/hooks/use-media-query";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { formatRelative } from "@/lib/utils/time";

interface Invite {
  id: string;
  code: string;
  url: string;
  uses: number;
  maxUses: number;
  revoked: boolean;
  expired: boolean;
  createdAt: string;
}

/** Create, copy and revoke room invite links. */
export function InvitePanel({ roomId }: { roomId: string }) {
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const { copied, copy } = useCopyToClipboard();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await apiFetch<Invite[]>(`/api/invites?roomId=${roomId}`));
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    try {
      await apiFetch("/api/invites", { method: "POST", json: { maxUses: 12 } });
      toast.success("Invite link created");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't create an invite.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try {
      await apiFetch(`/api/invites?id=${id}`, { method: "DELETE" });
      toast.success("Invite revoked");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't revoke that invite.");
    }
  }

  const active = invites.filter((i) => !i.revoked && !i.expired);
  const latest = active[0];

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void create()} loading={creating}>
            <Plus className="size-3.5" />
            New invite link
          </Button>
          {loading ? <span className="text-[12px] text-ink-muted">Loading…</span> : null}
        </div>

        {latest ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={latest.url} aria-label="Invite link" className="font-mono text-[12.5px]" />
            <Button
              variant="secondary"
              onClick={() => void copy(latest.url)}
              className="shrink-0"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">
            No active invite links yet. Create one to bring your roommates in.
          </p>
        )}

        {active.length > 0 ? (
          <ul className="divide-y divide-border-subtle rounded-lg border border-border">
            {active.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 px-3 py-2">
                <Link2 className="size-3.5 shrink-0 text-ink-muted" />
                <span className="font-mono text-[12.5px] text-ink">{invite.code}</span>
                <span className="tabular text-[11.5px] text-ink-muted">
                  {invite.uses}/{invite.maxUses} used
                </span>
                <span className="ml-auto text-[11.5px] text-ink-muted">
                  {formatRelative(invite.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void revoke(invite.id)}
                  aria-label="Revoke invite"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {invites.some((i) => i.revoked || i.expired) ? (
          <Badge tone="neutral">
            {invites.filter((i) => i.revoked || i.expired).length} expired or revoked
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}