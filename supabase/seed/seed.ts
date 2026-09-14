/**
 * Applies supabase/seed/quests.ts to the database.
 *
 * Idempotent: upserts on slug, so correcting a coordinate is a one-line edit to
 * quests.ts followed by `npm run seed`. Nothing is ever deleted.
 *
 * Every quest seeds with is_active = false. It cannot be otherwise — the
 * safety-notes check constraint rejects an active quest without bilingual
 * safety notes, and those are TODO stubs. That constraint doubles as the gate
 * on unverified coordinates: nothing reaches the public map until a human has
 * written the safety notes, and checking the pin is part of that pass.
 */
import { Pool } from 'pg';

import { questSeeds } from './quests.ts';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. See .env.example.');
  }

  const pool = new Pool({ connectionString });
  try {
    for (const q of questSeeds) {
      await pool.query(
        `insert into public.quests
           (slug, title_en, title_ar, summary_en, summary_ar, story_en, story_ar,
            region, category, difficulty, location, geofence_radius_m,
            proof_type, proof_hint_en, proof_hint_ar,
            safety_notes_en, safety_notes_ar, est_duration_min, sort_order)
         values
           ($1, $2, $3, $4, $5, $6, $7,
            $8::public.quest_region, $9::public.quest_category, $10,
            extensions.st_setsrid(extensions.st_makepoint($11::float8, $12::float8), 4326)::extensions.geography,
            $13, $14::public.proof_type, $15, $16, $17, $18, $19, $20)
         on conflict (slug) do update set
            title_en = excluded.title_en,
            title_ar = excluded.title_ar,
            summary_en = excluded.summary_en,
            summary_ar = excluded.summary_ar,
            region = excluded.region,
            category = excluded.category,
            difficulty = excluded.difficulty,
            location = excluded.location,
            geofence_radius_m = excluded.geofence_radius_m,
            proof_type = excluded.proof_type,
            proof_hint_en = excluded.proof_hint_en,
            proof_hint_ar = excluded.proof_hint_ar,
            est_duration_min = excluded.est_duration_min,
            sort_order = excluded.sort_order`,
        [
          q.slug, q.titleEn, q.titleAr, q.summaryEn, q.summaryAr, q.storyEn, q.storyAr,
          q.region, q.category, q.difficulty,
          q.lng, q.lat,
          q.geofenceRadiusM, q.proofType, q.proofHintEn, q.proofHintAr,
          q.safetyNotesEn, q.safetyNotesAr, q.estDurationMin, q.sortOrder,
        ],
      );
    }
    console.log(`seeded ${questSeeds.length} quests (all is_active = false)`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
