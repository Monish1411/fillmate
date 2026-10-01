import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/rbac";
import { previewInvite } from "@/lib/repositories/invites";
import { JoinRoomCard } from "@/components/auth/join-room-card";

export const metadata: Metadata = { title: "Join a room", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const preview = await previewInvite(code.toUpperCase());
  const ctx = await getAuthContext();

  if (ctx && ctx.user.onboarded && preview.valid) redirect("/app");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="relative w-full max-w-sm">
        <JoinRoomCard
          preview={preview}
          signedIn={Boolean(ctx)}
          inviteCode={preview.code}
        />
      </div>
    </div>
  );
}