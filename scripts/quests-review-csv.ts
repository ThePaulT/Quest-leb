/**
 * Regenerates content/quests-review.csv from the seed.
 *
 *   npm run content:review
 *
 * One row per quest with a Google Maps link, so the pins can be eyeballed
 * against satellite imagery without opening the app or the database. The
 * coordinates are only verified to town level; this file is how that gets
 * fixed.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { questSeeds } from '../supabase/seed/quests.ts';

const HEADER = ['slug', 'lat', 'lng', 'radius_m', 'google_maps'] as const;

/** RFC 4180: quote every field, double any embedded quote. */
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildCsv(): string {
  const rows = questSeeds.map((quest) => [
    quest.slug,
    quest.lat.toFixed(5),
    quest.lng.toFixed(5),
    quest.geofenceRadiusM,
    // Drops a pin at the exact coordinate rather than searching for a name, so
    // what opens is the position this app will actually use.
    `https://www.google.com/maps/search/?api=1&query=${quest.lat.toFixed(5)},${quest.lng.toFixed(5)}`,
  ]);

  return [HEADER, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

function main(): void {
  const out = new URL('../content/quests-review.csv', import.meta.url);
  writeFileSync(out, buildCsv(), 'utf8');
  console.log(`wrote ${fileURLToPath(out)} (${questSeeds.length} quests)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
