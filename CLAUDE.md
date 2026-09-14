@AGENTS.md

# Lebanon Quest

A gamified tourism quest map for Lebanon. Users complete real-world quests at
Lebanese locations, submit photo + GPS proof, and earn digital certificates and
regional badges.

Non-commercial. No payments, no purchases, ever. Built as a showcase for
investors and the Lebanese Ministry of Tourism.

Everything is a prototype: expect the schema and the shape of the code to keep
moving. Prefer changes that are cheap to reverse.

## Stack

- Next.js 16 App Router + TypeScript + Tailwind
- Supabase (Postgres + PostGIS + Auth)
- Cloudflare R2 for photos
- MapLibre GL JS + OpenStreetMap tiles
- Vercel Hobby

Everything must run on free tiers for now.

## Architecture rules

- Proof validation is a plugin pattern: one module per proof type in
  `lib/validators/`. Never branch on `proof_type` inside a route handler.
- Quests are data. Adding a quest must never require a code change or a
  migration.
- All user-facing strings are i18n keys. Every quest has `_en` and `_ar`
  fields. Arabic is first-class, including RTL layout.
- Photos go through the `lib/storage.ts` adapter. Routes never touch the R2
  client directly.
- Never store image bytes in Postgres.
- Every meaningful user action writes a row to `events`.
- Client compresses photos to WebP, max 1200px long edge, under 200KB, before
  upload. Server rejects anything larger.

## Content rules

- Every quest needs safety notes before it can be activated. Enforced by the
  `quests_safety_notes_required_when_active` check constraint, in both
  languages.

## Free-tier constraints

- Supabase: 500MB DB, 5GB egress, 2 active projects, pauses after 7 days of
  inactivity.
- R2: 10GB, zero egress.
- Projects created after 2026-05-30 need explicit Postgres grants for tables
  exposed via the Data API. Every migration that adds a table must also add its
  grants — `supabase/migrations/*_grants.sql` revokes the legacy blanket
  privileges and the default privileges that used to hand them out, and
  `auto_expose_new_tables = false` in `supabase/config.toml` makes a missing
  grant fail locally instead of in production.

## Working style

- Migrations are SQL files in `supabase/migrations/`, never dashboard clicks.
- Integration tests run against a local Supabase instance, not mocks.

## Database

`npm run db:start` + `npm run db:reset` is the real path (needs Docker).

`npm run db:local` is a Docker-less fallback used in agent/CI sandboxes: it
applies `supabase/migrations/` to a throwaway PostGIS cluster on top of the
shim in `supabase/dev/`, which fakes the api roles, `auth.users` and
`auth.uid()`. It gives you the database only — no PostgREST, no GoTrue. The
shim must never be applied to a real project.

Schema notes worth knowing before you touch it:

- PostGIS lives in the `extensions` schema, so every PostGIS type and function
  in a migration is schema-qualified. Do not assume `extensions` is on the
  search_path.
- `completions.validation_status` has no default and no terminal `pending`
  value: a validator module decides before the row exists.
- Clients may insert their own `completions` but can never write
  `validation_status = 'verified'` — only the service role can, after running
  the validator for the quest's `proof_type`.
- `events` has RLS on and zero policies, by design. It is service-role only.
