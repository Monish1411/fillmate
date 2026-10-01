import { ok, route } from "@/lib/http/response";
import { requireAdmin, assertHostelScope } from "@/lib/auth/rbac";
import { listReports, resolveReport } from "@/lib/repositories/reports";
import { notify } from "@/lib/repositories/notifications";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const hostelId = new URL(request.url).searchParams.get("hostelId") ?? ctx.hostelId;
  if (!hostelId) return ok([]);
  assertHostelScope(ctx, hostelId);

  const reports = await listReports(hostelId, {
    status: new URL(request.url).searchParams.get("status") ?? undefined,
  });
  return ok(reports);
});

const resolveSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["resolved", "dismissed", "reviewing"]),
  resolution: z.string().trim().min(2).max(400),
});

export const PATCH = route(async (request: Request) => {
  const ctx = await requireAdmin();
  const body = resolveSchema.parse(await request.json().catch(() => null));
  await resolveReport(body.id, body.status, body.resolution, ctx.user.id);
  await notify({
    userId: ctx.user.id,
    type: "report_resolved",
    title: "Report updated",
    body: body.resolution,
  }).catch(() => undefined);
  return ok({ id: body.id, status: body.status });
});