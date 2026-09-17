import { describe, expect, it } from 'vitest';

import { MAX_LONG_EDGE, fitWithin } from '@/lib/photo';

/**
 * The encoder needs a browser, but the sizing rule is pure arithmetic and is
 * the part that decides whether a 12MP phone photo lands inside the budget.
 */
describe('fitWithin', () => {
  it('leaves a photo already within the limit untouched', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('caps the long edge of a landscape photo', () => {
    const { width, height } = fitWithin(4032, 3024);
    expect(width).toBe(MAX_LONG_EDGE);
    expect(height).toBe(900);
  });

  it('caps the long edge of a portrait photo', () => {
    const { width, height } = fitWithin(3024, 4032);
    expect(height).toBe(MAX_LONG_EDGE);
    expect(width).toBe(900);
  });

  it('preserves aspect ratio within a pixel', () => {
    const source = { w: 4000, h: 2250 };
    const { width, height } = fitWithin(source.w, source.h);
    expect(Math.abs(width / height - source.w / source.h)).toBeLessThan(0.01);
  });

  it('never returns a zero dimension for an extreme panorama', () => {
    const { width, height } = fitWithin(10000, 3);
    expect(width).toBe(MAX_LONG_EDGE);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it('never enlarges a small photo', () => {
    expect(fitWithin(100, 50)).toEqual({ width: 100, height: 50 });
  });
});
