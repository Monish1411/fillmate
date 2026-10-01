"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import type { InvitePreview } from "@/types/api";

export function JoinRoomCard({
  preview,
  signedIn,
  inviteCode,
}: {
  preview: InvitePreview;
  signedIn: boolean;
  inviteCode: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/invites/join", { method: "POST", json: { code: inviteCode } });
      toast.success("Room joined");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "We couldn't join that room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-e2">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
      </div>

      {preview.valid ? (
        <>
          <div className="space-y-1">
            <h1 className="text-[20px] font-semibold tracking-[-0.025em] text-ink">
              Join Room {preview.roomNumber}
            </h1>
            <p className="text-[13.5px] text-ink-muted">{preview.hostelName}</p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
            <Users className="size-4 shrink-0 text-ink-muted" />
            <p className="text-[12.5px] text-ink-secondary">
              {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"} ·{" "}
              {preview.bottleTarget} bottles a day
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-[12.5px] text-danger">
              {error}
            </p>
          ) : null}

          <Button size="lg" className="w-full" onClick={() => void join()} loading={loading}>
            {signedIn ? "Join room" : "Sign in to join"}
          </Button>
          {!signedIn ? (
            <Button size="lg" variant="secondary" className="w-full" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          ) : null}
        </>
      ) : (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft">
            <CircleAlert className="size-6 text-warning" />
          </div>
          <div className="space-y-1">
            <h1 className="text-[18px] font-semibold text-ink">Invite unavailable</h1>
            <p className="text-[13px] text-ink-muted">{preview.reason}</p>
          </div>
          <Badge tone="neutral" className="mx-auto">
            Code {preview.code}
          </Badge>
          <Button size="lg" variant="secondary" className="w-full" asChild>
            <Link href="/">Back to FillMate</Link>
          </Button>
        </div>
      )}
    </div>
  );
}