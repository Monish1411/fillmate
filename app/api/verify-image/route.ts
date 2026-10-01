import { fail, ok, route } from "@/lib/http/response";
import { requireOnboarded, AuthError } from "@/lib/auth/rbac";
import { headers } from "next/headers";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { decodeDataUrl, ImageRejected, processEvidenceImage } from "@/lib/storage/image";
import { verifyEvidence } from "@/lib/ai/verify";
import { getRoom, resolveCooler } from "@/lib/repositories/rooms";
import { createActivitySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST - pre-flight image check.
 *
 * Lets the recording flow show "photo looks good" before the student commits
 * to a submission. Nothing is persisted here; the real write happens on
 * POST /api/activities.
 */
export const POST = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`verify:${ctx.user.id}:${ip}`, LIMITS.verify).allowed) {
    return fail("rate_limited", "That's a lot of checks. Take a quick breather.", {
      retryable: true,
    });
  }

  const body = await request.json().catch(() => null);
  const input = createActivitySchema
    .pick({ bottleCount: true })
    .parse({ bottleCount: body?.bottleCount ?? 1 });

  const imageBase64: string | undefined = body?.imageBase64;
  const decoded = imageBase64 ? decodeDataUrl(imageBase64) : null;
  if (!decoded) return fail("validation_error", "That photo couldn't be read.");

  let processed;
  try {
    processed = await processEvidenceImage(decoded.buffer, decoded.mime);
  } catch (err) {
    if (err instanceof ImageRejected) {
      return fail("upload_rejected", err.message);
    }
    throw err;
  }

  if (!ctx.hostelId || !ctx.roomId) {
    throw new AuthError("forbidden", "Join a room before recording a refill.");
  }
  const room = await getRoom(ctx.roomId);
  const cooler = await resolveCooler(ctx.hostelId, ctx.roomId);

  const decision = await verifyEvidence({
    image: {
      buffer: processed.buffer,
      mime: processed.mime,
      sha256: processed.sha256,
      phash: processed.phash,
    },
    claimedBottleCount: input.bottleCount,
    hostelId: ctx.hostelId,
    userId: ctx.user.id,
    roomNumber: room?.number ?? null,
    coolerLabel: cooler?.label ?? null,
  });

  return ok({
    quality: {
      width: processed.width,
      height: processed.height,
      brightness: processed.brightness,
      entropy: processed.entropy,
      sizeLabel: `${Math.round(processed.byteSize / 1024)} KB`,
    },
    verification: decision.outcome,
    status: decision.status,
    flags: decision.signals.reasons,
  });
});