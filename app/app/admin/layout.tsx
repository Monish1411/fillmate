import { redirect } from "next/navigation";
import { getAuthContext, isAdmin } from "@/lib/auth/rbac";

/**
 * Admin gate.
 *
 * Guards the whole section so a student is redirected rather than landing on a
 * page that would throw, and so every admin page shares one authorization path.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!isAdmin(ctx.user)) redirect("/app");

  return <>{children}</>;
}