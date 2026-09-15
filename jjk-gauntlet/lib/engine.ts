/**
 * The JJK Gauntlet fight engine.
 *
 * Every number here comes from jjk_gauntlet_db.json: `rules`, `counters`,
 * `domain_rules`, `synergies`, per-character `special`, and `ladders`. The
 * engine is pure and seeded — a seed plus a team replays a run exactly.
 *
 * Readings of rules the DB states in prose, recorded so they are arguable:
 *
 * - `rng_range: 12` is read as a per-side roll uniform on [-12, +12]. The three
 *   calibration rates in tests/engine.rates.test.ts only land with the
 *   symmetric-about-zero reading; a [0, 12] roll makes every underdog too cold.
 * - `enemy_top_power` in gap_factor is the opposing side's highest *character*
 *   power, before rung bonuses and before weakening.
 * - A ladder rung's `rung_bonus` is a flat addition to that rung's score.
 * - `domain_pressure` (opponent gains DOM/10) is computed, then reduced by the
 *   defender's answer: a full domain of their own turns it into `domain_clash`
 *   instead, `strong_anti_domain` cancels it, `anti_domain` or an incomplete
 *   domain halves it, and zero cursed energy cancels it for CLOSED domains
 *   only (`open_domain_exception`).
 * - `synergy_cap` clamps the synergy total in both directions, so the
 *   game_mechanic penalties (Gojo+Sukuna, Yuji+Mahito) cannot exceed -8.
 * - Synergies apply over *living* members, which is what Todo's
 *   "while at least 2 members are alive" implies.
 * - `loss_opponent_weaken` accumulates on the rung being retried and resets
 *   when the team advances.
 */

import { RULES, character, synergiesForMode, DB } from './data.ts';
import type { Rng } from './rng.ts';
import { makeRng } from './rng.ts';
import type { CanonStatus, Character, Mode, Side } from './types.ts';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface Fighter {
  char: Character;
  down: boolean;
  /** Remaining uses of a once-per-run special, keyed by special.key. */
  uses: Record<string, number>;
}

export function makeFighter(id: string): Fighter {
  const char = character(id);
  const uses: Record<string, number> = {};
  if (char.special) {
    const declared = char.special.params.uses;
    if (typeof declared === 'number') uses[char.special.key] = declared;
    else uses[char.special.key] = Infinity;
  }
  return { char, down: false, uses };
}

export interface TeamState {
  side: Side;
  fighters: Fighter[];
  /** Flat score bonus (a ladder rung's rung_bonus). */
  flatBonus: number;
  /** Power lost to `loss_opponent_weaken`, and to Mahoraga for one round. */
  powerPenalty: number;
  label: string;
}

const living = (t: TeamState): Fighter[] => t.fighters.filter((f) => !f.down);

// ---------------------------------------------------------------------------
// Breakdown of one side's score
// ---------------------------------------------------------------------------

export interface FiredCounter {
  attacker_tag: string;
  defender_tag: string;
  bonus: number;
  upset_chance: number;
  canon_status: CanonStatus;
  explanation: string;
  /** Set when Yuta's Copy is what supplied the attacker tag. */
  copied?: boolean;
}

export interface FiredSynergy {
  id: string;
  label: string;
  bonus: number;
  canon_status: CanonStatus;
  explanation: string;
}

export interface DomainNote {
  rule: string;
  value: number;
  text: string;
}

export interface Breakdown {
  topPower: number;
  others: number;
  synergy: number;
  counters: number;
  domain: number;
  specials: number;
  blackFlash: number;
  rng: number;
  flat: number;
  total: number;
  firedCounters: FiredCounter[];
  firedSynergies: FiredSynergy[];
  domainNotes: DomainNote[];
  specialNotes: string[];
}

/** Random values drawn once per round, so a clutch special can be re-scored
 *  without re-rolling the dice underneath it. */
interface Draws {
  rngA: number;
  rngB: number;
  blackFlashA: boolean;
  blackFlashB: boolean;
  jackpotA: boolean;
  jackpotB: boolean;
  copyPickA: number;
  copyPickB: number;
}

/** Per-side modifiers a clutch special adds after the first scoring pass. */
interface Mods {
  bonus: number;
  /** Uro's Deflect: cancel the opponent's counter total. */
  denyOpponentCounters: boolean;
  jackpot: boolean;
}

const emptyMods = (): Mods => ({ bonus: 0, denyOpponentCounters: false, jackpot: false });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function gapFactor(memberPower: number, enemyTopPower: number): number {
  const w = RULES.gap_window;
  return clamp((memberPower - (enemyTopPower - w)) / w, 0, 1);
}

function tagsOf(team: TeamState, copied: string | null): string[] {
  const tags = new Set<string>();
  for (const f of living(team)) for (const t of f.char.tags) tags.add(t);
  if (copied) tags.add(copied);
  return [...tags];
}

