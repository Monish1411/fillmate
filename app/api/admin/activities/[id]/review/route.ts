import { headers } from "next/headers";
import { ok, route } from "@/lib/http/response";
import { requireAdmin, assertActivityAccess, assertNotSelfReview } from "@/lib/auth/rbac";
import { reviewDecisionSchema } from "@/lib/validation/schemas";
import { reviewActivity } from "@/lib/services/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const ctx = await requireAdmin();
    const { id } = await context.params;
    const hdrs = await headers();

    // Pre-flight guards so unauthorized reviewers never see activity data.
    const activity = await assertActivityAccess(ctx, id);
    assertNotSelfReview(ctx, activity.user_id);

    const decision = reviewDecisionSchema.parse(await request.json().catch(() => null));
    const result = await reviewActivity(
      ctx,
      id,
      decision,
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    );
    return ok(result);
  },
);