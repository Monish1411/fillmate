import "server-only";
import { AuthError, assertRoomAccess, type AuthContext } from "@/lib/auth/rbac";
import { getSql } from "@/lib/db/client";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { createActivitySchema } from "@/lib/validation/schemas";
import { decodeDataUrl, ImageRejected, processEvidenceImage } from "@/lib/storage/image";
import { buildEvidenceKey, putEvidence } from "@/lib/storage";
import { verifyEvidence, type VerificationDecision } from "@/lib/ai/verify";
import { getHostelSettings } from "@/lib/repositories/hostels";
import { getRoom, getRoomStatus, resolveCooler } from "@/lib/repositories/rooms";
import { getActivityById } from "@/lib/repositories/activities";
import { publish } from "@/lib/realtime/bus";
import { evaluateLocation, type LocationEvaluation } from "./geo";
import { runPostRecordSideEffects } from "./post-record";
import { uuid } from "@/lib/utils/id";
import { DEFAULT_TZ } from "@/lib/utils/time";
import type { CreateActivityRequest, CreateActivityResponse } from "@/types/api";
import type { CoolerRow } from "@/types/core";

/**
 * The core write path.
 *
 * Order matters: validate -> rate limit -> process image -> store evidence ->
 * verify -> persist atomically -> read back -> broadcast -> side effects.
 *
 * The activity row is written only after verification completes, so the feed
 * never shows a half-finished record.
 */

async function resolveRequestedCooler(
  requestedId: string | null,
  hostelId: string,
  fallback: CoolerRow | null,
): Promise<CoolerRow | null> {
  if (!requestedId) return fallback;
  const sql = await getSql();
  const rows = await sql.query<CoolerRow>(
    `SELECT * FROM "coolers" WHERE "id" = ? AND "hostel_id" = ? AND "active" = TRUE LIMIT 1`,
    [requestedId, hostelId],
  );
  return rows[0] ?? fallback;
}

const NO_IMAGE_DECISION: VerificationDecision = {
  outcome: {
    verified: false,
    confidence: 0,
    cooler_detected: false,
    bottles_detected: 0,
    filling_context_detected: false,
    duplicate_suspected: false,
    reason: "No photo was attached, so an administrator will confirm this refill.",
    provider: "none",
    model: "none",
    latencyMs: 0,
  },
  status: "needs_review",
  reviewStatus: "pending",
  signals: {
    duplicateExact: false,
    duplicatePerceptual: false,
    duplicateOfId: null,
    tooFast: false,
    highVolume: false,
    reasons: [
      {
        code: "no_photo",
        label: "No photo attached",
        detail: "Photo evidence is switched off for this hostel.",
      },
    ],
  },
  verdict: null,
};

