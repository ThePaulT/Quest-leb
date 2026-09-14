-- badges: regional and thematic awards, evaluated from completions.
-- Like quests, badges are data — adding one is an insert.

create table public.badges (
  id   uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique
    constraint badges_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  name_en        text not null check (btrim(name_en) <> ''),
  name_ar        text not null check (btrim(name_ar) <> ''),
  description_en text,
  description_ar text,
  icon_url       text,

  rule_type  public.badge_rule_type not null,
  rule_value jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  -- Each rule_type reads a different shape out of rule_value. Keeping the
  -- contract in the database stops a malformed badge from silently never
  -- being awarded.
  constraint badges_rule_value_shape check (
    case rule_type
      when 'region_complete'   then rule_value ? 'region'
      when 'category_complete' then rule_value ? 'category'
      when 'count_threshold'   then (rule_value ->> 'count') ~ '^[0-9]+$'
      when 'all_complete'      then true
    end
  )
);

comment on column public.badges.rule_value is
  'Rule parameters. region_complete: {"region":"bekaa"}. category_complete: {"category":"food"}. count_threshold: {"count":10}. all_complete: {}.';

create table public.user_badges (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  badge_id  uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),

  primary key (user_id, badge_id)
);

comment on table public.user_badges is
  'Awarded badges. Append-only, written server-side after a completion is verified.';

-- The PK covers user_id lookups; this covers "who has this badge".
create index user_badges_badge_id_idx on public.user_badges (badge_id);
