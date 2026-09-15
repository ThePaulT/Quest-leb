import type { QuestRegion } from '@/lib/types';

/**
 * Pin styling by region.
 *
 * Five regions, and the palette offers three colours that can carry a pin —
 * ink, primary and sea. Sand reads as "inactive" and terracotta is reserved:
 * the design allows ONE accent element per screen, which on the map is the
 * SELECTED pin, not a whole region's worth of them.
 *
 * So region is encoded as colour plus fill: filled and hollow double the
 * vocabulary to six without borrowing a seventh colour. Hollow pairs sit in the
 * same colour family as their filled partner, which keeps the map legible at a
 * glance — north reads as "mountain, like Mount Lebanon", bekaa as "inland".
 *
 * Diamonds, not circles: a rotated square has no border radius, so it stays
 * inside the design rules, and it echoes the cement-tile geometry the whole
 * design references.
 */
export interface RegionPinStyle {
  /** A palette token name, resolved to a CSS variable by the marker. */
  color: 'ink' | 'primary' | 'sea';
  fill: 'solid' | 'hollow';
}

export const REGION_PIN: Record<QuestRegion, RegionPinStyle> = {
  beirut: { color: 'ink', fill: 'solid' },
  mount_lebanon: { color: 'primary', fill: 'solid' },
  north: { color: 'primary', fill: 'hollow' },
  south: { color: 'sea', fill: 'solid' },
  bekaa: { color: 'sea', fill: 'hollow' },
};

export const PALETTE = {
  base: '#F4F0E8',
  ink: '#1C1C1A',
  primary: '#0F4C3A',
  accent: '#C4552E',
  sand: '#D9CBB3',
  sea: '#2E5E6E',
} as const;

export const REGIONS: QuestRegion[] = [
  'beirut',
  'mount_lebanon',
  'north',
  'south',
  'bekaa',
];
