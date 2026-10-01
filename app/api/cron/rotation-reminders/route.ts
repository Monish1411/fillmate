import { headers } from "next/headers";
import { env } from "@/lib/env";
import { sendRotationReminders } from "@/lib/services/rotation";
import { pruneEvidence } from "@/lib/storage";
import { getSystemSetting } from "@/lib/repositories/hostels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron: 07:00 daily. Rotation nudges + evidence retention sweep. */
export async function GET(_request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (secret) {
    const token = (await headers()).get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token !== secret) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const sent = await sendRotationReminders();
  const setting = await getSystemSetting<{ retentionDays: number }>("retention", {
    retentionDays: 90,
  });
  const pruned = await pruneEvidence(setting.retentionDays).catch(() => 0);

  return Response.json({ ok: true, rotationReminders: sent, prunedImages: pruned });
}

export const POST = GET;