import "server-only";
import { env } from "@/lib/env";
import {
  AIUnavailableError,
  parseVerdict,
  SYSTEM_PROMPT,
  type AIProvider,
  type ProviderVerdict,
  type VerificationInput,
} from "./provider";

/* ── OpenAI ──────────────────────────────────────────────────── */

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly isRealVision = true;
  readonly model: string;

  constructor(model = env.aiModel) {
    this.model = model;
  }

  async verifyWaterActivity(input: VerificationInput): Promise<ProviderVerdict> {
    const userContent = [
      {
        type: "text" as const,
        text: `The student claims to have filled ${input.claimedBottleCount} bottle(s).${
          input.context.roomNumber ? ` Room ${input.context.roomNumber}.` : ""
        }`,
      },
      {
        type: "image_url" as const,
        image_url: {
          url: `data:${input.image.mime};base64,${input.image.buffer.toString("base64")}`,
          detail: "low",
        },
      },
    ];

    const res = await fetch(`${env.aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.aiApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 320,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AIUnavailableError(`Vision provider error ${res.status}: ${detail.slice(0, 180)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new AIUnavailableError("Vision provider returned no content.");
    return parseVerdict(text);
  }
}

/* ── Google Gemini ───────────────────────────────────────────── */

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly isRealVision = true;
  readonly model: string;

  constructor(model = env.aiModel) {
    this.model = model;
  }

  async verifyWaterActivity(input: VerificationInput): Promise<ProviderVerdict> {
    const res = await fetch(
      `${env.aiBaseUrl}/models/${this.model}:generateContent?key=${env.aiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `The student claims to have filled ${input.claimedBottleCount} bottle(s).${
                    input.context.roomNumber ? ` Room ${input.context.roomNumber}.` : ""
                  }`,
                },
                {
                  inline_data: {
                    mime_type: input.image.mime,
                    data: input.image.buffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 320,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AIUnavailableError(`Vision provider error ${res.status}: ${detail.slice(0, 180)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AIUnavailableError("Vision provider returned no content.");
    return parseVerdict(text);
  }
}
/* ── Local fallback ──────────────────────────────────────────── */

/**
 * Runs when no vision API key is configured.
 *
 * It performs genuine local checks — image sanity, entropy, known duplicate
 * detection — but it cannot see a water cooler, so it deliberately never
 * claims "verified". `needs_review` is the honest answer, and it keeps the
 * full pipeline (storage → verify → flag → review) working in development.
 */
export class LocalHeuristicProvider implements AIProvider {
  readonly id = "local";
  readonly model = "heuristic-v1";
  readonly isRealVision = false;

  async verifyWaterActivity(input: VerificationInput): Promise<ProviderVerdict> {
    const { brightness, entropy, duplicateExact, duplicatePerceptual } = input.localSignals;

    if (duplicateExact) {
      return {
        verified: false,
        confidence: 0.98,
        cooler_detected: false,
        bottles_detected: 0,
        filling_context_detected: false,
        duplicate_suspected: true,
        reason: "This exact photo has already been submitted as evidence.",
      };
    }

    if (brightness !== null && brightness < 0.06) {
      return {
        verified: false,
        confidence: 0.3,
        cooler_detected: false,
        bottles_detected: 0,
        filling_context_detected: false,
        duplicate_suspected: false,
        reason: "The photo is almost completely dark, so nothing can be assessed.",
      };
    }

    if (entropy !== null && entropy < 1.6) {
      return {
        verified: false,
        confidence: 0.34,
        cooler_detected: false,
        bottles_detected: 0,
        filling_context_detected: false,
        duplicate_suspected: false,
        reason: "The photo looks almost blank, so there is no visible detail to check.",
      };
    }

    const notes: string[] = [];
    if (duplicatePerceptual) notes.push("a near-identical photo was submitted recently");

    return {
      verified: false,
      // Deliberately capped: local checks cannot confirm the core evidence.
      confidence: 0.35,
      cooler_detected: false,
      bottles_detected: 0,
      filling_context_detected: false,
      duplicate_suspected: duplicatePerceptual,
      reason:
        notes.length > 0
          ? `Image checks flagged that ${notes.join(" and ")}.`
          : "Image quality checks passed, but this deployment has no AI vision provider connected, so an administrator will confirm it.",
    };
  }
}
