import type { Quest } from '@/lib/types';

import { checkPhotoAndLocation } from './shared';
import { verified, type Submission, type ValidationResult, type Validator } from './types';

/**
 * photo_at_location — "prove you stood here".
 *
 * The photo is evidence of presence; the geofence is what actually decides.
 * There is no image analysis yet, so a photo inside the fence is taken at face
 * value. See lib/validators/README.md for what that leaves open.
 */
export const photoAtLocationValidator: Validator = {
  async validate(s: Submission, q: Quest): Promise<ValidationResult> {
    const failure = await checkPhotoAndLocation(s, q);
    return failure ?? verified();
  },
};

export default photoAtLocationValidator;
