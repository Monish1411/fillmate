import { ok, route } from "@/lib/http/response";
import { getAuthContext, toSessionUser } from "@/lib/auth/rbac";
import { providerStatus } from "@/lib/ai";
import { isDemoEnvironment } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Session + deployment capabilities for the client shell. */
export const GET = route(async () => {
  const ctx = await getAuthContext();
  return ok({
    user: ctx ? toSessionUser(ctx) : null,
    capabilities: {
      aiVerification: providerStatus().live,
      aiProvider: providerStatus().id,
      aiModel: providerStatus().model,
      demoMode: isDemoEnvironment(),
    },
  });
});