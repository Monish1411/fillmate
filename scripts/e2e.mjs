import sharp from "sharp";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "FillMate@2026" }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { status: res.status, cookie };
}

async function html(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get("location") };
}

async function photo(seed) {
  const w = 640, h = 480; const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    raw[i] = (x * 3 + seed * 31) % 256;
    raw[i+1] = (y * 4 + seed * 11) % 256;
    raw[i+2] = ((x + y) * 2 + seed * 53) % 256;
  }
  const buf = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

console.log("\n=== 1. AUTHENTICATION ===");
const anon = await html("/app");
check("anonymous /app redirects to login", anon.status === 307 || anon.status === 302, `${anon.status} ${anon.location}`);

const bad = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "demo.student@demo.fillmate.app", password: "wrong" }),
});
check("wrong password rejected", bad.status === 401);

const student = await login("demo.student@demo.fillmate.app");
check("student login", student.status === 200 && student.cookie.startsWith("fm_session="));
const admin = await login("demo.admin@demo.fillmate.app");
check("admin login", admin.status === 200 && admin.cookie.startsWith("fm_session="));
const adminB = await login("demo.adminb@demo.fillmate.app");
check("admin B login (other hostel)", adminB.status === 200);

const dupeSignup = await fetch(`${BASE}/api/auth/signup`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fullName: "Test User", email: "demo.student@demo.fillmate.app", password: "Password123!" }),
});
check("duplicate email rejected", dupeSignup.status === 409);

const weak = await fetch(`${BASE}/api/auth/signup`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fullName: "Test User", email: "brand-new@example.com", password: "abc" }),
});
check("weak password rejected", weak.status === 422);

console.log("\n=== 2. PAGES (student) ===");
for (const [path, needle] of [
  ["/", "Never argue about who filled the bottles"],
  ["/login", "Sign in to FillMate"],
  ["/signup", "Create your account"],
  ["/app", "Water status"],
  ["/app/activity", "Activity"],
  ["/app/room", "Members"],
  ["/app/contributions", "Room contributions"],
  ["/app/rotation", "Refill rotation"],
  ["/app/notifications", "Notifications"],
  ["/app/profile", "Your contribution"],
  ["/app/settings", "Privacy"],
  ["/offline", "offline"],
]) {
  const page = await html(path, path === "/" || path.startsWith("/login") || path.startsWith("/signup") || path === "/offline" ? "" : student.cookie);
  check(`GET ${path}`, page.status === 200 && page.text.includes(needle), `${page.status}`);
}

console.log("\n=== 3. PAGES (admin) ===");
for (const [path, needle] of [
  ["/app/admin", "analytics"],
  ["/app/admin/activity", "Activity review"],
  ["/app/admin/members", "Members"],
  ["/app/admin/settings", "Hostel settings"],
]) {
  const page = await html(path, admin.cookie);
  check(`GET ${path}`, page.status === 200 && page.text.toLowerCase().includes(needle.toLowerCase()), `${page.status}`);
}
const studentAdmin = await html("/app/admin", student.cookie);
check("student blocked from /app/admin", studentAdmin.status === 307 || studentAdmin.status === 403 || studentAdmin.status === 500, `${studentAdmin.status}`);

console.log("\n=== 4. RECORDING FLOW ===");
const image = await photo(3);
const rec = await fetch(`${BASE}/api/activities`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ bottleCount: 2, imageBase64: image, timezone: "Asia/Kolkata" }),
});
const recJson = await rec.json();
check("POST /api/activities", rec.status === 201 && recJson.ok, JSON.stringify(recJson.error ?? {}));
const activity = recJson.data?.activity;
check("activity persisted with evidence", Boolean(activity?.imageUrl));
check("room status returned", Boolean(recJson.data?.roomStatus));
check("honest verification status", ["verified", "needs_review", "unavailable"].includes(activity?.status));

const dupe = await fetch(`${BASE}/api/activities`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ bottleCount: 2, imageBase64: image, timezone: "Asia/Kolkata" }),
});
const dupeJson = await dupe.json();
check("duplicate photo flagged", dupeJson.ok && dupeJson.data.activity.flaggedReasons.includes("duplicate_exact"), JSON.stringify(dupeJson.data?.activity?.flaggedReasons));

const tooMany = await fetch(`${BASE}/api/activities`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ bottleCount: 42, imageBase64: image }),
});
check("bottleCount capped at 10", tooMany.status === 422);

const noImage = await fetch(`${BASE}/api/activities`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ bottleCount: 1 }),
});
check("photo required", noImage.status === 422);

const notAnImage = await fetch(`${BASE}/api/activities`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ bottleCount: 1, imageBase64: "data:image/png;base64,aGVsbG8gd29ybGQ=" }),
});
check("non-image rejected", notAnImage.status === 422 || notAnImage.status === 415, `${notAnImage.status}`);

console.log("\n=== 5. EVIDENCE ACCESS ===");
if (activity?.imageUrl) {
  const owner = await fetch(`${BASE}${activity.imageUrl}`, { headers: { cookie: student.cookie } });
  check("owner can read evidence", owner.status === 200 && (owner.headers.get("content-type") ?? "").includes("image"));
  const pub = await fetch(`${BASE}${activity.imageUrl}`);
  check("anonymous blocked from evidence", pub.status === 401, `${pub.status}`);
  const other = await fetch(`${BASE}${activity.imageUrl}`, { headers: { cookie: adminB.cookie } });
  check("other hostel blocked from evidence", other.status === 403, `${other.status}`);
}

