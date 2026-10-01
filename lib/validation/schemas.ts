import { z } from "zod";

/**
 * Input validation — every write path validates before touching the database.
 * Messages are user-facing copy; nothing internal is echoed back.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address")
  .max(254, "That email is too long")
  .email("Enter a valid email address")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "That password is too long");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(80, "That name is too long");

export const roomNumberSchema = z
  .string()
  .trim()
  .min(1, "Enter your room number")
  .max(16, "That room number is too long")
  .regex(/^[A-Za-z0-9\-/]+$/, "Use letters, numbers, dashes or slashes only");

export const phoneSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^[+\d][\d\s\-()]{6,19}$/, "Enter a valid phone number"),
    z.literal("").transform(() => undefined),
  ])
  .optional();

export const signupSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  timezone: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
  redirectTo: z.string().max(200).optional(),
});

export const onboardingSchema = z.object({
  step: z.enum(["welcome", "hostel", "room", "bottles", "ready"]),
  hostelId: z.string().max(64).optional(),
  hostelName: z.string().trim().min(2).max(80).optional(),
  hostelCode: z.string().trim().min(2).max(16).optional(),
  roomNumber: roomNumberSchema.optional(),
  bottleTarget: z.coerce.number().int().min(1).max(20).optional(),
  floor: z.string().trim().max(20).optional(),
});

export const bottleCountSchema = z.coerce
  .number()
  .int("Enter a whole number of bottles")
  .min(1, "Fill at least 1 bottle")
  .max(10, "Record at most 10 bottles at once");

export const createActivitySchema = z.object({
  bottleCount: bottleCountSchema,
  /** Base64 data URL, or a previously uploaded storage key. */
  imageBase64: z.string().max(14_000_000).optional(),
  imageKey: z.string().max(200).optional(),
  coolerId: z.string().max(64).nullable().optional(),
  note: z.string().trim().max(280, "Keep notes under 280 characters").optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(100_000).optional(),
    })
    .nullable()
    .optional(),
  clientTimestamp: z.string().max(40).optional(),
  timezone: z.string().max(64).optional(),
  qrCode: z.string().trim().max(32).nullable().optional(),
});

export const activityQuerySchema = z.object({
  roomId: z.string().max(64).optional(),
  hostelId: z.string().max(64).optional(),
  userId: z.string().max(64).optional(),
  status: z.enum(["verified", "needs_review", "rejected", "unavailable"]).optional(),
  reviewStatus: z
    .enum(["not_required", "pending", "approved", "rejected", "re_upload_requested"])
    .optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  minBottles: z.coerce.number().int().min(0).max(50).optional(),
  maxBottles: z.coerce.number().int().min(0).max(50).optional(),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(["newest", "oldest", "most_bottles"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const reviewDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "re_upload_requested"]),
  note: z.string().trim().max(400).optional(),
});

export const createRoomSchema = z.object({
  roomNumber: roomNumberSchema,
  floor: z.string().trim().max(20).optional(),
  bottleTarget: z.coerce.number().int().min(1).max(20).default(4),
  refillDeadlineHour: z.coerce.number().int().min(0).max(23).default(21),
});

export const createHostelSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers or dashes"),
  city: z.string().trim().max(60).optional(),
  timezone: z.string().max(64).default("Asia/Kolkata"),
  organizationName: z.string().trim().min(2).max(80).optional(),
});

export const inviteSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(50).default(12),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
});
export const reportSchema = z.object({
  activityId: z.string().min(1, "Select the activity you're reporting"),
  reason: z.enum([
    "not_them",
    "wrong_bottle_count",
    "wrong_time",
    "unrelated_photo",
    "other",
  ]),
  details: z.string().trim().max(500).optional(),
});

export const coolerSchema = z.object({
  label: z.string().trim().min(2).max(40),
  roomId: z.string().max(64).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  allowedRadiusM: z.coerce.number().min(5).max(2000).default(60),
  locationEnforced: z.coerce.boolean().default(false),
});

export const profileSchema = z.object({
  fullName: nameSchema.optional(),
  displayName: z.string().trim().max(60).optional(),
  phone: phoneSchema,
  theme: z.enum(["system", "light", "dark"]).optional(),
  timezone: z.string().max(64).optional(),
});

export const preferencesSchema = z.object({
  notifyRefills: z.boolean().optional(),
  notifyRotation: z.boolean().optional(),
  notifyReviews: z.boolean().optional(),
  notifyWeekly: z.boolean().optional(),
  privacyShowContributions: z.boolean().optional(),
  privacyShowActivity: z.boolean().optional(),
  privacyShowName: z.boolean().optional(),
});

export const rotationSwapSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  action: z.enum(["skip", "swap", "claim", "accept"]),
  targetUserId: z.string().max(64).optional(),
  reason: z.string().trim().max(200).optional(),
});

export const featureConfigSchema = z.object({
  ai_verification: z.boolean().optional(),
  location_verification: z.boolean().optional(),
  qr_cooler: z.boolean().optional(),
  leaderboard: z.boolean().optional(),
  rotation: z.boolean().optional(),
  notifications: z.boolean().optional(),
  gamification: z.boolean().optional(),
  analytics: z.boolean().optional(),
  invites: z.boolean().optional(),
  photo_evidence: z.boolean().optional(),
  retentionDays: z.coerce.number().int().min(1).max(365).optional(),
  aiConfidenceThreshold: z.coerce.number().min(0).max(1).optional(),
});

export const analyticsRangeSchema = z.object({
  range: z.enum(["today", "7d", "30d", "custom"]).default("7d"),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
});

export const memberSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  roomNumber: roomNumberSchema,
  role: z.enum(["student", "hostel_admin"]).default("student"),
  temporaryPassword: z.string().min(8).max(128).optional(),
});