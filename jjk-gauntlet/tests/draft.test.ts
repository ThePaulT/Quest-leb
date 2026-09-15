import { describe, expect, it } from 'vitest';

import { DB, RULES, character } from '@/lib/data.ts';
import { allDraftRolls, dailySeed, rollDraft, validateTeam } from '@/lib/draft.ts';

describe('draft', () => {
  it('rolls draft_rounds rounds of options_per_round options', () => {
    const rolls = allDraftRolls('seed-1', 'hero');
    expect(rolls).toHaveLength(RULES.draft_rounds);
    for (const r of rolls) {
      expect(r.optionIds).toHaveLength(RULES.options_per_round);
      expect(new Set(r.optionIds).size).toBe(RULES.options_per_round);
    }
  });

  it('only offers characters from the rolled group, on the right side', () => {
    for (let i = 0; i < 400; i += 1) {
      for (const side of ['hero', 'villain'] as const) {
        const roll = rollDraft(`s${i}`, side, i % 3);
        expect(DB.draft_groups[roll.groupId].side).toBe(side);
        const group = DB.draft_groups[roll.groupId];
        const fromGroup = roll.optionIds.filter((id) =>
          character(id).draft_groups.includes(roll.groupId),
        );
        // Every option is on the right side; all of them come from the rolled
        // group unless it is too thin to fill four slots.
        for (const id of roll.optionIds) {
          const c = character(id);
          if (id === roll.legendaryId) continue;
          expect(c.side).toBe(side);
          expect(c.rarity).not.toBe('legendary');
        }
        expect(fromGroup.length).toBeGreaterThanOrEqual(
          Math.min(RULES.options_per_round, group ? 1 : 1),
        );
      }
    }
  });

  it('keeps the legendary behind the legendary roll, at roughly its stated rate', () => {
    let legendary = 0;
    const n = 20_000;
    for (let i = 0; i < n; i += 1) if (rollDraft(`leg${i}`, 'hero', 0).legendary) legendary += 1;
    const rate = legendary / n;
    expect(rate).toBeGreaterThan(RULES.legendary_roll_chance * 0.7);
    expect(rate).toBeLessThan(RULES.legendary_roll_chance * 1.3);
  });

  it('offers Gojo to heroes and Sukuna to villains', () => {
    const hero = Array.from({ length: 5000 }, (_, i) => rollDraft(`h${i}`, 'hero', 0)).find(
      (r) => r.legendary,
    );
    const villain = Array.from({ length: 5000 }, (_, i) => rollDraft(`v${i}`, 'villain', 0)).find(
      (r) => r.legendary,
    );
    expect(hero?.legendaryId).toBe('gojo');
    expect(villain?.legendaryId).toBe('sukuna');
    expect(hero?.optionIds).toContain('gojo');
  });

  it('gives a different set on a reroll, and the same set on a replay', () => {
    const first = rollDraft('same', 'hero', 0, 0);
    expect(rollDraft('same', 'hero', 0, 0)).toEqual(first);
    const rerolled = rollDraft('same', 'hero', 0, 1);
    expect(rerolled.optionIds).not.toEqual(first.optionIds);
  });

  it('gives everyone the same Daily rolls, whatever they pick', () => {
    const date = new Date('2026-09-15T12:00:00Z');
    const seed = dailySeed('hero', date);
    expect(seed).toBe('daily:2026-09-15:hero');
    const playerOne = allDraftRolls(seed, 'hero');
    const playerTwo = allDraftRolls(seed, 'hero');
    expect(playerTwo).toEqual(playerOne);
    // A different day is a different draft.
    expect(allDraftRolls(dailySeed('hero', new Date('2026-09-16T12:00:00Z')), 'hero')).not.toEqual(
      playerOne,
    );
  });

  it('validates a drafted team', () => {
    expect(validateTeam(['yuji', 'megumi', 'nobara'])).toBeNull();
    expect(validateTeam(['yuji', 'yuji', 'nobara'])).toMatch(/duplicate/i);
    expect(validateTeam(['yuji', 'megumi'])).toMatch(/Pick 3/);
  });
});
