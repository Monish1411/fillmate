export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1000) return String(Math.round(value));
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** "18m from cooler" · "Near cooler" · "Location unavailable" */
export function formatDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return "Distance unavailable";
  if (meters < 5) return "Right at the cooler";
  if (meters < 1000) return `${Math.round(meters)}m from cooler`;
  return `${(meters / 1000).toFixed(1)}km from cooler`;
}

export function initialsOf(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s.'-]/gu, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Deterministic accent index so avatars stay stable per person. */
export function accentIndex(seed: string, buckets = 6): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % buckets;
}

export function confidenceLabel(confidence: number | null): string {
  if (confidence === null || !Number.isFinite(confidence)) return "Not scored";
  const pct = Math.round(confidence * 100);
  if (pct >= 85) return "High confidence";
  if (pct >= 65) return "Moderate confidence";
  return "Low confidence";
}

export function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}