/** The tag Yuta copies this round: one copyable counter tag the opponent has. */
function copyTarget(team: TeamState, foe: TeamState, pick: number): string | null {
  const yuta = living(team).find((f) => f.char.special?.key === 'copy');
  if (!yuta) return null;
  const copyable = (yuta.char.special!.params.copyable as string[]) ?? [];
  const foeTags = new Set(tagsOf(foe, null));
  const own = new Set(yuta.char.tags);
  const available = copyable.filter((t) => foeTags.has(t) && !own.has(t));
  if (available.length === 0) return null;
  return available[pick % available.length];
}

/** Conditions a counter's own `explanation` states, keyed `attacker>defender`.
 *  Nobara's Resonance "requires a body part": in canon she reached Sukuna
 *  through a finger she already had. Here that means the team has to have
 *  traded blows with this enemy first, so it fires on a retry, never on the
 *  opening exchange. */
const COUNTER_CONDITIONS: Record<string, (ctx: CounterContext) => boolean> = {
  'resonance>incarnated': (ctx) => ctx.enemyChipped,
};

export interface CounterContext {
  /** The team has already fought this exact enemy at least once. */
  enemyChipped: boolean;
}

function counterTotal(
  attackerTags: string[],
  defenderTags: string[],
  copiedTag: string | null,
  ctx: CounterContext,
): { total: number; fired: FiredCounter[] } {
  const defenders = new Set(defenderTags);
  const attackers = new Set(attackerTags);
  const fired: FiredCounter[] = [];
  let sum = 0;
  for (const c of DB.counters) {
    if (!attackers.has(c.attacker_tag) || !defenders.has(c.defender_tag)) continue;
    const condition = COUNTER_CONDITIONS[`${c.attacker_tag}>${c.defender_tag}`];
    if (condition && !condition(ctx)) continue;
    fired.push({ ...c, copied: copiedTag === c.attacker_tag ? true : undefined });
    sum += c.bonus;
  }
  return { total: Math.min(sum, RULES.counter_cap), fired };
}

function synergyTotal(team: TeamState, mode: Mode): { total: number; fired: FiredSynergy[] } {
  const ids = new Set(living(team).map((f) => f.char.id));
  const fired: FiredSynergy[] = [];
  let sum = 0;
  for (const s of synergiesForMode(mode === 'freestyle' ? 'freestyle' : 'gauntlet')) {
    if (s.must_include && !ids.has(s.must_include)) continue;
    const have = s.members.filter((m) => ids.has(m)).length;
    if (have < s.required) continue;
    fired.push({
      id: s.id,
      label: s.label,
      bonus: s.bonus,
      canon_status: s.canon_status,
      explanation: s.explanation,
    });
    sum += s.bonus;
  }
  return { total: clamp(sum, -RULES.synergy_cap, RULES.synergy_cap), fired };
}

interface DomainProfile {
  sureHit: boolean;
  /** Highest DOM among members who actually bring a sure-hit domain. */
  dom: number;
  /** 'closed' | 'open' among that side's sure-hit domains. */
  openDomain: boolean;
  antiDomain: boolean;
  strongAntiDomain: boolean;
  zeroCe: boolean;
  incompleteDomain: boolean;
}

function domainProfile(team: TeamState): DomainProfile {
  const alive = living(team);
  const sureHitters = alive.filter((f) => f.char.tags.includes('sure_hit_domain'));
  return {
    sureHit: sureHitters.length > 0,
    dom: sureHitters.reduce((max, f) => Math.max(max, f.char.stats.dom), 0),
    openDomain: sureHitters.some((f) => f.char.domain.type === 'open'),
    antiDomain: alive.some((f) => f.char.tags.includes('anti_domain')),
    strongAntiDomain: alive.some((f) => f.char.tags.includes('strong_anti_domain')),
    zeroCe: alive.some((f) => f.char.tags.includes('zero_ce')),
    incompleteDomain: alive.some((f) => f.char.tags.includes('incomplete_domain')),
  };
}

