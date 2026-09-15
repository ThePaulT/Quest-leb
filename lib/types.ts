/**
 * Shared domain types.
 *
 * These mirror the SQL enums in supabase/migrations/. Once a real project
 * exists, `supabase gen types typescript` should replace the hand-written
 * unions here — keep the names identical so that swap is a delete, not a
 * refactor.
 */

export type QuestRegion =
  | 'beirut'
  | 'mount_lebanon'
  | 'north'
  | 'south'
  | 'bekaa';

export type QuestCategory =
  | 'heritage'
  | 'nature'
  | 'food'
  | 'urban'
  | 'religious';

export type ProofType =
  | 'photo_at_location'
  | 'photo_of_object'
  | 'receipt_photo'
  | 'qr_scan';

export type ValidationStatus = 'verified' | 'flagged' | 'rejected';

export type BadgeRuleType =
  | 'region_complete'
  | 'category_complete'
  | 'count_threshold'
  | 'all_complete';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** A row of public.quests, as the server reads it. */
export interface Quest {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  region: QuestRegion;
  category: QuestCategory;
  difficulty: Difficulty;
  geofenceRadiusM: number;
  proofType: ProofType;
  isActive: boolean;
}

export interface Completion {
  id: string;
  userId: string;
  questId: string;
  submittedAt: string;
  photoUrl: string | null;
  photoThumbUrl: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  validationStatus: ValidationStatus;
  validationReason: string | null;
  isPublic: boolean;
}

export interface Badge {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  ruleType: BadgeRuleType;
  ruleValue: Record<string, unknown>;
}

/**
 * The subset of a quest the card renders. Both the seed file and a database row
 * map onto this, so the card does not care which it came from.
 */
export interface QuestSummary {
  slug: string;
  titleEn: string;
  titleAr: string;
  region: QuestRegion;
  category?: QuestCategory;
  difficulty: number;
  estDurationMin?: number;
  isActive?: boolean;
  /** Present only for quests read from the database. */
  lat?: number;
  lng?: number;
}
