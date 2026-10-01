import { ok, route } from "@/lib/http/response";
import { signOut } from "@/lib/services/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async () => {
  await signOut();
  return ok({ signedOut: true });
});