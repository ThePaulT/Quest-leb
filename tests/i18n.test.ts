import { describe, expect, it } from 'vitest';

import { arDictionary, enDictionary, rejectionMessage, type Dictionary } from '@/lib/i18n';

/**
 * Arabic is first-class, so it cannot silently fall behind English. These
 * tests fail the moment a string is added to one dictionary and not the other.
 */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('dictionaries', () => {
  it('have identical key sets', () => {
    expect(keyPaths(enDictionary).sort()).toEqual(keyPaths(arDictionary).sort());
  });

  it.each([
    ['en', enDictionary],
    ['ar', arDictionary],
  ] as const)('%s has no empty strings', (_locale, dict: Dictionary) => {
    const empties: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string' && value.trim() === '') empties.push(path);
      else if (typeof value === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(dict, '');
    expect(empties).toEqual([]);
  });

  it('writes Arabic in Arabic script, not transliteration', () => {
    // Spot-check prose rather than every key: some values are deliberately
    // Latin (an email placeholder, the link offering the other language).
    for (const value of [
      arDictionary.quest.story,
      arDictionary.submit.accuracyPoor,
      arDictionary.success.flaggedBody,
      arDictionary.auth.intro,
    ]) {
      expect(value).toMatch(/[؀-ۿ]/);
    }
  });
});

describe('rejection messages', () => {
  /**
   * Every reason string the API can return. Kept here deliberately: if a route
   * or validator gains a new failure, this list and the catalogue must both
   * grow, or a visitor sees a generic apology instead of an explanation.
   */
  const REASONS_THE_SERVER_CAN_RETURN = [
    'auth.unauthorized',
    'request.malformed_multipart',
    'request.missing_quest_id',
    'request.missing_position',
    'request.invalid_position',
    'request.missing_photo',
    'photo.too_large',
    'photo.not_webp',
    'quest.not_found',
    'completion.already_verified',
    'storage.upload_failed',
    'proof.missing_photo',
    'proof.gps_too_inaccurate',
    'proof.outside_geofence',
    'not_implemented',
  ];

  it.each(REASONS_THE_SERVER_CAN_RETURN)('%s has a message in both languages', (reason) => {
    expect(enDictionary.rejection[reason]).toBeTruthy();
    expect(arDictionary.rejection[reason]).toBeTruthy();
  });

  it('never shows a raw key for an unknown reason', () => {
    const message = rejectionMessage('en', 'something.new.and.unmapped');
    expect(message).not.toContain('something.new');
    expect(message.length).toBeGreaterThan(10);
  });

  it('falls back in Arabic too', () => {
    expect(rejectionMessage('ar', null)).toMatch(/[؀-ۿ]/);
  });
});
