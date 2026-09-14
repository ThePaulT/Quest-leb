import { beforeEach, describe, expect, it } from 'vitest';

import { getPool, query } from '@/lib/db';
import { evaluateBadges } from '@/lib/badges';

import { createBadge, createQuest, createUser, resetDatabase } from './helpers';

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  userId = await createUser();
});

async function complete(
  questId: string,
  status: 'verified' | 'flagged' | 'rejected' = 'verified',
) {
  await query(
    `insert into public.completions
       (user_id, quest_id, lat, lng, accuracy_m, validation_status)
     values ($1::uuid, $2::uuid, 33.9, 35.5, 10, $3::public.validation_status)`,
    [userId, questId, status],
  );
}

async function evaluate() {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const earned = await evaluateBadges(userId, client);
    await client.query('commit');
    return earned;
  } finally {
    client.release();
  }
}

describe('badge rules', () => {
  it('awards count_threshold once the count is reached', async () => {
    await createBadge({ slug: 'three', ruleType: 'count_threshold', ruleValue: { count: 3 } });
    const quests = [await createQuest(), await createQuest(), await createQuest()];

    await complete(quests[0].id);
    await complete(quests[1].id);
    expect(await evaluate()).toHaveLength(0);

    await complete(quests[2].id);
    expect((await evaluate()).map((b) => b.slug)).toEqual(['three']);
  });

  it('counts flagged completions but not rejected ones', async () => {
    await createBadge({ slug: 'two', ruleType: 'count_threshold', ruleValue: { count: 2 } });
    const quests = [await createQuest(), await createQuest(), await createQuest()];

    await complete(quests[0].id, 'verified');
    await complete(quests[1].id, 'rejected');
    expect(await evaluate()).toHaveLength(0);

    await complete(quests[2].id, 'flagged');
    expect((await evaluate()).map((b) => b.slug)).toEqual(['two']);
  });

  it('awards region_complete only when every active quest in the region is done', async () => {
    await createBadge({
      slug: 'north-done',
      ruleType: 'region_complete',
      ruleValue: { region: 'north' },
    });
    const a = await createQuest({ region: 'north' });
    const b = await createQuest({ region: 'north' });
    const elsewhere = await createQuest({ region: 'south' });

    await complete(a.id);
    await complete(elsewhere.id);
    expect(await evaluate()).toHaveLength(0);

    await complete(b.id);
    expect((await evaluate()).map((s) => s.slug)).toEqual(['north-done']);
  });

  it('ignores inactive quests when deciding completeness', async () => {
    await createBadge({
      slug: 'south-done',
      ruleType: 'region_complete',
      ruleValue: { region: 'south' },
    });
    const active = await createQuest({ region: 'south' });
    await createQuest({ region: 'south', isActive: false });

    await complete(active.id);
    expect((await evaluate()).map((s) => s.slug)).toEqual(['south-done']);
  });

  it('does not award a region badge when the region has no active quests', async () => {
    await createBadge({
      slug: 'bekaa-done',
      ruleType: 'region_complete',
      ruleValue: { region: 'bekaa' },
    });
    // An empty slice is vacuously "complete" — guard against awarding it to
    // someone who has done nothing at all.
    expect(await evaluate()).toHaveLength(0);
  });

  it('awards category_complete across regions', async () => {
    await createBadge({
      slug: 'foodie',
      ruleType: 'category_complete',
      ruleValue: { category: 'food' },
    });
    const a = await createQuest({ category: 'food', region: 'beirut' });
    const b = await createQuest({ category: 'food', region: 'bekaa' });

    await complete(a.id);
    expect(await evaluate()).toHaveLength(0);
    await complete(b.id);
    expect((await evaluate()).map((s) => s.slug)).toEqual(['foodie']);
  });

  it('awards all_complete only after every active quest', async () => {
    await createBadge({ slug: 'everything', ruleType: 'all_complete', ruleValue: {} });
    const a = await createQuest();
    const b = await createQuest();

    await complete(a.id);
    expect(await evaluate()).toHaveLength(0);
    await complete(b.id);
    expect((await evaluate()).map((s) => s.slug)).toEqual(['everything']);
  });

  it('never awards the same badge twice', async () => {
    await createBadge({ slug: 'one', ruleType: 'count_threshold', ruleValue: { count: 1 } });
    await complete((await createQuest()).id);

    expect(await evaluate()).toHaveLength(1);
    expect(await evaluate()).toHaveLength(0);
  });
});
