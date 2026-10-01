import { ok, route } from "@/lib/http/response";
import { requireAuth } from "@/lib/auth/rbac";
import { getDashboard } from "@/lib/services/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireAuth();
  return ok(await getDashboard(ctx));
});