-- profiles: one row per auth.users row, created on signup by a trigger.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  home_country text
    constraint profiles_home_country_iso3166 check (home_country ~ '^[A-Z]{2}$'),
  role         public.user_role not null default 'user',
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing user record. Never holds email or any auth secret; those stay in auth.users.';
comment on column public.profiles.home_country is
  'ISO 3166-1 alpha-2, uppercase. Used for the Ministry-facing visitor-origin breakdown.';
comment on column public.profiles.role is
  'Authorization role. Only a service-role caller may change it; see the RLS migration.';

-- Mirror new auth users into profiles. Runs as definer because the auth trigger
-- fires under the auth admin role, which has no rights on public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
