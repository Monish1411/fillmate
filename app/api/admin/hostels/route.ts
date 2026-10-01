import { fail, ok, route } from "@/lib/http/response";
import { requireSuperAdmin } from "@/lib/auth/rbac";
import { listHostels } from "@/lib/repositories/hostels";
import { createHostel } from "@/lib/repositories/admin-writes";
import { createHostelSchema } from "@/lib/validation/schemas";
import { logAdminAction } from "@/lib/repositories/reports";
import { listAdminActions } from "@/lib/repositories/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireSuperAdmin();
  return ok({ hostels: await listHostels(), audit: await listAdminActions(null, 25) });
});

export const POST = route(async (request: Request) => {
  const ctx = await requireSuperAdmin();
  const body = createHostelSchema.parse(await request.json().catch(() => null));
  const hostel = await createHostel(body);
  await logAdminAction({
    actorUserId: ctx.user.id,
    actorName: ctx.user.full_name,
    hostelId: hostel.id,
    action: "hostel.created",
    targetType: "hostel",
    targetId: hostel.id,
    metadata: { name: body.name, code: body.code },
  });
  if (!hostel.id) return fail("db_error", "Could not create the hostel.");
  return ok(hostel, { status: 201 });
});