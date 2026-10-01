import { ok, route } from "@/lib/http/response";
import { requireAuth } from "@/lib/auth/rbac";
import { listNotifications, markAllRead, markRead } from "@/lib/repositories/notifications";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const ctx = await requireAuth();
  const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
  const result = await listNotifications(ctx.user.id, { limit: 40, unreadOnly });
  return ok(result);
});

const patchSchema = z.object({
  ids: z.array(z.string().max(64)).max(50).optional(),
  all: z.boolean().optional(),
});

export const PATCH = route(async (request: Request) => {
  const ctx = await requireAuth();
  const body = patchSchema.parse(await request.json().catch(() => ({})));
  const changed = body.all
    ? await markAllRead(ctx.user.id)
    : await markRead(ctx.user.id, body.ids ?? []);
  return ok({ changed });
});