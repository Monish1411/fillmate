import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/rbac";
import { listNotifications } from "@/lib/repositories/notifications";
import { NotificationList } from "@/components/app/notification-list";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { items, unread } = await listNotifications(ctx.user.id, { limit: 50 });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">Notifications</h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          {unread > 0 ? `${unread} unread` : "You’re all caught up"}
        </p>
      </header>
      <NotificationList initialItems={items} initialUnread={unread} />
    </div>
  );
}