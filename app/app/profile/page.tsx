import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/rbac";
import { getContributionStats } from "@/lib/repositories/users";
import { findUserById } from "@/lib/repositories/users";
import { listAchievements } from "@/lib/services/achievements";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { ProfileView } from "@/components/app/profile-view";
import { getRoomTotals } from "@/lib/repositories/rooms";
import { startOfTodayIso } from "@/lib/utils/time";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const tz = ctx.user.timezone;
  const [stats, user, settings, roomTotals] = await Promise.all([
    getContributionStats(ctx.user.id, tz),
    findUserById(ctx.user.id),
    ctx.hostelId ? getHostelSettings(ctx.hostelId) : Promise.resolve(null),
    ctx.roomId
      ? getRoomTotals(ctx.roomId, startOfTodayIso(tz))
      : Promise.resolve({ bottles: 0, refills: 0, days: 1 }),
  ]);

  if (!user) return null;

  const achievements = await listAchievements(ctx.user.id);

  return (
    <ProfileView
      user={{
        id: user.id,
        name: user.display_name?.trim() || user.full_name,
        fullName: user.full_name,
        initials: (user.display_name?.trim() || user.full_name)
          .split(/\s+/)
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase(),
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        role: user.role,
        roomNumber: ctx.roomNumber,
        hostelName: ctx.hostelName,
        memberSince: user.created_at,
      }}
      stats={stats}
      roomBottles={roomTotals.bottles}
      achievements={achievements.map((a) => ({
        key: a.key,
        title: a.title,
        description: a.description,
        earnedAt: a.earnedAt,
        icon: a.icon,
      }))}
      gamification={settings?.gamification ?? true}
    />
  );
}