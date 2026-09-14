import type { Quest } from '@/lib/types';

import { checkPhotoAndLocation } from './shared';
import { verified, type Submission, type ValidationResult, type Validator } from './types';

/**
 * photo_of_object — "prove you found the specific thing".
 *
 * Same gates as photo_at_location today. It stays a separate module because the
 * thing that will eventually distinguish it — recognising the object in the
 * frame — belongs here and nowhere else.
 */
export const photoOfObjectValidator: Validator = {
  async validate(s: Submission, q: Quest): Promise<ValidationResult> {
    const failure = await checkPhotoAndLocation(s, q);
    return failure ?? verified();
  },
};

export default photoOfObjectValidator;
