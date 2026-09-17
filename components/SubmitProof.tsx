'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CompletionStamp } from '@/components/CompletionStamp';
import { rejectionMessage, t, type Locale } from '@/lib/i18n';
import { PhotoError, preparePhoto, type PreparedPhoto } from '@/lib/photo';
import { useSession } from '@/lib/useSession';
import { MAX_ACCURACY_M } from '@/lib/validators/types';

/**
 * The submission flow: photo, position, send.
 *
 * Accuracy is shown BEFORE the submit button is usable, and a reading worse
 * than MAX_ACCURACY_M is called out in plain language, because the server will
 * reject it and a visitor standing in the right place deserves to know why
 * before they waste the attempt.
 *
 * Every failure the API can return maps to a sentence in the i18n catalogue —
 * never a status code, never a raw reason key.
 */
export interface SubmitProofProps {
  questId: string;
  questSlug: string;
  locale: Locale;
  geofenceRadiusM: number;
}

interface Position {
  lat: number;
  lng: number;
  accuracyM: number;
}

type Phase = 'idle' | 'working' | 'done';

interface Outcome {
  status: 'verified' | 'flagged';
  photoUrl: string | null;
  badges: { slug: string; nameEn: string; nameAr: string }[];
}

export function SubmitProof({ questId, questSlug, locale, geofenceRadiusM }: SubmitProofProps) {
  const copy = t(locale);
  const { loading: sessionLoading, token } = useSession();

  const fileInput = useRef<HTMLInputElement | null>(null);
  const previewUrl = useRef<string | null>(null);

  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  // Starts true: the effect below requests a fix on mount, so the very first
  // paint is already "locating" and nothing has to be written synchronously.
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Ask for position as soon as the form is open: a cold GPS fix can take
  // fifteen seconds, and starting when they press Submit wastes all of it.
  /**
   * Asks the browser for a fix. Every state write happens in a promise
   * callback, never synchronously — including the "no geolocation at all"
   * case, which is why that rejects rather than returning early.
   */
  const requestPosition = useCallback(() => {
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('unsupported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      });
    })
      .then((pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
        });
        setLocationError(null);
        setLocating(false);
      })
      .catch((cause: unknown) => {
        const denied =
          typeof cause === 'object' &&
          cause !== null &&
          'code' in cause &&
          (cause as GeolocationPositionError).code === 1;
        setLocationError(denied ? copy.submit.locationDenied : copy.submit.locationFailed);
        setLocating(false);
      });
  }, [copy.submit.locationDenied, copy.submit.locationFailed]);

  /** Retry button: shows the spinner again, then asks. */
  const locate = useCallback(() => {
    setLocating(true);
    setLocationError(null);
    requestPosition();
  }, [requestPosition]);

  useEffect(() => {
    requestPosition();
  }, [requestPosition]);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  async function onPhotoChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhase('working');
    try {
      const prepared = await preparePhoto(file);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(prepared.blob);
      setPreview(previewUrl.current);
      setPhoto(prepared);
    } catch (cause) {
      setError(cause instanceof PhotoError ? cause.message : copy.submit.needPhoto);
    } finally {
      setPhase('idle');
    }
  }

  async function submit() {
    if (!photo) return setError(copy.submit.needPhoto);
    if (!position) return setError(copy.submit.needLocation);
    if (!token) return setError(copy.rejection['auth.unauthorized']);

    setPhase('working');
    setError(null);

    const form = new FormData();
    form.set('questId', questId);
    form.set('lat', String(position.lat));
    form.set('lng', String(position.lng));
    form.set('accuracyM', String(position.accuracyM));
    form.set('photo', new File([photo.blob], 'proof.webp', { type: 'image/webp' }));

    try {
      const response = await fetch('/api/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await response.json().catch(() => null);

      if (response.ok) {
        setOutcome({
          status: body?.completion?.validationStatus === 'flagged' ? 'flagged' : 'verified',
          photoUrl: body?.completion?.photoUrl ?? preview,
          badges: body?.badgesEarned ?? [],
        });
        setPhase('done');
        return;
      }

      // 422 carries a stored rejection; everything else carries an error key.
      const reason = body?.completion?.validationReason ?? body?.error ?? null;
      setError(rejectionMessage(locale, reason));
      setPhase('idle');
    } catch {
      setError(rejectionMessage(locale, 'storage.upload_failed'));
      setPhase('idle');
    }
  }

  if (sessionLoading) {
    return <p className="font-body text-[14px] text-sea">…</p>;
  }

  if (!token) {
    return (
      <Link
        href={`/sign-in?next=/quest/${questSlug}${locale === 'ar' ? '?lang=ar' : ''}${locale === 'ar' ? '&lang=ar' : ''}`}
        className="font-body inline-block rounded-[2px] border border-primary bg-primary px-4 py-2.5 text-[14px] text-base transition-colors hover:border-ink hover:bg-ink"
      >
        {copy.quest.signInToSubmit}
      </Link>
    );
  }

  if (phase === 'done' && outcome) {
    return (
      <div>
        <CompletionStamp photoUrl={outcome.photoUrl} locale={locale} status={outcome.status} />
        <h3 className="font-display mt-5 text-[26px] leading-[1.2] text-ink">
          {outcome.status === 'verified' ? copy.success.verified : copy.success.flagged}
        </h3>
        <p className="font-body mt-2 text-[14px] leading-[1.65] text-ink">
          {outcome.status === 'verified' ? copy.success.verifiedBody : copy.success.flaggedBody}
        </p>

        {outcome.badges.length > 0 && (
          <>
            <hr className="mt-4 border-0 border-t border-sand" />
            <p className="font-body mt-3 text-[11px] uppercase tracking-[0.16em] text-accent">
              {copy.success.badgeEarned}
            </p>
            <ul className="mt-1.5">
              {outcome.badges.map((badge) => (
                <li key={badge.slug} className="font-display text-[20px] text-ink">
                  {locale === 'ar' ? badge.nameAr : badge.nameEn}
                </li>
              ))}
            </ul>
          </>
        )}

        <Link
          href={locale === 'ar' ? '/?lang=ar' : '/'}
          className="font-body mt-5 inline-block text-[13px] text-sea underline underline-offset-4"
        >
          {copy.success.backToMap}
        </Link>
      </div>
    );
  }

  const accuracyPoor = position != null && position.accuracyM > MAX_ACCURACY_M;
  const canSubmit = photo != null && position != null && phase !== 'working';

  return (
    <div>
      {/* Step 1 — the photo */}
      <p className="font-body text-[11px] uppercase tracking-[0.16em] text-sea">
        {copy.submit.step1}
      </p>

      {preview && (
        <div className="mt-2.5 aspect-[4/3] w-full max-w-[420px] overflow-hidden border border-sand bg-sand">
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL, never optimised */}
          <img src={preview} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhotoChosen}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={phase === 'working'}
        className="font-body mt-2.5 rounded-[2px] border border-sand bg-base px-4 py-2.5 text-[14px] text-ink transition-colors hover:border-ink disabled:opacity-50"
      >
        {photo ? copy.submit.retakePhoto : copy.submit.takePhoto}
      </button>

      {photo && (
        <p className="font-body mt-2 text-[13px] tabular-nums text-sea">
          {copy.submit.photoReady(Math.round(photo.bytes / 1024))}
        </p>
      )}

      <hr className="mt-5 border-0 border-t border-sand" />

      {/* Step 2 — the position */}
      <p className="font-body mt-4 text-[11px] uppercase tracking-[0.16em] text-sea">
        {copy.submit.step2}
      </p>

      {locating && (
        <p className="font-body mt-2 text-[14px] text-ink">{copy.submit.locating}</p>
      )}

      {locationError && (
        <div className="mt-2">
          <p className="font-body text-[14px] leading-[1.6] text-accent">{locationError}</p>
          <button
            type="button"
            onClick={locate}
            className="font-body mt-2 rounded-[2px] border border-sand bg-base px-3 py-1.5 text-[13px] text-ink hover:border-ink"
          >
            {copy.common.retry}
          </button>
        </div>
      )}

      {position && (
        <div className="mt-2">
          <p className="font-body text-[14px] text-ink">
            {copy.submit.accuracyLabel}:{' '}
            <span className="tabular-nums">{copy.common.metres(position.accuracyM)}</span>
          </p>
          <p
            className={`font-body mt-1 text-[13px] leading-[1.6] ${
              accuracyPoor ? 'text-accent' : 'text-sea'
            }`}
          >
            {accuracyPoor ? copy.submit.accuracyPoor : copy.submit.accuracyGood}
          </p>
          <p className="font-body mt-1 text-[12px] leading-[1.6] text-sea">
            {copy.quest.geofenceExplainer(geofenceRadiusM)}
          </p>
        </div>
      )}

      <hr className="mt-5 border-0 border-t border-sand" />

      {error && (
        <p className="font-body mt-4 text-[14px] leading-[1.65] text-accent">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="font-body mt-4 w-full rounded-[2px] border border-primary bg-primary px-4 py-3 text-[15px] text-base transition-colors hover:border-ink hover:bg-ink disabled:opacity-40"
      >
        {phase === 'working' ? copy.submit.submitting : copy.submit.submit}
      </button>
    </div>
  );
}

export default SubmitProof;
