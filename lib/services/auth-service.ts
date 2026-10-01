import "server-only";
import { AuthError } from "@/lib/auth/rbac";
import { getSql } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { uuid } from "@/lib/utils/id";
import { clientTimezone } from "@/lib/utils/time";
import { notify } from "@/lib/repositories/notifications";
import { findUserByEmail } from "@/lib/repositories/users";
import { loginSchema, signupSchema } from "@/lib/validation/schemas";
import type { UserRow } from "@/types/core";

/** Registration, login and the super-admin bootstrap. */

export interface AuthResult {
  userId: string;
  email: string;
  needsOnboarding: boolean;
}

export async function signUp(raw: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  timezone?: string;
}): Promise<AuthResult> {
  const input = signupSchema.parse(raw);
  const sql = await getSql();

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AuthError("conflict", "An account with that email already exists.");
  }

  const id = uuid();
  const now = new Date().toISOString();
  const timezone = input.timezone || clientTimezone();

  await sql.execute(
    `INSERT INTO "users"
       ("id", "email", "password_hash", "full_name", "phone", "role", "hostel_id",
        "onboarding_step", "onboarded", "theme", "timezone", "created_at", "updated_at")
     VALUES (?, ?, ?, ?, ?, 'student', NULL, 0, 0, 'system', ?, ?, ?)`,
    [
      id,
      input.email,
      await hashPassword(input.password),
      input.fullName,
      input.phone ?? null,
      timezone,
      now,
      now,
    ],
  );

  await createSession(id);
  await notify({
    userId: id,
    type: "welcome",
    title: "Welcome to FillMate",
    body: "Let's keep the bottles full.",
  }).catch(() => undefined);

  return { userId: id, email: input.email, needsOnboarding: true };
}

export async function signIn(raw: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const input = loginSchema.parse(raw);
  const user = await findUserByEmail(input.email);

  // Always run a verification so timing does not reveal account existence.
  const valid = await verifyPassword(input.password, user?.password_hash ?? null);
  if (!user || !valid) {
    throw new AuthError("unauthorized", "That email and password don't match.");
  }

  await createSession(user.id);

  return {
    userId: user.id,
    email: user.email,
    needsOnboarding: !user.onboarded,
  };
}

export async function signOut(): Promise<void> {
  const { destroySession } = await import("@/lib/auth/session");
  await destroySession();
}

/**
 * Create the platform super admin if it does not exist yet.
 * Safe to call on every boot; a no-op once the account is present.
 */
export async function ensureSuperAdmin(
  email: string,
  password: string,
): Promise<boolean> {
  if (!email || !password || password.length < 12) return false;
  const sql = await getSql();
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.role !== "super_admin") {
      await sql.execute(`UPDATE "users" SET "role" = 'super_admin' WHERE "id" = ?`, [
        existing.id,
      ]);
    }
    return false;
  }
  const id = uuid();
  const now = new Date().toISOString();
  await sql.execute(
    `INSERT INTO "users"
       ("id", "email", "password_hash", "full_name", "role", "onboarding_step", "onboarded",
        "theme", "timezone", "email_verified", "created_at", "updated_at")
     VALUES (?, ?, ?, ?, 'super_admin', 5, 1, 'system', ?, 1, ?, ?)`,
    [id, email.toLowerCase(), await hashPassword(password), "Platform Admin", "Asia/Kolkata", now, now],
  );
  return true;
}

export async function changePassword(
  user: UserRow,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) throw new AuthError("unauthorized", "That current password is incorrect.");
  const sql = await getSql();
  await sql.execute(`UPDATE "users" SET "password_hash" = ?, "updated_at" = ? WHERE "id" = ?`, [
    await hashPassword(newPassword),
    new Date().toISOString(),
    user.id,
  ]);
}