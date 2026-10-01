import "server-only";
import { AuthError, assertActivityAccess, assertNotSelfReview, type AuthContext } from "@/lib/auth/rbac";
import { getSql } from "@/lib/db/client";
import { uuid } from "@/lib/utils/id";
import { publish } from "@/lib/realtime/bus";
import { notify } from "@/lib/repositories/notifications";
import { logAdminAction } from "@/lib/repositories/reports";
import { getActivityRow } from "@/lib/repositories/activities";
import type { ReviewDecisionRequest } from "@/types/api";

/**
 * Human review of flagged activities.
 *
 * Rules enforced here:
 *   • only admins of the owning hostel may review
 *   • nobody may review their own submission
 *   • every decision is written to the immutable admin_actions log
 */

const STATUS_BY_DECISION = {
  approved: "verified",
  rejected: "rejected",
  re_upload_requested: "needs_review",
} as const;

const NOTIFICATION_BY_DECISION = {
  approved: "activity_approved",
  rejected: "activity_rejected",
  re_upload_requested: "reupload_requested",
} as const;

const COPY_BY_DECISION = {
  approved: {
    title: "Your refill was approved",
    body: "An administrator confirmed the photo. Thanks for keeping the room going.",
  },
  rejected: {
    title: "Your refill could not be accepted",
    body: "An administrator reviewed the photo and it did not match the record. You can record a fresh refill.",
  },
  re_upload_requested: {
    title: "A clearer photo would help",
    body: "The cooler wasn't clearly visible. Retake it with the bottles and cooler in frame.",
  },
} as const;

export async function reviewActivity(
  ctx: AuthContext,
  activityId: string,
  decision: ReviewDecisionRequest,
  ip?: string | null,
): Promise<{ status: string; reviewStatus: string }> {
  const activity = await assertActivityAccess(ctx, activityId);
  assertNotSelfReview(ctx, activity.user_id);

  if (activity.review_status === "not_required" && decision.decision !== "approved") {
    throw new AuthError(
      "conflict",
      "This activity was already verified automatically — no review is needed.",
    );
  }

  const sql = await getSql();
  const now = new Date().toISOString();
  const status = STATUS_BY_DECISION[decision.decision];
  const reviewStatus = decision.decision;

  await sql.transaction(async (tx) => {
    await tx.execute(
      `UPDATE "water_activities"
          SET "status" = ?, "review_status" = ?, "reviewed_by" = ?, "reviewed_at" = ?,
              "review_note" = ?, "updated_at" = ?
        WHERE "id" = ?`,
      [status, reviewStatus, ctx.user.id, now, decision.note ?? null, now, activityId],
    );

    await tx.execute(
      `INSERT INTO "ai_verifications"
         ("id", "activity_id", "provider", "model", "status", "confidence",
          "cooler_detected", "bottles_detected", "filling_context_detected",
          "duplicate_suspected", "reason", "raw_response", "latency_ms", "created_at")
       VALUES (?, ?, 'manual', 'human-review', ?, NULL, NULL, NULL, NULL, 0, ?, ?, 0, ?)`,
      [
        uuid(),
        activityId,
        status,
        decision.note ?? `Reviewed by ${ctx.user.full_name}`,
        JSON.stringify({
          decision: decision.decision,
          reviewer: ctx.user.id,
          reviewerName: ctx.user.full_name,
        }),
        now,
      ],
    );
  });

  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: activity.hostel_id,
    action: `activity.${decision.decision}`,
    targetType: "water_activity",
    targetId: activityId,
    metadata: { note: decision.note ?? null },
    ip: ip ?? null,
  });

  const row = await getActivityRow(activityId);
  await notify({
    userId: activity.user_id,
    hostelId: activity.hostel_id,
    roomId: activity.room_id,
    type: NOTIFICATION_BY_DECISION[decision.decision],
    title: COPY_BY_DECISION[decision.decision].title,
    body: COPY_BY_DECISION[decision.decision].body,
    activityId,
    category: "reviews",
  });

  await publish(
    "activity.reviewed",
    { hostelId: activity.hostel_id, roomId: activity.room_id, userId: activity.user_id },
    {
      activityId,
      status,
      reviewStatus,
      bottleCount: row?.bottle_count ?? 0,
    },
  );

  return { status, reviewStatus };
}