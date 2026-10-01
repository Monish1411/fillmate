import "server-only";

/**
 * In-memory sliding-window rate limiter.
 *
 * Adequate for a single instance. On serverless, each instance keeps its own
 * bucket — which is the correct trade-off for abuse protection without a
 * shared store. Swap for Redis/Upstash if you need cross-instance ceilings.
 */

interface Bucket {
  hits: number[];
}

const GLOBAL_KEY = Symbol.for("fillmate.ratelimit");
type RateStore = Map<string, Bucket>;

function store(): RateStore {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: RateStore };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY];
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed inside the window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const map = store();
  const bucket = map.get(key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);

  if (bucket.hits.length >= opts.max) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterMs = Math.max(0, opts.windowMs - (now - oldest));
    map.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  bucket.hits.push(now);
  map.set(key, bucket);
  return { allowed: true, remaining: opts.max - bucket.hits.length, retryAfterSeconds: 0 };
}

export const LIMITS = {
  login: { windowMs: 10 * 60_000, max: 10 },
  signup: { windowMs: 60 * 60_000, max: 5 },
  upload: { windowMs: 60 * 60_000, max: 40 },
  verify: { windowMs: 5 * 60_000, max: 30 },
  activity: { windowMs: 10 * 60_000, max: 20 },
  write: { windowMs: 60_000, max: 60 },
  read: { windowMs: 60_000, max: 300 },
} as const;

/** Identify the caller by session, falling back to IP for anonymous traffic. */
export async function callerKey(
  scope: string,
  sessionId?: string | null,
  ip?: string | null,
): Promise<string> {
  if (sessionId) return `${scope}:s:${sessionId}`;
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${scope}:ip:${forwarded || hdrs.get("x-real-ip") || "unknown"}:${ip ?? ""}`;
}

/** Periodic sweep to keep the map from growing unbounded. */
export function pruneRateLimits(): void {
  const map = store();
  const cutoff = Date.now() - 60 * 60_000;
  for (const [key, bucket] of map) {
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    if (bucket.hits.length === 0) map.delete(key);
  }
}