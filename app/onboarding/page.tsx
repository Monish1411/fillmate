import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/rbac";
import { listSelectableHostels, getOnboardingState } from "@/lib/services/onboarding";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { ensureSchema } from "@/lib/db/client";

export const metadata: Metadata = { title: "Set up FillMate", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await ensureSchema();
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.user.onboarded && ctx.roomId) redirect("/app");

  const [state, hostels] = await Promise.all([getOnboardingState(ctx), listSelectableHostels()]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
      <main
        id="main"
        className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
      >
        <OnboardingFlow
          hostels={hostels}
          initialHostelId={state.hostelId}
          initialRoomNumber={state.roomNumber}
        />
      </main>
    </div>
  );
}