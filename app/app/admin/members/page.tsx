import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/rbac";
import { listHostelUsers } from "@/lib/repositories/users";
import { MembersManager } from "@/components/admin/members-manager";

export const metadata: Metadata = { title: "Members", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const ctx = await requireAdmin();
  if (!ctx.hostelId) return null;

  const users = await listHostelUsers(ctx.hostelId);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">Members</h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Everyone registered in {ctx.hostelName}. Promote hostel admins or remove
          someone from a room.
        </p>
      </header>
      <MembersManager
        initial={users.map((u) => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          role: u.role,
          roomNumber: u.room_number,
          roomId: u.room_id,
          fills: Number(u.fills ?? 0),
          bottles: Number(u.bottles ?? 0),
          lastActivityAt: u.last_activity_at,
          lastSeenAt: u.last_seen_at,
        }))}
      />
    </div>
  );
}