import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/rbac";
import type { ApiErrorCode, ApiErrorShape, ApiResult } from "@/types/api";
import { env } from "@/lib/env";

/** Uniform JSON envelope so the client never has to guess shapes. */

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  rate_limited: 429,
  conflict: 409,
  upload_rejected: 415,
  ai_unavailable: 503,
  db_error: 500,
  unknown: 500,
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResult<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  extra: Partial<ApiErrorShape> = {},
): NextResponse<ApiResult<never>> {
  return NextResponse.json(
    { ok: false as const, error: { code, message, ...extra } },
    { status: STATUS_BY_CODE[code] },
  );
}

/** Wrap a handler so thrown errors become friendly, non-leaky responses. */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return handleError(err);
    }
  };
}

export function handleError(err: unknown): NextResponse<ApiResult<never>> {
  if (err instanceof AuthError) {
    const code = err.code as ApiErrorCode;
    return fail(code in STATUS_BY_CODE ? code : "forbidden", err.message);
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return fail("validation_error", "Please check the highlighted fields.", { fields });
  }

  if (isRateLimitError(err)) {
    return fail("rate_limited", "Slow down a moment and try again.", {
      retryable: true,
    });
  }

  const message = String((err as Error)?.message ?? err ?? "");

  if (/File too large|exceeds the maximum/i.test(message)) {
    return fail("upload_rejected", "That photo is too large. Try a smaller one.");
  }
  if (/Unsupported|image\/|mime/i.test(message)) {
    return fail("upload_rejected", "Only JPG, PNG and WebP photos are supported.");
  }

  if (env.isProduction) {
    console.error("[fillmate:api] unhandled error", err);
  } else {
    console.error("[fillmate:api]", message);
  }
  return fail("unknown", "Something went wrong on our side. Please try again.", {
    retryable: true,
  });
}

class RateLimitError extends Error {
  constructor() {
    super("rate_limited");
  }
}

export function isRateLimitError(err: unknown): boolean {
  return err instanceof RateLimitError || (err as Error)?.name === "RateLimitError";
}

export function throwRateLimit(): never {
  throw new RateLimitError();
}
