import { headers } from "next/headers";
import { env } from "@/lib/env";
import { sendRotationReminders } from "@/lib/services/rotation";
import { notify } from "@/lib/repositories/notifications";
import { getSql } from "@/lib/db/client";
import { getRoomStatus } from "@/lib/repositories/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(_request: Request): Promise<boolean> {
  const secret = env.cronSecret;
  if (!secret) return process.env.NODE_ENV !== "production";
  const token = (await headers()).get("authorization")?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

/** Vercel Cron: 09:00 daily. Gentle reminders only — never nagging. */
export async function GET(request: Request): Promise<Response> {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sent = await sendRotationReminders();
  const sql = await getSql();
  const rooms = await sql.query<{ id: string; timezone: string }>(
    `SELECT r."id", h."timezone" FROM "rooms" r JOIN "hostels" h ON h."id" = r."hostel_id"
      WHERE r."active" = TRUE`,
  );

  let reminders = 0;
  for (const room of rooms) {
    const status = await getRoomStatus(room.id, room.timezone);
    if (!status || status.filled > 0) continue;

    const members = await sql.query<{ user_id: string }>(
      `SELECT "user_id" FROM "room_members" WHERE "room_id" = ?`,
      [room.id],
    );
    for (const member of members) {
      await notify({
        userId: member.user_id,
        hostelId: status.hostelId,
        roomId: room.id,
        type: "room_overdue",
        title: `Room ${status.roomNumber} hasn't logged a refill today`,
        body: "A quick photo when you fill up keeps everyone in the loop.",
        category: "refills",
      });
      reminders++;
    }
  }

  return Response.json({ ok: true, rotationReminders: sent, roomReminders: reminders });
}

export const POST = GET;