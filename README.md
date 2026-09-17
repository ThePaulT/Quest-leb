# Lebanon Quest

A gamified tourism quest map for Lebanon. Complete quests at real Lebanese
locations, submit photo + GPS proof, earn certificates and regional badges.

Non-commercial. No payments, no purchases. Built as a showcase for investors and
the Lebanese Ministry of Tourism.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres +
PostGIS + Auth) · Cloudflare R2 · MapLibre GL JS + OpenStreetMap · Vercel Hobby.

Everything runs on free tiers.

## Claude Code on the web

`.claude/hooks/session-start.sh` runs on every session start in a remote
container and leaves a working app behind: dependencies installed, PostGIS
running with the migrations applied, the ten quests seeded, and `next dev`
serving on http://localhost:3000. Each step checks before it acts, so it never
recreates a healthy database or starts a second server, and it writes the
`.env.local` a fresh container lacks.

It exits immediately when `CLAUDE_CODE_REMOTE` is not set, so on a laptop
nothing is taken over — follow "Getting started" below instead.

Note that `npm test` truncates every table, so run `npm run seed` afterwards to
put the ten quests back.

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in
```

### Database

With Docker — the real stack:

```bash
npm run db:start               # supabase start
npm run db:reset               # apply migrations
```

Without Docker — database only, via the shim in `supabase/dev/`:

```bash
npm run db:local               # prints the DATABASE_URL to export
```

Then seed the ten prototype quests:

```bash
npm run seed
```

All ten seed as `is_active = false`; see "Seed coordinates" in `CLAUDE.md` for
why, and what has to happen before any of them go live.

### Cloudflare R2

```bash
npm run verify:r2
```

Uploads a real WebP to the configured bucket, fetches it back over the public
URL, asserts the bytes match, and deletes it. Needs `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `R2_PUBLIC_URL` —
and the bucket must allow public reads, or the fetch step fails even though the
upload succeeded.

### Tests

Integration tests run against a real database, not mocks. Start one, export
`DATABASE_URL`, then:

```bash
npm test
```

133 tests cover the validators, the API route's rejection paths, the
impossible-travel trigger, the badge rules and the RLS policies.

The tests truncate every table between cases, so running them against a
database wipes anything seeded there. Point `DATABASE_URL` at a throwaway
database, and re-run `npm run seed` afterwards if you want the quests back.

## Layout

```
app/api/completions/   POST proof: authenticate, validate, store, award badges
lib/validators/        One module per proof type — see its README
lib/storage.ts         R2 adapter. Routes never touch the R2 client directly
lib/db.ts              Server-side Postgres (bypasses RLS, like service_role)
lib/badges.ts          Reads the four badge rule types
supabase/migrations/   Schema. SQL files only, never dashboard clicks
supabase/seed/         Quest content as typed objects
supabase/dev/          Local-only Supabase shim. Never apply to a real project
```

`CLAUDE.md` carries the architecture rules, the decisions taken so far and how
to reverse each one.