console.log("\n=== 6. HOSTEL ISOLATION ===");
const crossRead = await fetch(`${BASE}/api/activities/${activity.id}`, { headers: { cookie: adminB.cookie } });
check("hostel B cannot read hostel A activity", crossRead.status === 403 || crossRead.status === 404, `${crossRead.status}`);
const crossReview = await fetch(`${BASE}/api/admin/activities/${activity.id}/review`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: adminB.cookie },
  body: JSON.stringify({ decision: "approved" }),
});
check("hostel B cannot review hostel A activity", crossReview.status === 403 || crossReview.status === 404, `${crossReview.status}`);
const selfReview = await fetch(`${BASE}/api/admin/activities/${activity.id}/review`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ decision: "approved" }),
});
check("student cannot review", selfReview.status === 403, `${selfReview.status}`);

console.log("\n=== 7. ADMIN REVIEW + EXPORT ===");
const approve = await fetch(`${BASE}/api/admin/activities/${activity.id}/review`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: admin.cookie },
  body: JSON.stringify({ decision: "approved", note: "Verified manually." }),
});
check("admin approves activity", approve.status === 200 && (await approve.json()).data?.status === "verified", `${approve.status}`);
const csv = await fetch(`${BASE}/api/admin/export?limit=100`, { headers: { cookie: admin.cookie } });
const csvText = await csv.text();
check("CSV export", csv.status === 200 && csvText.includes("Student") && csv.headers.get("content-type")?.includes("text/csv"));
const analytics = await fetch(`${BASE}/api/admin/analytics?range=30d`, { headers: { cookie: admin.cookie } });
const aj = await analytics.json();
check("analytics", analytics.status === 200 && aj.ok && aj.data.series.length === 30, `${analytics.status}`);
const settings = await fetch(`${BASE}/api/admin/settings`, { headers: { cookie: admin.cookie } });
check("hostel settings", settings.status === 200 && (await settings.json()).ok);
const members = await fetch(`${BASE}/api/admin/members`, { headers: { cookie: admin.cookie } });
check("members list", members.status === 200 && (await members.json()).data.length > 0);

console.log("\n=== 8. STUDENT-FACING APIs ===");
for (const [path, label] of [
  ["/api/dashboard", "dashboard"],
  ["/api/activities?limit=5", "activities"],
  ["/api/rotation", "rotation"],
  ["/api/notifications", "notifications"],
  ["/api/invites", "invites"],
]) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: student.cookie } });
  check(`GET ${label}`, res.status === 200 && (await res.json()).ok, `${res.status}`);
}

const notifRead = await fetch(`${BASE}/api/notifications`, {
  method: "PATCH", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ all: true }),
});
check("mark notifications read", notifRead.status === 200);

const pref = await fetch(`${BASE}/api/profile`, {
  method: "PATCH", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ theme: "dark", notifyRefills: false }),
});
check("update preferences", pref.status === 200);

console.log("\n=== 9. INVITES ===");
const invite = await fetch(`${BASE}/api/invites`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: student.cookie },
  body: JSON.stringify({ maxUses: 5 }),
});
const inviteJson = await invite.json();
check("invite created", invite.status === 201 && Boolean(inviteJson.data?.code), JSON.stringify(inviteJson.error ?? {}));
const preview = await fetch(`${BASE}/api/invites/${inviteJson.data?.code}`);
check("invite preview", preview.status === 200 && (await preview.json()).data?.valid);
const joinPage = await html(`/join/${inviteJson.data?.code}`);
check("join page renders", joinPage.status === 200 && joinPage.text.includes("Join Room"));
const badJoin = await html("/join/NOPE99");
check("bad invite shows empty state", badJoin.status === 200 && badJoin.text.includes("unavailable"));

console.log("\n=== 10. INFRASTRUCTURE ===");
const health = await fetch(`${BASE}/api/health`);
const hj = await health.json();
check("health endpoint", health.status === 200 && hj.data.status === "ok" && hj.data.tables >= 18, JSON.stringify(hj.data ?? {}));
const manifest = await fetch(`${BASE}/manifest.webmanifest`);
const mj = await manifest.json();
check("web manifest", manifest.status === 200 && mj.name.includes("FillMate") && mj.icons.length === 3);
const sw = await fetch(`${BASE}/sw.js`);
check("service worker served", sw.status === 200 && (await sw.text()).includes("fillmate-v1"));
const icons = await fetch(`${BASE}/icons/icon-192.png`);
check("PWA icons", icons.status === 200 && icons.headers.get("content-type") === "image/png");
const og = await fetch(`${BASE}/opengraph-image`);
check("OG image", og.status === 200 && og.headers.get("content-type") === "image/png");
const favicon = await fetch(`${BASE}/favicon.svg`);
check("favicon", favicon.status === 200);
const nf = await html("/does-not-exist");
check("404 page", nf.status === 404 && nf.text.includes("find that page"));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);