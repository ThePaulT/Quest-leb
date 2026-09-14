-- Minimal stand-in for the parts of a Supabase database that the migrations
-- depend on: the api roles, the auth schema, auth.users and auth.uid().
--
-- This is NOT a migration and must never be applied to a real project — a real
-- project already has all of this, provisioned by Supabase itself. It exists so
-- `npm run db:local` can apply supabase/migrations/ against a plain PostGIS
-- Postgres on a machine without Docker, which is the only way to run the schema
-- in the sandboxed CI/agent environments we use.
--
-- The preferred path is still `supabase start`, which gives you the real thing.

create schema if not exists extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique,
  raw_user_meta_data    jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

-- Supabase reads the user id out of the request JWT claims. Locally we read it
-- out of a session GUC that tests set with:
--   select set_config('request.jwt.claim.sub', '<uuid>', true);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
