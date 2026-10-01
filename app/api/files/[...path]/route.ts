import { fail, route } from "@/lib/http/response";
import { requireAuth, isAdmin } from "@/lib/auth/rbac";
import { readEvidence, isSafeKey } from "@/lib/storage";
import { getSql } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves evidence images from the local driver.
 *
 * Every request re-checks membership: knowing an object key is not enough to
 * read the photo. Supabase deployments bypass this route entirely and use
 * short-lived signed URLs instead.
 */
export const GET = route(
  async (_request: Request, context: { params: Promise<{ path: string[] }> }) => {
    const ctx = await requireAuth();
    const { path: segments } = await context.params;
    const key = segments.map(decodeURIComponent).join("/");

    if (!isSafeKey(key)) return fail("not_found", "That file doesn't exist.");

    const sql = await getSql();
    const rows = await sql.query<{
    owner_id: string;
    hostel_id: string;
    room_id: string;
  }>(
    `SELECT a."user_id" AS "owner_id", a."hostel_id" AS "hostel_id", a."room_id" AS "room_id"
       FROM "activity_images" i
       JOIN "water_activities" a ON a."id" = i."activity_id"
      WHERE i."storage_key" = ? AND a."deleted_at" IS NULL
      LIMIT 1`,
    [key],
  );
    const owner = rows[0];
    if (!owner) return fail("not_found", "That file doesn't exist.");

    const allowed =
      ctx.user.role === "super_admin" ||
      (ctx.hostelId === owner.hostel_id &&
        (isAdmin(ctx.user) || ctx.roomId === owner.room_id || ctx.user.id === owner.owner_id));
    if (!allowed) return fail("forbidden", "You don't have access to this photo.");

    const buffer = await readEvidence(key);
    if (!buffer) return fail("not_found", "That file has been removed.");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  },
);
