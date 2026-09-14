-- Data API grants.
--
-- Supabase projects created after 2026-05-30 no longer hand anon/authenticated
-- a blanket GRANT ALL on new tables in public, so every table reachable through
-- the Data API needs its privileges spelled out. This migration does that, and
-- also revokes the legacy blanket grants so an older project ends up with the
-- same ACLs as a new one.
--
-- RLS decides WHICH ROWS. These grants decide WHICH TABLES AND COLUMNS.
-- Both have to allow an operation for it to succeed.
--
-- Any future migration that adds a table must add its grants here-style, in
-- the same migration. The ALTER DEFAULT PRIVILEGES below makes that mandatory
-- rather than optional.

grant usage on schema public to anon, authenticated, service_role;

-- PostGIS is called from is_within_geofence() under the caller's privileges.
grant usage on schema extensions to anon, authenticated, service_role;

-- Start from nothing for the client roles.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines  in schema public from public, anon, authenticated;

-- Stop new tables from silently becoming world-readable on legacy projects.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke all on routines from public, anon, authenticated;


-- Read-only public content.
grant select on public.quests to anon, authenticated;
grant select on public.badges to anon, authenticated;

-- Signed-in users.
grant select, insert         on public.completions to authenticated;
grant select                 on public.user_badges to authenticated;
grant select, insert         on public.profiles    to authenticated;

-- Column-level update: `role` is intentionally absent, so a user cannot
-- promote itself to admin even though it may update its own profile row.
grant update (display_name, avatar_url, home_country)
  on public.profiles to authenticated;

-- public.events gets no client grants at all. It is written by the server
-- under the service role.

-- RPC.
grant execute on function public.is_within_geofence(uuid, double precision, double precision)
  to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- The server-side role. Supabase provisions this with broad rights already;
-- restating it keeps a fresh project and a restored dump identical.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines  in schema public to service_role;