/** Returns the domain contribution to `attacker`'s score against `defender`. */
function domainScore(
  attacker: DomainProfile,
  defender: DomainProfile,
): { value: number; notes: DomainNote[] } {
  const notes: DomainNote[] = [];
  if (!attacker.sureHit) return { value: 0, notes };

  let value = 0;

  // domain_clash: refinement decides a clash of sure-hit domains.
  if (defender.sureHit && attacker.dom > defender.dom) {
    value += RULES.domain_clash_bonus;
    notes.push({
      rule: 'domain_clash',
      value: RULES.domain_clash_bonus,
      text: ruleText('domain_clash'),
    });
  }

  let pressure = attacker.dom / 10;
  const pressureNote = notes.length;
  notes.push({ rule: 'domain_pressure', value: pressure, text: ruleText('domain_pressure') });

  // Rule 1 lists three answers to a sure-hit domain: a domain of your own,
  // anti-domain technique, or zero cursed energy. An OPEN domain has no
  // barrier to shut out, so "Malevolent Shrine cuts everything in range":
  // zero CE stops mattering, and a domain of your own only contests it.
  const open = attacker.openDomain;

  if (defender.sureHit) {
    if (!open) {
      notes[pressureNote].value = 0;
      return { value, notes };
    }
    pressure /= 2;
    notes.push({
      rule: 'open_domain_exception',
      value: -pressure,
      text: ruleText('open_domain_exception'),
    });
  }
  if (defender.zeroCe) {
    if (open) {
      notes.push({
        rule: 'open_domain_exception',
        value: 0,
        text: ruleText('open_domain_exception'),
      });
    } else {
      notes.push({ rule: 'zero_ce_immunity', value: -pressure, text: ruleText('zero_ce_immunity') });
      return { value, notes };
    }
  }
  if (defender.strongAntiDomain) {
    notes.push({ rule: 'anti_domain', value: -pressure, text: ruleText('anti_domain') });
    return { value, notes };
  }
  if (defender.antiDomain || defender.incompleteDomain) {
    notes.push({ rule: 'anti_domain', value: -pressure / 2, text: ruleText('anti_domain') });
    pressure /= 2;
  }
  return { value: value + pressure, notes };
}

function ruleText(rule: string): string {
  return DB.domain_rules.find((r) => r.rule === rule)?.text ?? rule;
}

/** Flat bonuses from `special` fields that apply to the whole side. */
function specialBonuses(
  team: TeamState,
  foeTopPower: number,
  roundNumber: number,
  jackpot: boolean,
): { total: number; notes: string[] } {
  const notes: string[] = [];
  let total = 0;
  for (const f of living(team)) {
    const sp = f.char.special;
    if (!sp) continue;
    switch (sp.key) {
      case 'boogie_woogie': {
        if (living(team).length >= 2) {
          total += sp.params.bonus as number;
          notes.push(`${f.char.name}: Boogie Woogie (+${sp.params.bonus})`);
        }
        break;
      }
      case 'overtime': {
        if (roundNumber >= (sp.params.from_round as number)) {
          total += sp.params.bonus as number;
          notes.push(`${f.char.name}: Overtime (+${sp.params.bonus})`);
        }
        break;
      }
      case 'speech_strain': {
        const strained = foeTopPower - f.char.power >= 10;
        const bonus = strained
          ? (sp.params.weak_bonus as number)
          : (sp.params.strong_bonus as number);
        total += bonus;
        notes.push(
          strained
            ? `${f.char.name}: Cursed Speech strains his throat (+${bonus}, double fall risk)`
            : `${f.char.name}: Cursed Speech lands clean (+${bonus})`,
        );
        break;
      }
      case 'jackpot': {
        if (jackpot) {
          total += sp.params.bonus as number;
          notes.push(`${f.char.name}: JACKPOT — cannot fall this round (+${sp.params.bonus})`);
        }
        break;
      }
      default:
        break;
    }
  }
  return { total, notes };
}

function scoreSide(
  team: TeamState,
  foe: TeamState,
  mode: Mode,
  roundNumber: number,
  rngRoll: number,
  blackFlash: boolean,
  copiedTag: string | null,
  mods: Mods,
  foeDeniesCounters: boolean,
  ctx: CounterContext,
): Breakdown {
  const alive = living(team);
  const foeAlive = living(foe);
  const foeTopPower = foeAlive.reduce((m, f) => Math.max(m, f.char.power), 0) - foe.powerPenalty;

  const powers = alive.map((f) => f.char.power).sort((a, b) => b - a);
  const topPower = (powers[0] ?? 0) - team.powerPenalty;
  const others = powers
    .slice(1)
    .reduce((sum, p) => sum + p * gapFactor(p, foeTopPower), 0) * RULES.others_coef;

  const syn = synergyTotal(team, mode);
  const ctr = counterTotal(tagsOf(team, copiedTag), tagsOf(foe, null), copiedTag, ctx);
  const counters = foeDeniesCounters ? 0 : ctr.total;
  const dom = domainScore(domainProfile(team), domainProfile(foe));
  const sp = specialBonuses(team, foeTopPower, roundNumber, mods.jackpot);
  const bf = blackFlash ? RULES.black_flash_bonus : 0;

  const total =
    topPower +
    others +
    syn.total +
    counters +
    dom.value +
    sp.total +
    bf +
    rngRoll +
    team.flatBonus +
    mods.bonus;

  return {
    topPower,
    others,
    synergy: syn.total,
    counters,
    domain: dom.value,
    specials: sp.total + mods.bonus,
    blackFlash: bf,
    rng: rngRoll,
    flat: team.flatBonus,
    total,
    firedCounters: ctr.fired,
    firedSynergies: syn.fired,
    domainNotes: dom.notes,
    specialNotes: sp.notes,
  };
}

