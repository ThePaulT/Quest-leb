import type { Quest } from '@/lib/types';

import { checkPhotoAndLocation } from './shared';
import { verified, type Submission, type ValidationResult, type Validator } from './types';

/**
 * receipt_photo — "prove you went in", for sites where photography is banned
 * (Jeita Grotto) or the interior is ticketed.
 *
 * Same gates as the other photo types today. OCR of the ticket date, which is
 * what would make this proof type actually strong, goes here when it exists.
 */
export const receiptPhotoValidator: Validator = {
  async validate(s: Submission, q: Quest): Promise<ValidationResult> {
    const failure = await checkPhotoAndLocation(s, q);
    return failure ?? verified();
  },
};

export default receiptPhotoValidator;
