import "server-only";
import type { AuthContext } from "@/lib/auth/rbac";
import { getRoomStatus, getRoomTotals, resolveCooler } from "@/lib/repositories/rooms";
import { getRoomContributions } from "@/lib/repositories/members";
import { getContributionStats } from "@/lib/repositories/users";
import { listActivities } from "@/lib/repositories/activities";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { getRotation } from "./rotation";
import { countUnread } from "@/lib/repositories/notifications";
import { startOfTodayIso } from "@/lib/utils/time";
import type {
  ActivityView,
  ContributionStats,
  MemberContribution,
  RoomContributionSummary,
  RoomStatusView,
  RotationTurn,
} from "@/types/views";
import type { CoolerRow } from "@/types/core";

/**
 * Dashboard projection.
 *
 * One call returns everything the student home screen needs, so the page
 * renders from a single server round-trip and streams without waterfalls.
 */

export interface DashboardData {
  roomStatus: RoomStatusView | null;
  recentActivity: ActivityView[];
  contributions: MemberContribution[];
  stats: ContributionStats;
  roomSummary: RoomContributionSummary;
  rotation: RotationTurn[];
  cooler: CoolerRow | null;
  unreadNotifications: number;
  features: {
    leaderboard: boolean;
    rotation: boolean;
    gamification: boolean;
    location: boolean;
    photoEvidence: boolean;
    notifications: boolean;
  };
}

export async function getDashboard(ctx: AuthContext): Promise<DashboardData> {
  const tz = ctx.user.timezone;
  const roomId = ctx.roomId;
  const hostelId = ctx.hostelId;

  const features = {
    leaderboard: true,
    rotation: true,
    gamification: true,
    location: false,
    photoEvidence: true,
    notifications: true,
  };

  if (!roomId || !hostelId) {
    return {
      roomStatus: null,
      recentActivity: [],
      contributions: [],
      stats: {
        fills: 0,
        weekFills: 0,
        monthFills: 0,
        bottles: 0,
        avgPerDay: 0,
        verificationRate: 100,
        streak: 0,
      },
      roomSummary: { roomBottles: 0, activeMembers: 0, totalMembers: 0, dailyAverage: 0, fillsToday: 0 },
      rotation: [],
      cooler: null,
      unreadNotifications: await countUnread(ctx.user.id),
      features,
    };
  }

  const settings = await getHostelSettings(hostelId);
  features.leaderboard = settings.leaderboard;
  features.rotation = settings.rotation;
  features.gamification = settings.gamification;
  features.location = settings.location_verification;
  features.photoEvidence = settings.photo_evidence;
  features.notifications = settings.notifications;

  const [roomStatus, feed, contributions, stats, totals, rotation, cooler, unread] =
    await Promise.all([
      getRoomStatus(roomId, tz),
      listActivities(
        { scopeHostelId: hostelId, roomId, limit: 12, sort: "newest" },
        ctx.user.id,
      ),
      settings.leaderboard
        ? getRoomContributions(roomId, ctx.user.id, monthStartIso(tz))
        : Promise.resolve([]),
      getContributionStats(ctx.user.id, tz),
      getRoomTotals(roomId, monthStartIso(tz)),
      settings.rotation
        ? getRotation(roomId, hostelId, tz, ctx.user.id)
        : Promise.resolve([]),
      resolveCooler(hostelId, roomId),
      countUnread(ctx.user.id),
    ]);

  return {
    roomStatus,
    recentActivity: feed.items,
    contributions,
    stats,
    roomSummary: {
      roomBottles: totals.bottles,
      activeMembers: contributions.filter((c) => !c.hidden && c.fills > 0).length,
      totalMembers: contributions.length,
      dailyAverage: Math.round((totals.bottles / totals.days) * 10) / 10,
      fillsToday: roomStatus?.activeToday ?? 0,
    },
    rotation,
    cooler,
    unreadNotifications: unread,
    features,
  };
}

function monthStartIso(tz: string): string {
  return startOfTodayIso(tz);
}