import { query, queryOne } from '@/lib/db';
import type { Quest, QuestSummary } from '@/lib/types';

interface QuestRow {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  region: Quest['region'];
  category: Quest['category'];
  difficulty: number;
  geofence_radius_m: number;
  proof_type: Quest['proofType'];
  is_active: boolean;
}

const toQuest = (row: QuestRow): Quest => ({
  id: row.id,
  slug: row.slug,
  titleEn: row.title_en,
  titleAr: row.title_ar,
  region: row.region,
  category: row.category,
  difficulty: row.difficulty as Quest['difficulty'],
  geofenceRadiusM: row.geofence_radius_m,
  proofType: row.proof_type,
  isActive: row.is_active,
});

export async function getQuestById(id: string): Promise<Quest | null> {
  const row = await queryOne<QuestRow>(
    `select id, slug, title_en, title_ar, region, category, difficulty,
            geofence_radius_m, proof_type, is_active
       from public.quests
      where id = $1::uuid`,
    [id],
  );
  return row ? toQuest(row) : null;
}

interface QuestPinRow extends QuestRow {
  est_duration_min: number | null;
  lat: number;
  lng: number;
}

/**
 * Every quest for the map, newest content rules applied.
 *
 * `includeInactive` exists because all ten seeded quests are is_active = false
 * until someone writes their safety notes — without it the map is empty. The
 * map only offers that toggle outside production.
 */
export async function listQuests(
  options: { includeInactive?: boolean } = {},
): Promise<QuestSummary[]> {
  const rows = await query<QuestPinRow>(
    `select id, slug, title_en, title_ar, region, category, difficulty,
            geofence_radius_m, proof_type, is_active, est_duration_min,
            extensions.st_y(location::extensions.geometry) as lat,
            extensions.st_x(location::extensions.geometry) as lng
       from public.quests
      where $1::boolean or is_active
      order by region, sort_order, slug`,
    [options.includeInactive ?? false],
  );

  return rows.map((row) => ({
    slug: row.slug,
    titleEn: row.title_en,
    titleAr: row.title_ar,
    region: row.region,
    category: row.category,
    difficulty: row.difficulty,
    estDurationMin: row.est_duration_min ?? undefined,
    isActive: row.is_active,
    lat: Number(row.lat),
    lng: Number(row.lng),
  }));
}

export interface QuestDetail extends QuestSummary {
  id: string;
  summaryEn: string;
  summaryAr: string;
  storyEn: string | null;
  storyAr: string | null;
  proofHintEn: string | null;
  proofHintAr: string | null;
  safetyNotesEn: string | null;
  safetyNotesAr: string | null;
  proofType: Quest['proofType'];
  geofenceRadiusM: number;
  lat: number;
  lng: number;
}

interface QuestDetailRow extends QuestPinRow {
  summary_en: string;
  summary_ar: string;
  story_en: string | null;
  story_ar: string | null;
  proof_hint_en: string | null;
  proof_hint_ar: string | null;
  safety_notes_en: string | null;
  safety_notes_ar: string | null;
}

/**
 * One quest, everything the detail page renders.
 *
 * Returns inactive quests too. The page decides what to do with them: outside
 * production it shows them behind a notice so content can be reviewed before
 * activation, which is the whole reason all ten ship inactive.
 */
export async function getQuestBySlug(slug: string): Promise<QuestDetail | null> {
  const row = await queryOne<QuestDetailRow>(
    `select id, slug, title_en, title_ar, summary_en, summary_ar,
            story_en, story_ar, proof_hint_en, proof_hint_ar,
            safety_notes_en, safety_notes_ar,
            region, category, difficulty, geofence_radius_m, proof_type,
            is_active, est_duration_min,
            extensions.st_y(location::extensions.geometry) as lat,
            extensions.st_x(location::extensions.geometry) as lng
       from public.quests
      where slug = $1`,
    [slug],
  );
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    titleEn: row.title_en,
    titleAr: row.title_ar,
    summaryEn: row.summary_en,
    summaryAr: row.summary_ar,
    storyEn: row.story_en,
    storyAr: row.story_ar,
    proofHintEn: row.proof_hint_en,
    proofHintAr: row.proof_hint_ar,
    safetyNotesEn: row.safety_notes_en,
    safetyNotesAr: row.safety_notes_ar,
    region: row.region,
    category: row.category,
    difficulty: row.difficulty,
    geofenceRadiusM: row.geofence_radius_m,
    proofType: row.proof_type,
    isActive: row.is_active,
    estDurationMin: row.est_duration_min ?? undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}
