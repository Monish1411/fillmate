import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/utils/id";

/**
 * Object storage abstraction.
 *
 * Supabase Storage (private bucket) is used whenever Supabase credentials are
 * present. Otherwise evidence is written to `.data/uploads` and served through
 * an authorization-checked API route. The database only ever stores the key.
 */

export interface StoredObject {
  key: string;
  provider: "local" | "supabase";
  byteSize: number;
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

let supabaseAdmin: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient | null {
  if (!env.supabaseEnabled) return null;
  if (supabaseAdmin) return supabaseAdmin;
  supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "fillmate-server" } },
  });
  return supabaseAdmin;
}

/** Ensure the private bucket exists (idempotent, cheap). */
export async function ensureBucket(): Promise<void> {
  const supabase = supabaseServer();
  if (!supabase) return;
  const { error } = await supabase.storage.getBucket(env.storageBucket);
  if (error && /not found/i.test(error.message)) {
    await supabase.storage.createBucket(env.storageBucket, {
      public: false,
      fileSizeLimit: env.maxUploadBytes,
    });
  }
}

/**
 * Build a content-addressed key. The random component defeats guessing; the
 * hostel prefix makes server-side scoping trivial.
 */
export function buildEvidenceKey(
  hostelId: string,
  buffer: Buffer,
  ext: string,
  now = new Date(),
): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = sha256(`${buffer.subarray(0, 4096).toString("base64")}:${Date.now()}:${Math.random()}`)
    .slice(0, 32);
  return `${hostelId}/${y}/${m}/${random}.${ext}`;
}

/** Never allow traversal — keys are validated before touching the filesystem. */
export function isSafeKey(key: string): boolean {
  return (
    /^[A-Za-z0-9_\-/]+\.[A-Za-z0-9]{2,5}$/.test(key) &&
    !key.includes("..") &&
    !key.startsWith("/") &&
    key.split("/").every((part) => part.length > 0 && part !== "." && part !== "..")
  );
}

export async function putEvidence(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<StoredObject> {
  if (!isSafeKey(key)) throw new Error("Invalid storage key");

  const supabase = supabaseServer();
  if (supabase) {
    await ensureBucket();
    const { error } = await supabase.storage
      .from(env.storageBucket)
      .upload(key, buffer, { contentType, upsert: false, cacheControl: "31536000" });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    return { key, provider: "supabase", byteSize: buffer.length };
  }

  const target = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  return { key, provider: "local", byteSize: buffer.length };
}
export async function readEvidence(key: string): Promise<Buffer | null> {
  if (!isSafeKey(key)) return null;
  const supabase = supabaseServer();
  if (supabase) {
    const { data, error } = await supabase.storage.from(env.storageBucket).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await readFile(path.join(LOCAL_ROOT, key));
  } catch {
    return null;
  }
}

export async function deleteEvidence(key: string): Promise<void> {
  if (!isSafeKey(key)) return;
  const supabase = supabaseServer();
  if (supabase) {
    await supabase.storage.from(env.storageBucket).remove([key]);
    return;
  }
  try {
    await unlink(path.join(LOCAL_ROOT, key));
  } catch {
    /* already gone */
  }
}

/**
 * Resolve a displayable URL.
 * Supabase private buckets need short-lived signed URLs; local evidence is
 * served through an authorization-checked route.
 */
export async function evidenceUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  const supabase = supabaseServer();
  if (supabase) {
    const { data } = await supabase.storage
      .from(env.storageBucket)
      .createSignedUrl(key, 60 * 30);
    return data?.signedUrl ?? null;
  }
  return `/api/files/${key}`;
}

/** Bulk resolution keeps a whole feed page to one round-trip. */
export async function evidenceUrls(keys: (string | null)[]): Promise<(string | null)[]> {
  const unique = Array.from(new Set(keys.filter((k): k is string => Boolean(k))));
  const resolved = new Map<string, string | null>();
  if (unique.length === 0) return keys.map(() => null);
  const bucketName = env.storageBucket;

  const supabase = supabaseServer();
  if (supabase) {
    await ensureBucket();
    const { data } = await supabase.storage
      .from(bucketName)
      .createSignedUrls(unique, 60 * 30);
    for (const entry of data ?? []) {
      resolved.set(entry.path as string, (entry.signedUrl as string | null) ?? null);
    }
  } else {
    for (const key of unique) resolved.set(key, `/api/files/${key}`);
  }
  return keys.map((k) => (k ? (resolved.get(k) ?? null) : null));
}

/** Retention sweep — removes evidence past its configured retention window. */
export async function pruneEvidence(retentionDays: number): Promise<number> {
  void retentionDays;
  const { getSql } = await import("@/lib/db/client");
  const sql = await getSql();
  const stale = await sql.query<{ id: string; storage_key: string }>(
    `SELECT "id", "storage_key" FROM "activity_images"
      WHERE "retention_until" IS NOT NULL AND "retention_until" < ?`,
    [new Date().toISOString()],
  );
  for (const row of stale) await deleteEvidence(row.storage_key);
  for (const row of stale) {
    await sql.execute(`DELETE FROM "activity_images" WHERE "id" = ?`, [row.id]);
  }
  return stale.length;
}