"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Check, CircleSlash, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { cn } from "@/lib/utils/cn";
import type { RotationTurn } from "@/types/views";

interface Member {
  id: string;
  name: string;
}

export function RotationManager({
  initialTurns,
  members,
  viewerId,
}: {
  initialTurns: RotationTurn[];
  members: Member[];
  viewerId: string;
}) {
  const router = useRouter();
  const [turns, setTurns] = React.useState(initialTurns);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [swapTurn, setSwapTurn] = React.useState<RotationTurn | null>(null);
  const [swapTarget, setSwapTarget] = React.useState("");
  const [skipReason, setSkipReason] = React.useState("");
  const [skipTurnRow, setSkipTurnRow] = React.useState<RotationTurn | null>(null);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      setTurns(await apiFetch<RotationTurn[]>("/api/rotation", { method: "POST", json: body }));
      toast.success("Schedule updated");
      setSwapTurn(null);
      setSkipTurnRow(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't update the schedule.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border-subtle">
            {turns.map((turn) => (
              <li key={`${turn.date}-${turn.userId}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="w-20 shrink-0">
                  <p
                    className={cn(
                      "text-[13px] font-medium",
                      turn.isToday ? "text-aqua" : "text-ink-muted",
                    )}
                  >
                    {turn.isToday ? "Today" : shortDay(turn.date)}
                  </p>
                  {turn.isTomorrow ? (
                    <p className="text-[11px] text-ink-muted">Tomorrow</p>
                  ) : null}
                </div>

                <Avatar name={turn.name} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">
                    {turn.isMe ? "You" : turn.name}
                  </p>
                  {turn.skipReason ? (
                    <p className="truncate text-[11.5px] text-ink-muted">
                      {turn.skipReason}
                    </p>
                  ) : null}
                </div>

                {turn.status === "completed" ? (
                  <Badge tone="success">
                    <Check className="size-3" />
                    Done
                  </Badge>
                ) : turn.status === "skipped" ? (
                  <Badge tone="neutral">
                    <CircleSlash className="size-3" />
                    Skipped
                  </Badge>
                ) : (
                  <div className="flex gap-1">
                    {!turn.isMe ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Take this turn"
                        aria-label="Take this turn"
                        loading={busy === `claim-${turn.date}`}
                        onClick={() =>
                          void act({ date: turn.date, action: "claim" }, `claim-${turn.date}`)
                        }
                      >
                        <Hand className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSwapTurn(turn);
                        setSwapTarget("");
                      }}
                    >
                      <ArrowLeftRight className="size-3.5" />
                      Swap
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSkipTurnRow(turn)}
                    >
                      <CircleSlash className="size-3.5" />
                      Skip
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={Boolean(swapTurn)} onOpenChange={(o) => !o && setSwapTurn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Swap this turn</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Field label="Hand it to" htmlFor="swap-target">
              <select
                id="swap-target"
                value={swapTarget}
                onChange={(e) => setSwapTarget(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-[14px]"
              >
                <option value="">Choose a roommate</option>
                {members
                  .filter((m) => m.id !== swapTurn?.userId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === viewerId ? "You" : m.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSwapTurn(null)}>
              Cancel
            </Button>
            <Button
              disabled={!swapTarget}
              loading={busy === `swap-${swapTurn?.date}`}
              onClick={() =>
                swapTurn &&
                void act(
                  { date: swapTurn.date, action: "swap", targetUserId: swapTarget },
                  `swap-${swapTurn.date}`,
                )
              }
            >
              Swap turn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(skipTurnRow)} onOpenChange={(o) => !o && setSkipTurnRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as unavailable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Field label="Reason" optional htmlFor="skip-reason" hint="Shared with your roommates.">
              <Input
                id="skip-reason"
                value={skipReason}
                maxLength={200}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Out for classes"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipTurnRow(null)}>
              Cancel
            </Button>
            <Button
              loading={busy === `skip-${skipTurnRow?.date}`}
              onClick={() =>
                skipTurnRow &&
                void act(
                  { date: skipTurnRow.date, action: "skip", reason: skipReason || undefined },
                  `skip-${skipTurnRow.date}`,
                )
              }
            >
              Mark unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}