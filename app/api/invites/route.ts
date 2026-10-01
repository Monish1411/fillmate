import { fail, ok, route } from "@/lib/http/response";
import { requireOnboarded } from "@/lib/auth/rbac";
import { createInvite, inviteUrl, listInvites, revokeInvite } from "@/lib/repositories/invites";
import { inviteSchema } from "@/lib/validation/schemas";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireOnboarded();
  if (!ctx.roomId) return ok([]);
  const invites = await listInvites(ctx.roomId);
  return ok(
    invites.map((i) => ({
      id: i.id,
      code: i.code,
      url: inviteUrl(i.code, env.appUrl),
      uses: i.uses,
      maxUses: i.max_uses,
      revoked: Boolean(i.revoked),
      expired: i.expires_at ? new Date(i.expires_at) < new Date() : false,
      createdAt: i.created_at,
    })),
  );
});

export const POST = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  if (!ctx.roomId || !ctx.hostelId) return fail("forbidden", "Join a room first.");
  const body = inviteSchema.parse(await request.json().catch(() => ({})));
  const invite = await createInvite({
    roomId: ctx.roomId,
    hostelId: ctx.hostelId,
    createdBy: ctx.user.id,
    maxUses: body.maxUses,
    expiresInDays: body.expiresInDays,
  });
  return ok(
    { id: invite.id, code: invite.code, url: inviteUrl(invite.code, env.appUrl) },
    { status: 201 },
  );
});

export const DELETE = route(async (request: Request) => {
  const ctx = await requireOnboarded();
  if (!ctx.roomId) return fail("forbidden", "Join a room first.");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("validation_error", "Missing invite id.");
  const invites = await listInvites(ctx.roomId);
  if (!invites.some((i) => i.id === id)) {
    return fail("forbidden", "You can only revoke invites for your own room.");
  }
  await revokeInvite(id);
  return ok({ revoked: true });
});