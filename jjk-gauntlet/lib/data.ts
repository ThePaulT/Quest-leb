import raw from '@/data/jjk_gauntlet_db.json';

import type { Character, GauntletDB, Side, Synergy } from './types.ts';

export const DB = raw as unknown as GauntletDB;
export const RULES = DB.rules;

const byId = new Map<string, Character>(DB.characters.map((c) => [c.id, c]));

export function character(id: string): Character {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}

export function maybeCharacter(id: string): Character | undefined {
  return byId.get(id);
}

export function charactersForSide(side: Side): Character[] {
  return DB.characters.filter((c) => c.side === side);
}

/** Draft groups a side rolls from. `legendary` is reached only by the
 *  legendary roll, never by a normal group roll. */
export function draftGroupsForSide(side: Side): string[] {
  return Object.entries(DB.draft_groups)
    .filter(([id, g]) => g.side === side && id !== 'legendary')
    .map(([id]) => id);
}

/** The pool a group rolls from. Legendary-rarity characters are excluded:
 *  they only ever arrive through the legendary roll. */
export function poolForGroup(groupId: string): Character[] {
  return DB.characters.filter(
    (c) => c.draft_groups.includes(groupId) && c.rarity !== 'legendary',
  );
}

/** The legendary a side can roll. `notes` in the DB pin these down: Gojo is the
 *  Hero Gauntlet's legendary roll, Sukuna the Villain Gauntlet's. */
export function legendaryForSide(side: Side): Character | undefined {
  return DB.characters.find(
    (c) =>
      c.rarity === 'legendary' &&
      (side === 'hero' ? c.id !== DB.ladders.hero.final_boss : c.id !== DB.ladders.villain.final_boss),
  );
}

/** Synergies scoped `gauntlet` are the ones a drafted single-side team can
 *  reach, so they apply in every mode. Synergies scoped `freestyle` pair
 *  characters from opposite sides (Gojo+Geto, Toji+Megumi, Gojo+Sukuna), which
 *  a gauntlet draft can never produce, so they are freestyle-only. */
export function synergiesForMode(mode: 'gauntlet' | 'freestyle'): Synergy[] {
  return DB.synergies.filter((s) => s.scope === 'gauntlet' || mode === 'freestyle');
}
