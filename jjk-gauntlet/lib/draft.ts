/**
 * Drafting. `rules.draft_rounds` rounds, `rules.options_per_round` options each,
 * `rules.rerolls_per_run` reroll, `rules.legendary_roll_chance` per round.
 *
 * A roll depends only on (seed, round, reroll count), never on what the player
 * has already taken. That is what makes the Daily identical for everyone: two
 * players who pick differently still see the same groups and the same four
 * faces. A character already on the team simply shows as taken.
 */

import {
  DB,
  RULES,
  character,
  charactersForSide,
  draftGroupsForSide,
  legendaryForSide,
  poolForGroup,
} from './data.ts';
import { makeRng } from './rng.ts';
import type { Side } from './types.ts';

export interface DraftRoll {
  round: number;
  groupId: string;
  groupLabel: string;
  optionIds: string[];
  /** The legendary roll landed; `legendaryId` is in `optionIds`. */
  legendary: boolean;
  legendaryId: string | null;
  rerollUsed: number;
}

export function draftSeed(seed: string, round: number, reroll: number): string {
  return `${seed}:draft:${round}:${reroll}`;
}

export function rollDraft(seed: string, side: Side, round: number, reroll = 0): DraftRoll {
  const rng = makeRng(draftSeed(seed, round, reroll));
  const groups = draftGroupsForSide(side);
  const groupId = rng.pick(groups);
  const pool = poolForGroup(groupId);
  const optionIds = rng.sample(pool, RULES.options_per_round).map((c) => c.id);
  // Special Grades holds only two draftable faces (Gojo is legendary-only), so
  // a thin group is topped up from the rest of the side rather than shown short.
  if (optionIds.length < RULES.options_per_round) {
    const rest = charactersForSide(side).filter(
      (c) => c.rarity !== 'legendary' && !optionIds.includes(c.id),
    );
    optionIds.push(
      ...rng.sample(rest, RULES.options_per_round - optionIds.length).map((c) => c.id),
    );
  }

  let legendary = false;
  let legendaryId: string | null = null;
  const legend = legendaryForSide(side);
  if (legend && rng.chance(RULES.legendary_roll_chance)) {
    legendary = true;
    legendaryId = legend.id;
    optionIds[rng.int(optionIds.length)] = legend.id;
  }

  return {
    round,
    groupId,
    groupLabel: DB.draft_groups[groupId].label,
    optionIds,
    legendary,
    legendaryId,
    rerollUsed: reroll,
  };
}

export function allDraftRolls(seed: string, side: Side, rerolls: Record<number, number> = {}): DraftRoll[] {
  return Array.from({ length: RULES.draft_rounds }, (_, i) =>
    rollDraft(seed, side, i, rerolls[i] ?? 0),
  );
}

/** YYYY-MM-DD in UTC, so everyone's Daily flips at the same moment. */
export function dailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailySeed(side: Side, date = new Date()): string {
  return `daily:${dailyKey(date)}:${side}`;
}

/** A drafted team is legal when it has the right size and no duplicates. */
export function validateTeam(ids: string[], size = RULES.draft_rounds): string | null {
  if (ids.length !== size) return `Pick ${size} characters.`;
  if (new Set(ids).size !== ids.length) return 'No duplicates.';
  for (const id of ids) character(id);
  return null;
}
