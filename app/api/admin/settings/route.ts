import { fail, ok, route } from "@/lib/http/response";
import { requireAdmin, assertHostelScope } from "@/lib/auth/rbac";
import { getHostelSettings, updateHostelSettings } from "@/lib/repositories/hostels";
import { featureConfigSchema } from "@/lib/validation/schemas";
import { logAdminAction } from "@/lib/repositories/reports";
import { providerStatus } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireAdmin();
  if (!ctx.hostelId) return fail("forbidden", "No hostel selected.");
  assertHostelScope(ctx, ctx.hostelId);
  return ok({ settings: await getHostelSettings(ctx.hostelId), ai: providerStatus() });
});

export const PATCH = route(async (request: Request) => {
  const ctx = await requireAdmin();
  if (!ctx.hostelId) return fail("forbidden", "No hostel selected.");
  assertHostelScope(ctx, ctx.hostelId);

  const body = featureConfigSchema.parse(await request.json().catch(() => null));
  const next = await updateHostelSettings(ctx.hostelId, body);

  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: ctx.hostelId,
    action: "hostel.settings_updated",
    targetType: "hostel",
    targetId: ctx.hostelId,
    metadata: body as Record<string, unknown>,
  });

  return ok({ settings: next });
});