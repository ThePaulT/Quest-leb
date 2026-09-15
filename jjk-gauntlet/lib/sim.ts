/** Monte Carlo over the seeded engine: the numbers shown before a Freestyle
 *  fight come from running the real engine, not from a formula. */

import { runFreestyle, runGauntlet } from './engine.ts';
import type { Side } from './types.ts';

export interface WinOdds {
  fights: number;
  aWins: number;
  bWins: number;
  aWinPct: number;
  upsetRate: number;
  /** Median surviving members on the winning side. */
  avgSurvivors: number;
}

export function simulateFreestyle(
  seed: string,
  aIds: string[],
  bIds: string[],
  fights = 2000,
): WinOdds {
  let aWins = 0;
  let upsets = 0;
  let survivors = 0;
  for (let i = 0; i < fights; i += 1) {
    const r = runFreestyle(`${seed}#${i}`, aIds, bIds);
    if (r.winner === 'a') aWins += 1;
    if (r.upsets > 0) upsets += 1;
    survivors += (r.winner === 'a' ? r.aSurvivors : r.bSurvivors).length;
  }
  return {
    fights,
    aWins,
    bWins: fights - aWins,
    aWinPct: (aWins / fights) * 100,
    upsetRate: (upsets / fights) * 100,
    avgSurvivors: survivors / fights,
  };
}

export interface ClearOdds {
  runs: number;
  fullClears: number;
  fullClearPct: number;
  avgRungs: number;
}

export function simulateGauntlet(
  seed: string,
  side: Side,
  teamIds: string[],
  runs = 2000,
): ClearOdds {
  let clears = 0;
  let rungs = 0;
  for (let i = 0; i < runs; i += 1) {
    const r = runGauntlet(`${seed}#${i}`, side, teamIds);
    if (r.fullClear) clears += 1;
    rungs += r.rungsCleared;
  }
  return {
    runs,
    fullClears: clears,
    fullClearPct: (clears / runs) * 100,
    avgRungs: rungs / runs,
  };
}
