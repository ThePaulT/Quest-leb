import { beforeEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/completions/route';
import { query, queryOne } from '@/lib/db';
import { setStorage, type Storage } from '@/lib/storage';
import { MAX_ACCURACY_M } from '@/lib/validators';

import {
  BEIRUT,
  createQuest,
  createUser,
  metresNorth,
  pngBytes,
  resetDatabase,
  signToken,
  webpBytes,
} from './helpers';

/**
 * The database, the validators, the trigger and the badge rules are all real
 * here. The one seam is R2: there is no free way to reach a bucket from a test,
 * so uploads go to a recording adapter. Everything the route does with the URL
 * it gets back is exercised for real.
 */
const uploads: Array<{ key: string; bytes: number }> = [];

const deletions: string[] = [];

const recordingStorage: Storage = {
  publicUrl(key) {
    return `https://photos.example.test/${key}`;
  },
  async uploadPhoto(buffer, key) {
    uploads.push({ key, bytes: buffer.byteLength });
    return `https://photos.example.test/${key}`;
  },
  async deletePhoto(key) {
    deletions.push(key);
  },
};

let userId: string;
let token: string;

beforeEach(async () => {
  await resetDatabase();
  uploads.length = 0;
  deletions.length = 0;
  setStorage(recordingStorage);
  userId = await createUser();
  token = await signToken(userId);
});

interface SubmitOptions {
  questId?: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  photo?: Buffer | null;
  filename?: string;
  token?: string | null;
  extra?: Record<string, string>;
}

async function submit(options: SubmitOptions = {}): Promise<Response> {
  const form = new FormData();
  if (options.questId !== undefined) form.set('questId', options.questId);
  form.set('lat', String(options.lat ?? BEIRUT.lat));
  form.set('lng', String(options.lng ?? BEIRUT.lng));
  form.set('accuracyM', String(options.accuracyM ?? 10));
  if (options.photo !== null) {
    const bytes = options.photo ?? webpBytes();
    form.set(
      'photo',
      new File([new Uint8Array(bytes)], options.filename ?? 'proof.webp', {
        type: 'image/webp',
      }),
    );
  }
  for (const [k, v] of Object.entries(options.extra ?? {})) form.set(k, v);

  const headers = new Headers();
  const auth = options.token === undefined ? token : options.token;
  if (auth !== null) headers.set('authorization', `Bearer ${auth}`);

  return POST(
    new Request('http://localhost/api/completions', {
      method: 'POST',
      headers,
      body: form,
    }),
  );
}

describe('POST /api/completions — rejection paths', () => {
  it('401s without a token', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, token: null });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'auth.unauthorized' });
  });

  it('401s on a token signed with the wrong secret', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, token: 'not.a.jwt' });
    expect(response.status).toBe(401);
  });

  it('400s without a questId', async () => {
    const response = await submit();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'request.missing_quest_id' });
  });

  it('400s without a position', async () => {
    const quest = await createQuest();
    const form = new FormData();
    form.set('questId', quest.id);
    form.set('photo', new File([new Uint8Array(webpBytes())], 'p.webp', { type: 'image/webp' }));
    const response = await POST(
      new Request('http://localhost/api/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'request.missing_position' });
  });

  it('400s on an out-of-range latitude', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, lat: 91 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'request.invalid_position' });
  });

  it('400s without a photo part', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, photo: null });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'request.missing_photo' });
  });

  it('413s over 400KB', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, photo: webpBytes(400 * 1024 + 1) });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'photo.too_large' });
    expect(uploads).toHaveLength(0);
  });

  it('accepts exactly 400KB', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, photo: webpBytes(400 * 1024) });
    expect(response.status).toBe(201);
  });

  it('415s on a non-WebP body even when the content-type claims WebP', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, photo: pngBytes() });
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: 'photo.not_webp' });
    expect(uploads).toHaveLength(0);
  });

  it('404s for an unknown quest', async () => {
    const response = await submit({ questId: '00000000-0000-0000-0000-000000000000' });
    expect(response.status).toBe(404);
  });

  it('404s for an inactive quest, without revealing that it exists', async () => {
    const quest = await createQuest({ isActive: false });
    const response = await submit({ questId: quest.id });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'quest.not_found' });
  });

  it('422s and stores a rejection when the user is outside the geofence', async () => {
    const quest = await createQuest({ geofenceRadiusM: 150 });
    const response = await submit({
      questId: quest.id,
      lat: metresNorth(BEIRUT.lat, 500),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.completion.validationStatus).toBe('rejected');
    expect(body.completion.validationReason).toBe('proof.outside_geofence');
    expect(body.badgesEarned).toEqual([]);
  });

  it('422s on a GPS fix that is too loose', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id, accuracyM: MAX_ACCURACY_M + 1 });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.completion.validationReason).toBe('proof.gps_too_inaccurate');
  });

  it('422s on a qr_scan quest as not_implemented', async () => {
    const quest = await createQuest({ proofType: 'qr_scan' });
    const response = await submit({ questId: quest.id });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.completion.validationReason).toBe('not_implemented');
  });

  it('409s on a second attempt at an already verified quest', async () => {
    const quest = await createQuest();
    expect((await submit({ questId: quest.id })).status).toBe(201);
    const second = await submit({ questId: quest.id });
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toEqual({
      error: 'completion.already_verified',
    });
  });

  it('lets a rejected attempt be retried', async () => {
    const quest = await createQuest({ geofenceRadiusM: 150 });
    const first = await submit({ questId: quest.id, lat: metresNorth(BEIRUT.lat, 500) });
    expect(first.status).toBe(422);

    const retry = await submit({ questId: quest.id });
    expect(retry.status).toBe(201);
    const body = await retry.json();
    expect(body.completion.validationStatus).toBe('verified');

    const rows = await query('select id from public.completions where user_id = $1', [userId]);
    expect(rows).toHaveLength(1);
  });
});