/**
 * Deterministic preview of a matchup: every roll zeroed, round 1, nobody
 * chipped. Used by the UI to explain a fight before it happens, and by the
 * tests to assert one rule at a time.
 */
export function explainMatchup(
  aIds: string[],
  bIds: string[],
  mode: Mode = 'freestyle',
  opts: { aFlat?: number; bFlat?: number; roundNumber?: number; chipped?: boolean } = {},
): { a: Breakdown; b: Breakdown } {
  const a: TeamState = {
    side: 'hero',
    fighters: aIds.map(makeFighter),
    flatBonus: opts.aFlat ?? 0,
    powerPenalty: 0,
    label: 'A',
  };
  const b: TeamState = {
    side: 'villain',
    fighters: bIds.map(makeFighter),
    flatBonus: opts.bFlat ?? 0,
    powerPenalty: 0,
    label: 'B',
  };
  const ctx = { enemyChipped: opts.chipped ?? false };
  const round = opts.roundNumber ?? 1;
  return {
    a: scoreSide(a, b, mode, round, 0, false, copyTarget(a, b, 0), emptyMods(), false, ctx),
    b: scoreSide(b, a, mode, round, 0, false, copyTarget(b, a, 0), emptyMods(), false, ctx),
  };
}

// ---------------------------------------------------------------------------
// Falls
// ---------------------------------------------------------------------------

/** `fall_weight`: (110 - power), halved for rct, x special fall_weight. */
export function fallWeight(f: Fighter, strainedSpeech: boolean): number {
  let w = 110 - f.char.power;
  if (f.char.tags.includes('rct')) w /= 2;
  const sp = f.char.special;
  if (sp && typeof sp.params.fall_weight === 'number') w *= sp.params.fall_weight;
  if (strainedSpeech && sp?.key === 'speech_strain') w *= 2;
  return Math.max(w, 0.01);
}

interface FallOutcome {
  fellId: string | null;
  notes: string[];
}

function chooseFaller(
  team: TeamState,
  foeTopPower: number,
  rng: Rng,
  jackpot: boolean,
): Fighter | null {
  const pool = living(team).filter((f) => !(jackpot && f.char.special?.key === 'jackpot'));
  if (pool.length === 0) return null;
  const weights = pool.map((f) =>
    fallWeight(f, f.char.special?.key === 'speech_strain' && foeTopPower - f.char.power >= 10),
  );
  return pool[rng.weighted(weights)];
}

/** Specials that stop a fall. Returns null when the fall is prevented. */
function applyFallPrevention(
  team: TeamState,
  faller: Fighter,
  rng: Rng,
): FallOutcome {
  const notes: string[] = [];
  const sp = faller.char.special;

  if (sp?.key === 'luck' && rng.chance(sp.params.chance as number)) {
    notes.push(`${faller.char.name} somehow survives. Again.`);
    return { fellId: null, notes };
  }
  if (sp?.key === 'spare_core' && (faller.uses[sp.key] ?? 0) > 0) {
    faller.uses[sp.key] -= 1;
    notes.push(`${faller.char.name} switches to his spare core and stays up.`);
    return { fellId: null, notes };
  }
  if (sp?.key === 'polymorph' && (faller.uses[sp.key] ?? 0) > 0) {
    faller.uses[sp.key] -= 1;
    notes.push(`${faller.char.name} reshapes himself instead of falling.`);
    return { fellId: null, notes };
  }
  const takaba = living(team).find(
    (f) => f.char.special?.key === 'comedian_shield' && (f.uses.comedian_shield ?? 0) > 0,
  );
  if (takaba) {
    takaba.uses.comedian_shield -= 1;
    notes.push(`${takaba.char.name} finds it funny, so it simply does not happen.`);
    return { fellId: null, notes };
  }

  faller.down = true;
  return { fellId: faller.char.id, notes };
}

// ---------------------------------------------------------------------------
// One round
// ---------------------------------------------------------------------------

export interface RoundResult {
  round: number;
  /** Ladder rung index, or -1 in freestyle. */
  rung: number;
  teamIds: string[];
  enemyIds: string[];
  enemyLabel: string;
  teamScore: number;
  enemyScore: number;
  margin: number;
  won: boolean;
  upset: boolean;
  /** Which side pulled the upset: 'team' flipped a loss into a win, 'enemy'
   *  flipped the team's win into a loss. */
  upsetSide: 'team' | 'enemy' | null;
  upsetReason: string | null;
  /** Everyone knocked out this round. Usually zero or one, but Yuki's Black
   *  Hole and Kashimo's Amber can add a second. */
  fellIds: string[];
  enemyFellIds: string[];
  narrowWin: boolean;
  notes: string[];
  team: Breakdown;
  enemy: Breakdown;
}

