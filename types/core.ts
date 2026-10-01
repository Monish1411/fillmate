/**
 * FillMate — core enums & row shapes.
 * These mirror the SQL schema 1:1. Timestamps are always ISO-8601 UTC
 * strings in storage and are formatted for display at the edge.
 */

export const USER_ROLES = ["student", "hostel_admin", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROOM_ROLES = ["member", "captain"] as const;
export type RoomRole = (typeof ROOM_ROLES)[number];

export const AI_STATUSES = ["verified", "needs_review", "rejected", "unavailable"] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export const REVIEW_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
  "re_upload_requested",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const LOCATION_STATUSES = ["near", "far", "unavailable"] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

export const ROOM_STATUSES = ["full", "needs_refill", "overdue", "unknown"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROTATION_STATUSES = ["upcoming", "completed", "skipped", "swapped"] as const;
export type RotationStatus = (typeof ROTATION_STATUSES)[number];

export const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "refill_recorded",
  "target_reached",
  "room_overdue",
  "rotation_today",
  "rotation_tomorrow",
  "rotation_skipped",
  "rotation_swap_request",
  "activity_flagged",
  "activity_approved",
  "activity_rejected",
  "reupload_requested",
  "report_filed",
  "report_resolved",
  "room_joined",
  "welcome",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const FEATURE_FLAGS = [
  "ai_verification",
  "location_verification",
  "qr_cooler",
  "leaderboard",
  "rotation",
  "notifications",
  "gamification",
  "analytics",
  "invites",
  "photo_evidence",
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type FeatureConfig = Record<FeatureFlag, boolean>;

export const DEFAULT_FEATURES: FeatureConfig = {
  ai_verification: true,
  location_verification: true,
  qr_cooler: true,
  leaderboard: true,
  rotation: true,
  notifications: true,
  gamification: true,
  analytics: true,
  invites: true,
  photo_evidence: true,
};

export interface UserPreferences {
  notifyRefills: boolean;
  notifyRotation: boolean;
  notifyReviews: boolean;
  notifyWeekly: boolean;
  privacyShowContributions: boolean;
  privacyShowActivity: boolean;
  privacyShowName: boolean;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface HostelRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  city: string | null;
  timezone: string;
  bottle_target: number;
  refill_deadline_hour: number;
  settings: string;
  created_at: string;
}

export interface RoomRow {
  id: string;
  hostel_id: string;
  number: string;
  floor: string | null;
  bottle_target: number;
  refill_deadline_hour: number;
  invite_code: string;
  active: number;
  created_at: string;
}

export interface CoolerRow {
  id: string;
  hostel_id: string;
  room_id: string | null;
  label: string;
  qr_code: string | null;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_m: number | null;
  location_enforced: number;
  active: number;
  created_at: string;
}

export interface RoomMemberRow {
  id: string;
  room_id: string;
  user_id: string;
  hostel_id: string;
  role_in_room: RoomRole;
  joined_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  hostel_id: string | null;
  email_verified: number;
  onboarding_step: number;
  onboarded: number;
  theme: "system" | "light" | "dark";
  timezone: string;
  notify_refills: number;
  notify_rotation: number;
  notify_reviews: number;
  notify_weekly: number;
  privacy_show_contributions: number;
  privacy_show_activity: number;
  privacy_show_name: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
}

export interface InviteRow {
  id: string;
  code: string;
  room_id: string;
  hostel_id: string;
  created_by: string | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  revoked: number;
  created_at: string;
}

export interface AchievementRow {
  id: string;
  user_id: string;
  hostel_id: string | null;
  key: string;
  title: string;
  description: string | null;
  earned_at: string;
}

export interface RealtimeEventRow {
  id: string;
  hostel_id: string | null;
  room_id: string | null;
  type: string;
  payload: string;
  created_at: string;
}