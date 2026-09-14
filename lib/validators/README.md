# Proof validators

One module per `proof_type`, registered in `index.ts`. A route handler resolves
a validator from the registry and calls it. **No route branches on
`proof_type`** — if you find yourself writing that switch, the logic belongs in
a module here instead.

## Adding a proof type

1. Add the value to the `proof_type` enum (a migration — the taxonomy is schema,
   the quests are data).
2. Add the value to `ProofType` in `lib/types.ts`.
3. Write `lib/validators/<name>.ts` exporting a `Validator`.
4. Register it in `index.ts`.

Step 4 is not optional and not easy to forget: `validators` is typed as a total
`Record<ProofType, Validator>`, so skipping it is a compile error.

## What the current validators actually prove

Honestly: less than it looks.

| Check | Strength |
| --- | --- |
| A photo exists | Weak. Nothing inspects the image. |
| GPS accuracy ≤ 150m | Moderate. Rejects a useless fix, not a faked one. |
| Inside the geofence | Moderate. Trusts the device's reported position. |

A determined user can spoof GPS on a rooted phone and submit any photo. That is
a known and accepted limit of the prototype — the certificates are souvenirs,
not credentials, and nothing of value turns on them.

The defence that does exist is after the fact: `flag_impossible_travel` catches
positions that contradict each other, and flagged rows are visible to admins for
review. Strengthening the front door — EXIF timestamp and GPS cross-checks, OCR
on receipts, real QR tokens — is where this goes next, and each one is a change
to a single file in this directory.

## Why `qr_scan` rejects everything

It is not built. It rejects with `not_implemented` rather than falling through
to the photo checks, which would reject it too but with a misleading reason
(`proof.missing_photo`, for a proof type that has no photo). Quests using it
cannot be completed, which is correct until the real implementation lands.
