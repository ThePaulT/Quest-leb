import { queryOne } from '@/lib/db';
import type { Quest } from '@/lib/types';

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
