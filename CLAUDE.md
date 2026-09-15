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

`npm run verify:r2` proves the R2 path end to end against a real bucket: it
uploads a real WebP through `lib/storage.ts`, fetches it back over the public
URL, asserts byte equality, then deletes it. It needs the five `R2_*` variables
and cannot run in a sandbox whose egress policy blocks Cloudflare.

`npm run db:local` is a Docker-less fallback used in agent/CI sandboxes: it
applies `supabase/migrations/` to a throwaway PostGIS cluster on top of the
shim in `supabase/dev/`, which fakes the api roles, `auth.users` and
`auth.uid()`. It gives you the database only — no PostgREST, no GoTrue. The
shim must never be applied to a real project. On a fresh container it installs
PostgreSQL 16 + PostGIS first, and `--reset` recovers from an orphaned
postmaster (one whose data directory was deleted under it, which otherwise
holds the socket lock and breaks every later start).

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
megabytes, which keeps the serverless bundle and cold starts small on Vercel
Hobby. (An earlier note here also claimed it runs on the edge runtime; that is
not a reason to prefer it, because the Edge Runtime is deprecated in Next 16.)

**Rejected submissions are never uploaded to R2.** The route validates against
the URL the photo *would* have (`Storage.publicUrl`) and uploads only if the
verdict is not `rejected`, so a rejected row carries `photo_url = null`. A
rejected photo is readable by nobody and has no cleanup path, so storing it only
burns the 10GB free tier — and retries let one user outside a geofence upload
repeatedly. Flagged rows *do* keep their photo: a human has to review it.
*Reverse:* upload unconditionally before calling the validator.

**No `runtime` export in route files.** `nodejs` is the default in Next 16 and
the docs say to remove the export; `edge` is deprecated.

**No quest uses `qr_scan`.** The validator is a stub and there is no partner QR
at any site, so a qr_scan quest is uncompletable — Byblos Citadel and Beiteddine
Palace were moved to `photo_at_location`. The module stays registered in
`lib/validators/` for a future partner integration, and
`tests/seed-coordinates.test.ts` fails if a seed quest ever references a stubbed
proof type again. *Reverse:* set `proofType` back once real QR codes exist on
site and the validator is implemented.

**No public read path on `profiles` yet.** A feed showing display names will
need a view exposing only `display_name`/`avatar_url`. Deferred until a feed
exists.

## Seed coordinates: verified to town level, not to the building

The sandbox this was built in cannot reach Nominatim, Overpass or Wikipedia —
the organization's egress policy allows package registries and GitHub only, and
a blocked host returns 403 at the proxy. Geocoding the pins directly was not
possible.

They were cross-checked instead against GeoNames settlement positions, which
ship as npm packages (`all-the-cities`, `cities.json`) and so come from an
allowed host. Every pin sits 0.1–4.5km from the town it belongs to:

| quest | nearest settlement | distance |
| --- | --- | --- |
| harissa-our-lady-of-lebanon | Jounieh | 3.0km |
| raouche-pigeon-rocks | Ra's Bayrut | 1.6km |
| jeita-grotto | Aajaltoûn | 4.5km |
| baalbek-temple-of-bacchus | Baalbek | 1.3km |
| byblos-citadel | Jbaïl | 0.2km |
| qadisha-valley | Bcharré | 1.3km (SW, in the gorge) |
| cedars-of-god | Bcharré | 3.6km (E, uphill) |
| beiteddine-palace | Beït ed Dîne | 0.1km |
| sidon-sea-castle | Sidon | 1.3km |
| tyre-hippodrome | Tyre | 1.3km (east, at Al-Bass) |

This rules out a transposed lat/lng, a wrong hemisphere and a pin in the wrong
region. It does **not** confirm a pin is on the right building, and the geofence
radii remain judgement calls.

The identical latitude on `cedars-of-god` and `qadisha-valley` turned out to be
geography, not an error: Bsharri sits between them at a similar latitude, one
1.3km SW down in the gorge and the other 3.6km E uphill.

Nothing can reach the public map regardless: every seeded quest is
`is_active = false`. `safety_notes_ar` is deliberately still null on all ten,
and the safety-notes constraint needs BOTH languages, so the activation gate
stays shut on its own — which is right while the English notes are unverified.

`content/quests-review.csv` (regenerate with `npm run content:review`) lists
every pin with a Google Maps link, for checking positions against satellite
imagery.

## Quest content is a draft

All ten quests now carry `story_en`, `story_ar` and proof hints, so the app is
not empty. None of it has been fact-checked:

- **Stories carry dates, names and figures that were written without a source
  to check them against.** Treat every number as a claim to verify. They were
  briefed to be things a Lebanese person would not already know, which is
  exactly the material most likely to be wrong.
- **`safety_notes_en` begins with `[UNVERIFIED — PAUL TO CONFIRM]` on every
  quest.** Do not strip that marker; it is what stops draft terrain, road and
  opening-hours guidance from being mistaken for checked guidance. A test
  asserts it is still there.
- **Geofence radii are sized to each site's footprint** — 180m for the Sidon
  islet, 600m for the Tyre hippodrome whose track alone is ~480m, 1500m for the
  Qadisha valley floor. They are judgement calls, not survey.

`npm run seed` overwrites story and safety notes from the seed file, because
that file is their source of truth today. The moment quests become editable
anywhere else, drop those four columns from the upsert in
`supabase/seed/seed.ts` or a re-seed will silently revert someone's edits.

Correcting one is a one-line edit to `quests.ts` followed by `npm run seed` —
the seed upserts on slug. `tests/seed-coordinates.test.ts` holds the cheap
structural guards (inside Lebanon, no duplicate pins, radius in range).

## Design

Reference: 1960s Lebanese tourism posters and the geometry of Lebanese
cement floor tiles. Printed, flat, editorial. Not a SaaS dashboard,
not a mobile game.

### Palette — these six only
base    #F4F0E8  warm paper, app background
ink     #1C1C1A  all text, never pure black
primary #0F4C3A  deep pine — nav, primary actions, completed
accent  #C4552E  terracotta — ONE element per screen
sand    #D9CBB3  borders, dividers, inactive
sea     #2E5E6E  coastal region, secondary data

### Type
Display: Instrument Serif (Latin) / Amiri (Arabic)
UI+body: IBM Plex Sans (Latin) / IBM Plex Sans Arabic (Arabic)
All numerals tabular. Self-host via next/font, no CDN calls.

### Banned — do not generate these under any circumstance
- Gradients of any kind
- Glassmorphism, backdrop blur, frosted panels
- Emoji anywhere in the interface
- Drop shadows on cards (use a 1px sand border instead)
- Border radius above 4px
- Purple, indigo, violet, or any colour outside the six above
- Generic shadcn defaults left unstyled

### Rules
- Photos are the only loud element. Everything else recedes.
- Hierarchy via size and spacing, not three font weights.
- Arabic is not a mirrored afterthought: test every screen in RTL.
- Completion reward is a rubber stamp pressing onto paper —
  slight rotation, ink texture. Never confetti or a trophy modal.
