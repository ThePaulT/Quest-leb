-- events: append-only analytics/audit log. Every meaningful user action writes
-- a row here (see CLAUDE.md).
--
-- bigint identity rather than uuid: this is the fastest-growing table in the
-- schema and the free tier caps the database at 500MB. 8 bytes beats 16, and
-- nothing outside the database references an event by id.

create table public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  event_name text not null
    constraint events_event_name_format check (event_name ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  quest_id   uuid references public.quests (id) on delete set null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.events is
  'Append-only event log. Service-role writes only; no client grants. Anonymous events carry a null user_id.';
comment on column public.events.event_name is
  'snake_case verb phrase, e.g. quest_viewed, proof_submitted, badge_earned.';
comment on column public.events.metadata is
  'Event-specific payload. Never put PII or photo bytes here.';

create index events_created_at_idx on public.events (created_at desc);
create index events_user_id_idx on public.events (user_id, created_at desc);
create index events_name_idx on public.events (event_name, created_at desc);
