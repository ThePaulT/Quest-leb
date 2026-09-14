-- completions: one accepted submission per user per quest.
--
-- Photo BYTES never live here (see CLAUDE.md) — these are R2 object URLs
-- produced by lib/storage.ts. Routes never touch the R2 client directly.

create table public.completions (
  id       uuid primary key default extensions.gen_random_uuid(),
  user_id  uuid not null references public.profiles (id) on delete cascade,
  quest_id uuid not null references public.quests (id) on delete cascade,

  submitted_at timestamptz not null default now(),

  photo_url       text,
  photo_thumb_url text,

  lat        double precision check (lat between -90 and 90),
  lng        double precision check (lng between -180 and 180),
  accuracy_m double precision check (accuracy_m >= 0),

  -- No default: a validator module must decide. Terminal on write.
  validation_status public.validation_status not null,
  validation_reason text,

  is_public boolean not null default true,

  constraint completions_user_quest_unique unique (user_id, quest_id)
);

comment on table public.completions is
  'Accepted quest submissions. Written server-side only, after a lib/validators/ module returns a verdict.';
comment on column public.completions.photo_url is
  'R2 object URL from lib/storage.ts. Never image bytes.';
comment on column public.completions.validation_status is
  'Set by the validator for the quest''s proof_type. Clients cannot write or change it.';
comment on column public.completions.validation_reason is
  'i18n key (not prose) explaining a flagged/rejected verdict, e.g. proof.outside_geofence.';
comment on column public.completions.is_public is
  'User-controlled visibility in public feeds. Even when true, only verified rows are readable by others.';

-- Asked for explicitly: the "my passport" page reads every completion for a user.
create index completions_user_id_idx on public.completions using btree (user_id);

-- Supports the FK and the per-quest completion counts on the map.
create index completions_quest_id_idx on public.completions (quest_id);

-- The public feed: newest verified public completions first.
create index completions_public_feed_idx on public.completions (submitted_at desc)
  where is_public and validation_status = 'verified';
