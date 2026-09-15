import { describe, expect, it } from 'vitest';

import { UNVERIFIED_MARKER, questSeeds } from '@/supabase/seed/quests';

/**
 * The seed coordinates have NOT been checked against OpenStreetMap — the
 * sandbox this was built in cannot reach Nominatim. These are the cheap
 * structural guards that catch a transposed or fat-fingered pin; they are not a
 * substitute for someone looking at the map.
 *
 * Lebanon's bounding box, generously padded.
 */
const LEBANON = { minLat: 33.03, maxLat: 34.72, minLng: 35.08, maxLng: 36.65 };

describe('quest seeds', () => {
  it('has the ten quests the prototype ships with', () => {
    expect(questSeeds).toHaveLength(10);
  });

  it('has unique slugs', () => {
    const slugs = questSeeds.map((q) => q.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(questSeeds)('$slug sits inside Lebanon', (quest) => {
    expect(quest.lat).toBeGreaterThanOrEqual(LEBANON.minLat);
    expect(quest.lat).toBeLessThanOrEqual(LEBANON.maxLat);
    expect(quest.lng).toBeGreaterThanOrEqual(LEBANON.minLng);
    expect(quest.lng).toBeLessThanOrEqual(LEBANON.maxLng);
  });

  it.each(questSeeds)('$slug has a radius the database will accept', (quest) => {
    expect(quest.geofenceRadiusM).toBeGreaterThanOrEqual(10);
    expect(quest.geofenceRadiusM).toBeLessThanOrEqual(5000);
  });

  it.each(questSeeds)('$slug has both languages filled in', (quest) => {
    expect(quest.titleEn.trim()).not.toBe('');
    expect(quest.titleAr.trim()).not.toBe('');
    expect(quest.summaryEn.trim()).not.toBe('');
    expect(quest.summaryAr.trim()).not.toBe('');
    expect(quest.proofHintEn.trim()).not.toBe('');
    expect(quest.proofHintAr.trim()).not.toBe('');
  });

  it.each(questSeeds)('$slug has a story in both languages', (quest) => {
    const words = (quest.storyEn ?? '').trim().split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(80);
    expect(words).toBeLessThanOrEqual(120);
    // A translation, not a transliteration: the Arabic must be Arabic script.
    expect(quest.storyAr).toMatch(/[\u0600-\u06FF]/);
  });

  it.each(questSeeds)('$slug safety notes still carry the UNVERIFIED marker', (quest) => {
    // The marker is the whole point: it must survive until a human has checked
    // the terrain, the access road and the opening hours on the ground.
    expect(quest.safetyNotesEn).not.toBeNull();
    expect(quest.safetyNotesEn?.startsWith(UNVERIFIED_MARKER)).toBe(true);
  });

  it('leaves Arabic safety notes empty, which keeps the activation gate shut', () => {
    // quests_safety_notes_required_when_active needs BOTH languages, so no
    // quest can be activated while these are null — correct while the English
    // notes are themselves unverified.
    for (const quest of questSeeds) {
      expect(quest.safetyNotesAr).toBeNull();
    }
  });

  it('ships no quest whose validator is a stub', () => {
    // qr_scan rejects everything as not_implemented, so a quest using it can
    // never be completed. The module stays registered for a future partner
    // integration; the seed just must not reference it.
    expect(questSeeds.filter((q) => q.proofType === 'qr_scan')).toEqual([]);
  });

  it('does not place two quests on the same pin', () => {
    const pins = questSeeds.map((q) => `${q.lat},${q.lng}`);
    expect(new Set(pins).size).toBe(pins.length);
  });
});
