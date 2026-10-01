import "server-only";
import { getSql } from "@/lib/db/client";
import { uuid } from "@/lib/utils/id";
import type { AdminActionRow, ReportRow } from "@/types/activity";

/** Reports filed by students, plus the immutable admin audit log. */

export interface ReportInput {
  reporterUserId: string;
  activityId: string;
  roomId: string;
  hostelId: string;
  reason: string;
  details?: string | null;
}

export async function createReport(input: ReportInput): Promise<ReportRow> {
  const sql = await getSql();
  const id = uuid();
  const now = new Date().toISOString();
  await sql.execute(
    `INSERT INTO "reports"
       ("id", "reporter_user_id", "activity_id", "room_id", "hostel_id",
        "reason", "details", "status", "created_at")
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      id,
      input.reporterUserId,
      input.activityId,
      input.roomId,
      input.hostelId,
      input.reason,
      input.details ?? null,
      now,
    ],
  );
  const rows = await sql.query<ReportRow>(`SELECT * FROM "reports" WHERE "id" = ?`, [id]);
  return rows[0]!;
}

export async function listReports(
  hostelId: string,
  options: { status?: string; limit?: number } = {},
): Promise<Array<ReportRow & { reporter_name: string; room_number: string; student_name: string }>> {
  const sql = await getSql();
  const where = [`r."hostel_id" = ?`];
  const params: Array<string | number> = [hostelId];
  if (options.status) {
    where.push(`r."status" = ?`);
    params.push(options.status);
  }
  return sql.query(
    `SELECT r.*, u."full_name" AS "reporter_name", rm."number" AS "room_number",
            a."full_name" AS "student_name"
       FROM "reports" r
       JOIN "users" u ON u."id" = r."reporter_user_id"
       JOIN "rooms" rm ON rm."id" = r."room_id"
       JOIN "water_activities" wa ON wa."id" = r."activity_id"
       JOIN "users" a ON a."id" = wa."user_id"
      WHERE ${where.join(" AND ")}
      ORDER BY r."created_at" DESC LIMIT ?`,
    [...params, options.limit ?? 50],
  );
}

export async function resolveReport(
  reportId: string,
  status: "resolved" | "dismissed" | "reviewing",
  resolution: string,
  resolvedBy: string,
): Promise<void> {
  const sql = await getSql();
  await sql.execute(
    `UPDATE "reports" SET "status" = ?, "resolution" = ?, "resolved_by" = ?, "resolved_at" = ?
      WHERE "id" = ?`,
    [status, resolution.slice(0, 400), resolvedBy, new Date().toISOString(), reportId],
  );
}

export async function countOpenReports(hostelId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ total: number }>(
    `SELECT COUNT(*) AS "total" FROM "reports" WHERE "hostel_id" = ? AND "status" = 'open'`,
    [hostelId],
  );
  return Number(rows[0]?.total ?? 0);
}

/* -- Admin audit log ------------------------------------------- */

export async function logAdminAction(params: {
  actorUserId: string;
  actorName?: string | null;
  hostelId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql.execute(
    `INSERT INTO "admin_actions"
       ("id", "actor_user_id", "actor_name", "hostel_id", "action",
        "target_type", "target_id", "metadata", "ip", "created_at")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      params.actorUserId,
      params.actorName ?? null,
      params.hostelId ?? null,
      params.action,
      params.targetType ?? null,
      params.targetId ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.ip ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function listAdminActions(
  hostelId: string | null,
  limit = 50,
): Promise<AdminActionRow[]> {
  const sql = await getSql();
  if (hostelId) {
    return sql.query<AdminActionRow>(
      `SELECT * FROM "admin_actions" WHERE "hostel_id" = ? ORDER BY "created_at" DESC LIMIT ?`,
      [hostelId, limit],
    );
  }
  return sql.query<AdminActionRow>(
    `SELECT * FROM "admin_actions" ORDER BY "created_at" DESC LIMIT ?`,
    [limit],
  );
}