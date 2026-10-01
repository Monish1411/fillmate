/**
 * Timezone-aware formatting helpers.
 *
 * Every timestamp in FillMate is stored as ISO-8601 UTC. Display formatting
 * always happens against an explicit IANA timezone so a user in Bengaluru and
 * an admin in London both see correct, unambiguous local times.
 */

export const DEFAULT_TZ = "Asia/Kolkata";

export function safeTz(tz?: string | null): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

export function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "YYYY-MM-DD" for the given instant in the given timezone. */
export function dayKey(value: string | Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toDate(value));
}

/** "Today" · "Yesterday" · "12 Oct" — activity-feed group headers. */
export function formatDayLabel(
  value: string | Date,
  tz?: string | null,
  now: Date = new Date(),
): string {
  const key = dayKey(value, tz);
  if (key === dayKey(now, tz)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), tz)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz(tz),
    day: "numeric",
    month: "short",
  }).format(toDate(value));
}

/** "8:42 PM" */
export function formatTime(value: string | Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz(tz),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(toDate(value))
    .replace(/\s/g, " ");
}

/** "8:42:17 PM" */
export function formatTimeSeconds(value: string | Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz(tz),
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
    .format(toDate(value))
    .replace(/\s/g, " ");
}

/** "1 October 2026" */
export function formatFullDate(value: string | Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz(tz),
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}

/** "1 October 2026 · 8:42:17 PM · Asia/Kolkata" */
export function formatFullTimestamp(value: string | Date, tz?: string | null): string {
  const zone = safeTz(tz);
  return `${formatFullDate(value, zone)} · ${formatTimeSeconds(value, zone)} · ${zone}`;
}

/** "just now" · "12m ago" · "3h ago" · "2d ago" */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const diff = now.getTime() - toDate(value).getTime();
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";
  const mins = Math.round(abs / 60_000);
  if (mins < 60) return diff >= 0 ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.round(abs / 3_600_000);
  if (hours < 24) return diff >= 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(abs / 86_400_000);
  if (days < 7) return diff >= 0 ? `${days}d ago` : `in ${days}d`;
  return formatDayLabel(value, DEFAULT_TZ, now);
}

/** "September 2026" — used for "Member since". */
export function formatMonthYear(value: string | Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz(tz),
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}
export function greeting(date: Date = new Date(), tz?: string | null): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz(tz),
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Hour of day (0–23) in the given timezone — powers "most active hours". */
export function hourIn(value: string | Date, tz?: string | null): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: safeTz(tz),
        hour: "numeric",
        hour12: false,
      }).format(toDate(value)),
    ) % 24
  );
}

/** Offset of `tz` from UTC at a given instant, in milliseconds. */
export function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz(tz),
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** UTC instant for local midnight of the `YYYY-MM-DD` day in `tz`. */
export function startOfDayIso(day: string, tz: string = DEFAULT_TZ): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
  // Two passes converge even across DST transitions.
  let guess = target;
  for (let i = 0; i < 2; i++) guess = target - tzOffsetMs(new Date(guess), tz);
  return new Date(guess).toISOString();
}

/** Start of the current local day as a UTC instant. */
export function startOfTodayIso(tz: string = DEFAULT_TZ): string {
  return startOfDayIso(dayKey(new Date(), tz), tz);
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

export function tzAbbreviation(tz?: string | null, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz(tz),
      timeZoneName: "short",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? safeTz(tz);
  } catch {
    return safeTz(tz);
  }
}

/** Browser timezone, falling back to the default. */
export function clientTimezone(): string {
  if (typeof Intl === "undefined") return DEFAULT_TZ;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}