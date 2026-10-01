import type {
  AiStatus,
  LocationStatus,
  RoomRole,
  RoomStatus,
  ReviewStatus,
  RotationStatus,
  UserPreferences,
  UserRole,
} from "./core";
export type {
  AiStatus,
  LocationStatus,
  ReportStatus,
  RoomRole,
  RoomStatus,
  ReviewStatus,
  RotationStatus,
  UserRole,
} from "./core";

/* ── Composed view models consumed by the UI ─────────────────── */

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  initials: string;
  role: UserRole;
  hostelId: string | null;
  hostelName: string | null;
  roomId: string | null;
  roomNumber: string | null;
  onboarded: boolean;
  avatarUrl: string | null;
  theme: "system" | "light" | "dark";
  timezone: string;
  preferences: UserPreferences;
}

export interface ActivityView {
  id: string;
  userId: string;
  actorName: string;
  actorInitials: string;
  actorHidden: boolean;
  actorAvatar: string | null;
  hostelId: string;
  roomId: string;
  roomNumber: string;
  coolerId: string | null;
  coolerLabel: string | null;
  bottleCount: number;
  status: AiStatus;
  reviewStatus: ReviewStatus;
  confidence: number | null;
  coolerDetected: boolean | null;
  bottlesDetected: number | null;
  fillingContextDetected: boolean | null;
  duplicateSuspected: boolean;
  locationStatus: LocationStatus;
  distanceMeters: number | null;
  locationAccuracy: number | null;
  qrScanned: boolean;
  serverTimestamp: string;
  timezone: string;
  note: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  sha256: string | null;
  flaggedReasons: string[];
  reviewNote: string | null;
  isMine: boolean;
}

export interface RoomStatusView {
  roomId: string;
  roomNumber: string;
  hostelId: string;
  hostelName: string;
  target: number;
  filled: number;
  remaining: number;
  percent: number;
  status: RoomStatus;
  lastRefill: {
    activityId: string;
    actorName: string;
    bottleCount: number;
    timestamp: string;
    status: AiStatus;
  } | null;
  memberCount: number;
  activeToday: number;
  deadlineHour: number;
  updatedAt: string;
}

export interface MemberContribution {
  userId: string;
  name: string;
  initials: string;
  isMe: boolean;
  roomRole: RoomRole;
  fills: number;
  bottles: number;
  lastActivityAt: string | null;
  hidden: boolean;
  avatarUrl: string | null;
}

export interface ContributionStats {
  fills: number;
  weekFills: number;
  monthFills: number;
  bottles: number;
  avgPerDay: number;
  verificationRate: number;
  streak: number;
}

export interface RoomContributionSummary {
  roomBottles: number;
  activeMembers: number;
  totalMembers: number;
  dailyAverage: number;
  fillsToday: number;
}

export interface RotationTurn {
  id: string | null;
  date: string;
  userId: string;
  name: string;
  initials: string;
  status: RotationStatus;
  isToday: boolean;
  isTomorrow: boolean;
  isMe: boolean;
  skipReason: string | null;
  swappedToName: string | null;
}

export interface AchievementView {
  key: string;
  title: string;
  description: string;
  earnedAt: string | null;
  icon: string;
}

export interface AdminMetrics {
  totalStudents: number;
  activeStudents: number;
  todayRefills: number;
  bottlesFilled: number;
  verificationRate: number;
  flaggedActivities: number;
  pendingReview: number;
  participationRate: number;
  totalRooms: number;
}

export interface AnalyticsPoint {
  date: string;
  label: string;
  refills: number;
  bottles: number;
}

export interface HourBucket {
  hour: number;
  count: number;
}

export interface ContributionBar {
  label: string;
  name: string;
  fills: number;
  bottles: number;
  isMe: boolean;
}

export interface VerificationDonut {
  verified: number;
  needsReview: number;
  rejected: number;
  unavailable: number;
}

export interface VerificationOutcome {
  verified: boolean;
  confidence: number;
  cooler_detected: boolean;
  bottles_detected: number;
  filling_context_detected: boolean;
  duplicate_suspected: boolean;
  reason: string;
  raw?: unknown;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface FlagReason {
  code: string;
  label: string;
  detail: string;
}