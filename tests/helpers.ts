import { randomUUID } from 'node:crypto';

import { SignJWT } from 'jose';

import { query, queryOne } from '@/lib/db';
import type { Quest } from '@/lib/types';

/** Wipe every table the tests touch. auth.users cascades into profiles. */
export async function resetDatabase(): Promise<void> {
  await query('truncate public.events, public.user_badges, public.completions cascade');
  await query('truncate public.badges cascade');
  await query('truncate public.quests cascade');
  await query('delete from auth.users');
}

/** Creates an auth user; the on_auth_user_created trigger makes the profile. */
export async function createUser(): Promise<string> {
  const id = randomUUID();
  await query(
    `insert into auth.users (id, email) values ($1::uuid, $2)`,
    [id, `${id}@example.test`],
  );
  return id;
}

export async function signToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export interface CreateQuestOptions {
  slug?: string;
  lat?: number;
  lng?: number;
  geofenceRadiusM?: number;
  proofType?: Quest['proofType'];
  region?: Quest['region'];
  category?: Quest['category'];
  isActive?: boolean;
}

/** Beirut's Raouché, as a default that is inside Lebanon and easy to reason about. */
export const BEIRUT = { lat: 33.8908, lng: 35.4705 };

export async function createQuest(
  options: CreateQuestOptions = {},
): Promise<Quest> {
  const slug = options.slug ?? `test-quest-${randomUUID().slice(0, 8)}`;
  const isActive = options.isActive ?? true;

  const row = await queryOne<{ id: string }>(
    `insert into public.quests
       (slug, title_en, title_ar, summary_en, summary_ar, region, category,
        difficulty, location, geofence_radius_m, proof_type,
        safety_notes_en, safety_notes_ar, is_active)
     values ($1, 'Test', 'اختبار', 'Test summary', 'ملخص', $2::public.quest_region,
             $3::public.quest_category, 1,
             extensions.st_setsrid(extensions.st_makepoint($4::float8, $5::float8), 4326)::extensions.geography,
             $6, $7::public.proof_type,
             'Test safety notes', 'ملاحظات السلامة', $8)
     returning id`,
    [
      slug,
      options.region ?? 'beirut',
      options.category ?? 'urban',
      options.lng ?? BEIRUT.lng,
      options.lat ?? BEIRUT.lat,
      options.geofenceRadiusM ?? 150,
      options.proofType ?? 'photo_at_location',
      isActive,
    ],
  );

  return {
    id: row!.id,
    slug,
    titleEn: 'Test',
    titleAr: 'اختبار',
    region: options.region ?? 'beirut',
    category: options.category ?? 'urban',
    difficulty: 1,
    geofenceRadiusM: options.geofenceRadiusM ?? 150,
    proofType: options.proofType ?? 'photo_at_location',
    isActive,
  };
}

export async function createBadge(input: {
  slug: string;
  ruleType: 'region_complete' | 'category_complete' | 'count_threshold' | 'all_complete';
  ruleValue: Record<string, unknown>;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `insert into public.badges (slug, name_en, name_ar, rule_type, rule_value)
     values ($1, 'Badge', 'شارة', $2::public.badge_rule_type, $3::jsonb)
     returning id`,
    [input.slug, input.ruleType, JSON.stringify(input.ruleValue)],
  );
  return row!.id;
}

/**
 * A byte-valid WebP file: the RIFF container header the route checks, padded to
 * whatever size a test needs. Real pixel data is irrelevant — nothing decodes
 * the image yet.
 */
export function webpBytes(totalBytes = 64): Buffer {
  const buffer = Buffer.alloc(Math.max(totalBytes, 12), 0);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(Math.max(totalBytes, 12) - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  return buffer;
}

/** Same size, wrong container: a PNG header. */
export function pngBytes(totalBytes = 64): Buffer {
  const buffer = Buffer.alloc(Math.max(totalBytes, 12), 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  return buffer;
}

/** Offsets a coordinate by roughly `metres` northward. */
export function metresNorth(lat: number, metres: number): number {
  return lat + metres / 111_320;
}
