import { isWithinGeofence } from '@/lib/db';
import type { Quest } from '@/lib/types';

import {
  MAX_ACCURACY_M,
  REASON,
  rejected,
  type Submission,
  type ValidationResult,
} from './types';

/**
 * The checks every photo-backed proof type shares: a photo exists, the GPS
 * reading is trustworthy, and the user was inside the quest's geofence.
 *
 * Returns a rejection, or null when the submission clears all three. Order
 * matters — the cheap local checks run before the database round trip.
 */
export async function checkPhotoAndLocation(
  s: Submission,
  q: Quest,
): Promise<ValidationResult | null> {
  if (s.photoUrl === null) {
    return rejected(REASON.missingPhoto);
  }

  if (s.accuracyM > MAX_ACCURACY_M) {
    return rejected(REASON.inaccurateGps);
  }

  const inside = await isWithinGeofence(q.id, s.lat, s.lng);
  if (!inside) {
    return rejected(REASON.outsideGeofence);
  }

  return null;
}
