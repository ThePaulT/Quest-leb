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