export async function recordRefill(
  rawRequest: CreateActivityRequest,
  ctx: AuthContext,
): Promise<CreateActivityResponse> {
  const input = createActivitySchema.parse(rawRequest);

  const limiter = rateLimit(`activity:${ctx.user.id}`, LIMITS.activity);
  if (!limiter.allowed) {
    throw new AuthError(
      "rate_limited",
      "You've recorded several refills in a row. Take a breather and try again.",
    );
  }

  const roomId = ctx.roomId;
  if (!roomId || !ctx.hostelId) {
    throw new AuthError("forbidden", "Join a room before recording a refill.");
  }
  const { hostelId: scopedHostel } = await assertRoomAccess(ctx, roomId);
  const settings = await getHostelSettings(scopedHostel);

  const room = await getRoom(roomId);
  if (!room) throw new AuthError("not_found", "That room no longer exists.");

  const cooler = await resolveRequestedCooler(
    input.coolerId ?? null,
    scopedHostel,
    await resolveCooler(scopedHostel, roomId),
  );

  /* -- Evidence ------------------------------------------------ */

  const decoded = input.imageBase64 ? decodeDataUrl(input.imageBase64) : null;
  if (input.imageBase64 && !decoded) {
    throw new AuthError("validation_error", "That photo couldn't be read. Try again.");
  }
  if (!decoded && settings.photo_evidence) {
    throw new AuthError("validation_error", "Add a photo so your refill can be verified.");
  }

  let processed: Awaited<ReturnType<typeof processEvidenceImage>> | null = null;
  let storage: { key: string; provider: "local" | "supabase"; byteSize: number } | null = null;

  if (decoded) {
    try {
      processed = await processEvidenceImage(decoded.buffer, decoded.mime);
    } catch (err) {
      if (err instanceof ImageRejected) throw new AuthError("validation_error", err.message);
      throw err;
    }
    const key = buildEvidenceKey(scopedHostel, processed.buffer, processed.ext);
    storage = await putEvidence(key, processed.buffer, `image/${processed.mime}`);
  }

  /* -- Verification -------------------------------------------- */

  const serverTimestamp = new Date().toISOString();
  const timezone = input.timezone || ctx.user.timezone || DEFAULT_TZ;

  const decision = processed
    ? await verifyEvidence({
        image: {
          buffer: processed.buffer,
          mime: processed.mime,
          sha256: processed.sha256,
          phash: processed.phash,
        },
        claimedBottleCount: input.bottleCount,
        hostelId: scopedHostel,
        userId: ctx.user.id,
        roomNumber: room.number,
        coolerLabel: cooler?.label ?? null,
      })
    : NO_IMAGE_DECISION;

  const location: LocationEvaluation = evaluateLocation(
    input.location ?? null,
    cooler,
    settings.location_verification,
  );

  /* -- Persist -------------------------------------------------- */

  const activityId = uuid();
  const sql = await getSql();
  const flagged = decision.signals.reasons.map((r) => r.code);
  const duplicate = decision.signals.duplicateExact || decision.signals.duplicatePerceptual;

  await sql.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO "water_activities" (
         "id", "user_id", "hostel_id", "room_id", "cooler_id", "bottle_count",
         "status", "ai_confidence", "cooler_detected", "bottles_detected",
         "filling_context_detected", "duplicate_suspected", "duplicate_of",
         "image_hash", "perceptual_hash", "latitude", "longitude",
         "location_accuracy", "distance_from_cooler_m", "location_status",
         "qr_scanned", "client_timestamp", "server_timestamp", "timezone",
         "note", "review_status", "flagged_reasons", "created_at", "updated_at"
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        activityId,
        ctx.user.id,
        scopedHostel,
        roomId,
        cooler?.id ?? null,
        input.bottleCount,
        decision.status,
        decision.outcome.confidence,
        decision.outcome.cooler_detected,
        decision.outcome.bottles_detected,
        decision.outcome.filling_context_detected,
        duplicate,
        decision.signals.duplicateOfId,
        processed?.sha256 ?? null,
        processed?.phash ?? null,
        input.location?.latitude ?? null,
        input.location?.longitude ?? null,
        location.accuracy,
        location.distanceMeters,
        location.status,
        Boolean(input.qrCode),
        input.clientTimestamp ?? null,
        serverTimestamp,
        timezone,
        input.note ?? null,
        decision.reviewStatus,
        flagged.length ? JSON.stringify(flagged) : null,
        serverTimestamp,
        serverTimestamp,
      ],
    );

    if (storage && processed) {
      await tx.execute(
        `INSERT INTO "activity_images" (
           "id", "activity_id", "storage_key", "storage_provider", "mime_type",
           "byte_size", "width", "height", "sha256", "phash", "retention_until", "created_at"
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuid(),
          activityId,
          storage.key,
          storage.provider,
          processed.mime,
          storage.byteSize,
          processed.width || null,
          processed.height || null,
          processed.sha256,
          processed.phash,
          new Date(Date.now() + settings.retentionDays * 86_400_000).toISOString(),
          serverTimestamp,
        ],
      );
    }

    await tx.execute(
      `INSERT INTO "ai_verifications" (
         "id", "activity_id", "provider", "model", "status", "confidence",
         "cooler_detected", "bottles_detected", "filling_context_detected",
         "duplicate_suspected", "reason", "raw_response", "latency_ms", "created_at"
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        activityId,
        decision.outcome.provider,
        decision.outcome.model,
        decision.status,
        decision.outcome.confidence,
        decision.outcome.cooler_detected,
        decision.outcome.bottles_detected,
        decision.outcome.filling_context_detected,
        decision.outcome.duplicate_suspected,
        decision.outcome.reason,
        JSON.stringify(decision.outcome.raw ?? {}),
        decision.outcome.latencyMs,
        serverTimestamp,
      ],
    );
  });

  const activity = await getActivityById(activityId, ctx.user.id);
  if (!activity) throw new Error("Activity could not be read back after saving.");
  const roomStatus = await getRoomStatus(roomId, timezone);

  /* -- Broadcast + side effects --------------------------------- */

  void publish(
    "activity.created",
    { hostelId: scopedHostel, roomId, userId: ctx.user.id },
    {
      activityId,
      roomNumber: room.number,
      actorName: activity.actorName,
      actorInitials: activity.actorInitials,
      bottleCount: input.bottleCount,
      status: decision.status,
      serverTimestamp,
    },
  );

  void runPostRecordSideEffects({
    ctx,
    room,
    activityId,
    bottleCount: input.bottleCount,
    status: decision.status,
    roomStatus,
    timezone,
    settings,
  });

  return { activity, verification: decision.outcome, roomStatus: roomStatus! };
}
