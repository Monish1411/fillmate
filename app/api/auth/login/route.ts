import { headers } from "next/headers";
import { fail, ok, route } from "@/lib/http/response";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { signIn } from "@/lib/services/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`, LIMITS.login).allowed) {
    return fail("rate_limited", "Too many attempts. Try again in a few minutes.", {
      retryable: true,
    });
  }

  const body = await request.json().catch(() => null);
  if (!body) return fail("validation_error", "Enter your email and password.");

  const result = await signIn(body);
  return ok(result);
});