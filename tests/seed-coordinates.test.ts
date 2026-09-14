import { describe, expect, it } from 'vitest';

import { questSeeds } from '@/supabase/seed/quests';

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

  it('leaves story and safety notes as stubs, so nothing can be activated yet', () => {
    for (const quest of questSeeds) {
      expect(quest.storyEn).toBeNull();
      expect(quest.safetyNotesEn).toBeNull();
      expect(quest.safetyNotesAr).toBeNull();
    }
  });

  it('does not place two quests on the same pin', () => {
    const pins = questSeeds.map((q) => `${q.lat},${q.lng}`);
    expect(new Set(pins).size).toBe(pins.length);
  });
});
