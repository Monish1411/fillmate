import type { ApiErrorCode, ApiErrorShape, ApiResult } from "@/types/api";

/**
 * Client-side fetch helper.
 *
 * Lives apart from the server-only response helpers so it can be imported
 * from any client component without dragging server code into the bundle.
 */

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(input, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });

  let payload: ApiResult<T> | null = null;
  try {
    payload = (await res.json()) as ApiResult<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.ok) {
    const error: ApiErrorShape | null = payload && !payload.ok ? payload.error : null;
    throw new ApiClientError(
      error?.code ?? "unknown",
      error?.message ?? "Something went wrong. Please try again.",
      res.status,
      error?.fields,
    );
  }
  return payload.data;
}