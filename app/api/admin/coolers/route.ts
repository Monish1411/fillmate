import { fail, ok, route } from "@/lib/http/response";
import { requireAdmin, assertHostelScope } from "@/lib/auth/rbac";
import { getCoolers } from "@/lib/repositories/rooms";
import { createCooler, updateCooler, deactivateCooler } from "@/lib/repositories/admin-writes";
import { coolerSchema } from "@/lib/validation/schemas";
import { logAdminAction } from "@/lib/repositories/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const hostelId = new URL(request.url).searchParams.get("hostelId") ?? ctx.hostelId;
  if (!hostelId) return fail("forbidden", "No hostel selected.");
  assertHostelScope(ctx, hostelId);
  return ok(await getCoolers(hostelId));
});

export const POST = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const hostelId = ctx.hostelId;
  if (!hostelId) return fail("forbidden", "No hostel selected.");
  assertHostelScope(ctx, hostelId);

  const body = coolerSchema.parse(await request.json().catch(() => null));
  const cooler = await createCooler({ hostelId, ...body });
  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId,
    action: "cooler.created",
    targetType: "cooler",
    targetId: cooler.id,
    metadata: { label: body.label },
  });
  return ok(cooler, { status: 201 });
});

export const PATCH = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return fail("validation_error", "Missing cooler id.");

  const existing = await getCoolers(ctx.hostelId ?? "").then((all) =>
    all.find((c) => c.id === id),
  );
  if (!existing) return fail("not_found", "That cooler doesn't exist.");
  assertHostelScope(ctx, existing.hostel_id);

  const body = coolerSchema.partial().parse(await request.json().catch(() => ({})));
  await updateCooler(id, body);
  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: existing.hostel_id,
    action: "cooler.updated",
    targetType: "cooler",
    targetId: id,
    metadata: body as Record<string, unknown>,
  });
  return ok({ id });
});

export const DELETE = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("validation_error", "Missing cooler id.");
  const all = await getCoolers(ctx.hostelId ?? "");
  const existing = all.find((c) => c.id === id);
  if (!existing) return fail("not_found", "That cooler doesn't exist.");
  await deactivateCooler(id);
  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: existing.hostel_id,
    action: "cooler.deactivated",
    targetType: "cooler",
    targetId: id,
  });
  return ok({ deactivated: true });
});
