import { fail, ok, route } from "@/lib/http/response";
import { requireAuth, assertRoomAccess } from "@/lib/auth/rbac";
import { getActivityById } from "@/lib/repositories/activities";
import { getSql } from "@/lib/db/client";
import type { AiVerificationRow } from "@/types/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET - full detail for one activity, including every verification pass. */
export const GET = route(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const ctx = await requireAuth();
    const { id } = await context.params;

    const activity = await getActivityById(id, ctx.user.id);
    if (!activity) return fail("not_found", "That activity could not be found.");

    await assertRoomAccess(ctx, activity.roomId);

    const sql = await getSql();
    const verifications = await sql.query<AiVerificationRow>(
      `SELECT * FROM "ai_verifications" WHERE "activity_id" = ? ORDER BY "created_at" ASC`,
      [id],
    );

    const reviewerRows = activity.reviewNote
      ? await sql.query<{ full_name: string }>(
          `SELECT "full_name" FROM "users" WHERE "id" = ? LIMIT 1`,
          [activity.reviewNote],
        )
      : [];

    return ok({
      activity,
      verifications: verifications.map((v) => ({
        provider: v.provider,
        model: v.model,
        status: v.status,
        confidence: v.confidence,
        reason: v.reason,
        createdAt: v.created_at,
        latencyMs: v.latency_ms,
      })),
      reviewer: reviewerRows[0] ?? null,
    });
  },
);