# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Email the maintainer privately or use GitHub's private vulnerability reporting
on the Security tab of the repository. Include reproduction steps and the
affected version.

We aim to acknowledge within 3 working days.

## What FillMate stores

Being explicit matters for a product built on evidence photos:

* **Evidence photos** — the single image you submit for a refill. Re-encoded
  to WebP, stripped of EXIF and GPS metadata, capped at `MAX_UPLOAD_MB`.
  Deleted automatically after the hostel's retention window (default 90 days).
* **Activity records** — bottle count, server timestamp, verification result.
* **Optional location** — only if you explicitly grant permission. Stored as a
  distance from the configured cooler; raw coordinates are never shown to any
  user and are not exposed in any API response.

FillMate never reads your camera roll, contacts, or files.

## Trust model

* Server-side timestamps are authoritative. Device clocks are recorded but
  never trusted.
* AI verification is treated as a *first reviewer*, not a judge. Low-confidence
  results are always routed to a human administrator and labelled as such in
  the interface.
* Authorization is enforced server-side in `lib/auth/rbac.ts` **and** mirrored by
  database Row Level Security in `supabase/migrations/0002_row_level_security.sql`.
* Students can never approve their own flagged activity, and can never read
  another hostel's data.

## Secrets

`.env.local`, `.env*` and `.data/` are gitignored. Never commit
`SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `SESSION_SECRET` or `DATABASE_URL`.
Only `NEXT_PUBLIC_*` values are ever included in the client bundle.