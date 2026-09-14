-- Row Level Security.
--
-- Shape of the policy set:
--   quests       public read, active only
--   badges       public read, all
--   profiles     own row only
--   completions  own rows, plus other people's public+verified rows
--   user_badges  own rows
--   events       no client access at all (service role only)
--
-- Writes to completions, user_badges and events happen server-side under the
-- service role, which bypasses RLS entirely. The policies below describe what
-- a browser holding an anon or user JWT may do, and nothing more.

-- Admin check. security definer so it can read profiles.role without being
-- caught by the profiles policies it is used inside.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the calling JWT belongs to a profile with role = admin.';

alter table public.profiles    enable row level security;
alter table public.quests      enable row level security;
alter table public.completions enable row level security;
alter table public.badges      enable row level security;
alter table public.user_badges enable row level security;
alter table public.events      enable row level security;


-- quests -------------------------------------------------------------------

-- Anonymous visitors browse the map. Inactive quests (drafts, or quests still
-- missing safety notes) are invisible.
create policy quests_select_active_public
  on public.quests for select
  to anon, authenticated
  using (is_active);

create policy quests_select_all_admin
  on public.quests for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policies: quest content is authored through the
-- service role (seed files and the admin route), never from a browser session.


-- badges -------------------------------------------------------------------

-- The badge catalogue is public so the "what can I earn" screen works logged out.
create policy badges_select_public
  on public.badges for select
  to anon, authenticated
  using (true);


-- profiles -----------------------------------------------------------------

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_all_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- role is not client-writable: the column grant in the grants migration omits
-- it, so this policy cannot be used to self-promote.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- completions --------------------------------------------------------------

create policy completions_select_own
  on public.completions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Other people's completions, for the public feed. Only verified rows: a
-- rejected or flagged submission is never shown to anyone but its author.
create policy completions_select_public_verified
  on public.completions for select
  to authenticated
  using (is_public and validation_status = 'verified');

create policy completions_select_all_admin
  on public.completions for select
  to authenticated
  using (public.is_admin());

-- A client may only file a submission for itself, and may never mark it
-- verified — only the service role, after running the validator for the
-- quest's proof_type, can write a verified row.
create policy completions_insert_own_unverified
  on public.completions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and validation_status <> 'verified'
  );

-- Deliberately no update and no delete policy for any client role.


-- user_badges --------------------------------------------------------------

create policy user_badges_select_own
  on public.user_badges for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy user_badges_select_all_admin
  on public.user_badges for select
  to authenticated
  using (public.is_admin());


-- events -------------------------------------------------------------------

-- No policies at all, by design. RLS is on and every client role is denied;
-- only the service role (which bypasses RLS) reads or writes the log.
