import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing — scrypt with per-password salt.
 *
 * Format: `scrypt$N$r$p$<salt-base64url>$<hash-base64url>`
 * Self-describing so parameters can be raised over time without
 * invalidating existing hashes.
 */

const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: PARAMS.maxmem,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) {
    // Constant-ish work even for accounts with no password (OAuth-only).
    await hashPassword(password);
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, "base64url");
  const expected = Buffer.from(parts[5]!, "base64url");
  try {
    const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: PARAMS.maxmem,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface PasswordCheck {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  message: string;
}

/** Lightweight, honest password strength guidance used in the UI. */
export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 8) {
    return { ok: false, score: 0, message: "Use at least 8 characters" };
  }
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score++;

  if (score <= 1) {
    return {
      ok: true,
      score: 1 as const,
      message: "Add a mix of letters, numbers or symbols",
    };
  }
  if (score === 2) {
    return { ok: true, score: 2 as const, message: "Fair — a little longer would help" };
  }
  if (score === 3) {
    return { ok: true, score: 3 as const, message: "Good password" };
  }
  return { ok: true, score: 4 as const, message: "Strong password" };
}