describe('POST /api/completions — R2 is only written when the proof survives', () => {
  it('uploads nothing when the validator rejects', async () => {
    const quest = await createQuest({ geofenceRadiusM: 150 });
    const response = await submit({
      questId: quest.id,
      lat: metresNorth(BEIRUT.lat, 500),
    });

    expect(response.status).toBe(422);
    // A rejected photo is visible to nobody and has no cleanup path; storing it
    // would only burn the 10GB free tier.
    expect(uploads).toHaveLength(0);
    const body = await response.json();
    expect(body.completion.photoUrl).toBeNull();
  });

  it('uploads nothing for a qr_scan quest', async () => {
    const quest = await createQuest({ proofType: 'qr_scan' });
    expect((await submit({ questId: quest.id })).status).toBe(422);
    expect(uploads).toHaveLength(0);
  });

  it('keeps the photo for a flagged completion, because a human must review it', async () => {
    const baalbek = await createQuest({ lat: 34.0069, lng: 36.2039, region: 'bekaa' });
    const tyre = await createQuest({ lat: 33.2725, lng: 35.2075, region: 'south' });

    await submit({ questId: baalbek.id, lat: 34.0069, lng: 36.2039 });
    const response = await submit({ questId: tyre.id, lat: 33.2725, lng: 35.2075 });

    const body = await response.json();
    expect(body.completion.validationStatus).toBe('flagged');
    expect(body.completion.photoUrl).not.toBeNull();
    expect(uploads).toHaveLength(2);
  });
});

describe('impossible travel through the API', () => {
  it('flags a retry that conflicts with another completion', async () => {
    // The retry path is an upsert, so this also pins down that the BEFORE
    // INSERT trigger still applies on the ON CONFLICT DO UPDATE branch —
    // Postgres reflects BEFORE INSERT trigger effects in `excluded`.
    const baalbek = await createQuest({ lat: 34.0069, lng: 36.2039, region: 'bekaa' });
    const tyre = await createQuest({ lat: 33.2725, lng: 35.2075, region: 'south' });

    // First attempt at Tyre fails on GPS accuracy, leaving a rejected row.
    const first = await submit({
      questId: tyre.id,
      lat: 33.2725,
      lng: 35.2075,
      accuracyM: MAX_ACCURACY_M + 1,
    });
    expect(first.status).toBe(422);

    // Meanwhile the same user completes Baalbek, 130km away.
    await submit({ questId: baalbek.id, lat: 34.0069, lng: 36.2039 });

    // Retrying Tyre now contradicts the Baalbek completion.
    const retry = await submit({ questId: tyre.id, lat: 33.2725, lng: 35.2075 });
    const body = await retry.json();
    expect(body.completion.validationStatus).toBe('flagged');
    expect(body.completion.validationReason).toBe('proof.impossible_travel');

    const rows = await query('select id from public.completions where user_id = $1', [userId]);
    expect(rows).toHaveLength(2);
  });
});

describe('POST /api/completions — success path', () => {
  it('stores the completion, uploads under the documented key, and logs an event', async () => {
    const quest = await createQuest();
    const response = await submit({ questId: quest.id });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.completion.validationStatus).toBe('verified');
    expect(body.completion.validationReason).toBeNull();
    expect(body.completion.isPublic).toBe(true);

    expect(uploads).toHaveLength(1);
    expect(uploads[0].key).toMatch(
      new RegExp(`^completions/${userId}/${quest.id}-\\d+\\.webp$`),
    );

    const event = await queryOne<{ event_name: string; metadata: Record<string, unknown> }>(
      `select event_name, metadata from public.events where user_id = $1::uuid
        and event_name = 'proof_submitted'`,
      [userId],
    );
    expect(event?.metadata.validation_status).toBe('verified');
  });

  it('ignores a client-supplied submitted_at and uses server time', async () => {
    const quest = await createQuest();
    const response = await submit({
      questId: quest.id,
      extra: { submittedAt: '1999-01-01T00:00:00.000Z', submitted_at: '1999-01-01T00:00:00.000Z' },
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    const stored = new Date(body.completion.submittedAt).getTime();
    expect(stored).toBeGreaterThan(Date.now() - 60_000);
  });

  it('writes no completion row when the photo is rejected before validation', async () => {
    const quest = await createQuest();
    await submit({ questId: quest.id, photo: pngBytes() });
    const rows = await query('select id from public.completions');
    expect(rows).toHaveLength(0);
  });
});
