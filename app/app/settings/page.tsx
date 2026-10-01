import type { Metadata } from "next";
import { getAuthContext, toSessionUser } from "@/lib/auth/rbac";
import { SettingsView } from "@/components/app/settings-view";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const user = toSessionUser(ctx);

  return (
    <SettingsView
      user={{
        fullName: user.fullName,
        displayName: user.displayName,
        email: user.email,
        phone: ctx.user.phone,
        preferences: user.preferences,
      }}
    />
  );
}