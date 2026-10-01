import "server-only";
import { getSql } from "@/lib/db/client";
import { shortCode, uuid } from "@/lib/utils/id";
import { DEFAULT_TZ } from "@/lib/utils/time";
import type { InviteRow } from "@/types/core";
import type { InvitePreview } from "@/types/api";

/**
 * Room invites.
 *
 * Codes are short, high-entropy (32^6) and single-use-countered so a link
 * pasted into a group chat can be revoked and has a bounded blast radius.
 */

const CODE_ATTEMPTS = 6;

export async function createInvite(params: {
  roomId: string;
  hostelId: string;
  createdBy: string;
  maxUses: number;
  expiresInDays?: number;
}): Promise<InviteRow> {
  const sql = await getSql();
  const id = uuid();

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = shortCode(6);
    const exists = await sql.query<{ id: string }>(
      `SELECT "id" FROM "invites" WHERE "code" = ? LIMIT 1`,
      [code],
    );
    if (exists[0]) continue;

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 86_400_000).toISOString()
      : null;

    await sql.execute(
      `INSERT INTO "invites"
         ("id", "code", "room_id", "hostel_id", "created_by", "max_uses", "uses", "expires_at", "revoked", "created_at")
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?)`,
      [id, code, params.roomId, params.hostelId, params.createdBy, params.maxUses, expiresAt, new Date().toISOString()],
    );
    const rows = await sql.query<InviteRow>(`SELECT * FROM "invites" WHERE "id" = ?`, [id]);
    return rows[0]!;
  }
  throw new Error("Could not generate a unique invite code. Try again.");
}

export async function getInviteByCode(code: string): Promise<InviteRow | null> {
  const sql = await getSql();
  const rows = await sql.query<InviteRow>(
    `SELECT * FROM "invites" WHERE "code" = ? LIMIT 1`,
    [code.toUpperCase()],
  );
  return rows[0] ?? null;
}

/** Public preview for the join screen — no private data is exposed. */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const invite = await getInviteByCode(code);
  const sql = await getSql();

  if (!invite) {
    return { code, roomNumber: "", hostelName: "", bottleTarget: 0, memberCount: 0, valid: false, reason: "This invite link is no longer valid." };
  }
  if (invite.revoked) {
    return { code, roomNumber: "", hostelName: "", bottleTarget: 0, memberCount: 0, valid: false, reason: "This invite was revoked by a roommate." };
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { code, roomNumber: "", hostelName: "", bottleTarget: 0, memberCount: 0, valid: false, reason: "This invite has expired." };
  }
  if (invite.uses >= invite.max_uses) {
    return { code, roomNumber: "", hostelName: "", bottleTarget: 0, memberCount: 0, valid: false, reason: "This invite has already been used the maximum number of times." };
  }

  const room = await sql.query<{
    number: string;
    bottle_target: number;
    hostel_name: string;
    total: number;
  }>(
    `SELECT r."number", r."bottle_target", h."name" AS "hostel_name",
            (SELECT COUNT(*) FROM "room_members" m WHERE m."room_id" = r."id") AS "total"
       FROM "rooms" r JOIN "hostels" h ON h."id" = r."hostel_id"
      WHERE r."id" = ? LIMIT 1`,
    [invite.room_id],
  );

  return {
    code: invite.code,
    roomNumber: room[0]?.number ?? "",
    hostelName: room[0]?.hostel_name ?? "",
    bottleTarget: Number(room[0]?.bottle_target ?? 4),
    memberCount: Number(room[0]?.total ?? 0),
    valid: true,
  };
}

/** Consume one use of an invite. Returns false when it is exhausted. */
export async function consumeInvite(inviteId: string): Promise<boolean> {
  const sql = await getSql();
  const changed = await sql.execute(
    `UPDATE "invites" SET "uses" = "uses" + 1 WHERE "id" = ? AND "uses" < "max_uses" AND "revoked" = 0`,
    [inviteId],
  );
  return changed > 0;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const sql = await getSql();
  await sql.execute(`UPDATE "invites" SET "revoked" = 1 WHERE "id" = ?`, [inviteId]);
}

export async function listInvites(roomId: string): Promise<InviteRow[]> {
  const sql = await getSql();
  return sql.query<InviteRow>(
    `SELECT * FROM "invites" WHERE "room_id" = ? ORDER BY "created_at" DESC LIMIT 20`,
    [roomId],
  );
}

export function inviteUrl(code: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/join/${code}`;
}

export const INVITE_TIMEZONE = DEFAULT_TZ;