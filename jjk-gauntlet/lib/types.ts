// Shapes of jjk_gauntlet_db.json. The JSON is the source of truth: nothing in
// the engine hardcodes a character, a counter, or a ladder.

export type Side = 'hero' | 'villain';

export type CanonStatus =
  | 'canon'
  | 'inferred'
  | 'fanbook'
  | 'fan_theory'
  | 'game_mechanic';

export type Mode = 'gauntlet' | 'freestyle' | 'daily';

export interface Stats {
  ce: number;
  phy: number;
  tec: number;
  dom: number;
}

export interface CharacterDomain {
  name: string | null;
  type: 'closed' | 'open' | 'incomplete' | 'none';
  sure_hit: string | null;
  canon_status: CanonStatus | null;
}

export interface Special {
  key: string;
  description: string;
  params: Record<string, number | string[]>;
}

export interface Character {
  id: string;
  name: string;
  side: Side;
  power: number;
  stats: Stats;
  role: string;
  draft_groups: string[];
  tags: string[];
  peak_version: string;
  techniques: string[];
  domain: CharacterDomain;
  special: Special | null;
  rarity: 'common' | 'rare' | 'legendary';
  canon_grade: string;
  story_hook: string;
  notes: string;
  tier: string;
}

export interface DraftGroup {
  side: Side;
  label: string;
}

export interface Counter {
  attacker_tag: string;
  defender_tag: string;
  bonus: number;
  upset_chance: number;
  canon_status: CanonStatus;
  explanation: string;
}

export interface DomainRule {
  rule: string;
  canon_status: CanonStatus;
  text: string;
}

export interface Synergy {
  id: string;
  label: string;
  members: string[];
  required: number;
  bonus: number;
  must_include: string | null;
  scope: 'gauntlet' | 'freestyle';
  canon_status: CanonStatus;
  explanation: string;
}

export interface Ladder {
  label: string;
  final_boss: string;
  rungs: string[];
  rung_bonus: number[];
}

export interface Rules {
  draft_rounds: number;
  options_per_round: number;
  rerolls_per_run: number;
  legendary_roll_chance: number;
  team_formula: string;
  others_coef: number;
  gap_window: number;
  gap_factor: string;
  synergy_cap: number;
  counter_cap: number;
  domain_clash_bonus: number;
  rng_range: number;
  underdog_upset_chance: number;
  underdog_gap: number;
  black_flash_chance: number;
  black_flash_bonus: number;
  narrow_win_margin: number;
  narrow_win_fall_chance: number;
  loss_opponent_weaken: number;
  fall_weight: string;
  ai_role: string;
}

export interface Progression {
  type: string;
  note: string;
  xp_per_round_cleared: number;
  xp_full_clear_bonus: number;
  levels: number[];
}

export interface GauntletDB {
  name: string;
  version: string;
  updated: string;
  scope: string;
  canon_status_legend: Record<string, string>;
  tier_bands: Record<string, string>;
  characters: Character[];
  draft_groups: Record<string, DraftGroup>;
  counters: Counter[];
  domain_rules: DomainRule[];
  synergies: Synergy[];
  ladders: Record<Side, Ladder>;
  rank_titles: Record<Side, string[]>;
  rules: Rules;
  progression: Progression;
}
