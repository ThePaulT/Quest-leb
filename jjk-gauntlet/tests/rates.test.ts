/**
 * Calibration. These three rates are the spec the engine was tuned against:
 *
 *   Yuji / Megumi / Nobara full clear   ~7%
 *   Yuji / Yuta / Maki full clear       ~23%
 *   Toji beats Gojo                     ~32%
 *
 * They are the reason for three readings the DB leaves open, each marked in
 * lib/engine.ts: `rng_range` as a symmetric +/-12 roll, an open domain's
 * pressure landing even on a side that brought a domain of its own, and
 * Resonance needing a body part before it counters an incarnation.
 *
 * Every run here is seeded, so this file is deterministic: it fails on an
 * engine change, not on luck.
 */

import { describe, expect, it } from 'vitest';

import { simulateFreestyle, simulateGauntlet } from '@/lib/sim.ts';

const RUNS = 4000;

describe('calibration rates', () => {
  it('Yuji / Megumi / Nobara clear the Hero Gauntlet about 7% of the time', () => {
    const { fullClearPct } = simulateGauntlet('calib-a', 'hero', ['yuji', 'megumi', 'nobara'], RUNS);
    expect(fullClearPct).toBeGreaterThan(4);
    expect(fullClearPct).toBeLessThan(12);
  });

  it('Yuji / Yuta / Maki clear it about 23% of the time', () => {
    const { fullClearPct } = simulateGauntlet('calib-b', 'hero', ['yuji', 'yuta', 'maki'], RUNS);
    expect(fullClearPct).toBeGreaterThan(15);
    expect(fullClearPct).toBeLessThan(30);
  });

  it('Toji beats Gojo about 32% of the time', () => {
    const { aWinPct } = simulateFreestyle('calib-c', ['toji'], ['gojo'], RUNS);
    expect(aWinPct).toBeGreaterThan(26);
    expect(aWinPct).toBeLessThan(40);
  });

  it('ranks the two hero trios in the right order, by a wide margin', () => {
    const weak = simulateGauntlet('calib-d', 'hero', ['yuji', 'megumi', 'nobara'], RUNS);
    const strong = simulateGauntlet('calib-d', 'hero', ['yuji', 'yuta', 'maki'], RUNS);
    expect(strong.fullClearPct).toBeGreaterThan(weak.fullClearPct * 1.8);
    expect(strong.avgRungs).toBeGreaterThan(weak.avgRungs);
  });

  it('keeps the final boss the hardest rung on both ladders', () => {
    for (const [side, team] of [
      ['hero', ['yuji', 'yuta', 'gojo']],
      ['villain', ['sukuna', 'kenjaku', 'mahito']],
    ] as const) {
      const { fullClearPct, avgRungs } = simulateGauntlet('calib-e', side, [...team], 1500);
      expect(avgRungs).toBeGreaterThan(3);
      expect(fullClearPct).toBeLessThan(95);
      expect(fullClearPct).toBeGreaterThan(5);
    }
  });

  it('never makes a weaker duplicate team beat a stronger one on average', () => {
    const strong = simulateFreestyle('calib-f', ['gojo'], ['miwa'], 500);
    expect(strong.aWinPct).toBeGreaterThan(95);
    const weak = simulateFreestyle('calib-g', ['haruta'], ['sukuna'], 500);
    expect(weak.aWinPct).toBeLessThan(5);
  });
});
