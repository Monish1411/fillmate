import type {
  AiStatus,
  LocationStatus,
  ReviewStatus,
  ReportStatus,
} from "./core";
export type { NotificationType, RotationStatus, ReportStatus } from "./core";

/* ── Evidence & activity rows ────────────────────────────────── */

export interface WaterActivityRow {
  id: string;
  user_id: string;
  hostel_id: string;
  room_id: string;
  cooler_id: string | null;
  bottle_count: number;
  status: AiStatus;
  ai_confidence: number | null;
  cooler_detected: number | null;
  bottles_detected: number | null;
  filling_context_detected: number | null;
  duplicate_suspected: number;
  duplicate_of: string | null;
  image_hash: string | null;
  perceptual_hash: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  distance_from_cooler_m: number | null;
  location_status: LocationStatus;
  qr_scanned: number;
  client_timestamp: string | null;
  server_timestamp: string;
  timezone: string;
  note: string | null;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  flagged_reasons: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityImageRow {
  id: string;
  activity_id: string;
  storage_key: string;
  storage_provider: "local" | "supabase";
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  sha256: string;
  phash: string | null;
  retention_until: string | null;
  created_at: string;
}

export interface AiVerificationRow {
  id: string;
  activity_id: string | null;
  provider: string;
  model: string;
  status: AiStatus;
  confidence: number | null;
  cooler_detected: number | null;
  bottles_detected: number | null;
  filling_context_detected: number | null;
  duplicate_suspected: number;
  reason: string | null;
  raw_response: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  hostel_id: string | null;
  room_id: string | null;
  type: string;
  title: string;
  body: string | null;
  activity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface RotationRow {
  id: string;
  room_id: string;
  hostel_id: string;
  user_id: string;
  scheduled_for: string;
  status: "upcoming" | "completed" | "skipped" | "swapped";
  swapped_to_user_id: string | null;
  skip_reason: string | null;
  completed_activity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  reporter_user_id: string;
  activity_id: string;
  room_id: string;
  hostel_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AdminActionRow {
  id: string;
  actor_user_id: string;
  actor_name: string | null;
  hostel_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: string | null;
  ip: string | null;
  created_at: string;
}