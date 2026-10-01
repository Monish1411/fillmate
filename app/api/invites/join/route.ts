import { fail, ok, route } from "@/lib/http/response";
import { requireAuth } from "@/lib/auth/rbac";
import { getInviteByCode, consumeInvite } from "@/lib/repositories/invites";
import { joinViaInvite } from "@/lib/services/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const ctx = await requireAuth();
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code) return fail("validation_error", "That invite link is missing a code.");

  const invite = await getInviteByCode(body.code);
  if (!invite) return fail("not_found", "This invite link is no longer valid.");

  const result = await joinViaInvite(ctx, invite.id, () => consumeInvite(invite.id));
  return ok(result);
});