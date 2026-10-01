import "server-only";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/utils/id";

/**
 * Evidence image pipeline.
 *
 *  • validate magic bytes (never trust the client-declared MIME type)
 *  • strip EXIF/GPS metadata — students must not leak their location
 *  • normalise + re-encode to a bounded WebP for storage and AI
 *  • compute an exact SHA-256 and a perceptual dHash for duplicate detection
 */

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export class ImageRejected extends Error {
  constructor(
    message: string,
    readonly code: "type" | "size" | "corrupt",
  ) {
    super(message);
    this.name = "ImageRejected";
  }
}

const MAGIC: Array<{ mime: AllowedMime; test: (b: Buffer) => boolean }> = [
  {
    mime: "image/jpeg",
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
];

export function sniffMime(buffer: Buffer): AllowedMime | null {
  for (const entry of MAGIC) if (entry.test(buffer)) return entry.mime;
  return null;
}

export interface ProcessedImage {
  buffer: Buffer;
  mime: AllowedMime;
  ext: string;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  /** 64-bit difference hash as hex — catches re-encodes and light edits. */
  phash: string | null;
  /** Average luminance 0–1; used by the local heuristic analyser. */
  brightness: number | null;
  /** Shannon entropy of luminance (0–8). Low entropy ⇒ flat/blank image. */
  entropy: number | null;
  /** True when the file carried GPS EXIF tags (we always strip them). */
  hadLocationMetadata: boolean;
}

const AI_MAX_EDGE = 1280;
const AI_QUALITY = 78;
export async function processEvidenceImage(
  input: Buffer,
  declaredMime?: string | null,
): Promise<ProcessedImage> {
  if (!input || input.length === 0) {
    throw new ImageRejected("That file is empty. Try again.", "corrupt");
  }
  if (input.length > env.maxUploadBytes) {
    throw new ImageRejected(
      `Photos must be under ${Math.round(env.maxUploadBytes / (1024 * 1024))} MB.`,
      "size",
    );
  }

  const sniffed = sniffMime(input);
  if (!sniffed) {
    throw new ImageRejected("Only JPG, PNG and WebP photos are supported.", "type");
  }
  // Declared type is advisory; a non-image declaration means a renamed file.
  if (declaredMime && !declaredMime.startsWith("image/")) {
    throw new ImageRejected("Only JPG, PNG and WebP photos are supported.", "type");
  }

  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default;
  } catch {
    // Graceful degradation: keep original bytes, skip derived signals.
    return {
      buffer: input,
      mime: sniffed,
      ext: sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg",
      width: 0,
      height: 0,
      byteSize: input.length,
      sha256: sha256(input),
      phash: null,
      brightness: null,
      entropy: null,
      hadLocationMetadata: false,
    };
  }

  let hadLocationMetadata = false;
  try {
    const meta = await sharp(input).metadata();
    hadLocationMetadata = Boolean(meta.exif && /GPS/i.test(String(meta.exif)));
  } catch {
    /* metadata failures are non-fatal */
  }

  try {
    const base = sharp(input, { failOn: "none" }).rotate();
    const metadata = await base.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 160 || height < 160) {
      throw new ImageRejected("That photo is too small to verify.", "corrupt");
    }

    // Re-encode strips every metadata segment, including GPS.
    const buffer = await base
      .resize({
        width: AI_MAX_EDGE,
        height: AI_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: AI_QUALITY })
      .toBuffer();

    const analysis = await analysePixels(sharp, input);
    const phash = await computeDHash(sharp, input);

    return {
      buffer,
      mime: "image/webp",
      ext: "webp",
      width,
      height,
      byteSize: buffer.length,
      sha256: sha256(input),
      phash,
      brightness: analysis.brightness,
      entropy: analysis.entropy,
      hadLocationMetadata,
    };
  } catch (err) {
    if (err instanceof ImageRejected) throw err;
    throw new ImageRejected("We couldn't read that photo. Try another one.", "corrupt");
  }
}

async function analysePixels(
  sharp: typeof import("sharp"),
  input: Buffer,
): Promise<{ brightness: number | null; entropy: number | null }> {
  try {
    const data = await sharp(input, { failOn: "none" })
      .rotate()
      .greyscale()
      .resize(64, 64, { fit: "fill" })
      .raw()
      .toBuffer();

    let sum = 0;
    const histogram = new Array<number>(256).fill(0);
    for (let i = 0; i < data.length; i++) {
      sum += data[i]!;
      histogram[data[i]!] = (histogram[data[i]!] ?? 0) + 1;
    }
    const total = data.length || 1;
    let entropy = 0;
    for (const count of histogram) {
      if (count === 0) continue;
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
    return { brightness: sum / total / 255, entropy };
  } catch {
    return { brightness: null, entropy: null };
  }
}

/**
 * 64-bit difference hash. Robust to resizing, re-encoding and light edits —
 * exactly the transformations a duplicate-photo attempt goes through.
 */
async function computeDHash(
  sharp: typeof import("sharp"),
  input: Buffer,
): Promise<string | null> {
  try {
    const data = await sharp(input, { failOn: "none" })
      .rotate()
      .greyscale()
      .resize(9, 8, { fit: "fill" })
      .raw()
      .toBuffer();

    let bits = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        bits += data[y * 9 + x]! > data[y * 9 + x + 1]! ? "1" : "0";
      }
    }
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

/** Hamming distance between two 64-bit dHashes (0 = identical). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** Decode a client data-URL into bytes, enforcing the size ceiling first. */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] ?? "application/octet-stream";
  if (payloadTooLarge(match[3] ?? "")) return null;
  try {
    return {
      buffer: Buffer.from(match[3] ?? "", match[2] ? "base64" : "utf8"),
      mime,
    };
  } catch {
    return null;
  }
}

function payloadTooLarge(payload: string): boolean {
  return payload.length * 0.75 > env.maxUploadBytes * 1.45;
}

/** Data URL for AI providers (we always send the resized, stripped WebP). */
export function toDataUrl(buffer: Buffer, mime = "image/webp"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}