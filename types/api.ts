import type { AdminMetrics, AnalyticsPoint, ContributionBar, HourBucket, VerificationDonut } from "./views";

/** Uniform envelope for every JSON API route. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorShape };

export interface ApiErrorShape {
  code: ApiErrorCode;
  message: string;
  /** Optional field-level validation detail. Never leaks internals. */
  fields?: Record<string, string>;
  /** Set when the UI should offer a retry. */
  retryable?: boolean;
}

export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "validation_error",
  "rate_limited",
  "conflict",
  "upload_rejected",
  "ai_unavailable",
  "db_error",
  "unknown",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface CreateActivityRequest {
  bottleCount: number;
  imageBase64?: string;
  imageKey?: string;
  coolerId?: string | null;
  note?: string;
  location?: { latitude: number; longitude: number; accuracy: number } | null;
  clientTimestamp?: string;
  timezone?: string;
  qrCode?: string | null;
}

export interface CreateActivityResponse {
  activity: import("./views").ActivityView;
  verification: import("./views").VerificationOutcome;
  roomStatus: import("./views").RoomStatusView;
}

export interface ActivityQuery {
  roomId?: string;
  hostelId?: string;
  userId?: string;
  status?: string;
  reviewStatus?: string;
  from?: string;
  to?: string;
  minBottles?: number;
  maxBottles?: number;
  search?: string;
  sort?: "newest" | "oldest" | "most_bottles";
  limit?: number;
  offset?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAnalyticsResponse {
  range: { from: string; to: string; label: string };
  metrics: AdminMetrics;
  series: AnalyticsPoint[];
  hours: HourBucket[];
  contribution: ContributionBar[];
  verification: VerificationDonut;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
    members: number;
    bottles: number;
    refills: number;
    lastRefillAt: string | null;
  }>;
  flaggedRate: number;
  busiestHour: number | null;
}

export interface ReviewDecisionRequest {
  decision: "approved" | "rejected" | "re_upload_requested";
  note?: string;
}

export interface InvitePreview {
  code: string;
  roomNumber: string;
  hostelName: string;
  bottleTarget: number;
  memberCount: number;
  valid: boolean;
  reason?: string;
}