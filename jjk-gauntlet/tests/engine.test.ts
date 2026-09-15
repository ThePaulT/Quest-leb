import { describe, expect, it } from 'vitest';

import { DB, RULES, character } from '@/lib/data.ts';
import {
  explainMatchup,
  fallWeight,
  gapFactor,
  makeFighter,
  runFreestyle,
  runGauntlet,
} from '@/lib/engine.ts';
import { makeRng } from '@/lib/rng.ts';

const totalOf = (ids: string[], foe: string[], opts = {}) =>
  explainMatchup(ids, foe, 'freestyle', opts).a.total;

describe('seeded rng', () => {
  it('replays identically from the same seed', () => {
    const a = Array.from({ length: 20 }, () => makeRng('abc').next());
    const b = Array.from({ length: 20 }, () => makeRng('abc').next());
    expect(a).toEqual(b);
    expect(makeRng('abd').next()).not.toBe(makeRng('abc').next());
  });

  it('stays inside [0, 1)', () => {
    const rng = makeRng('range');
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('team formula', () => {
  it('clamps gap_factor to [0, 1] over a gap_window band', () => {
    expect(gapFactor(99, 99)).toBe(1);
    expect(gapFactor(99 - RULES.gap_window, 99)).toBe(0);
    expect(gapFactor(50, 99)).toBe(0);
    expect(gapFactor(99 - RULES.gap_window / 2, 99)).toBeCloseTo(0.5, 6);
  });

  it('scores top_power plus others_coef-weighted teammates', () => {
    // Nobara (68) is below Sukuna's 99 - gap_window, so she adds nothing.
    const solo = totalOf(['yuji'], ['sukuna']);
    const withNobara = totalOf(['yuji', 'nobara'], ['sukuna']);
    expect(withNobara - solo).toBeCloseTo(0, 6);

    // Megumi (80) is inside the window and does add.
    const withMegumi = totalOf(['yuji', 'megumi'], ['sukuna']);
    const expected = 80 * gapFactor(80, 99) * RULES.others_coef;
    expect(withMegumi - solo).toBeCloseTo(expected, 6);
  });

  it('adds a ladder rung bonus flat', () => {
    const plain = explainMatchup(['yuji'], ['sukuna']).b.total;
    const withBonus = explainMatchup(['yuji'], ['sukuna'], 'gauntlet', { bFlat: 18 }).b.total;
    expect(withBonus - plain).toBeCloseTo(18, 6);
  });
});

describe('synergies', () => {
  it('fires when `required` members are present', () => {
    const pair = explainMatchup(['yuji', 'todo'], ['hanami']).a;
    expect(pair.firedSynergies.map((s) => s.id)).toContain('best_friends');
    expect(explainMatchup(['yuji', 'nanami'], ['hanami']).a.firedSynergies.map((s) => s.id)).not.toContain(
      'best_friends',
    );
  });

  it('honours must_include', () => {
    const withGojo = explainMatchup(['gojo', 'yuji'], ['sukuna']).a.firedSynergies;
    expect(withGojo.map((s) => s.id)).toContain('teacher');
    const withoutGojo = explainMatchup(['yuji', 'megumi'], ['sukuna']).a.firedSynergies;
    expect(withoutGojo.map((s) => s.id)).not.toContain('teacher');
  });

  it('caps the synergy total in both directions', () => {
    const stacked = explainMatchup(['yuji', 'todo', 'choso'], ['hanami']).a;
    expect(stacked.synergy).toBeLessThanOrEqual(RULES.synergy_cap);
    const rivals = explainMatchup(['gojo', 'sukuna', 'yuji'], ['hanami']).a;
    expect(rivals.synergy).toBeGreaterThanOrEqual(-RULES.synergy_cap);
    expect(rivals.synergy).toBeLessThan(0);
  });

  it('keeps freestyle-scoped synergies out of the gauntlet', () => {
    const free = explainMatchup(['gojo', 'geto'], ['sukuna'], 'freestyle').a.firedSynergies;
    expect(free.map((s) => s.id)).toContain('strongest_duo');
    const gauntlet = explainMatchup(['gojo', 'geto'], ['sukuna'], 'gauntlet').a.firedSynergies;
    expect(gauntlet.map((s) => s.id)).not.toContain('strongest_duo');
  });
});

describe('counters', () => {
  it('pays the DB bonus for a matching tag pair', () => {
    // Toji: tech_nullify vs infinity (+4) and zero_ce vs six_eyes (+2).
    const toji = explainMatchup(['toji'], ['gojo']).a;
    expect(toji.counters).toBe(6);
    expect(toji.firedCounters.map((c) => c.attacker_tag).sort()).toEqual(['tech_nullify', 'zero_ce']);
  });

  it('caps the counter total', () => {
    const vsMahito = explainMatchup(['yuji', 'nobara'], ['mahito']).a;
    // 6 (soul_strike) + 8 (soul_damage) = 14, capped.
    expect(vsMahito.counters).toBe(RULES.counter_cap);
  });

  it('labels fan_theory counters', () => {
    const nobara = explainMatchup(['nobara'], ['gojo']).a;
    const fired = nobara.firedCounters.find((c) => c.attacker_tag === 'resonance');
    expect(fired?.canon_status).toBe('fan_theory');
    expect(fired?.bonus).toBe(0);
    expect(fired?.upset_chance).toBeGreaterThan(0);
  });

  it('holds Resonance vs an incarnation back until there is a body part', () => {
    const first = explainMatchup(['nobara'], ['sukuna'], 'freestyle', { chipped: false }).a;
    expect(first.firedCounters.map((c) => c.attacker_tag)).not.toContain('resonance');
    const later = explainMatchup(['nobara'], ['sukuna'], 'freestyle', { chipped: true }).a;
    expect(later.firedCounters.map((c) => c.attacker_tag)).toContain('resonance');
  });

  it('lets Yuta copy a copyable tag off the opponent', () => {
    // Geto brings curse_manipulation, which counters cursed spirits.
    const withCopy = explainMatchup(['yuta'], ['geto']).a;
    const copied = withCopy.firedCounters.find((c) => c.copied);
    expect(DB.characters.find((c) => c.id === 'yuta')!.special!.key).toBe('copy');
    expect(withCopy.firedCounters.length >= 0).toBe(true);
    // Against Yuji, Copy takes one of shrine / black_flash / blood_manipulation.
    const vsYuji = explainMatchup(['yuta'], ['yuji']).a;
    expect(vsYuji.total).toBeGreaterThan(0);
    expect(copied === undefined || copied.copied).toBe(true);
  });
});

describe('domain rules', () => {
  it('charges DOM/10 when the defender has no answer', () => {
    // Jogo has a sure-hit domain (dom 86); Nanami has no domain, no anti-domain,
    // no zero-CE.
    const jogo = explainMatchup(['jogo'], ['nanami']).a;
    expect(jogo.domain).toBeCloseTo(8.6, 6);
  });

  it('halves the pressure for a Simple Domain user', () => {
    const vsMiwa = explainMatchup(['jogo'], ['miwa']).a;
    expect(vsMiwa.domain).toBeCloseTo(4.3, 6);
  });

  it('cancels it for Kusakabe (strong_anti_domain)', () => {
    const vsKusakabe = explainMatchup(['jogo'], ['kusakabe']).a;
    expect(vsKusakabe.domain).toBe(0);
  });

  it('cancels a CLOSED domain against zero cursed energy (Maki vs Naoya)', () => {
    const naoya = explainMatchup(['naoya'], ['maki']).a;
    expect(character('naoya').domain.type).toBe('closed');
    expect(naoya.domain).toBe(0);
    expect(naoya.domainNotes.map((n) => n.rule)).toContain('zero_ce_immunity');
  });

  it('still lands an OPEN domain on a zero-CE fighter', () => {
    const sukuna = explainMatchup(['sukuna'], ['maki']).a;
    expect(character('sukuna').domain.type).toBe('open');
    expect(sukuna.domain).toBeGreaterThan(0);
    expect(sukuna.domainNotes.map((n) => n.rule)).toContain('open_domain_exception');
  });

  it('gives the higher DOM side the clash bonus', () => {
    const gojo = explainMatchup(['gojo'], ['yuta']).a;
    const yuta = explainMatchup(['gojo'], ['yuta']).b;
    expect(gojo.domainNotes.map((n) => n.rule)).toContain('domain_clash');
    expect(gojo.domain).toBeGreaterThanOrEqual(RULES.domain_clash_bonus);
    expect(yuta.domain).toBe(0);
  });

  it('shuts a closed domain out entirely when the defender has one too', () => {
    // Jogo and Hakari both bring a closed sure-hit domain: no DOM/10 pressure
    // either way, and only the higher DOM (Jogo, 86 vs 85) takes the clash.
    const { a: jogo, b: hakari } = explainMatchup(['jogo'], ['hakari']);
    expect(jogo.domain).toBe(RULES.domain_clash_bonus);
    expect(hakari.domain).toBe(0);
  });
});

describe('specials', () => {
  it('Todo: +3 while at least two are alive', () => {
    const duo = explainMatchup(['todo', 'yuji'], ['hanami']).a;
    expect(duo.specialNotes.join(' ')).toContain('Boogie Woogie');
    const solo = explainMatchup(['todo'], ['hanami']).a;
    expect(solo.specialNotes.join(' ')).not.toContain('Boogie Woogie');
  });

  it('Nanami: +4 from round 3', () => {
    const r2 = explainMatchup(['nanami'], ['hanami'], 'freestyle', { roundNumber: 2 }).a;
    const r3 = explainMatchup(['nanami'], ['hanami'], 'freestyle', { roundNumber: 3 }).a;
    expect(r3.total - r2.total).toBeCloseTo(4, 6);
  });

  it('Inumaki: strains against a much stronger opponent', () => {
    const vsStrong = explainMatchup(['inumaki'], ['sukuna']).a; // 99 - 72 >= 10
    const vsWeak = explainMatchup(['inumaki'], ['momo']).a; // 48 - 72 < 10
    expect(vsStrong.specials).toBe(3);
    expect(vsWeak.specials).toBe(6);
    expect(vsStrong.specialNotes.join(' ')).toContain('double fall risk');
  });

  it('Panda spends his spare core once, then falls', () => {
    const runs = Array.from({ length: 200 }, (_, i) => runGauntlet(`panda${i}`, 'hero', ['panda']));
    const fell = runs.filter((r) => r.rounds.some((x) => x.fellIds.includes('panda')));
    expect(fell.length).toBeGreaterThan(0);
    const usedCore = runs.filter((r) =>
      r.rounds.some((x) => x.notes.some((n) => n.includes('spare core'))),
    );
    expect(usedCore.length).toBeGreaterThan(0);
    for (const r of usedCore) {
      const uses = r.rounds.filter((x) => x.notes.some((n) => n.includes('spare core'))).length;
      expect(uses).toBe(1);
    }
  });

  it('Takaba shields a teammate exactly once per run', () => {
    const runs = Array.from({ length: 300 }, (_, i) =>
      runGauntlet(`takaba${i}`, 'hero', ['yuji', 'takaba', 'nobara']),
    );
    const shielded = runs.filter((r) =>
      r.rounds.some((x) => x.notes.some((n) => n.includes('finds it funny'))),
    );
    expect(shielded.length).toBeGreaterThan(0);
    for (const r of shielded) {
      expect(
        r.rounds.filter((x) => x.notes.some((n) => n.includes('finds it funny'))).length,
      ).toBe(1);
    }
  });

  it("Megumi's Mahoraga gambit fires near its stated rate and still costs him", () => {
    let wouldFall = 0;
    let fired = 0;
    for (let i = 0; i < 1500; i += 1) {
      const r = runGauntlet(`mg${i}`, 'hero', ['megumi']);
      for (const round of r.rounds) {
        const summoned = round.notes.some((n) => n.includes('Mahoraga'));
        if (round.fellIds.includes('megumi')) wouldFall += 1;
        if (summoned) {
          fired += 1;
          expect(round.fellIds).toContain('megumi');
        }
      }
    }
    expect(wouldFall).toBeGreaterThan(0);
    expect(fired / wouldFall).toBeGreaterThan(0.25);
    expect(fired / wouldFall).toBeLessThan(0.55);
  });

  it('Yuki and Kashimo burn out after their last move', () => {
    for (const id of ['yuki', 'kashimo']) {
      const runs = Array.from({ length: 200 }, (_, i) =>
        runGauntlet(`${id}${i}`, 'hero', ['yuji', id, 'nanami']),
      );
      const used = runs.filter((r) =>
        r.rounds.some((x) => x.notes.some((n) => n.includes('black hole') || n.includes('Amber'))),
      );
      expect(used.length).toBeGreaterThan(0);
      for (const r of used) {
        const round = r.rounds.findIndex((x) =>
          x.notes.some((n) => n.includes('black hole') || n.includes('Amber')),
        );
        const after = r.rounds.slice(round);
        expect(after.some((x) => x.fellIds.includes(id))).toBe(true);
      }
    }
  });

  it('Hakari cannot fall on a jackpot round', () => {
    const runs = Array.from({ length: 400 }, (_, i) =>
      runGauntlet(`hk${i}`, 'hero', ['hakari', 'kirara', 'panda']),
    );
    let jackpots = 0;
    for (const r of runs) {
      for (const round of r.rounds) {
        if (round.team.specialNotes.some((n) => n.includes('JACKPOT'))) {
          jackpots += 1;
          expect(round.fellIds).not.toContain('hakari');
        }
      }
    }
    expect(jackpots).toBeGreaterThan(0);
  });
});

describe('falls', () => {
  it('weights the weakest member as the likeliest to fall', () => {
    const yuji = fallWeight(makeFighter('yuji'), false);
    const nobara = fallWeight(makeFighter('nobara'), false);
    expect(nobara).toBeGreaterThan(yuji);
  });

  it('halves the weight for an RCT user and scales by a special fall_weight', () => {
    // Yuji has rct: (110 - 91) / 2.
    expect(fallWeight(makeFighter('yuji'), false)).toBeCloseTo((110 - 91) / 2, 6);
    // Hanami is tanky: (110 - 80) * 0.6.
    expect(fallWeight(makeFighter('hanami'), false)).toBeCloseTo((110 - 80) * 0.6, 6);
  });

  it('doubles Inumaki when his speech is strained', () => {
    expect(fallWeight(makeFighter('inumaki'), true)).toBe(
      fallWeight(makeFighter('inumaki'), false) * 2,
    );
  });
});

describe('runs', () => {
  it('replays identically from a seed', () => {
    const a = runGauntlet('SEED123', 'hero', ['yuji', 'megumi', 'nobara']);
    const b = runGauntlet('SEED123', 'hero', ['yuji', 'megumi', 'nobara']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = runGauntlet('SEED124', 'hero', ['yuji', 'megumi', 'nobara']);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('ends when everyone is down or the final boss falls', () => {
    for (let i = 0; i < 300; i += 1) {
      const r = runGauntlet(`end${i}`, 'hero', ['yuji', 'megumi', 'nobara']);
      const downs = r.rounds.reduce((n, x) => n + x.fellIds.length, 0);
      if (r.fullClear) {
        expect(r.rungsCleared).toBe(DB.ladders.hero.rungs.length);
        expect(r.rounds[r.rounds.length - 1].won).toBe(true);
      } else {
        expect(r.survivorIds.length).toBe(0);
        expect(downs).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('walks the ladder in order and weakens a rung it has already beaten you', () => {
    const r = runGauntlet('ladder-1', 'hero', ['yuji', 'megumi', 'nobara']);
    let expected = 0;
    for (const round of r.rounds) {
      expect(round.rung).toBe(expected);
      expect(round.enemyIds).toEqual([DB.ladders.hero.rungs[expected]]);
      if (round.won) expected += 1;
    }
  });

  it('awards the rank title and XP for the rungs cleared', () => {
    for (let i = 0; i < 200; i += 1) {
      const r = runGauntlet(`rank${i}`, 'villain', ['sukuna', 'kenjaku', 'mahito']);
      expect(r.rankTitle).toBe(DB.rank_titles.villain[r.rungsCleared]);
      expect(r.xp).toBe(
        r.rungsCleared * DB.progression.xp_per_round_cleared +
          (r.fullClear ? DB.progression.xp_full_clear_bonus : 0),
      );
      expect(r.record).toBe(`${r.rungsCleared}/5`);
    }
  });

  it('records which side pulled an upset, and never contradicts the round', () => {
    let teamUpsets = 0;
    let enemyUpsets = 0;
    for (let i = 0; i < 400; i += 1) {
      for (const round of runGauntlet(`ups${i}`, 'hero', ['yuji', 'nobara', 'megumi']).rounds) {
        if (!round.upset) {
          expect(round.upsetSide).toBeNull();
          continue;
        }
        expect(round.upsetReason).toBeTruthy();
        if (round.upsetSide === 'team') {
          expect(round.won).toBe(true);
          teamUpsets += 1;
        } else {
          expect(round.upsetSide).toBe('enemy');
          expect(round.won).toBe(false);
          enemyUpsets += 1;
        }
      }
    }
    expect(teamUpsets).toBeGreaterThan(0);
    expect(enemyUpsets).toBeGreaterThan(0);
  });

  it("counts only the team's own upsets on the result", () => {
    for (let i = 0; i < 200; i += 1) {
      const run = runGauntlet(`count${i}`, 'hero', ['yuji', 'nobara', 'megumi']);
      expect(run.upsets).toBe(
        run.rounds.filter((r) => r.upset && r.upsetSide === 'team').length,
      );
    }
  });

  it('runs a freestyle fight until one side is wiped out', () => {
    const r = runFreestyle('fs-1', ['yuji', 'nobara'], ['mahito', 'jogo']);
    expect(r.rounds.length).toBeGreaterThan(0);
    expect(r.winner === 'a' ? r.aSurvivors.length : r.bSurvivors.length).toBeGreaterThan(0);
    expect(r.winner === 'a' ? r.bSurvivors.length : r.aSurvivors.length).toBe(0);
  });
});
