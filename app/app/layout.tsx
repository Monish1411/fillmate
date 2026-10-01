import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext, toSessionUser } from "@/lib/auth/rbac";
import { SessionProvider } from "@/components/session-provider";
import { RealtimeProvider } from "@/components/realtime-provider";
import { AppShell } from "@/components/app/app-shell";
import { ensureSchema } from "@/lib/db/client";
import { env } from "@/lib/env";
import { providerStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (env.superAdminEmail && env.superAdminPassword) {
    const { ensureSuperAdmin } = await import("@/lib/services/auth-service");
    await ensureSuperAdmin(env.superAdminEmail, env.superAdminPassword).catch(() => false);
  }

  if (!ctx.user.onboarded || !ctx.roomId) redirect("/onboarding");

  const user = toSessionUser(ctx);
  const ai = providerStatus();

  return (
    <SessionProvider
      initialUser={user}
      initialCapabilities={{
        aiVerification: ai.live,
        aiProvider: ai.id,
        aiModel: ai.model,
        demoMode: env.demoMode && !env.databaseUrl,
      }}
    >
      <RealtimeProvider enabled={Boolean(ctx.hostelId)}>
        <AppShell>{children}</AppShell>
      </RealtimeProvider>
    </SessionProvider>
  );
}