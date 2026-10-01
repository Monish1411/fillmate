import "server-only";
import { getSql } from "@/lib/db/client";
import { uuid } from "@/lib/utils/id";
import { notify } from "@/lib/repositories/notifications";
import type { AchievementRow } from "@/types/core";

/**
 * Subtle gamification.
 *
 * Badges are factual milestones, never judgements. An admin can switch
 * achievements off entirely for their hostel.
 */

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  /** Predicate over the student's lifetime numbers. */
  test: (stats: { fills: number; bottles: number; streak: number }) => boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first_fill",
    title: "First fill",
    description: "Recorded your first refill for the room.",
    icon: "droplets",
    test: (s) => s.fills >= 1,
  },
  {
    key: "week_streak",
    title: "7-day contribution",
    description: "Recorded a refill seven days in a row.",
    icon: "calendar-check",
    test: (s) => s.streak >= 7,
  },
  {
    key: "hundred_bottles",
    title: "100 bottles",
    description: "Helped fill 100 bottles in total.",
    icon: "sparkles",
    test: (s) => s.bottles >= 100,
  },
  {
    key: "reliable_roommate",
    title: "Reliable roommate",
    description: "Covered the refill on 20 separate days.",
    icon: "shield-check",
    test: (s) => s.fills >= 20,
  },
];

export async function listAchievements(userId: string): Promise<Array<AchievementDefinition & { earnedAt: string | null }>> {
  const sql = await getSql();
  const rows = await sql.query<AchievementRow>(
    `SELECT * FROM "achievements" WHERE "user_id" = ?`,
    [userId],
  );
  const earned = new Map(rows.map((r) => [r.key, r.earned_at]));
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    earnedAt: earned.get(a.key) ?? null,
  }));
}

/**
 * Award any newly-earned badges. Idempotent — the unique index on
 * (user_id, key) makes double-award impossible even under a race.
 */
export async function maybeAwardAchievements(
  userId: string,
  hostelId: string | null,
  stats: { fills: number; bottles: number; streak: number },
  options: { enabled: boolean },
): Promise<Array<AchievementDefinition>> {
  if (!options.enabled) return [];
  const newlyEarned: AchievementDefinition[] = [];

  const sql = await getSql();
  const existing = await sql.query<{ key: string }>(
    `SELECT "key" FROM "achievements" WHERE "user_id" = ?`,
    [userId],
  );
  const have = new Set(existing.map((r) => r.key));

  for (const achievement of ACHIEVEMENTS) {
    if (have.has(achievement.key)) continue;
    if (!achievement.test(stats)) continue;
    const inserted = await sql
      .execute(
        `INSERT INTO "achievements" ("id", "user_id", "hostel_id", "key", "title", "description", "earned_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          userId,
          hostelId,
          achievement.key,
          achievement.title,
          achievement.description,
          new Date().toISOString(),
        ],
      )
      .then(() => true)
      .catch(() => false);
    if (!inserted) continue;
    newlyEarned.push(achievement);
  }

  for (const achievement of newlyEarned) {
    await notify({
      userId,
      hostelId,
      type: "welcome",
      title: `Achievement unlocked · ${achievement.title}`,
      body: achievement.description,
    }).catch(() => undefined);
  }

  return newlyEarned;
}