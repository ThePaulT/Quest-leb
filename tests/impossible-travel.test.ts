import { beforeEach, describe, expect, it } from 'vitest';

import { query, queryOne } from '@/lib/db';

import { createQuest, createUser, resetDatabase } from './helpers';

/** Baalbek and Tyre are ~130km apart — the canonical impossible pair. */
const BAALBEK = { lat: 34.0069, lng: 36.2039 };
const TYRE = { lat: 33.2725, lng: 35.2075 };
/** ~2km from Baalbek: far enough to be a different quest, near enough to be real. */
const NEAR_BAALBEK = { lat: 34.0249, lng: 36.2039 };

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  userId = await createUser();
});

async function insertCompletion(input: {
  userId?: string;
  lat: number | null;
  lng: number | null;
  minutesAgo?: number;
  status?: 'verified' | 'flagged' | 'rejected';
}): Promise<{ validation_status: string; validation_reason: string | null }> {
  const quest = await createQuest();
  const row = await queryOne<{ validation_status: string; validation_reason: string | null }>(
    `insert into public.completions
       (user_id, quest_id, submitted_at, lat, lng, accuracy_m, validation_status)
     values ($1::uuid, $2::uuid, now() - make_interval(mins => $3),
             $4::float8, $5::float8, 10, $6::public.validation_status)
     returning validation_status, validation_reason`,
    [
      input.userId ?? userId,
      quest.id,
      input.minutesAgo ?? 0,
      input.lat,
      input.lng,
      input.status ?? 'verified',
    ],
  );
  return row!;
}

describe('flag_impossible_travel', () => {
  it('flags a completion >50km away within 15 minutes', async () => {
    await insertCompletion({ ...BAALBEK, minutesAgo: 5 });
    const second = await insertCompletion({ ...TYRE });

    expect(second.validation_status).toBe('flagged');
    expect(second.validation_reason).toBe('proof.impossible_travel');
  });

  it('leaves a plausible nearby completion verified', async () => {
    await insertCompletion({ ...BAALBEK, minutesAgo: 5 });
    const second = await insertCompletion({ ...NEAR_BAALBEK });

    expect(second.validation_status).toBe('verified');
    expect(second.validation_reason).toBeNull();
  });

  it('leaves a far completion verified once more than 15 minutes have passed', async () => {
    await insertCompletion({ ...BAALBEK, minutesAgo: 16 });
    const second = await insertCompletion({ ...TYRE });

    expect(second.validation_status).toBe('verified');
  });

  it('does not upgrade a rejected completion to flagged', async () => {
    // Flagged rows count toward badges and rejected ones do not, so flagging a
    // rejection would be a promotion.
    await insertCompletion({ ...BAALBEK, minutesAgo: 5 });
    const second = await insertCompletion({ ...TYRE, status: 'rejected' });

    expect(second.validation_status).toBe('rejected');
  });

  it('ignores completions belonging to a different user', async () => {
    const other = await createUser();
    await insertCompletion({ userId: other, ...BAALBEK, minutesAgo: 5 });
    const second = await insertCompletion({ ...TYRE });

    expect(second.validation_status).toBe('verified');
  });

  it('ignores completions with no recorded position', async () => {
    await insertCompletion({ lat: null, lng: null, minutesAgo: 5 });
    const second = await insertCompletion({ ...TYRE });

    expect(second.validation_status).toBe('verified');
  });

  it('leaves the earlier completion untouched', async () => {
    await insertCompletion({ ...BAALBEK, minutesAgo: 5 });
    await insertCompletion({ ...TYRE });

    const rows = await query<{ validation_status: string }>(
      `select validation_status from public.completions
        where user_id = $1::uuid order by submitted_at`,
      [userId],
    );
    expect(rows.map((r) => r.validation_status)).toEqual(['verified', 'flagged']);
  });
});
