import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/rbac";
import { getActivityById } from "@/lib/repositories/activities";
import { ReviewPanel } from "@/components/admin/review-panel";

export const metadata: Metadata = { title: "Review activity", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const activity = await getActivityById(id, ctx.user.id);

  if (!activity || ctx.hostelId !== activity.hostelId) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/app/admin/activity"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back to activities
      </Link>
      <ReviewPanel activity={activity} canReview={activity.userId !== ctx.user.id} />
    </div>
  );
}