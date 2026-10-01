import "server-only";
import { getSql } from "@/lib/db/client";
import { hammingDistance } from "@/lib/storage/image";
import { getProvider, AIUnavailableError, type ProviderVerdict } from "./index";
import type { VerificationOutcome } from "@/types/views";

/**
 * Verification orchestrator.
 *
 * Combines three independent trust signals into one decision:
 *   1. Vision model   — is the required evidence actually in the photo?
 *   2. Hash forensics — has this image (or a near-copy) been used before?
 *   3. Behaviour      — is the submission rate humanly possible?
 *
 * No single signal accuses a student. Anything suspicious produces
 * "needs review", which routes to a human administrator.
 */

export interface FraudSignals {
  duplicateExact: boolean;
  duplicatePerceptual: boolean;
  duplicateOfId: string | null;
  tooFast: boolean;
  highVolume: boolean;
  reasons: Array<{ code: string; label: string; detail: string }>;
}

const EXACT_MATCH_WINDOW_DAYS = 365;
const PERCEPTUAL_DISTANCE_THRESHOLD = 6;
const PERCEPTUAL_LOOKBACK_DAYS = 30;
const MIN_INTERVAL_SECONDS = 8;
const MAX_BOTTLES_PER_10_MIN = 20;

/** Compare the image against recent submissions in the same hostel. */
export async function detectDuplicates(
  hostelId: string,
  sha256: string,
  phash: string | null,
): Promise<{ exact: boolean; perceptual: boolean; ofId: string | null }> {
  const sql = await getSql();
  const since = new Date(Date.now() - EXACT_MATCH_WINDOW_DAYS * 86_400_000).toISOString();

  const exactRows = await sql.query<{ id: string }>(
    `SELECT "id" FROM "water_activities"
      WHERE "hostel_id" = ? AND "image_hash" = ? AND "created_at" > ?
        AND "deleted_at" IS NULL
      LIMIT 1`,
    [hostelId, sha256, since],
  );
  if (exactRows[0]) {
    return { exact: true, perceptual: true, ofId: exactRows[0].id };
  }

  if (!phash) return { exact: false, perceptual: false, ofId: null };

  const sincePerceptual = new Date(
    Date.now() - PERCEPTUAL_LOOKBACK_DAYS * 86_400_000,
  ).toISOString();
  const candidates = await sql.query<{
    id: string;
    perceptual_hash: string;
    user_id: string;
  }>(
    `SELECT "id", "perceptual_hash", "user_id" FROM "water_activities"
      WHERE "hostel_id" = ? AND "perceptual_hash" IS NOT NULL AND "created_at" > ?
        AND "deleted_at" IS NULL
      ORDER BY "created_at" DESC LIMIT 200`,
    [hostelId, sincePerceptual],
  );

  for (const candidate of candidates) {
    if (hammingDistance(candidate.perceptual_hash, phash) <= PERCEPTUAL_DISTANCE_THRESHOLD) {
      return { exact: false, perceptual: true, ofId: candidate.id };
    }
  }

  return { exact: false, perceptual: false, ofId: null };
}

/** Behavioural checks that do not depend on the image at all. */
export async function detectBehaviourAnomalies(
  userId: string,
  bottleCount: number,
): Promise<{ tooFast: boolean; highVolume: boolean }> {
  const sql = await getSql();
  const now = Date.now();

  const last = await sql.query<{ server_timestamp: string }>(
    `SELECT "server_timestamp" FROM "water_activities"
      WHERE "user_id" = ? AND "deleted_at" IS NULL
      ORDER BY "created_at" DESC LIMIT 1`,
    [userId],
  );
  const lastAt = last[0]?.server_timestamp ? new Date(last[0].server_timestamp).getTime() : 0;
  const tooFast = lastAt > 0 && now - lastAt < MIN_INTERVAL_SECONDS * 1000;

  const windowStart = new Date(now - 10 * 60_000).toISOString();
  const recent = await sql.query<{ total: number }>(
    `SELECT COALESCE(SUM("bottle_count"), 0) AS "total" FROM "water_activities"
      WHERE "user_id" = ? AND "server_timestamp" > ? AND "deleted_at" IS NULL`,
    [userId, windowStart],
  );

  return {
    tooFast,
    highVolume: (recent[0]?.total ?? 0) + bottleCount > MAX_BOTTLES_PER_10_MIN,
  };
}

