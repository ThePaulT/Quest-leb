import { beforeEach, describe, expect, it } from 'vitest';

import { getValidator, validators, MAX_ACCURACY_M, REASON } from '@/lib/validators';
import type { Submission } from '@/lib/validators';

import { BEIRUT, createQuest, createUser, metresNorth, resetDatabase } from './helpers';

/**
 * Real database, real is_within_geofence. The only thing these tests stub is
 * nothing at all — the geofence verdict comes from PostGIS.
 */

const PHOTO_TYPES = ['photo_at_location', 'photo_of_object', 'receipt_photo'] as const;

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  userId = await createUser();
});

const submission = (overrides: Partial<Submission> = {}): Submission => ({
  questId: '',
  userId,
  lat: BEIRUT.lat,
  lng: BEIRUT.lng,
  accuracyM: 10,
  photoUrl: 'https://photos.example.test/a.webp',
  ...overrides,
});

describe.each(PHOTO_TYPES)('%s validator', (proofType) => {
  it('verifies a photo taken inside the geofence with a good GPS fix', async () => {
    const quest = await createQuest({ proofType });
    const result = await getValidator(proofType).validate(
      submission({ questId: quest.id }),
      quest,
    );
    expect(result).toEqual({ status: 'verified', reason: null });
  });

  it('rejects a missing photo', async () => {
    const quest = await createQuest({ proofType });
    const result = await getValidator(proofType).validate(
      submission({ questId: quest.id, photoUrl: null }),
      quest,
    );
    expect(result).toEqual({ status: 'rejected', reason: REASON.missingPhoto });
  });

  it(`rejects a GPS accuracy worse than ${MAX_ACCURACY_M}m`, async () => {
    const quest = await createQuest({ proofType });
    const result = await getValidator(proofType).validate(
      submission({ questId: quest.id, accuracyM: MAX_ACCURACY_M + 1 }),
      quest,
    );
    expect(result).toEqual({ status: 'rejected', reason: REASON.inaccurateGps });
  });

  it(`accepts exactly ${MAX_ACCURACY_M}m — the bound is inclusive`, async () => {
    const quest = await createQuest({ proofType });
    const result = await getValidator(proofType).validate(
      submission({ questId: quest.id, accuracyM: MAX_ACCURACY_M }),
      quest,
    );
    expect(result.status).toBe('verified');
  });

  it('rejects a position outside the geofence', async () => {
    const quest = await createQuest({ proofType, geofenceRadiusM: 150 });
    const result = await getValidator(proofType).validate(
      submission({ questId: quest.id, lat: metresNorth(BEIRUT.lat, 400) }),
      quest,
    );
    expect(result).toEqual({ status: 'rejected', reason: REASON.outsideGeofence });
  });

  it('rejects a quest that does not exist — the geofence fails closed', async () => {
    const quest = await createQuest({ proofType });
    const ghost = { ...quest, id: '00000000-0000-0000-0000-000000000000' };
    const result = await getValidator(proofType).validate(
      submission({ questId: ghost.id }),
      ghost,
    );
    expect(result).toEqual({ status: 'rejected', reason: REASON.outsideGeofence });
  });

  it('checks the photo before spending a database round trip', async () => {
    // Both a missing photo and a bad position; the photo reason must win.
    const quest = await createQuest({ proofType });
    const result = await getValidator(proofType).validate(
      submission({
        questId: quest.id,
        photoUrl: null,
        lat: metresNorth(BEIRUT.lat, 5_000),
        accuracyM: 9_999,
      }),
      quest,
    );
    expect(result.reason).toBe(REASON.missingPhoto);
  });
});

describe('qr_scan validator', () => {
  it('rejects everything as not_implemented', async () => {
    const quest = await createQuest({ proofType: 'qr_scan' });
    const result = await getValidator('qr_scan').validate(
      submission({ questId: quest.id }),
      quest,
    );
    expect(result).toEqual({ status: 'rejected', reason: REASON.notImplemented });
  });

  it('does not leak a geofence reason for a perfectly located scan', async () => {
    const quest = await createQuest({ proofType: 'qr_scan' });
    const result = await getValidator('qr_scan').validate(
      submission({ questId: quest.id, photoUrl: null }),
      quest,
    );
    expect(result.reason).toBe(REASON.notImplemented);
  });
});

describe('registry', () => {
  it('covers every proof type', () => {
    expect(Object.keys(validators).sort()).toEqual([
      'photo_at_location',
      'photo_of_object',
      'qr_scan',
      'receipt_photo',
    ]);
  });

  it('matches the proof_type enum in the database exactly', async () => {
    const { query } = await import('@/lib/db');
    const rows = await query<{ value: string }>(
      `select unnest(enum_range(null::public.proof_type))::text as value`,
    );
    expect(rows.map((r) => r.value).sort()).toEqual(Object.keys(validators).sort());
  });
});
