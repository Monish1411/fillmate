-- =============================================================================
-- FillMate - Storage
--
-- Evidence photos live in a PRIVATE bucket. Nothing is ever public: the API
-- mints short-lived signed URLs only after checking that the caller may read
-- that specific activity.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fillmate-evidence',
  'fillmate-evidence',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object keys are <hostel_id>/<yyyy>/<mm>/<random>.webp
create or replace function fillmate_storage_allowed(
  object_name text,
  operation text
) returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
declare
  hostel_id text := split_part(object_name, '/', 1);
begin
  -- Writes only ever happen through the service-role API.
  if operation = 'INSERT' or operation = 'UPDATE' then
    return true;
  end if;

  if operation = 'SELECT' then
    return fillmate_is_hostel_admin(hostel_id);
  end if;

  return false;
end;
$$;

drop policy if exists "evidence read" on storage.objects;
create policy "evidence read"
  on storage.objects for select
  using (bucket_id = 'fillmate-evidence' and fillmate_storage_allowed(name, 'SELECT'));

drop policy if exists "evidence write" on storage.objects;
create policy "evidence write"
  on storage.objects for insert
  with check (bucket_id = 'fillmate-evidence' and fillmate_storage_allowed(name, 'INSERT'));

drop policy if exists "evidence delete" on storage.objects;
create policy "evidence delete"
  on storage.objects for delete
  using (bucket_id = 'fillmate-evidence' and fillmate_is_hostel_admin(split_part(name, '/', 1)));

-- Cooler QR images (optional feature) live in their own private bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('fillmate-coders', 'fillmate-coders', false, 2097152)
on conflict (id) do nothing;

-- Realtime: publish refill events to subscribed clients.
alter publication supabase_realtime add table "water_activities";
alter publication supabase_realtime add table "room_members";
alter publication supabase_realtime add table "rotation_schedules";