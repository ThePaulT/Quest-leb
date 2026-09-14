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

## Decisions taken, and how to reverse them

Prototype decisions made without a second opinion. Each is reversible; this
records what to change if you disagree.

**Clients cannot write `validation_status = 'verified'.** The insert policy is
`user_id = auth.uid() AND validation_status <> 'verified'`. A policy that only
checked ownership would let anyone POST a verified row and skip validation
entirely. *Reverse:* drop the second clause in the RLS migration.

**The public feed shows verified rows only**, not every `is_public` row — a
rejected proof photo should not be visible to strangers. *Reverse:* drop
`validation_status = 'verified'` from `completions_select_public_verified`.

**A rejected attempt can be retried.** `unique (user_id, quest_id)` stays, and
the route upserts: a non-verified row is replaced in place, a verified one
returns 409. *Reverse:* make the route 409 on any existing row.

**Flagged completions count toward badges**, verified ones obviously do, and
rejected ones do not. Withholding a badge because a heuristic was unsure is the
wrong default; review can revoke. *Reverse:* `COUNTS_TOWARD_BADGES` in
`lib/badges.ts`, one constant.

**`flag_impossible_travel` only downgrades `verified` to `flagged`.** Flagging a
rejected row would promote it, since flagged counts toward badges. It also flags
the incoming row, never the earlier one.

**Photos: 400KB server ceiling, 200KB client target.** The client compresses to
200KB; the route accepts up to 400KB so encoder variance across devices does not
reject a legitimately compressed photo. Both constants are at the top of
`app/api/completions/route.ts`.

**Postgres access is `pg`, not `supabase-js`.** Server code talks to the
database directly (`lib/db.ts`), which is what makes the tests real integration
tests. `jose` verifies the access token locally instead of calling GoTrue,
saving a network hop per request against the 5GB egress cap.

**R2 uses `aws4fetch`, not `@aws-sdk/client-s3`** — kilobytes instead of
megabytes, and it runs on the edge runtime.

**No public read path on `profiles` yet.** A feed showing display names will
need a view exposing only `display_name`/`avatar_url`. Deferred until a feed
exists.

## Seed coordinates are UNVERIFIED

The ten quest coordinates in `supabase/seed/quests.ts` were written from general
knowledge and have **not** been checked against OpenStreetMap — the sandbox they
were authored in cannot reach Nominatim, Overpass or Wikipedia.

They are safe to hold because nothing can reach the public map: every seeded
quest is `is_active = false`, and the safety-notes constraint blocks activation
until a human writes them. Verifying the pin belongs in that same pass.

Correcting one is a one-line edit to `quests.ts` followed by `npm run seed` —
the seed upserts on slug. `tests/seed-coordinates.test.ts` holds the cheap
guards (inside Lebanon, no duplicate pins, radius in range); it cannot tell you
a pin is on the wrong building.

Known suspicious: `cedars-of-god` and `qadisha-valley` share a latitude to four
decimals. The ~4.6km gap between them is plausible for Bsharri→the Cedars, but
identical latitudes look like a memory artifact.
