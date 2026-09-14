import type { Quest } from '@/lib/types';

/**
 * Proof validation contract.
 *
 * One module per proof type, registered in ./index.ts. Route handlers resolve a
 * validator from the registry and call it — they never branch on proof_type.
 * Adding a proof type means adding a file and a registry entry, nothing else.
 */

export type Submission = {
  questId: string;
  userId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  photoUrl: string | null;
};

export type ValidationResult = {
  status: 'verified' | 'flagged' | 'rejected';
  /** i18n key, never prose. Null only when status is 'verified'. */
  reason: string | null;
};

export interface Validator {
  validate(s: Submission, q: Quest): Promise<ValidationResult>;
}

/**
 * Worst GPS accuracy we will accept, in metres.
 *
 * A reading looser than this tells us almost nothing about where the user
 * actually stood, so it is rejected rather than flagged: flagging implies "we
 * think you were there but something is off", and here we simply do not know.
 */
export const MAX_ACCURACY_M = 150;

/** Reason keys. Every one of these needs an entry in the i18n catalogues. */
export const REASON = {
  missingPhoto: 'proof.missing_photo',
  inaccurateGps: 'proof.gps_too_inaccurate',
  outsideGeofence: 'proof.outside_geofence',
  notImplemented: 'not_implemented',
} as const;

export const verified = (): ValidationResult => ({
  status: 'verified',
  reason: null,
});

export const rejected = (reason: string): ValidationResult => ({
  status: 'rejected',
  reason,
});

export const flagged = (reason: string): ValidationResult => ({
  status: 'flagged',
  reason,
});
