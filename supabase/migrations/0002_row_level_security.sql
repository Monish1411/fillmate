-- =============================================================================
-- FillMate - Row Level Security
--
-- Defense in depth. The API enforces authorization in application code, but
-- these policies make a mistake in that code non-fatal: the database refuses
-- the row anyway.
--
-- Helper functions read the caller's claims from auth.jwt(). The API signs a
-- session token whose payload is mirrored into the JWT when Supabase Auth is
-- used; for the built-in email/password auth the API uses the service role and
-- these policies simply do not apply (documented trade-off in the README).
-- =============================================================================

-- The caller's user id, from either Supabase Auth or a FillMate session claim.
CREATE OR REPLACE FUNCTION fillmate_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''),
    auth.uid()::text
  );
$$;

-- The hostel the caller belongs to.
CREATE OR REPLACE FUNCTION fillmate_hostel_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "hostel_id" FROM "users" WHERE "id" = fillmate_user_id();
$$;

-- The caller's role.
CREATE OR REPLACE FUNCTION fillmate_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "role" FROM "users" WHERE "id" = fillmate_user_id();
$$;

-- TRUE when the caller is an admin of the given hostel (or a super admin).
CREATE OR REPLACE FUNCTION fillmate_is_hostel_admin(hostel_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT fillmate_role() = 'super_admin'
      OR (fillmate_role() = 'hostel_admin' AND fillmate_hostel_id() = hostel_id);
$;

ALTER TABLE "organizations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostels"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_members"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coolers"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "water_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_images"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rotation_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_actions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "achievements"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "realtime_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;

-- users: you can read yourself; admins can read anyone in their hostel.
DROP POLICY IF EXISTS users_select ON "users";
CREATE POLICY users_select ON "users" FOR SELECT USING (
  "id" = fillmate_user_id()
  OR "hostel_id" = fillmate_hostel_id()
);

-- users: nobody may rewrite another account through a client connection.
DROP POLICY IF EXISTS users_update_self ON "users";
CREATE POLICY users_update_self ON "users" FOR UPDATE USING (
  "id" = fillmate_user_id()
) WITH CHECK ("id" = fillmate_user_id());

-- Verification results are immutable from the database side: the only writes
-- happen through the service-role API, which bypasses RLS by design.
DROP POLICY IF EXISTS activities_admin_write ON "water_activities";
CREATE POLICY activities_admin_write ON "water_activities" FOR ALL
  USING (fillmate_role() IN ('hostel_admin', 'super_admin'))
  WITH CHECK (fillmate_role() IN ('hostel_admin', 'super_admin'));

-- A student may add their own refill, and may never rewrite someone else's.
DROP POLICY IF EXISTS activities_insert_own ON "water_activities";
CREATE POLICY activities_insert_own ON "water_activities" FOR INSERT
  WITH CHECK (
    "user_id" = fillmate_user_id()
    AND "status" IN ('verified', 'needs_review', 'unavailable')
  );

-- Reads: room members see their room; hostel admins see the whole hostel.
DROP POLICY IF EXISTS activities_select ON "water_activities";
CREATE POLICY activities_select ON "water_activities" FOR SELECT USING (
  "hostel_id" = fillmate_hostel_id()
  AND (
    fillmate_role() IN ('hostel_admin', 'super_admin')
    OR "room_id" IN (
      SELECT "room_id" FROM "room_members" WHERE "user_id" = fillmate_user_id()
    )
  )
);

-- Evidence images inherit the activity's access rules.
DROP POLICY IF EXISTS images_select ON "activity_images";
CREATE POLICY images_select ON "activity_images" FOR SELECT USING (
  "activity_id" IN (SELECT "id" FROM "water_activities")
);

-- AI verdicts are read-only for clients.
DROP POLICY IF EXISTS verifications_select ON "ai_verifications";
CREATE POLICY verifications_select ON "ai_verifications" FOR SELECT USING (
  "activity_id" IN (SELECT "id" FROM "water_activities")
);

-- Notifications are strictly private.
DROP POLICY IF EXISTS notifications_own ON "notifications";
CREATE POLICY notifications_own ON "notifications" FOR ALL
  USING ("user_id" = fillmate_user_id())
  WITH CHECK ("user_id" = fillmate_user_id());

-- Sessions are private to their owner.
DROP POLICY IF EXISTS sessions_own ON "sessions";
CREATE POLICY sessions_own ON "sessions" FOR ALL
  USING ("user_id" = fillmate_user_id())
  WITH CHECK ("user_id" = fillmate_user_id());

-- Room members can read their own room and its roster.
DROP POLICY IF EXISTS rooms_select ON "rooms";
CREATE POLICY rooms_select ON "rooms" FOR SELECT USING (
  "id" IN (SELECT "room_id" FROM "room_members" WHERE "user_id" = fillmate_user_id())
  OR fillmate_role() IN ('hostel_admin', 'super_admin')
);

DROP POLICY IF EXISTS room_members_select ON "room_members";
CREATE POLICY room_members_select ON "room_members" FOR SELECT USING (
  "room_id" IN (SELECT "room_id" FROM "room_members" WHERE "user_id" = fillmate_user_id())
  OR fillmate_role() IN ('hostel_admin', 'super_admin')
);

-- Rotation and contributions follow the room.
DROP POLICY IF EXISTS rotation_select ON "rotation_schedules";
CREATE POLICY rotation_select ON "rotation_schedules" FOR SELECT USING (
  "room_id" IN (SELECT "room_id" FROM "room_members" WHERE "user_id" = fillmate_user_id())
  OR fillmate_role() IN ('hostel_admin', 'super_admin')
);

-- Reports are visible to admins of the hostel only.
DROP POLICY IF EXISTS reports_select ON "reports";
CREATE POLICY reports_select ON "reports" FOR SELECT USING (
  fillmate_role() IN ('hostel_admin', 'super_admin')
);

-- The audit log is admin-only and read-only from the client.
DROP POLICY IF EXISTS admin_actions_select ON "admin_actions";
CREATE POLICY admin_actions_select ON "admin_actions" FOR SELECT USING (
  fillmate_role() IN ('hostel_admin', 'super_admin')
);

-- Coolers and invites are readable within the hostel.
DROP POLICY IF EXISTS coolers_select ON "coolers";
CREATE POLICY coolers_select ON "coolers" FOR SELECT USING (
  "hostel_id" = fillmate_hostel_id()
);

DROP POLICY IF EXISTS invites_select ON "invites";
CREATE POLICY invites_select ON "invites" FOR SELECT USING (
  "hostel_id" = fillmate_hostel_id()
);

-- Achievements are private.
DROP POLICY IF EXISTS achievements_own ON "achievements";
CREATE POLICY achievements_own ON "achievements" FOR SELECT USING (
  "user_id" = fillmate_user_id()
);