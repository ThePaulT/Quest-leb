import type { Quest } from '@/lib/types';

import { REASON, rejected, type Submission, type ValidationResult, type Validator } from './types';

/**
 * qr_scan — not built yet.
 *
 * Deliberately rejects everything rather than falling through to the photo
 * checks: a QR quest has no photo, so the photo path would reject it anyway but
 * with a misleading reason. An explicit 'not_implemented' keeps the failure
 * honest, and keeps qr_scan quests un-completable until the real thing lands.
 *
 * Registered like any other validator so the registry stays exhaustive over
 * ProofType — the compiler will not let a proof type go unhandled.
 */
export const qrScanValidator: Validator = {
  async validate(_s: Submission, _q: Quest): Promise<ValidationResult> {
    return rejected(REASON.notImplemented);
  },
};

export default qrScanValidator;
