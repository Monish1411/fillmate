import { headers } from "next/headers";
import { fail, ok, route } from "@/lib/http/response";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { signUp } from "@/lib/services/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`signup:${ip}`, LIMITS.signup).allowed) {
    return fail(
      "rate_limited",
      "Too many accounts created from this network. Try again later.",
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return fail("validation_error", "Enter your details to continue.");

  const result = await signUp(body);
  return ok(result, { status: 201 });
});