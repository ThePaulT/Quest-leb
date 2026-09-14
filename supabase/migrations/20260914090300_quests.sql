-- quests: the content table. Everything a quest needs is a row here, so adding
-- a quest is an insert (seed file or admin UI), never a code change or a
-- migration. Bilingual columns are mandatory — Arabic is first-class, not a
-- translation layer bolted on later.

create table public.quests (
  id       uuid primary key default extensions.gen_random_uuid(),
  slug     text not null unique
    constraint quests_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  title_en   text not null check (btrim(title_en) <> ''),
  title_ar   text not null check (btrim(title_ar) <> ''),
  summary_en text not null check (btrim(summary_en) <> ''),
  summary_ar text not null check (btrim(summary_ar) <> ''),
  story_en   text,
  story_ar   text,

  region     public.quest_region   not null,
  category   public.quest_category not null,
  difficulty smallint not null check (difficulty between 1 and 5),

  location          extensions.geography(Point, 4326) not null,
  geofence_radius_m integer not null default 150
    check (geofence_radius_m between 10 and 5000),

  proof_type    public.proof_type not null,
  proof_hint_en text,
  proof_hint_ar text,

  safety_notes_en text,
  safety_notes_ar text,

  est_duration_min integer check (est_duration_min between 1 and 1440),

  is_active  boolean not null default false,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Content rule: a quest cannot go live without safety notes in both
  -- languages. Enforced here so it holds no matter which client writes the row.
  constraint quests_safety_notes_required_when_active check (
    not is_active
    or (
      safety_notes_en is not null and btrim(safety_notes_en) <> ''
      and safety_notes_ar is not null and btrim(safety_notes_ar) <> ''
    )
  )
);

comment on table public.quests is
  'Quest content. Adding a quest is data, never a migration.';
comment on column public.quests.slug is
  'Stable public identifier used in URLs and i18n keys. Never reuse a retired slug.';
comment on column public.quests.location is
  'WGS84 point, geography so distance math is in metres without projecting.';
comment on column public.quests.geofence_radius_m is
  'Radius in metres for is_within_geofence(). 150m is the default for urban GPS drift.';
comment on column public.quests.is_active is
  'Only active quests are readable by the public. Guarded by quests_safety_notes_required_when_active.';
comment on column public.quests.sort_order is
  'Ascending display order within a region. Ties break on slug.';

-- Spatial index: powers "quests near me" and the geofence lookup.
create index quests_location_gist on public.quests using gist (location);

-- The map and list views always filter on is_active first.
create index quests_active_sort_idx on public.quests (region, sort_order, slug)
  where is_active;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger quests_set_updated_at
  before update on public.quests
  for each row execute function public.set_updated_at();
