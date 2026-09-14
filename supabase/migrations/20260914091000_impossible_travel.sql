-- flag_impossible_travel
--
-- A user cannot be at Baalbek and Tyre fifteen minutes apart. When a new
-- completion lands within 15 minutes of another of the same user's completions
-- and more than 50km away, mark it flagged for human review.
--
-- Two deliberate choices:
--
--   * It only ever downgrades 'verified' to 'flagged'. A row the validator
--     already rejected stays rejected — flagging it would UPGRADE it, because
--     flagged rows still count toward badges and rejected ones do not.
--
--   * It flags the incoming row, not the earlier one. The earlier completion
--     may be long since certified; re-opening settled history from a trigger
--     would be surprising. Review starts from the new arrival.
--
-- Distance is computed between the two claimed positions, not between the two
-- quests: the user's own GPS is what we are calling implausible.

create or replace function public.flag_impossible_travel()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_point extensions.geography;
begin
  -- Nothing to compare against without a position.
  if new.lat is null or new.lng is null then
    return new;
  end if;

  -- Never make a verdict better than the validator's.
  if new.validation_status <> 'verified' then
    return new;
  end if;

  v_point := extensions.st_setsrid(
    extensions.st_makepoint(new.lng, new.lat), 4326
  )::extensions.geography;

  if exists (
    select 1
    from public.completions c
    where c.user_id = new.user_id
      and c.id is distinct from new.id
      and c.lat is not null
      and c.lng is not null
      and abs(extract(epoch from (new.submitted_at - c.submitted_at))) <= 15 * 60
      and extensions.st_distance(
            v_point,
            extensions.st_setsrid(
              extensions.st_makepoint(c.lng, c.lat), 4326
            )::extensions.geography
          ) > 50000
  ) then
    new.validation_status := 'flagged';
    new.validation_reason := coalesce(new.validation_reason, 'proof.impossible_travel');
  end if;

  return new;
end;
$$;

comment on function public.flag_impossible_travel() is
  'Downgrades a verified completion to flagged when the same user claims a position >50km away within 15 minutes.';

create trigger completions_flag_impossible_travel
  before insert on public.completions
  for each row execute function public.flag_impossible_travel();

-- The trigger's lookup is by user and time window.
create index completions_user_submitted_at_idx
  on public.completions (user_id, submitted_at desc);
