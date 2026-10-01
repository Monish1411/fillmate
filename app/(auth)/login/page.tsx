import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/rbac";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.user.onboarded ? "/app" : "/onboarding");
  return <LoginForm />;
}