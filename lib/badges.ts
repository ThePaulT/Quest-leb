import type { PoolClient } from 'pg';

import type { Badge } from '@/lib/types';

/**
 * Badge evaluation.
 *
 * Badges are data: the rules live in badges.rule_type / rule_value, so adding a
 * badge is an insert. This module knows how to READ the four rule types, not
 * which badges exist.
 *
 * What counts as "completed": verified OR flagged. A flagged completion is one
 * awaiting human review, not one we have rejected — withholding a badge from a
 * visitor because an automated heuristic was unsure is the wrong default, and
 * the review can revoke it later if it turns out to be bogus.
 */

const COUNTS_TOWARD_BADGES = "('verified','flagged')";

interface BadgeRow {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  rule_type: Badge['ruleType'];
  rule_value: Record<string, unknown>;
}

const toBadge = (row: BadgeRow): Badge => ({
  id: row.id,
  slug: row.slug,
  nameEn: row.name_en,
  nameAr: row.name_ar,
  ruleType: row.rule_type,
  ruleValue: row.rule_value,
});

/**
 * Awards every badge the user now qualifies for and has not already earned.
 * Returns only the newly earned ones, so the caller can tell the user what just
 * happened rather than re-announcing their whole collection.
 *
 * Runs inside the caller's transaction: a badge is earned because a completion
 * landed, and the two must commit or roll back together.
 */
export async function evaluateBadges(
  userId: string,
  client: PoolClient,
): Promise<Badge[]> {
  const { rows: candidates } = await client.query<BadgeRow>(
    `select b.id, b.slug, b.name_en, b.name_ar, b.rule_type, b.rule_value
       from public.badges b
      where not exists (
        select 1 from public.user_badges ub
         where ub.badge_id = b.id and ub.user_id = $1::uuid
      )`,
    [userId],
  );

  const earned: Badge[] = [];
  for (const row of candidates) {
    if (await qualifies(userId, row, client)) {
      // on conflict do nothing: two concurrent submissions can both decide the
      // same badge is newly earned. The insert decides, not the check.
      const { rowCount } = await client.query(
        `insert into public.user_badges (user_id, badge_id)
         values ($1::uuid, $2::uuid)
         on conflict (user_id, badge_id) do nothing`,
        [userId, row.id],
      );
      if (rowCount && rowCount > 0) {
        earned.push(toBadge(row));
      }
    }
  }
  return earned;
}

async function qualifies(
  userId: string,
  badge: BadgeRow,
  client: PoolClient,
): Promise<boolean> {
  switch (badge.rule_type) {
    case 'region_complete': {
      const region = badge.rule_value.region;
      if (typeof region !== 'string') return false;
      return allActiveQuestsDone(userId, 'region', region, client);
    }
    case 'category_complete': {
      const category = badge.rule_value.category;
      if (typeof category !== 'string') return false;
      return allActiveQuestsDone(userId, 'category', category, client);
    }
    case 'count_threshold': {
      const threshold = Number(badge.rule_value.count);
      if (!Number.isFinite(threshold) || threshold <= 0) return false;
      const { rows } = await client.query<{ n: string }>(
        `select count(*)::text as n
           from public.completions c
          where c.user_id = $1::uuid
            and c.validation_status in ${COUNTS_TOWARD_BADGES}`,
        [userId],
      );
      return Number(rows[0]?.n ?? 0) >= threshold;
    }
    case 'all_complete':
      return allActiveQuestsDone(userId, null, null, client);
  }
}

/**
 * True when the user has completed every active quest in the given slice, and
 * the slice is not empty — otherwise a region with no active quests would award
 * its badge to everyone, including people who have done nothing.
 */
async function allActiveQuestsDone(
  userId: string,
  column: 'region' | 'category' | null,
  value: string | null,
  client: PoolClient,
): Promise<boolean> {
  // `column` is a closed set from the switch above, never user input.
  const filter = column ? `and q.${column}::text = $2` : '';
  const params = column ? [userId, value] : [userId];

  const { rows } = await client.query<{ total: string; done: string }>(
    `select count(*)::text as total,
            count(c.id)::text as done
       from public.quests q
       left join public.completions c
         on c.quest_id = q.id
        and c.user_id = $1::uuid
        and c.validation_status in ${COUNTS_TOWARD_BADGES}
      where q.is_active ${filter}`,
    params,
  );

  const total = Number(rows[0]?.total ?? 0);
  const done = Number(rows[0]?.done ?? 0);
  return total > 0 && done === total;
}