interface RoundOptions {
  mode: Mode;
  roundNumber: number;
  rung: number;
  /** Gauntlet rungs are replaced each round, so only the team takes
   *  narrow-win casualties. */
  enemyPersists: boolean;
  /** This enemy has already been fought once in this run. */
  enemyChipped: boolean;
  /** This team has already been fought once by this enemy. */
  teamChipped: boolean;
}

export function resolveRound(
  team: TeamState,
  enemy: TeamState,
  rng: Rng,
  opts: RoundOptions,
): RoundResult {
  const { mode, roundNumber } = opts;
  const range = RULES.rng_range;

  const draws: Draws = {
    rngA: rng.range(-range, range),
    rngB: rng.range(-range, range),
    blackFlashA:
      living(team).some((f) => f.char.tags.includes('black_flash')) &&
      rng.chance(RULES.black_flash_chance),
    blackFlashB:
      living(enemy).some((f) => f.char.tags.includes('black_flash')) &&
      rng.chance(RULES.black_flash_chance),
    jackpotA:
      living(team).some((f) => f.char.special?.key === 'jackpot') &&
      rng.chance(character('hakari').special!.params.chance as number),
    jackpotB:
      living(enemy).some((f) => f.char.special?.key === 'jackpot') &&
      rng.chance(character('hakari').special!.params.chance as number),
    copyPickA: rng.int(64),
    copyPickB: rng.int(64),
  };

  const copiedA = copyTarget(team, enemy, draws.copyPickA);
  const copiedB = copyTarget(enemy, team, draws.copyPickB);

  const modsA = emptyMods();
  const modsB = emptyMods();
  modsA.jackpot = draws.jackpotA;
  modsB.jackpot = draws.jackpotB;

  const notes: string[] = [];
  if (copiedA) notes.push(`Yuta copies ${copiedA.replace(/_/g, ' ')}.`);
  if (copiedB) notes.push(`The opposing Copy user takes ${copiedB.replace(/_/g, ' ')}.`);

  const score = () => {
    const a = scoreSide(
      team,
      enemy,
      mode,
      roundNumber,
      draws.rngA,
      draws.blackFlashA,
      copiedA,
      modsA,
      modsB.denyOpponentCounters,
      { enemyChipped: opts.enemyChipped },
    );
    const b = scoreSide(
      enemy,
      team,
      mode,
      roundNumber,
      draws.rngB,
      draws.blackFlashB,
      copiedB,
      modsB,
      modsA.denyOpponentCounters,
      { enemyChipped: opts.teamChipped },
    );
    return { a, b };
  };

  let { a, b } = score();

  // --- Clutch specials, spent by whichever side is behind -------------------
  const clutchPass = (
    self: TeamState,
    mods: Mods,
    foeMods: Mods,
    getSelf: () => Breakdown,
    getFoe: () => Breakdown,
    lastStand: boolean,
  ) => {
    const spend = (f: Fighter, key: string, bonus: number, always: boolean, note: string) => {
      if ((f.uses[key] ?? 0) <= 0) return false;
      const deficit = getFoe().total - getSelf().total;
      if (deficit <= 0) return false;
      if (!always && !(bonus > deficit || lastStand)) return false;
      f.uses[key] -= 1;
      mods.bonus += bonus;
      notes.push(note);
      ({ a, b } = score());
      return true;
    };

    for (const f of living(self)) {
      const sp = f.char.special;
      if (!sp) continue;
      const deficit = getFoe().total - getSelf().total;
      if (deficit <= 0) break;
      switch (sp.key) {
        case 'deflect': {
          if ((f.uses[sp.key] ?? 0) > 0 && getFoe().counters > 0 && deficit < getFoe().counters) {
            f.uses[sp.key] -= 1;
            foeMods.denyOpponentCounters = true;
            notes.push(`${f.char.name} peels the technique off the sky — counters cancelled.`);
            ({ a, b } = score());
          }
          break;
        }
        case 'mythical_beast_amber':
          // "First losing round": unconditional, not held for a flip.
          spend(
            f,
            sp.key,
            sp.params.bonus as number,
            true,
            `${f.char.name} burns his body out: Mythical Beast Amber (+${sp.params.bonus}).`,
          );
          break;
        case 'black_hole':
          spend(
            f,
            sp.key,
            sp.params.bonus as number,
            false,
            `${f.char.name} collapses the fight into a black hole (+${sp.params.bonus}).`,
          );
          break;
        case 'bird_strike':
          spend(
            f,
            sp.key,
            sp.params.bonus as number,
            false,
            `${f.char.name} calls in the whole flock (+${sp.params.bonus}).`,
          );
          break;
        case 'true_sphere':
          spend(
            f,
            sp.key,
            sp.params.bonus as number,
            false,
            `${f.char.name} forges the True Sphere (+${sp.params.bonus}).`,
          );
          break;
        case 'granite_blast':
          spend(
            f,
            sp.key,
            sp.params.bonus as number,
            false,
            `${f.char.name} fires Granite Blast (+${sp.params.bonus}).`,
          );
          break;
        default:
          break;
      }
    }
  };

  const teamLastStand = living(team).length === 1;
  const enemyLastStand = living(enemy).length === 1 && opts.enemyPersists;
  if (a.total < b.total) clutchPass(team, modsA, modsB, () => a, () => b, teamLastStand);
  else if (opts.enemyPersists) clutchPass(enemy, modsB, modsA, () => b, () => a, enemyLastStand);

  let won = a.total > b.total;
  let upset = false;
  let upsetSide: 'team' | 'enemy' | null = null;
  let upsetReason: string | null = null;

  // --- Mahoraga gambit ------------------------------------------------------
  let forcedFaller: Fighter | null = null;
  let mahoragaFired = false;
  if (!won) {
    const foeTop = living(enemy).reduce((m, f) => Math.max(m, f.char.power), 0);
    const prospective = chooseFaller(team, foeTop, rng, draws.jackpotA);
    if (prospective) {
      const sp = prospective.char.special;
      if (sp?.key === 'mahoraga_gambit' && rng.chance(sp.params.chance as number)) {
        mahoragaFired = true;
        enemy.powerPenalty += sp.params.opp_power_loss as number;
        ({ a, b } = score());
        notes.push(
          `${prospective.char.name} opens Chimera Shadow Garden and calls Mahoraga. ` +
            `The Divine General takes the enemy apart (-${sp.params.opp_power_loss} power) — ` +
            `and ${prospective.char.name} goes down doing it.`,
        );
        enemy.powerPenalty -= sp.params.opp_power_loss as number;
        won = a.total > b.total;
      }
      forcedFaller = prospective;
    }
  }

  // --- Upsets ---------------------------------------------------------------
  // Rolled last, so an upset is always the thing that decided the round: a side
  // flagged with the upset won it, full stop.
  // Each fired counter is its own chance to end the fight early, plus the flat
  // underdog roll once the gap reaches underdog_gap.
  const rollUpsets = (breakdown: Breakdown, deficit: number): string | null => {
    for (const c of breakdown.firedCounters) {
      if (c.upset_chance > 0 && rng.chance(c.upset_chance)) return `UPSET — ${c.explanation}`;
    }
    if (deficit >= RULES.underdog_gap && rng.chance(RULES.underdog_upset_chance)) {
      return 'UPSET — the underdog finds the one opening that exists.';
    }
    return null;
  };

  if (!won) {
    const reason = rollUpsets(a, b.total - a.total);
    if (reason) {
      won = true;
      upset = true;
      upsetSide = 'team';
      upsetReason = reason;
      notes.push(reason);
    }
  } else {
    const reason = rollUpsets(b, a.total - b.total);
    if (reason) {
      won = false;
      upset = true;
      upsetSide = 'enemy';
      upsetReason = reason;
      notes.push(reason);
    }
  }

  // --- Falls ----------------------------------------------------------------
  const margin = a.total - b.total;
  const fellIds: string[] = [];
  const enemyFellIds: string[] = [];
  let narrowWin = false;

  if (!won) {
    const faller = forcedFaller;
    if (faller) {
      if (mahoragaFired) {
        // "Megumi still falls" — the gambit is not a survival roll.
        faller.down = true;
        fellIds.push(faller.char.id);
      } else {
        const out = applyFallPrevention(team, faller, rng);
        if (out.fellId) fellIds.push(out.fellId);
        notes.push(...out.notes);
      }
    }
    enemy.powerPenalty += RULES.loss_opponent_weaken;
  } else {
    if (mahoragaFired && forcedFaller) {
      forcedFaller.down = true;
      fellIds.push(forcedFaller.char.id);
    }
    if (Math.abs(margin) <= RULES.narrow_win_margin) {
      narrowWin = true;
      if (fellIds.length === 0 && rng.chance(RULES.narrow_win_fall_chance)) {
        const foeTop = living(enemy).reduce((m, f) => Math.max(m, f.char.power), 0);
        const faller = chooseFaller(team, foeTop, rng, draws.jackpotA);
        if (faller) {
          const out = applyFallPrevention(team, faller, rng);
          notes.push(...out.notes);
          if (out.fellId) {
            fellIds.push(out.fellId);
            notes.push('They take the rung, but it costs them somebody.');
          }
        }
      }
    }
    if (opts.enemyPersists) {
      team.powerPenalty += RULES.loss_opponent_weaken;
      const enemyFaller = chooseFaller(
        enemy,
        living(team).reduce((m, f) => Math.max(m, f.char.power), 0),
        rng,
        draws.jackpotB,
      );
      if (enemyFaller) {
        const out = applyFallPrevention(enemy, enemyFaller, rng);
        if (out.fellId) enemyFellIds.push(out.fellId);
        notes.push(...out.notes);
      }
    }
  }

  // Yuki's Black Hole and Kashimo's Amber take their user with them.
  for (const t of [team, enemy]) {
    for (const f of living(t)) {
      const key = f.char.special?.key;
      if ((key === 'black_hole' || key === 'mythical_beast_amber') && f.uses[key] === 0) {
        f.down = true;
        f.uses[key] = -1;
        (t === team ? fellIds : enemyFellIds).push(f.char.id);
        notes.push(`${f.char.name}'s body gives out after the move.`);
      }
    }
  }

  return {
    round: roundNumber,
    rung: opts.rung,
    teamIds: team.fighters
      .filter((f) => !f.down || fellIds.includes(f.char.id))
      .map((f) => f.char.id),
    enemyIds: enemy.fighters.map((f) => f.char.id),
    enemyLabel: enemy.label,
    teamScore: round2(a.total),
    enemyScore: round2(b.total),
    margin: round2(margin),
    won,
    upset,
    upsetSide,
    upsetReason,
    fellIds,
    enemyFellIds,
    narrowWin,
    notes,
    team: roundBreakdown(a),
    enemy: roundBreakdown(b),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function roundBreakdown(b: Breakdown): Breakdown {
  return {
    ...b,
    topPower: round2(b.topPower),
    others: round2(b.others),
    domain: round2(b.domain),
    rng: round2(b.rng),
    total: round2(b.total),
  };
}

// ---------------------------------------------------------------------------
// A full gauntlet run
// ---------------------------------------------------------------------------

export interface RunResult {
  seed: string;
  mode: Mode;
  side: Side;
  teamIds: string[];
  rounds: RoundResult[];
  rungsCleared: number;
  fullClear: boolean;
  record: string;
  rankTitle: string;
  mvpId: string | null;
  survivorIds: string[];
  xp: number;
  hype: boolean;
  upsets: number;
}

export function runGauntlet(
  seed: string,
  side: Side,
  teamIds: string[],
  mode: Mode = 'gauntlet',
): RunResult {
  const rng = makeRng(`${seed}:fight:${teamIds.join(',')}`);
  const ladder = DB.ladders[side];
  const team: TeamState = {
    side,
    fighters: teamIds.map(makeFighter),
    flatBonus: 0,
    powerPenalty: 0,
    label: 'Your team',
  };

  const rounds: RoundResult[] = [];
  let rung = 0;
  let roundNumber = 1;

  while (rung < ladder.rungs.length && living(team).length > 0) {
    const enemyChar = character(ladder.rungs[rung]);
    const enemy: TeamState = {
      side: side === 'hero' ? 'villain' : 'hero',
      fighters: [makeFighter(enemyChar.id)],
      flatBonus: ladder.rung_bonus[rung],
      powerPenalty: 0,
      label: enemyChar.name,
    };
    // Weakening carries across retries of the same rung only.
    const retries = rounds.filter((r) => r.rung === rung && !r.won).length;
    enemy.powerPenalty = retries * RULES.loss_opponent_weaken;

    const result = resolveRound(team, enemy, rng, {
      mode,
      roundNumber,
      rung,
      enemyPersists: false,
      enemyChipped: retries > 0,
      teamChipped: rounds.length > 0,
    });
    rounds.push(result);
    roundNumber += 1;
    if (result.won) rung += 1;
    // A lost round that nobody fell for (Takaba, Panda, Haruta) still costs a
    // retry; without a guard a shielded team could loop forever.
    if (roundNumber > 40) break;
  }

  const rungsCleared = rung;
  const fullClear = rungsCleared >= ladder.rungs.length;
  const survivors = living(team).map((f) => f.char.id);
  const xp =
    rungsCleared * DB.progression.xp_per_round_cleared +
    (fullClear ? DB.progression.xp_full_clear_bonus : 0);

  return {
    seed,
    mode,
    side,
    teamIds,
    rounds,
    rungsCleared,
    fullClear,
    record: `${rungsCleared}/${ladder.rungs.length}`,
    rankTitle: DB.rank_titles[side][Math.min(rungsCleared, DB.rank_titles[side].length - 1)],
    mvpId: pickMvp(teamIds, rounds),
    survivorIds: survivors,
    xp,
    hype: isHype(teamIds, rounds, mode),
    // Only upsets the team pulled off — the card's UPSET stamp is a boast.
    upsets: rounds.filter((r) => r.upset && r.upsetSide === 'team').length,
  };
}

/** MVP: who was on the mat when it mattered. */
export function pickMvp(teamIds: string[], rounds: RoundResult[]): string | null {
  if (teamIds.length === 0) return null;
  const score = new Map<string, number>(teamIds.map((id) => [id, 0]));
  for (const r of rounds) {
    for (const id of r.teamIds) {
      if (!score.has(id)) continue;
      let pts = r.won ? 2 : 0.5;
      if (r.won && r.upset) pts += 3;
      if (r.won && r.narrowWin) pts += 1;
      score.set(id, (score.get(id) ?? 0) + pts);
    }
    if (r.won) for (const id of r.fellIds) score.set(id, (score.get(id) ?? 0) + 2);
  }
  let best: string | null = null;
  let bestVal = -Infinity;
  for (const id of teamIds) {
    const v = (score.get(id) ?? 0) + character(id).power / 1000;
    if (v > bestVal) {
      bestVal = v;
      best = id;
    }
  }
  return best;
}

function isHype(teamIds: string[], rounds: RoundResult[], mode: Mode): boolean {
  if (teamIds.some((id) => character(id).rarity === 'legendary')) return true;
  if (rounds.some((r) => r.won && Math.abs(r.margin) <= 2)) return true;
  const synergies = synergiesForMode(mode === 'freestyle' ? 'freestyle' : 'gauntlet');
  const ids = new Set(teamIds);
  return synergies.some(
    (s) =>
      s.bonus < 0 &&
      s.members.filter((m) => ids.has(m)).length >= s.required &&
      (!s.must_include || ids.has(s.must_include)),
  );
}

// ---------------------------------------------------------------------------
// Freestyle: two teams, rounds until one side is wiped out
// ---------------------------------------------------------------------------

export interface FreestyleResult {
  seed: string;
  mode: 'freestyle';
  aIds: string[];
  bIds: string[];
  rounds: RoundResult[];
  winner: 'a' | 'b';
  aSurvivors: string[];
  bSurvivors: string[];
  mvpId: string | null;
  upsets: number;
  hype: boolean;
}

export function runFreestyle(seed: string, aIds: string[], bIds: string[]): FreestyleResult {
  const rng = makeRng(`${seed}:freestyle:${aIds.join(',')}|${bIds.join(',')}`);
  const label = (ids: string[]) => ids.map((id) => character(id).name).join(' & ');
  const a: TeamState = {
    side: 'hero',
    fighters: aIds.map(makeFighter),
    flatBonus: 0,
    powerPenalty: 0,
    label: label(aIds),
  };
  const b: TeamState = {
    side: 'villain',
    fighters: bIds.map(makeFighter),
    flatBonus: 0,
    powerPenalty: 0,
    label: label(bIds),
  };

  const rounds: RoundResult[] = [];
  let roundNumber = 1;
  while (living(a).length > 0 && living(b).length > 0 && roundNumber <= 20) {
    rounds.push(
      resolveRound(a, b, rng, {
        mode: 'freestyle',
        roundNumber,
        rung: -1,
        enemyPersists: true,
        enemyChipped: roundNumber > 1,
        teamChipped: roundNumber > 1,
      }),
    );
    roundNumber += 1;
  }

  const aAlive = living(a).length;
  const bAlive = living(b).length;
  const winner: 'a' | 'b' =
    aAlive === bAlive
      ? rounds.filter((r) => r.won).length >= Math.ceil(rounds.length / 2)
        ? 'a'
        : 'b'
      : aAlive > bAlive
        ? 'a'
        : 'b';

  return {
    seed,
    mode: 'freestyle',
    aIds,
    bIds,
    rounds,
    winner,
    aSurvivors: living(a).map((f) => f.char.id),
    bSurvivors: living(b).map((f) => f.char.id),
    mvpId: pickMvp(winner === 'a' ? aIds : bIds, winner === 'a' ? rounds : rounds.map(flip)),
    upsets: rounds.filter((r) => r.upset).length,
    hype: isHype([...aIds, ...bIds], rounds, 'freestyle'),
  };
}

function flip(r: RoundResult): RoundResult {
  return {
    ...r,
    teamIds: r.enemyIds,
    enemyIds: r.teamIds,
    won: !r.won,
    upsetSide: r.upsetSide === 'team' ? 'enemy' : r.upsetSide === 'enemy' ? 'team' : null,
    fellIds: r.enemyFellIds,
    enemyFellIds: r.fellIds,
    margin: -r.margin,
    teamScore: r.enemyScore,
    enemyScore: r.teamScore,
    team: r.enemy,
    enemy: r.team,
  };
}
