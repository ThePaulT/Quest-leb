import { NextResponse } from 'next/server';

import { UnauthorizedError, requireUserId } from '@/lib/auth';
import { evaluateBadges } from '@/lib/badges';
import { queryOne, transaction } from '@/lib/db';
import { recordEvent } from '@/lib/events';
import { getQuestById } from '@/lib/quests';
import { completionPhotoKey, getStorage } from '@/lib/storage';
import type { Badge } from '@/lib/types';
import { getValidator } from '@/lib/validators';

/**
 * POST /api/completions — submit proof for a quest.
 *
 * The client compresses to WebP under 200KB before upload (see CLAUDE.md).
 * This route allows up to 400KB: the extra headroom absorbs encoder variance
 * across devices without accepting an uncompressed photo.
 */
const MAX_PHOTO_BYTES = 400 * 1024;
const CLIENT_TARGET_BYTES = 200 * 1024;

/** WebP is RIFF....WEBP. Trusting the declared content-type alone is not enough. */
const WEBP_MAGIC = { riff: 'RIFF', format: 'WEBP' } as const;

export async function POST(request: Request): Promise<NextResponse> {
  let userId: string;
  try {
    userId = await requireUserId(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, 'auth.unauthorized');
    }
    throw error;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'request.malformed_multipart');
  }

  const questId = stringField(form, 'questId');
  if (!questId) return fail(400, 'request.missing_quest_id');

  const lat = numberField(form, 'lat');
  const lng = numberField(form, 'lng');
  const accuracyM = numberField(form, 'accuracyM');
  if (lat === null || lng === null || accuracyM === null) {
    return fail(400, 'request.missing_position');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || accuracyM < 0) {
    return fail(400, 'request.invalid_position');
  }

  const photo = form.get('photo');
  if (!(photo instanceof File)) {
    return fail(400, 'request.missing_photo');
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return fail(413, 'photo.too_large');
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  if (!isWebp(bytes)) {
    return fail(415, 'photo.not_webp');
  }

  const quest = await getQuestById(questId);
  if (!quest || !quest.isActive) {
    // Same answer either way: an inactive quest must not be discoverable by
    // probing this endpoint.
    return fail(404, 'quest.not_found');
  }

  // A verified completion is final. Anything else — rejected, or flagged and
  // since reviewed — may be attempted again, which is why this replaces rather
  // than colliding with the (user_id, quest_id) unique constraint.
  const existing = await findExisting(userId, questId);
  if (existing === 'verified') {
    return fail(409, 'completion.already_verified');
  }

  const submittedAt = new Date();
  const key = completionPhotoKey(userId, questId, submittedAt);
  const storage = getStorage();

  // Validate against the URL the photo WOULD have, then upload only if the
  // submission survives. A rejected photo is readable by nobody and has no
  // cleanup path, so uploading one just consumes the 10GB free tier — and
  // retries mean a user outside the geofence could upload repeatedly.
  const prospectiveUrl = storage.publicUrl(key);

  const result = await getValidator(quest.proofType).validate(
    { questId, userId, lat, lng, accuracyM, photoUrl: prospectiveUrl },
    quest,
  );

  // Flagged rows keep their photo: a human has to look at it to review.
  let photoUrl: string | null = null;
  if (result.status !== 'rejected') {
    try {
      photoUrl = await storage.uploadPhoto(bytes, key);
    } catch {
      return fail(502, 'storage.upload_failed');
    }
  }

  const { completion, badges } = await transaction(async (client) => {
    const { rows } = await client.query(
      `insert into public.completions
         (user_id, quest_id, submitted_at, photo_url, photo_thumb_url,
          lat, lng, accuracy_m, validation_status, validation_reason)
       values ($1::uuid, $2::uuid, $3::timestamptz, $4, $5,
               $6::float8, $7::float8, $8::float8, $9::public.validation_status, $10)
       on conflict (user_id, quest_id) do update
          set submitted_at      = excluded.submitted_at,
              photo_url         = excluded.photo_url,
              photo_thumb_url   = excluded.photo_thumb_url,
              lat               = excluded.lat,
              lng               = excluded.lng,
              accuracy_m        = excluded.accuracy_m,
              validation_status = excluded.validation_status,
              validation_reason = excluded.validation_reason
       returning id, user_id, quest_id, submitted_at, photo_url, photo_thumb_url,
                 lat, lng, accuracy_m, validation_status, validation_reason, is_public`,
      [
        userId,
        questId,
        // Server time, always. Any client-supplied timestamp is ignored.
        submittedAt.toISOString(),
        photoUrl,
        null,
        lat,
        lng,
        accuracyM,
        result.status,
        result.reason,
      ],
    );

    const row = rows[0];

    await recordEvent(
      {
        eventName: 'proof_submitted',
        userId,
        questId,
        metadata: {
          proof_type: quest.proofType,
          validation_status: row.validation_status,
          validation_reason: row.validation_reason,
          accuracy_m: accuracyM,
          photo_bytes: bytes.byteLength,
          over_client_target: bytes.byteLength > CLIENT_TARGET_BYTES,
        },
      },
      client,
    );

    if (row.validation_status === 'rejected') {
      return { completion: row, badges: [] as Badge[] };
    }

    // Flagged still counts toward badges — see lib/badges.ts.
    const earned = await evaluateBadges(userId, client);
    for (const badge of earned) {
      await recordEvent(
        {
          eventName: 'badge_earned',
          userId,
          questId,
          metadata: { badge_slug: badge.slug, rule_type: badge.ruleType },
        },
        client,
      );
    }

    return { completion: row, badges: earned };
  });

  return NextResponse.json(
    {
      completion: {
        id: completion.id,
        questId: completion.quest_id,
        submittedAt: completion.submitted_at,
        photoUrl: completion.photo_url,
        photoThumbUrl: completion.photo_thumb_url,
        lat: completion.lat,
        lng: completion.lng,
        accuracyM: completion.accuracy_m,
        validationStatus: completion.validation_status,
        validationReason: completion.validation_reason,
        isPublic: completion.is_public,
      },
      badgesEarned: badges.map((b) => ({
        slug: b.slug,
        nameEn: b.nameEn,
        nameAr: b.nameAr,
      })),
    },
    { status: completion.validation_status === 'rejected' ? 422 : 201 },
  );
}

/** The prior verdict for this (user, quest), if any. */
async function findExisting(
  userId: string,
  questId: string,
): Promise<string | null> {
  const row = await queryOne<{ validation_status: string }>(
    `select validation_status
       from public.completions
      where user_id = $1::uuid and quest_id = $2::uuid`,
    [userId, questId],
  );
  return row?.validation_status ?? null;
}

/** Error bodies carry an i18n key, never a translated string. */
function fail(status: number, reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status });
}

function stringField(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numberField(form: FormData, name: string): number | null {
  const raw = stringField(form, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.byteLength >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === WEBP_MAGIC.riff &&
    bytes.subarray(8, 12).toString('ascii') === WEBP_MAGIC.format
  );
}
