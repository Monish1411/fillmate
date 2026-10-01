import { fail, ok, route } from "@/lib/http/response";
import { requireAuth } from "@/lib/auth/rbac";
import { preferencesSchema, profileSchema } from "@/lib/validation/schemas";
import { updateUserProfile, findUserById } from "@/lib/repositories/users";
import { toSessionUser } from "@/lib/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREF_COLUMNS: Record<string, string> = {
  notifyRefills: "notify_refills",
  notifyRotation: "notify_rotation",
  notifyReviews: "notify_reviews",
  notifyWeekly: "notify_weekly",
  privacyShowContributions: "privacy_show_contributions",
  privacyShowActivity: "privacy_show_activity",
  privacyShowName: "privacy_show_name",
};

export const PATCH = route(async (request: Request) => {
  const ctx = await requireAuth();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if ("theme" in body || "fullName" in body || "displayName" in body || "phone" in body) {
    const profile = profileSchema.parse(body);
    await updateUserProfile(ctx.user.id, {
      ...(profile.fullName !== undefined ? { full_name: profile.fullName } : {}),
      ...(profile.displayName !== undefined ? { display_name: profile.displayName || null } : {}),
      ...(profile.phone !== undefined ? { phone: profile.phone ?? null } : {}),
      ...(profile.theme !== undefined ? { theme: profile.theme } : {}),
      ...(profile.timezone !== undefined ? { timezone: profile.timezone } : {}),
    });
  }

  const prefs = preferencesSchema.parse(body);
  const patch: Record<string, number> = {};
  for (const [key, value] of Object.entries(prefs)) {
    const column = PREF_COLUMNS[key];
    if (column && typeof value === "boolean") patch[column] = value ? 1 : 0;
  }
  if (Object.keys(patch).length > 0) await updateUserProfile(ctx.user.id, patch);

  const fresh = await findUserById(ctx.user.id);
  if (!fresh) return fail("not_found", "Your account could not be reloaded.");

  return ok({
    user: toSessionUser({
      ...ctx,
      user: fresh,
    }),
  });
});