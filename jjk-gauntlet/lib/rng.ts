/** Seeded RNG. Every run replays identically from its seed string. */

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i += 1) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  /** n distinct items, sampled without replacement. */
  sample<T>(items: readonly T[], n: number): T[];
  /** Index into weights, proportional to each weight. */
  weighted(weights: readonly number[]): number;
}

export function makeRng(seed: string): Rng {
  const [a, b, c, d] = cyrb128(seed);
  let s0 = a;
  let s1 = b;
  let s2 = c;
  let s3 = d;

  // sfc32
  const next = (): number => {
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    let t = (s0 + s1) | 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) | 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s3 = (s3 + 1) | 0;
    t = (t + s3) | 0;
    s2 = (s2 + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)],
    sample: (items, n) => {
      const copy = items.slice();
      const out: typeof copy = [];
      const take = Math.min(n, copy.length);
      for (let i = 0; i < take; i += 1) {
        out.push(...copy.splice(Math.floor(next() * copy.length), 1));
      }
      return out;
    },
    weighted: (weights) => {
      const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
      if (total <= 0) return 0;
      let roll = next() * total;
      for (let i = 0; i < weights.length; i += 1) {
        roll -= Math.max(0, weights[i]);
        if (roll <= 0) return i;
      }
      return weights.length - 1;
    },
  };
  return rng;
}

/** A short, shareable seed. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomSeed(length = 8): string {
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
