import "server-only";

/**
 * AI verification abstraction.
 *
 * The rest of the application only ever talks to `AIProvider`. Swapping
 * OpenAI for Gemini (or a self-hosted VLM) is a one-line change in
 * `getProvider()` — no business logic depends on a specific vendor.
 *
 * AI output is never treated as truth. It produces one of three states:
 *   verified · needs_review · unavailable
 */

export interface VerificationInput {
  /** Resized, metadata-stripped image. Never the original upload. */
  image: { buffer: Buffer; mime: string };
  claimedBottleCount: number;
  context: { roomNumber?: string | null; coolerLabel?: string | null };
  /** Signals computed locally that help the model and the trust rules. */
  localSignals: {
    duplicateExact: boolean;
    duplicatePerceptual: boolean;
    brightness: number | null;
    entropy: number | null;
    width: number;
    height: number;
  };
}

export interface ProviderVerdict {
  verified: boolean;
  confidence: number;
  cooler_detected: boolean;
  bottles_detected: number;
  filling_context_detected: boolean;
  duplicate_suspected: boolean;
  reason: string;
  raw?: unknown;
}

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  /** False for the local fallback, which cannot do real vision analysis. */
  readonly isRealVision: boolean;
  verifyWaterActivity(input: VerificationInput): Promise<ProviderVerdict>;
}

export class AIUnavailableError extends Error {
  constructor(message = "Verification service is temporarily unavailable.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/* ── Prompt contract ─────────────────────────────────────────── */

export const SYSTEM_PROMPT = `You are the evidence reviewer for FillMate, a hostel water-refill accountability app.

You receive one photo submitted as proof that a student filled water bottles from a hostel cooler.

Return STRICT JSON only, no markdown fences, with exactly these keys:
{
  "cooler_detected": boolean,          // water cooler / dispenser / water purifier visible
  "bottles_detected": number,          // count of water bottles visible, 0 if none
  "filling_context_detected": boolean, // scene is consistent with filling bottles (bottles near/under cooler, or held by a person)
  "image_relevant": boolean,           // photo is not a selfie, meme, textbook page, screenshot or unrelated scene
  "manipulation_suspected": boolean,   // obvious editing, compositing, filters, or text overlay
  "confidence": number,                // 0..1 your confidence in the above
  "reason": string                     // one sentence, factual, max 200 chars
}

Be conservative and honest. If you cannot clearly see the cooler, set cooler_detected to false.
Never claim certainty you do not have — low confidence is the correct, useful answer.`;

export function parseVerdict(text: string): ProviderVerdict {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const cooler = Boolean(parsed.cooler_detected);
  const bottles = Number(parsed.bottles_detected);
  const context = Boolean(parsed.filling_context_detected);
  const relevant = parsed.image_relevant !== false;
  const manipulation = Boolean(parsed.manipulation_suspected);
  const rawConfidence = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;

  // Trust model: verification requires the core evidence AND confidence.
  const verified =
    cooler &&
    relevant &&
    !manipulation &&
    bottles > 0 &&
    context &&
    confidence >= 0.7;

  return {
    verified,
    confidence,
    cooler_detected: cooler,
    bottles_detected: Number.isFinite(bottles) ? Math.max(0, Math.round(bottles)) : 0,
    filling_context_detected: context,
    duplicate_suspected: false,
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 240)
        : "The reviewer could not describe this image clearly.",
    raw: parsed,
  };
}