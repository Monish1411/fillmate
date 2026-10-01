import "server-only";
import { cookies, headers } from "next/headers";
import { getSql } from "@/lib/db/client";
import { env } from "@/lib/env";
import { secureToken, sha256, uuid } from "@/lib/utils/id";
import type { SessionRow, UserRow } from "@/types/core";

export const SESSION_COOKIE = "fm_session";
const SESSION_DAYS = 30;

export interface AuthContext {
  user: UserRow;
  sessionId: string;
  /** Denormalized membership so guards avoid extra round-trips. */
  hostelId: string | null;
  hostelName: string | null;
  roomId: string | null;
  roomNumber: string | null;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.sessionCookieSecure,
    path: "/",
    expires,
  };
}

/** Create a server-side session and set the cookie. */
export async function createSession(userId: string): Promise<string> {
  const token = secureToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  const sql = await getSql();
  const hdrs = await headers();

  await sql.execute(
    `INSERT INTO "sessions" ("id", "user_id", "token_hash", "user_agent", "ip", "expires_at", "created_at", "last_used_at")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      userId,
      sha256(token),
      hdrs.get("user-agent")?.slice(0, 255) ?? null,
      clientIp(hdrs),
      expires.toISOString(),
      now.toISOString(),
      now.toISOString(),
    ],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expires));
  return token;
}

/** Destroy the current session (idempotent). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const sql = await getSql();
    await sql
      .execute(`DELETE FROM "sessions" WHERE "token_hash" = ?`, [sha256(token)])
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

/** Destroy every session for a user (used on password change / ban). */
export async function destroyAllSessions(userId: string): Promise<void> {
  const sql = await getSql();
  await sql.execute(`DELETE FROM "sessions" WHERE "user_id" = ?`, [userId]);
}

function clientIp(hdrs: Headers): string | null {
  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return hdrs.get("x-real-ip")?.slice(0, 64) ?? null;
}

/**
 * Resolve the current user from the session cookie.
 * Returns null for anonymous requests. Never throws.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sql = await getSql();
  const rows = await sql.query<UserRow & { session_id: string }>(
    `SELECT u.*, s."id" AS session_id
       FROM "sessions" s
       JOIN "users" u ON u."id" = s."user_id"
      WHERE s."token_hash" = ? AND s."expires_at" > ?
      LIMIT 1`,
    [sha256(token), new Date().toISOString()],
  );

  const row = rows[0];
  if (!row) return null;

  const membership = await sql.query<{ room_id: string; room_number: string }>(
    `SELECT rm."room_id", r."number" AS room_number
       FROM "room_members" rm
       JOIN "rooms" r ON r."id" = rm."room_id"
      WHERE rm."user_id" = ?
      ORDER BY rm."joined_at" ASC
      LIMIT 1`,
    [row.id],
  );

  const hostel = row.hostel_id
    ? await sql.query<{ name: string }>(
        `SELECT "name" FROM "hostels" WHERE "id" = ? LIMIT 1`,
        [row.hostel_id],
      )
    : [];

  // Refresh activity markers cheaply and without blocking the request.
  void sql
    .execute(
      `UPDATE "sessions" SET "last_used_at" = ? WHERE "id" = ?`,
      [new Date().toISOString(), row.session_id],
    )
    .catch(() => undefined);
  void sql
    .execute(`UPDATE "users" SET "last_seen_at" = ? WHERE "id" = ?`, [
      new Date().toISOString(),
      row.id,
    ])
    .catch(() => undefined);

  return {
    user: stripSession(row),
    sessionId: row.session_id,
    hostelId: row.hostel_id,
    hostelName: hostel[0]?.name ?? null,
    roomId: membership[0]?.room_id ?? null,
    roomNumber: membership[0]?.room_number ?? null,
  };
}

function stripSession(row: UserRow & { session_id: string }): UserRow {
  const { session_id: _ignored, ...user } = row;
  return user as UserRow;
}

/** Housekeeping — remove expired sessions. Called opportunistically. */
export async function pruneSessions(): Promise<void> {
  const sql = await getSql();
  await sql.execute(`DELETE FROM "sessions" WHERE "expires_at" < ?`, [
    new Date().toISOString(),
  ]);
}

export async function listSessions(userId: string): Promise<SessionRow[]> {
  const sql = await getSql();
  return sql.query<SessionRow>(
    `SELECT * FROM "sessions" WHERE "user_id" = ? ORDER BY "created_at" DESC`,
    [userId],
  );
}