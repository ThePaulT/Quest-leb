-- Enums.
--
-- Quests are data (see CLAUDE.md): adding a quest must never need a migration.
-- These enums are the one exception — they are the shape of the taxonomy, not
-- the content. Adding a region or category IS a migration, deliberately, so the
-- UI, badge rules and i18n keys stay in sync with the database.
--
-- To add a value later:  alter type public.quest_region add value 'akkar';
-- (Not reversible, and cannot run inside a transaction block with older PG.)

create type public.quest_region as enum (
  'beirut',
  'mount_lebanon',
  'north',
  'south',
  'bekaa'
);

create type public.quest_category as enum (
  'heritage',
  'nature',
  'food',
  'urban',
  'religious'
);

-- One validator module per value in lib/validators/. Route handlers dispatch
-- through the registry; they never branch on proof_type.
create type public.proof_type as enum (
  'photo_at_location',
  'photo_of_object',
  'receipt_photo',
  'qr_scan'
);

-- Terminal states only. Validation runs synchronously at submit time, so a
-- completion row is never written in a pending state.
create type public.validation_status as enum (
  'verified',
  'flagged',
  'rejected'
);

create type public.badge_rule_type as enum (
  'region_complete',
  'category_complete',
  'count_threshold',
  'all_complete'
);

create type public.user_role as enum (
  'user',
  'admin'
);
