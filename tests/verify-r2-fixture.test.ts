import { describe, expect, it } from 'vitest';

import { buildVerificationWebp, isStructurallyValidWebp } from '@/scripts/verify-r2';

/**
 * scripts/verify-r2.ts cannot be run in CI — it needs real R2 credentials. The
 * fixture it uploads can be tested here, so a malformed fixture is caught
 * before someone runs the script against a live bucket and gets a confusing
 * failure.
 */
describe('verification WebP fixture', () => {
  it('is a structurally valid WebP', () => {
    expect(isStructurallyValidWebp(buildVerificationWebp())).toBe(true);
  });

  it('reaches roughly the requested size', () => {
    const photo = buildVerificationWebp(120 * 1024);
    expect(photo.length).toBeGreaterThanOrEqual(120 * 1024 - 2);
    expect(photo.length).toBeLessThanOrEqual(120 * 1024 + 2);
  });

  it('still starts with the 1x1 VP8L image chunk', () => {
    const photo = buildVerificationWebp();
    expect(photo.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(photo.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(photo.subarray(12, 16).toString('ascii')).toBe('VP8L');
    expect(photo[20]).toBe(0x2f); // VP8L signature byte
  });

  it('declares a RIFF length matching the real file length', () => {
    const photo = buildVerificationWebp(64 * 1024);
    expect(photo.readUInt32LE(4)).toBe(photo.length - 8);
  });

  it.each([16 * 1024, 64 * 1024, 200 * 1024])(
    'stays valid at %i bytes',
    (size) => {
      expect(isStructurallyValidWebp(buildVerificationWebp(size))).toBe(true);
    },
  );

  it('passes the same magic-byte check the API route applies', () => {
    // Keep the fixture honest: it must look like a WebP to the route too.
    const photo = buildVerificationWebp();
    expect(photo.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(photo.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  it('rejects a truncated or non-WebP buffer', () => {
    expect(isStructurallyValidWebp(Buffer.alloc(4))).toBe(false);
    expect(isStructurallyValidWebp(Buffer.from('not an image at all'))).toBe(false);
    const good = buildVerificationWebp(16 * 1024);
    expect(isStructurallyValidWebp(good.subarray(0, good.length - 10))).toBe(false);
  });
});
