/**
 * Typed environment access.
 *
 * Server-only secrets are read lazily and never exposed through
 * `NEXT_PUBLIC_*`, so they cannot leak into the client bundle.
 */

function str(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

function num(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback = false): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export const env = {
  get appUrl(): string {
    return str("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get sessionSecret(): string {
    const secret = str("SESSION_SECRET");
    if (!secret || secret.includes("change-me")) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "SESSION_SECRET must be set to a strong random value in production.",
        );
      }
      return "fillmate-development-session-secret-do-not-use-in-production";
    }
    return secret;
  },
  get sessionTtlDays(): number {
    return num("SESSION_TTL_DAYS", 30);
  },
  /**
   * `Secure` flag on the session cookie.
   *
   * Defaults to true in production, which is correct behind HTTPS. Set
   * `COOKIE_SECURE=false` when serving a production build over plain HTTP on a
   * trusted LAN (or behind a proxy that terminates TLS itself) - browsers
   * silently drop Secure cookies over http://, which would break sign-in.
   */
  get sessionCookieSecure(): boolean {
    const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
    if (override === "false" || override === "0") return false;
    if (override === "true" || override === "1") return true;
    return env.isProduction;
  },
  get databaseUrl(): string {
    return str("DATABASE_URL");
  },
  get supabaseUrl(): string {
    return str("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return str("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey(): string {
    return str("SUPABASE_SERVICE_ROLE_KEY");
  },
  get storageBucket(): string {
    return str("SUPABASE_STORAGE_BUCKET", "fillmate-evidence");
  },
  get supabaseEnabled(): boolean {
    return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
  },
  get aiProvider(): "openai" | "gemini" | "heuristic" {
    const p = str("AI_PROVIDER", env.aiApiKey ? "openai" : "heuristic").toLowerCase();
    if (p === "openai" || p === "gemini" || p === "heuristic") return p;
    return "heuristic";
  },
  get aiApiKey(): string {
    return str("AI_API_KEY");
  },
  get aiModel(): string {
    const provider = env.aiProvider;
    const fallback =
      provider === "gemini"
        ? "gemini-2.0-flash"
        : provider === "openai"
          ? "gpt-4o-mini"
          : "heuristic-v1";
    return str("AI_MODEL", fallback);
  },
  get aiBaseUrl(): string {
    return str(
      "AI_BASE_URL",
      env.aiProvider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta"
        : "https://api.openai.com/v1",
    );
  },
  /** AI is considered live only when a real provider key is present. */
  get aiEnabled(): boolean {
    const p = env.aiProvider;
    return p !== "heuristic" && Boolean(env.aiApiKey);
  },
  get maxUploadBytes(): number {
    return Math.min(Math.max(num("MAX_UPLOAD_MB", 8), 1), 10) * 1024 * 1024;
  },
  get demoMode(): boolean {
    return bool("NEXT_PUBLIC_DEMO_MODE", true);
  },
  get cronSecret(): string {
    return str("CRON_SECRET");
  },
  get superAdminEmail(): string {
    return str("SUPER_ADMIN_EMAIL");
  },
  get superAdminPassword(): string {
    return str("SUPER_ADMIN_PASSWORD");
  },
};

/** Validate critical config at boot so failures are loud, not silent. */
export function assertServerConfig(): void {
  if (env.isProduction && !env.databaseUrl) {
    console.warn(
      "[fillmate] DATABASE_URL is not set — falling back to the local SQLite driver. " +
        "This is fine for a single-instance preview but not for production scale.",
    );
  }
}