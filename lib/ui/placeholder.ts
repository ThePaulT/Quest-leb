/**
 * Placeholder imagery.
 *
 * Real photography does not exist yet. Rather than grey boxes, quests get a
 * cement-tile pattern drawn from the palette — the geometry the design
 * references, and honest about being a placeholder rather than pretending to be
 * a photograph of the site.
 *
 * Deterministic on slug so a quest keeps the same tile between renders.
 */
const TILES = [
  '/placeholder/tile-pine.svg',
  '/placeholder/tile-terracotta.svg',
  '/placeholder/tile-sea.svg',
] as const;

export function placeholderFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TILES[hash % TILES.length];
}
