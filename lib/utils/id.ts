import { randomBytes, randomUUID, createHash } from "node:crypto";

export const uuid = (): string => randomUUID();

/** Short, human-friendly, URL-safe code (invite codes, room codes). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function shortCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .digest("hex");
}

/** Opaque, high-entropy token used for session cookies and invite secrets. */
export function secureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}