-- Geofence check used by the photo_at_location validator.
--
-- Fails closed: an unknown quest id returns false, never null, so a caller
-- cannot accidentally treat "no such quest" as a pass.
--
-- security invoker (the default) on purpose: the caller's RLS applies, so a
-- client can only probe quests it is already allowed to read.

create or replace function public.is_within_geofence(
  p_quest_id uuid,
  p_lat      double precision,
  p_lng      double precision
)
returns boolean
language sql
stable
parallel safe
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    (
      select extensions.st_dwithin(
        q.location,
        extensions.st_setsrid(
          extensions.st_makepoint(p_lng, p_lat),  -- note: lng first, then lat
          4326
        )::extensions.geography,
        q.geofence_radius_m
      )
      from public.quests q
      where q.id = p_quest_id
    ),
    false
  );
$$;

comment on function public.is_within_geofence(uuid, double precision, double precision) is
  'True when (p_lat, p_lng) is within the quest''s geofence_radius_m. False for an unknown quest.';
