<div align="center">

# FillMate

**"Never argue about who filled the bottles."**

A production-ready accountability system for shared hostel water.
One photo, an AI vision check, a transparent record everyone can see.

[Next.js](https://nextjs.org) · [TypeScript](https://www.typescriptlang.org) · [Tailwind CSS v4](https://tailwindcss.com) · [PostgreSQL](https://www.postgresql.org) · [Supabase](https://supabase.com) · [Vercel](https://vercel.com)

</div>

---

## What it does

A hostel shares one water cooler. Somebody has to refill the bottles. Today that
turns into a group-chat argument nobody can resolve.

FillMate makes the record objective:

1. **Fill the bottles.** Whoever does it taps one button.
2. **Take a photo.** Bottles and cooler in the same frame. Ten seconds.
3. **AI verifies it.** A vision model checks for the cooler, the bottles and a
   filling context — and says plainly when it is *not* sure.
4. **Everyone stays informed.** The room feed updates instantly for every member.

The goal is **accountability without conflict**. The language throughout the
product is *activity*, *contribution*, *verification* and *room status* — never
blame. AI output is never treated as truth: low-confidence results go to a human
administrator with the photo and the reasoning side by side.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Environment variables](#environment-variables)
3. [Database setup](#database-setup)
4. [Storage setup](#storage-setup)
5. [AI provider setup](#ai-provider-setup)
6. [Architecture](#architecture)
7. [Security model](#security-model)
8. [API reference](#api-reference)
9. [Feature flags](#feature-flags)
10. [Demo accounts](#demo-accounts)
11. [Local development](#local-development)
12. [Production deployment](#production-deployment)
13. [Testing](#testing)
14. [Extending FillMate](#extending-fillmate)

---

## Quick start

```bash
git clone <your-repo> fillmate
cd fillmate
npm install

# Zero-configuration start: no database or API keys required.
cp .env.example .env.local
npm run demo:reset     # migrate + seed a realistic two-hostel world
npm run dev
```

Open <http://localhost:3000>.

Sign in with a [demo account](#demo-accounts) and record a refill.

### What "zero-configuration" means

FillMate ships with a **dual-driver data layer**. The same SQL runs on two
engines:

| Driver | Selected when | Use it for |
| --- | --- | --- |
| `node:sqlite` (built into Node 22+) | `DATABASE_URL` is empty | local dev, demos, CI, single-instance previews |
| `pg` (PostgreSQL) | `DATABASE_URL` is set | production: Supabase, Neon, Vercel Postgres, RDS |

One schema definition (`lib/db/schema.ts`) renders DDL for **both** dialects, so
the local and production databases can never drift. Migrations are idempotent and
run on boot.

Storage follows the same pattern: Supabase Storage when configured, otherwise a
`.data/uploads` directory served through an authorization-checked route.

---

## Environment variables

Copy `.env.example` to `.env.local`. Only `SESSION_SECRET` is genuinely required
in production.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | production | Absolute origin, used for invite links and OG tags. |
| `SESSION_SECRET` | **yes** | HMAC key for session cookies. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_URL` | no | PostgreSQL connection string. Empty = SQLite driver. |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Enables Supabase Storage for evidence photos. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Public anon key (safe to expose). |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Server-only. Never prefix with `NEXT_PUBLIC_`. |
| `SUPABASE_STORAGE_BUCKET` | no | Defaults to `fillmate-evidence`. |
| `AI_PROVIDER` | no | `openai` \| `gemini` \| `heuristic`. Defaults to `heuristic`. |
| `AI_API_KEY` | for AI | Server-only vision API key. |
| `AI_MODEL` | no | e.g. `gpt-4o-mini`, `gemini-2.0-flash`. |
| `MAX_UPLOAD_MB` | no | 1–10. Defaults to 8. |
| `NEXT_PUBLIC_DEMO_MODE` | no | `false` hides the demo affordances. |
| `CRON_SECRET` | production | Guards the scheduled job routes. |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | no | Bootstraps a platform admin. |

> **Secrets never reach the browser.** Only `NEXT_PUBLIC_*` values are inlined
> into the client bundle. Every AI call, database query and storage operation
> happens in a route handler or server action.

---

## Database setup

### Local (SQLite — nothing to install)

```bash
npm run db:setup      # create tables + indexes
npm run db:seed       # load demo data
npm run demo:reset    # drop everything, migrate, seed
npm run db:reset      # drop everything, migrate
```

The database lives at `.data/fillmate.db` (gitignored).

### Production (PostgreSQL / Supabase)

1. Create a PostgreSQL project.
2. Apply the migrations in order — they are plain SQL and run fine in the Supabase
   SQL editor or via `psql`:

   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_core_schema.sql
   psql "$DATABASE_URL" -f supabase/migrations/0002_row_level_security.sql
   psql "$DATABASE_URL" -f supabase/migrations/0003_storage_and_realtime.sql
   ```

3. Set `DATABASE_URL`.

`0001_core_schema.sql` is generated from the runtime schema definition:

```bash
npm run gen:migrations   # never hand-edit 0001; regenerate instead
```

### Tables

```
organizations ──< hostels ──< rooms ──< room_members >── users
                        │         │
                        │         └──< coolers
                        │
                        └──< water_activities ──< activity_images
                                       │  └──< ai_verifications
                                       ├──< notifications
                                       └──< reports

rotation_schedules · invites · achievements · admin_actions · sessions
realtime_events · system_settings
```

All timestamps are `timestamptz` in UTC and are formatted per-user at the edge.
Foreign keys cascade on delete, so removing a room removes its activity.
---

## Storage setup

Evidence photos are never stored in a database row — only a key is. The row
keeps `sha256`, a perceptual `phash`, dimensions and a retention deadline.

### Supabase Storage (recommended)

```bash
# Apply 0003_storage_and_realtime.sql, then set:
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=fillmate-evidence
```

The bucket is created as **private**. The API mints 30-minute signed URLs only
after checking that the caller belongs to the activity's room.

### Local filesystem (development)

Without Supabase credentials, photos are written to
`.data/uploads/<hostel>/<yyyy>/<mm>/<random>.webp` and served by
`GET /api/files/[...path]`, which re-checks room membership on every request.
Knowing a key is not enough to read a photo.

### What happens to an upload

1. Magic-byte sniffing — the declared MIME type is never trusted.
2. Size ceiling (`MAX_UPLOAD_MB`), dimension floor (160 px minimum side).
3. Auto-rotate + resize to 1280 px + re-encode to WebP. **This strips all EXIF
   and GPS metadata** — your location is never stored from the photo.
4. SHA-256 (exact) and a 64-bit dHash (perceptual) computed for duplicate
   detection.
5. Stored under a random, content-addressed key.

### Retention

Admins set `retentionDays` (default 90). The nightly cron deletes expired images
and their metadata rows. Evidence is never retained "just in case".

---

## AI provider setup

FillMate never trusts a model. It combines three independent signals and escalates
whenever it is unsure.

### 1. Vision model (optional but recommended)

```bash
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini

# or Google Gemini
AI_PROVIDER=gemini
AI_API_KEY=AIza...
AI_MODEL=gemini-2.0-flash
```

The model receives a strict JSON contract and returns:

```json
{
  "cooler_detected": true,
  "bottles_detected": 3,
  "filling_context_detected": true,
  "image_relevant": true,
  "manipulation_suspected": false,
  "confidence": 0.94,
  "reason": "Three bottles and the hostel cooler are visible in the same frame."
}
```

A refill is only marked **Verified** when the cooler *and* bottles *and* a filling
context are all present, nothing looks manipulated, and confidence is at or above
the hostel threshold. Everything else becomes **Needs review**.

### 2. Hash forensics

* **SHA-256** — exact duplicates, checked for a year.
* **dHash (64-bit)** — Hamming distance ≤ 6 over a 30-day window catches
  re-encodes, crops and screenshot-and-reupload.

### 3. Behaviour

* Submissions less than 8 seconds apart are flagged.
* More than 20 bottles in 10 minutes is flagged.
* **Server-side timestamps only** — the device clock is recorded but never trusted.

### No key? Everything still works.

With `AI_PROVIDER=heuristic` (the default) the app runs genuine local checks —
image sanity, brightness, entropy, known duplicates — but deliberately **never**
claims `verified`. Activities are saved and marked `needs_review`, and the UI
says so plainly: *"this deployment has no AI vision provider connected, so an
administrator will confirm it."*

That is the honest behaviour, not a degraded one. Everything else — storage,
feeds, rotation, admin review, analytics — works exactly the same.

### Adding a provider

Implement `AIProvider` in `lib/ai/provider.ts`, add a class in
`lib/ai/providers.ts`, register it in `lib/ai/index.ts`. No business logic
references a specific vendor.

---

## Architecture

```
app/
  (marketing)/          Landing page (indexable)
  (auth)/               Login + signup
  onboarding/           Hostel → room → bottles → done
  app/                  Student + admin app (sidebar / bottom nav)
  api/                  Route handlers, one concern each
  manifest.ts           PWA manifest
  opengraph-image.tsx   Social card, rendered from the design tokens
components/
  ui/                   Design-system primitives (Radix + custom styling)
  app/                  Product surfaces (status card, feed, rotation, …)
  record/               The refill capture flow
  admin/                Analytics, review, members, settings
  marketing/            Landing page sections
hooks/                  use-location, use-media-query
lib/
  db/                   Dual-driver SQL layer + portable schema
  auth/                 scrypt hashing, sessions, RBAC guards
  ai/                   Provider abstraction + verification orchestrator
  storage/              Image pipeline + object storage adapters
  repositories/         All reads and writes (SQL, no business logic)
  services/             Business logic (record, review, rotation, dashboard)
  realtime/             SSE event bus
  validation/           Zod schemas for every write path
types/                  Domain types shared by client and server
supabase/migrations/    Generated SQL + RLS + storage policies
scripts/                Migrations, seed, icons, end-to-end tests
```

**Layering rule:** `repositories` only speak SQL, `services` only speak
repositories, route handlers only speak services. Nothing below a layer imports
from above it.

### The dual-driver data layer

`lib/db/client.ts` exposes one interface:

```ts
interface SqlDriver {
  query<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  execute(sql: string, params?: SqlParam[]): Promise<number>;
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
}
```

Both drivers speak the same SQL: `?` placeholders, double-quoted identifiers,
ISO-8601 UTC text timestamps. The Postgres driver rewrites `?` → `$n` and
normalises `Date` → ISO string; the SQLite driver coerces booleans and
JSON-ifies objects. Everything above this line is dialect-agnostic.

### Realtime

`GET /api/realtime/stream` is a Server-Sent Events endpoint. Events are written
to `realtime_events` and pushed to in-process subscribers, with a periodic table
tail so the feed stays live across multiple server instances (which is what you
get on Vercel). The client reconnects with exponential backoff and shows a
connection state in the sidebar.

---

## Security model

Authorization is enforced in application code **and** mirrored by database RLS.

### Roles

| Role | Scope |
| --- | --- |
| `student` | Own hostel, rooms they belong to |
| `hostel_admin` | Entire hostel: review, members, rooms, coolers, settings |
| `super_admin` | All hostels: platform configuration |

### Rules a student can never break

* **No cross-hostel access.** Every query is scoped by hostel *in the SQL*, not by
  a post-filter, so a wrong request returns no rows rather than filtered rows.
  Cross-hostel lookups return `404`, not `403`, so existence is not leaked.
* **Cannot modify anyone else's activity.** `water_activities` insert policy
  requires `user_id = current_user`.
* **Cannot approve their own flagged activity.** `assertNotSelfReview` blocks it
  in the service layer and the route pre-flights it before any data is read.
* **Cannot touch AI results.** Verdicts are written with the service role, which
  bypasses RLS; client connections have no INSERT/UPDATE policy on
  `ai_verifications` at all.
* **Cannot reach admin endpoints.** `requireAdmin` is the first line of every
  `/api/admin/*` route.
* **Cannot read another room's evidence.** `/api/files/[...path]` re-checks
  membership on every request.

### Upload hardening

| Control | Implementation |
| --- | --- |
| Type validation | Magic-byte sniffing; renamed files rejected |
| Size ceiling | `MAX_UPLOAD_MB`, enforced on decode |
| Dimensions | Minimum 160 px per side |
| Metadata | EXIF/GPS stripped by re-encoding |
| Traversal | Storage keys validated against a strict pattern |
| Cadence | Per-user rate limits on upload, verification and writes |
| Retention | Automatic expiry sweep |

### Authentication

`scrypt` with a per-password salt and self-describing parameters
(`scrypt$N$r$p$salt$hash`). Login runs a verification even for unknown accounts
so response timing does not reveal which emails exist. Sessions are random
256-bit tokens stored **hashed** in the database, delivered as `httpOnly`,
`SameSite=Lax`, `Secure` cookies. Sign-in is rate limited per IP.
---

## API reference

Every response uses one envelope:

```jsonc
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "forbidden", "message": "..." } }
```

`code` is one of `unauthorized · forbidden · not_found · validation_error ·
rate_limited · conflict · upload_rejected · ai_unavailable · db_error · unknown`.
Messages are written for students; internals are never surfaced.

### Auth

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Full name, email, password, optional phone. |
| `POST` | `/api/auth/login` | Sets the session cookie. |
| `POST` | `/api/auth/logout` | Destroys the server-side session. |
| `GET` | `/api/auth/me` | Session user + deployment capabilities. |

### Student

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/dashboard` | Everything the home screen needs, one round-trip. |
| `GET` | `/api/activities` | Scoped, filterable, sorted, paginated. |
| `POST` | `/api/activities` | **Records a refill.** Validates → processes → verifies → persists. |
| `GET` | `/api/activities/:id` | Detail + every verification pass. |
| `POST` | `/api/verify-image` | Pre-flight photo check; persists nothing. |
| `GET`/`POST`/`DELETE` | `/api/invites` | Create, list and revoke room invites. |
| `GET` | `/api/invites/:code` | Public preview for the join screen. |
| `POST` | `/api/invites/join` | Redeems an invite. |
| `POST` | `/api/reports` | Report another member's activity. |
| `GET`/`POST` | `/api/rotation` | Schedule; skip, swap or volunteer. |
| `GET`/`PATCH` | `/api/notifications` | List and mark read. |
| `PATCH` | `/api/profile` | Profile, theme, notification and privacy settings. |
| `GET`/`POST` | `/api/onboarding` | Hostel → room → bottles → ready. |
| `GET` | `/api/rooms`, `/api/rooms/:id` | Room status and roster. |
| `GET` | `/api/realtime/stream` | SSE event stream. |
| `GET` | `/api/files/*` | Authorized evidence delivery (local driver). |

### Admin

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/admin/analytics` | `?range=today\|7d\|30d\|custom`. |
| `POST` | `/api/admin/activities/:id/review` | Approve / reject / request re-upload. |
| `GET` | `/api/admin/export` | CSV export of activity records. |
| `GET`/`PATCH` | `/api/admin/settings` | Feature flags, retention, thresholds. |
| `GET`/`PUT`/`DELETE` | `/api/admin/members` | Search, promote, remove from a room. |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/admin/coolers` | Cooler locations and QR codes. |
| `GET`/`POST` | `/api/admin/hostels` | Super admin: hostels and the audit log. |
| `GET`/`PATCH` | `/api/admin/reports` | Triage student reports. |
| `GET` | `/api/health` | Liveness + deployment capabilities. |

### Cron

`/api/cron/daily-digest` and `/api/cron/rotation-reminders` run on the schedule
declared in `vercel.json`. Both require `Authorization: Bearer $CRON_SECRET` in
production.

---

## Feature flags

Per-hostel toggles, managed at **Hostel settings**:

| Flag | Default | Effect |
| --- | --- | --- |
| `photo_evidence` | on | Require a photo on every refill. |
| `ai_verification` | on | Send photos to the vision provider. |
| `location_verification` | on | Compare an optional position to the cooler. |
| `qr_cooler` | on | Cooler QR scanning. |
| `leaderboard` | on | Show per-member contribution totals. |
| `rotation` | on | Generate and manage the schedule. |
| `notifications` | on | Room activity and review notifications. |
| `gamification` | on | Factual milestone badges. |
| `invites` | on | Shareable room join links. |
| `analytics` | on | Hostel-wide charts. |

Plus `retentionDays` (default 90) and `aiConfidenceThreshold` (default 0.7).
Turning the leaderboard off hides the contributions page entirely rather than
showing an empty chart.

---

## Demo accounts

`npm run demo:reset` creates a realistic two-hostel world. **All demo accounts
share the password `FillMate@2026`.**

| Role | Email | Hostel / room |
| --- | --- | --- |
| Student | `demo.student@demo.fillmate.app` | Hostel A · Room 304 |
| Roommates | `aditya@` · `khush@` · `krish@demo.fillmate.app` | Hostel A · Room 304 |
| Hostel admin | `demo.admin@demo.fillmate.app` | Hostel A |
| Hostel admin | `demo.adminb@demo.fillmate.app` | **Hostel B** — proves isolation |

The seed writes two hostels on purpose: signing in as `demo.adminb@…` and
attempting to read, review or fetch an evidence photo from Hostel A returns
`403`/`404`. That isolation is enforced server-side and covered by the test
suite.

Demo data is clearly separated: seeded rows carry provider `seed`, and the admin
audit log records `seed.data_created`. Demo accounts only exist if you run the
seed, and nothing about them is hard-coded in the application.

### Creating demo accounts safely

Never hard-code a production password. To provision accounts yourself:

```bash
# Option A — the normal path: let people sign up, then promote them.
#   Sign up normally, then run SQL:
UPDATE users SET role = 'hostel_admin' WHERE email = 'you@hostel.edu';

# Option B — bootstrap a super admin from environment variables at boot.
SUPER_ADMIN_EMAIL=admin@yourhostel.edu
SUPER_ADMIN_PASSWORD=<generate a 20+ character random password>
```

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Super-admin bootstrap is idempotent and only runs when those variables are set.

---

## Local development

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run gen:icons    # regenerate PWA icons from the logo
npm run gen:migrations  # regenerate supabase/migrations/0001 from the schema
```

### Project conventions

* **Tailwind v4** — design tokens live in `app/globals.css` as CSS variables and
  are mapped into Tailwind with `@theme inline`. Change a token once, the whole
  app follows.
* **Radius is restrained.** 12px cards, 8px controls, full pills only for badges.
  Nothing is pill-shaped by default.
* **Colour is functional.** Aqua marks action and verification; green/amber/red
  mark status. Decorative colour is not used.
* **Numerals are tabular.** Every statistic uses `font-variant-numeric:
  tabular-nums` so numbers do not jitter while updating.
* **Server components by default.** `"use client"` is added only where
  interaction requires it.
* **No raw technical errors reach the UI.** `handleError` maps every thrown value
  to friendly copy.

---

## Production deployment

### Vercel

```bash
npm i -g vercel
vercel
```

`vercel.json` already pins the framework, build command and cron schedules.

Set these environment variables in the project settings:

```
NEXT_PUBLIC_APP_URL     = https://your-domain.com
SESSION_SECRET          = <48 random bytes, base64url>
DATABASE_URL            = postgresql://...
SUPABASE_SERVICE_ROLE_KEY = ...   (optional, for Storage)
AI_PROVIDER / AI_API_KEY / AI_MODEL  (optional)
CRON_SECRET             = <random>
```

Migrations are **not** run automatically in production. Apply them once:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_core_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_row_level_security.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_storage_and_realtime.sql
```

### Other hosts

Any platform that runs Next.js 15 with a persistent database works. If you use
the SQLite driver, mount a **persistent volume** at `.data/` — it is not suitable
for ephemeral or multi-instance deployments.

### Post-deploy checklist

- [ ] `SESSION_SECRET` is set to a strong random value.
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`.
- [ ] Migrations applied and `GET /api/health` reports the right dialect.
- [ ] `AI_API_KEY` set, or the UI honestly reports "no vision provider".
- [ ] A super admin exists; demo accounts were never seeded.
- [ ] Evidence retention set to something your hostel will honour.

---

## Testing

```bash
npm run typecheck        # zero TypeScript errors
npm run lint             # zero warnings
npm run build            # production build
npm run test:e2e         # 60+ end-to-end checks against a running server
```

The end-to-end suite starts a production server and exercises:

* **Authentication** — signup, duplicate email, weak password, login, logout,
  anonymous redirects.
* **Pages** — every student and admin route renders with real data.
* **Recording** — photo upload, storage, verification, persistence, feed update.
* **Anti-fraud** — exact duplicate detection, bottle-count caps, type rejection.
* **Security** — cross-hostel reads, cross-hostel review, self-review, anonymous
  and cross-hostel evidence access.
* **Admin** — review decisions, CSV export, analytics, settings, members.
* **Invites** — creation, preview, join page, invalid code handling.
* **Infrastructure** — health, manifest, service worker, icons, OG image, 404.

```bash
npm run build && npm start
npm run test:e2e
```

### Manual QA

| Area | How to check |
| --- | --- |
| Mobile | DevTools → iPhone 15 Pro. Bottom nav, camera input, safe areas. |
| Camera | On a phone: the primary input opens the rear camera directly. |
| Dark mode | Toggle in Settings; no flash, no unreadable contrast. |
| Offline | DevTools → Network → Offline. Service worker serves the shell. |
| Permissions | Deny camera/location — the flow must still complete. |
| Keyboard | Tab through every form; focus rings are visible. |

---

## Extending FillMate

The architecture is deliberately modular so new hostel features slot in without a
rewrite.

### Adding a module (laundry, cleaning rotation, mess feedback, complaints)

1. Add tables to `lib/db/schema.ts` and regenerate the migration.
2. Add a repository in `lib/repositories/` — SQL only.
3. Add a service in `lib/services/` — business rules only.
4. Add a route in `app/api/`.
5. Add a page under `app/app/`.

Shared infrastructure — auth, RBAC, storage, AI, realtime, notifications,
analytics, invites — is reused unchanged.

### Notes on scale

* **Realtime** uses SSE with a table tail. At very high fan-out per hostel, move
  the transport to Supabase Realtime (the publication is already enabled in
  `0003_storage_and_realtime.sql`); `RealtimeProvider` is the only client that
  would change.
* **Rate limiting** is in-process per instance. Swap `lib/security/rate-limit.ts`
  for Redis when you need cross-instance ceilings.
* **Analytics** aggregate on read. If a hostel's activity grows past a few million
  rows, add a nightly rollup table and point `lib/repositories/analytics.ts` at it.

---

## Project philosophy

> Accountability without conflict.

FillMate records what happened. It does not judge anyone. The vocabulary is
deliberate:

| We say | We never say |
| --- | --- |
| Activity | Failure |
| Contribution | Score |
| Verification | Cheating |
| Needs review | Flagged offender |
| Room status | Neglect |

AI is treated as a helpful first reviewer that must be able to say *"I don't
know"*. When it does, a human decides. That is the whole design.

---

<div align="center">

**FillMate** — someone has to fill it. Now everyone knows who, and when.

`MIT licensed`

</div>