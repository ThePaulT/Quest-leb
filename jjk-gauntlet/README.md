# JJK Gauntlet

Draft a trio, run the five-rung ladder, and find out how far you get. A
Jujutsu Kaisen fan project: Next.js App Router, TypeScript, Tailwind, deployable
on Vercel.

Every number comes out of `data/jjk_gauntlet_db.json` — 48 characters, 23
counters, 5 domain rules, 28 synergies, two ladders. Nothing about a character
is hardcoded anywhere in the engine.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 58 tests, no network, no database
npm run build
```

Neither environment variable is required to play. See `.env.example`.

| Variable | Without it |
| --- | --- |
| `ANTHROPIC_API_KEY` | Rounds are narrated from a local template instead of by Claude. |
| `DATABASE_URL` | Saved runs live in memory and disappear on restart. `/api/runs` says so in its response. |

### Deploying to Vercel

This app lives in a subdirectory of the repository, so set the project's **Root
Directory** to `jjk-gauntlet`. Add both environment variables. Any Postgres with
a free tier works for `DATABASE_URL`; the `runs` table is created on first use.

## The three modes

**Gauntlet** — pick Hero or Villain, draft over three rolls of four (one reroll
for the whole run, `legendary_roll_chance` per roll for Gojo or Sukuna), then
climb five rungs. A lost round knocks a member out and weakens that rung by
`loss_opponent_weaken`; you try it again with who is left. The run ends when
everyone is down or the final boss falls.

**Freestyle** — up to three a side, any mix. Win % comes from running the real
engine 2,000 times before you commit to one fight. Cross-side synergies only
exist here, and so do the rivalry penalties.

**Daily** — the same three rolls for everyone, seeded by the UTC date. Same
groups, same faces, same order. What you take is the only variable.

## How a round is decided

```
top_power + others_coef * sum(other_power * gap_factor) + synergy + counters
          + domain + specials + rng
```

Both sides are scored, the higher score wins, and the loser puts somebody on the
ground (`fall_weight` = `(110 - power)`, halved for RCT users, scaled by a
character's own `fall_weight`). Then:

- **Clutch specials** are spent by whoever is behind — Yuki's Black Hole, Mei
  Mei's Bird Strike, Yorozu's True Sphere, Ishigori's Granite Blast, Uro's
  Deflect — and Kashimo's Amber fires on the first losing round whether it
  saves him or not. Each one re-scores the round underneath the same dice.
- **Megumi's Mahoraga gambit** fires when he is the one who would fall: 40% for
  −15 to the opponent for that round. It can turn the round around. He falls
  either way.
- **Upsets** are rolled last, so an upset is always the thing that decided the
  round. Each fired counter carries its own `upset_chance`, plus a flat
  `underdog_upset_chance` once the gap reaches `underdog_gap`.

A run is a pure function of `(seed, side, team)`. The same seed always replays
the same run — that is what makes a shared link honest, and what lets the tests
assert rates instead of vibes.

## Readings the database leaves open

The DB states some rules in prose. Three readings were settled by the
calibration rates below, and each is commented where it lives in
`lib/engine.ts`:

1. **`rng_range: 12` is a symmetric ±12 roll per side.** A `[0, 12]` roll makes
   every underdog far too cold — Toji lands near 21% against Gojo instead of the
   ~32% the spec asks for.
2. **An open domain's pressure lands even on a side that brought a domain of its
   own.** "Malevolent Shrine cuts everything in range": there is no barrier to
   clash against, so a defender's own domain only halves it, zero cursed energy
   stops mattering (`open_domain_exception`), and Simple Domain halves what is
   left. A *closed* domain is still shut out entirely by any of the three
   answers rule 1 lists.
3. **Resonance needs a body part before it counters an incarnation.** The
   counter's own explanation says so — Nobara reached Sukuna through a finger
   she already had — so it fires on a retry, never on the opening exchange.

Two smaller ones: `gauntlet`-scoped synergies apply in every mode while
`freestyle`-scoped ones need mixed sides a draft cannot produce, and
`synergy_cap` clamps in both directions so the rivalry penalties cannot exceed
−8.

## Calibration

`tests/rates.test.ts` reproduces the target rates and fails on an engine change
rather than on luck — every run in it is seeded.

| Matchup | Target | Engine |
| --- | --- | --- |
| Yuji / Megumi / Nobara full clear | ~7% | 8.8% |
| Yuji / Yuta / Maki full clear | ~23% | 22.2% |
| Toji beats Gojo | ~32% | 35.0% |

## Where the AI sits

`rules.ai_role`: *"Narrates the result it is given. Never decides outcomes."*

`/api/narrate` is called **after** the engine has resolved a round. It receives
the result as fact — winner, who fell, which counters fired, whether it was an
upset and which side pulled it — and writes 3–4 sentences. Nothing it returns
is fed back into the engine, and the system prompt forbids it from contradicting,
hedging or reversing the result. A refusal or an API error falls through to the
local template.

## Sharing

Saving a run POSTs to `/api/runs`, which **replays the seed server-side** and
stores its own result, so a shared link can never show a run the engine did not
produce. Each run gets a short `/run/[id]`:

- a vertical result card at `/api/card/[id]` behind **Save image** — record,
  rank title, the ladder rung by rung, MVP, the best line of the story, and
  UPSET / HYPE stamps;
- an OG image for link previews at the same URL;
- a **Share on X** button with the text and the link.

Freestyle is a sandbox and is not saved — its result has no record, rung or rank
to put on a card.

## Layout

```
data/     jjk_gauntlet_db.json — the source of truth
lib/      engine, draft, rng, sim, narration, store, card artwork
app/      routes: /, /gauntlet, /freestyle, /daily, /run/[id], /api/*
tests/    engine rules, calibration rates, draft, story and card
```

Unofficial fan project, no affiliation with the rights holders. Original manga
ch. 1–271, peak versions.
