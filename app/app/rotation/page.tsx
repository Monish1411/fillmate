import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/rbac";
import { getRotation } from "@/lib/services/rotation";
import { getRoomMembers } from "@/lib/repositories/members";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { RotationManager } from "@/components/app/rotation-manager";
import { EmptyState } from "@/components/ui/states";
import { CalendarClock } from "lucide-react";

export const metadata: Metadata = { title: "Refill rotation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RotationPage() {
  const ctx = await getAuthContext();
  if (!ctx?.roomId || !ctx.hostelId) return null;

  const settings = await getHostelSettings(ctx.hostelId);
  if (!settings.rotation) {
    return (
      <div className="space-y-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Refill rotation
        </h1>
        <EmptyState
          icon={<CalendarClock />}
          title="Rotation is turned off"
          description="Your hostel admin has disabled the refill schedule for this hostel."
        />
      </div>
    );
  }

  const [turns, members] = await Promise.all([
    getRotation(ctx.roomId, ctx.hostelId, ctx.user.timezone, ctx.user.id),
    getRoomMembers(ctx.roomId),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Refill rotation
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Everyone takes a turn. Skip, swap or volunteer &mdash; the schedule stays
          shared so nobody has to ask.
        </p>
      </header>
      <RotationManager
        initialTurns={turns}
        members={members.map((m) => ({ id: m.user_id, name: m.display_name?.trim() || m.full_name }))}
        viewerId={ctx.user.id}
      />
    </div>
  );
}