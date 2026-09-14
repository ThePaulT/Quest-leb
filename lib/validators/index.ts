import type { ProofType } from '@/lib/types';

import { photoAtLocationValidator } from './photo-at-location';
import { photoOfObjectValidator } from './photo-of-object';
import { qrScanValidator } from './qr-scan';
import { receiptPhotoValidator } from './receipt-photo';
import type { Validator } from './types';

/**
 * The validator registry.
 *
 * Typed as a total Record over ProofType, so adding a value to the ProofType
 * union without adding a module here is a compile error rather than a runtime
 * surprise in production.
 */
export const validators: Record<ProofType, Validator> = {
  photo_at_location: photoAtLocationValidator,
  photo_of_object: photoOfObjectValidator,
  receipt_photo: receiptPhotoValidator,
  qr_scan: qrScanValidator,
};

/** Resolve the validator for a proof type. The only supported entry point. */
export function getValidator(proofType: ProofType): Validator {
  return validators[proofType];
}

export * from './types';
