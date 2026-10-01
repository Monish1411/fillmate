import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/rbac";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.user.onboarded ? "/app" : "/onboarding");
  return <SignupForm />;
}