/**
 * Demo seed - `npm run db:seed` or `npm run demo:reset`.
 *
 * Creates a realistic two-hostel world so the product can be explored end to
 * end. Demo accounts live on the @demo.fillmate.app domain and every seeded
 * record is marked with provider "seed" so it is never mistaken for live data.
 */
import { getSql, migrate } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";
import { uuid } from "../lib/utils/id";
import { DEFAULT_HOSTEL_SETTINGS } from "../lib/repositories/hostels";
import { createRoom, createCooler } from "../lib/repositories/admin-writes";
import { addRoomMember } from "../lib/repositories/members";
import { createInvite } from "../lib/repositories/invites";
import { ensureRotation } from "../lib/services/rotation";
import { startOfTodayIso } from "../lib/utils/time";

const PASSWORD = "FillMate@2026";
const TZ = "Asia/Kolkata";

export async function runSeed() {
  await migrate();
  const sql = await getSql();
  const passwordHash = await hashPassword(PASSWORD);

  const orgId = uuid();
  const now = new Date().toISOString();
  await sql.execute(
    `INSERT INTO "organizations" ("id","name","slug","created_at") VALUES (?,?,?,?)`,
    [orgId, "Northline Hostels", `northline-${orgId.slice(0, 6)}`, now],
  );

  async function makeHostel(name: string, code: string, city: string) {
    const id = uuid();
    await sql.execute(
      `INSERT INTO "hostels"
         ("id","organization_id","name","code","city","timezone","bottle_target",
          "refill_deadline_hour","settings","created_at")
       VALUES (?,?,?,?,?,?,4,21,?,?)`,
      [id, orgId, name, code, city, TZ, JSON.stringify(DEFAULT_HOSTEL_SETTINGS), now],
    );
    return id;
  }

  const hostelA = await makeHostel("Hostel A", "HOSTA", "Pune");
  const hostelB = await makeHostel("Hostel B", "HOSTB", "Pune");

  async function makeUser(
    name: string,
    email: string,
    role: "student" | "hostel_admin",
    hostelId: string,
  ) {
    const existing = await sql.query<{ id: string }>(
      `SELECT "id" FROM "users" WHERE LOWER("email") = LOWER(?) LIMIT 1`,
      [email],
    );
    if (existing[0]) return existing[0].id;
    const id = uuid();
    await sql.execute(
      `INSERT INTO "users"
         ("id","email","password_hash","full_name","role","hostel_id","onboarding_step",
          "onboarded","theme","timezone","email_verified","created_at","updated_at")
       VALUES (?,?,?,?,?,?,5,TRUE,'system',?,TRUE,?,?)`,
      [id, email.toLowerCase(), passwordHash, name, role, hostelId, TZ, now, now],
    );
    return id;
  }

  const adminA = await makeUser("Priya Nair", "demo.admin@demo.fillmate.app", "hostel_admin", hostelA);
  const adminB = await makeUser("Rahul Iyer", "demo.adminb@demo.fillmate.app", "hostel_admin", hostelB);
  const monish = await makeUser("Monish Undhad", "demo.student@demo.fillmate.app", "student", hostelA);
  const aditya = await makeUser("Aditya Sharma", "aditya@demo.fillmate.app", "student", hostelA);
  const khush = await makeUser("Khush Patel", "khush@demo.fillmate.app", "student", hostelA);
  const krish = await makeUser("Krish Menon", "krish@demo.fillmate.app", "student", hostelA);
  const bRoom = await makeUser("Ishita Rao", "ishita@demo.fillmate.app", "student", hostelB);
  await makeUser("Neel Joshi", "neel@demo.fillmate.app", "student", hostelB);

  async function makeRoom(hostelId: string, number: string, target: number) {
    const room = await createRoom({ hostelId, number, bottleTarget: target, refillDeadlineHour: 21 });
    await createInvite({
      roomId: room.id,
      hostelId,
      createdBy: adminA,
      maxUses: 12,
    });
    return room;
  }

  const room304 = await makeRoom(hostelA, "304", 4);
  const room305 = await makeRoom(hostelA, "305", 3);
  const room201 = await makeRoom(hostelB, "201", 4);

  for (const userId of [monish, aditya, khush, krish]) {
    await addRoomMember(room304.id, hostelA, userId);
  }
  for (const userId of [adminA]) await addRoomMember(room305.id, hostelA, userId);
  for (const userId of [bRoom]) await addRoomMember(room201.id, hostelB, userId);

  const coolerA = await createCooler({
    hostelId: hostelA,
    label: "Cooler #A01 - Pantry",
    latitude: 18.5264,
    longitude: 73.8785,
    allowedRadiusM: 60,
  });
  const coolerB = await createCooler({
    hostelId: hostelB,
    label: "Cooler #B01 - Ground floor",
    latitude: 18.5291,
    longitude: 73.8742,
    allowedRadiusM: 50,
  });

  await ensureRotation(room304.id, hostelA, TZ);
  await ensureRotation(room201.id, hostelB, TZ);

  const members = [monish, aditya, khush, krish];
  const dayStart = new Date(startOfTodayIso(TZ)).getTime();
  const nowMs = Date.now();
  // Minutes before "now", never spilling before local midnight.
  const agoToday = (minutes: number) =>
    new Date(Math.max(dayStart + 10 * 60_000, nowMs - minutes * 60_000)).toISOString();
  const onDay = (daysBack: number, hour: number) =>
    new Date(dayStart - daysBack * 86_400_000 + hour * 3_600_000).toISOString();

  const insert = async (opts: {
    userId: string;
    roomId: string;
    hostelId: string;
    coolerId: string | null;
    bottles: number;
    at: string;
    status: "verified" | "needs_review" | "rejected";
    reviewStatus: "not_required" | "pending" | "rejected";
    confidence: number;
    distance: number | null;
    duplicate?: boolean;
  }) => {
    const id = uuid();
    const iso = opts.at;
    await sql.execute(
      `INSERT INTO "water_activities"
         ("id","user_id","hostel_id","room_id","cooler_id","bottle_count","status",
          "ai_confidence","cooler_detected","bottles_detected","filling_context_detected",
          "duplicate_suspected","image_hash","perceptual_hash","latitude","longitude",
          "location_accuracy","distance_from_cooler_m","location_status","server_timestamp",
          "timezone","review_status","flagged_reasons","created_at","updated_at")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, opts.userId, opts.hostelId, opts.roomId, opts.coolerId, opts.bottles,
        opts.status, opts.confidence,
        opts.status === "verified",
        opts.status === "verified" ? opts.bottles : null,
        opts.status === "verified",
        opts.duplicate,
        opts.duplicate ? `seedhash-${opts.roomId}` : `hash-${id}`,
        opts.duplicate ? "ffffffffffffffff" : null,
        opts.distance === null ? null : 18.5264,
        opts.distance === null ? null : 73.8785,
        opts.distance === null ? null : 18,
        opts.distance,
        opts.distance === null ? "unavailable" : opts.distance <= 60 ? "near" : "far",
        iso, TZ, opts.reviewStatus,
        opts.duplicate ? JSON.stringify(["duplicate_exact"]) : null,
        iso, iso,
      ],
    );
    await sql.execute(
      `INSERT INTO "ai_verifications"
         ("id","activity_id","provider","model","status","confidence","cooler_detected",
          "bottles_detected","filling_context_detected","duplicate_suspected","reason",
          "latency_ms","created_at")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(), id, "seed", "demo-corpus", opts.status, opts.confidence,
        opts.status === "verified",
        opts.status === "verified" ? opts.bottles : null,
        opts.status === "verified",
        opts.duplicate,
        opts.duplicate
          ? "This exact photo has already been submitted as evidence."
          : opts.status === "verified"
            ? `${opts.bottles} bottle(s) and the hostel cooler are visible in the same frame.`
            : "The cooler was not clearly visible, so an administrator will confirm it.",
        800 + opts.bottles * 45, iso,
      ],
    );
  };

  // Today - reads like a normal morning.
  await insert({ userId: khush, roomId: room304.id, hostelId: hostelA, coolerId: coolerA.id, bottles: 4, at: agoToday(150), status: "verified", reviewStatus: "not_required", confidence: 0.96, distance: 18 });
  await insert({ userId: aditya, roomId: room304.id, hostelId: hostelA, coolerId: coolerA.id, bottles: 2, at: agoToday(70), status: "verified", reviewStatus: "not_required", confidence: 0.93, distance: 24 });
  await insert({ userId: monish, roomId: room304.id, hostelId: hostelA, coolerId: coolerA.id, bottles: 3, at: onDay(1, 20), status: "needs_review", reviewStatus: "pending", confidence: 0.61, distance: 41 });

  // Recent history for a believable feed and charts.
  const history = [
    [0, 3, 2, 25], [1, 1, 4, 30], [1, 2, 2, 18], [2, 3, 3, 22],
    [2, 0, 4, 16], [3, 1, 1, 35], [3, 2, 5, 12], [4, 0, 2, 28],
    [4, 3, 3, 20], [5, 1, 4, 33], [6, 2, 2, 15], [7, 0, 3, 26],
  ] as const;

  for (const [days, memberIndex, bottles, distance] of history) {
    await insert({
      userId: members[memberIndex]!,
      roomId: room304.id,
      hostelId: hostelA,
      coolerId: coolerA.id,
      bottles,
      at: onDay(days + 1, 7 + memberIndex * 2),
      status: "verified",
      reviewStatus: "not_required",
      confidence: 0.88 + (memberIndex % 3) * 0.03,
      distance,
    });
  }

  // One honest edge case for the admin review queue.
  await insert({
    userId: krish,
    roomId: room304.id,
    hostelId: hostelA,
    coolerId: coolerA.id,
    bottles: 6,
    at: onDay(1, 21),
    status: "needs_review",
    reviewStatus: "pending",
    confidence: 0.42,
    distance: null,
    duplicate: true,
  });

  await insert({ userId: bRoom, roomId: room201.id, hostelId: hostelB, coolerId: coolerB.id, bottles: 4, at: agoToday(95), status: "verified", reviewStatus: "not_required", confidence: 0.95, distance: 12 });

  await sql.execute(
    `INSERT INTO "admin_actions"
       ("id","actor_user_id","actor_name","hostel_id","action","target_type","metadata","created_at")
     VALUES (?,?,?,?,?,?,?,?)`,
    [uuid(), adminA, "Priya Nair", hostelA, "seed.data_created", "system",
      JSON.stringify({ note: "Demo environment seeded" }), now],
  );

  console.log("[fillmate] demo data ready");
  console.log(`  Hostel A / Room 304  -> ${members.length} students, ${history.length + 4} activities`);
  console.log(`  Hostel B / Room 201  -> cross-hostel isolation check`);
  console.log("");
  console.log("  Demo accounts (password for all: FillMate@2026)");
  console.log("    student  demo.student@demo.fillmate.app");
  console.log("    admin    demo.admin@demo.fillmate.app");
  console.log(`    admin2   demo.adminb@demo.fillmate.app  (${adminB ? "Hostel B" : ""})`);
  process.exit(0);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[fillmate] seed failed:", err);
      process.exit(1);
    });
}