export function describeSignals(
  duplicates: { exact: boolean; perceptual: boolean },
  behaviour: { tooFast: boolean; highVolume: boolean },
  verdict: ProviderVerdict,
): FraudSignals {
  const reasons: FraudSignals["reasons"] = [];

  if (duplicates.exact) {
    reasons.push({
      code: "duplicate_exact",
      label: "Duplicate photo",
      detail: "This exact image was already submitted as evidence.",
    });
  } else if (duplicates.perceptual) {
    reasons.push({
      code: "duplicate_perceptual",
      label: "Near-duplicate photo",
      detail: "A visually very similar image was submitted recently.",
    });
  }

  if (behaviour.tooFast) {
    reasons.push({
      code: "submit_rate",
      label: "Very fast repeat submission",
      detail: "Another refill was logged within seconds.",
    });
  }
  if (behaviour.highVolume) {
    reasons.push({
      code: "high_volume",
      label: "Unusual submission volume",
      detail: "An unusually high number of bottles in a short window.",
    });
  }
  if (verdict.duplicate_suspected && reasons.length === 0) {
    reasons.push({
      code: "duplicate_model",
      label: "Possible reuse",
      detail: "The reviewer flagged this image as a likely reuse.",
    });
  }
  if (!verdict.cooler_detected) {
    reasons.push({
      code: "no_cooler",
      label: "Cooler not detected",
      detail: "A water cooler was not visible in the photo.",
    });
  }
  if (verdict.bottles_detected === 0) {
    reasons.push({
      code: "no_bottles",
      label: "Bottles not detected",
      detail: "No water bottles were visible in the photo.",
    });
  }

  return {
    duplicateExact: duplicates.exact,
    duplicatePerceptual: duplicates.perceptual,
    duplicateOfId: null,
    tooFast: behaviour.tooFast,
    highVolume: behaviour.highVolume,
    reasons,
  };
}

export interface VerificationDecision {
  outcome: VerificationOutcome;
  status: "verified" | "needs_review" | "unavailable";
  reviewStatus: "not_required" | "pending";
  signals: FraudSignals;
  verdict: ProviderVerdict | null;
}

/**
 * Run the full verification pass. Provider outages downgrade the activity to
 * "saved for review" rather than losing the submission.
 */
export async function verifyEvidence(params: {
  image: { buffer: Buffer; mime: string; sha256: string; phash: string | null };
  claimedBottleCount: number;
  hostelId: string;
  userId: string;
  roomNumber?: string | null;
  coolerLabel?: string | null;
}): Promise<VerificationDecision> {
  const startedAt = Date.now();

  const duplicates = await detectDuplicates(
    params.hostelId,
    params.image.sha256,
    params.image.phash,
  );
  const behaviour = await detectBehaviourAnomalies(params.userId, params.claimedBottleCount);

  const provider = getProvider();
  let verdict: ProviderVerdict | null = null;
  let status: VerificationDecision["status"] = "unavailable";
  let failureReason: string | null = null;

  try {
    verdict = await provider.verifyWaterActivity({
      image: { buffer: params.image.buffer, mime: params.image.mime },
      claimedBottleCount: params.claimedBottleCount,
      context: { roomNumber: params.roomNumber, coolerLabel: params.coolerLabel },
      localSignals: {
        duplicateExact: duplicates.exact,
        duplicatePerceptual: duplicates.perceptual,
        brightness: null,
        entropy: null,
        width: 0,
        height: 0,
      },
    });
    status = verdict.verified ? "verified" : "needs_review";
  } catch (error) {
    failureReason =
      error instanceof AIUnavailableError
        ? error.message
        : "The reviewer didn't respond correctly.";
    verdict = null;
    status = "unavailable";
  }

  const signals = verdict
    ? describeSignals(duplicates, behaviour, verdict)
    : {
        duplicateExact: duplicates.exact,
        duplicatePerceptual: duplicates.perceptual,
        duplicateOfId: duplicates.ofId,
        tooFast: behaviour.tooFast,
        highVolume: behaviour.highVolume,
        reasons: [
          {
            code: "ai_unavailable",
            label: "Verification unavailable",
            detail: "The reviewer could not be reached, so a human will confirm this.",
          },
          ...(duplicates.exact
            ? [
                {
                  code: "duplicate_exact",
                  label: "Duplicate photo",
                  detail: "This exact image was already submitted.",
                },
              ]
            : []),
        ],
      };

  signals.duplicateOfId = duplicates.ofId;

  // Duplicates always escalate, even when the model was positive.
  if (duplicates.exact && status === "verified") status = "needs_review";

  const latencyMs = Date.now() - startedAt;
  const outcome: VerificationOutcome = {
    verified: status === "verified",
    confidence: verdict?.confidence ?? 0,
    cooler_detected: verdict?.cooler_detected ?? false,
    bottles_detected: verdict?.bottles_detected ?? 0,
    filling_context_detected: verdict?.filling_context_detected ?? false,
    duplicate_suspected: duplicates.exact || duplicates.perceptual,
    reason:
      verdict?.reason ??
      failureReason ??
      "Verification is temporarily unavailable. Your activity has been saved for review.",
    raw: verdict?.raw ?? null,
    provider: provider.id,
    model: provider.model,
    latencyMs,
  };

  return { outcome, status, reviewStatus: status === "verified" ? "not_required" : "pending", signals, verdict };
}
