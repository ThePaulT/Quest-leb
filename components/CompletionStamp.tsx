'use client';

import Image from 'next/image';

import { t, type Locale } from '@/lib/i18n';

/**
 * The reward: a rubber stamp pressing onto the submitted photo.
 *
 * Per CLAUDE.md — slight rotation, ink texture, never confetti or a trophy
 * modal. The texture is an SVG turbulence filter masked to the ink, which
 * gives the broken, uneven bite of a real stamp pad rather than flat vector
 * edges. The rotation is fixed, not random: a stamp that lands differently on
 * every render reads as an animation gimmick.
 */
export interface CompletionStampProps {
  photoUrl: string | null;
  locale: Locale;
  status: 'verified' | 'flagged';
}

export function CompletionStamp({ photoUrl, locale, status }: CompletionStampProps) {
  const copy = t(locale);
  const ink = status === 'verified' ? '#0F4C3A' : '#2E5E6E';

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-sand bg-sand">
        {photoUrl && (
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="420px"
            className="object-cover"
            unoptimized
          />
        )}

        {/* The stamp. Absolutely placed so it presses onto the photo, slightly
            off-square, the way a hand-held stamp lands. */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 320 160"
            className="w-[74%] -rotate-[7deg]"
            role="presentation"
          >
            <defs>
              <filter id="stamp-ink" x="-20%" y="-20%" width="140%" height="140%">
                {/* Roughens every edge: the ink skips where the pad was dry. */}
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.9"
                  numOctaves="4"
                  seed="7"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="3.2"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
              <mask id="stamp-wear">
                <rect width="320" height="160" fill="white" />
                {/* Patchy black knocks holes in the ink, like an uneven press. */}
                <g filter="url(#stamp-ink)">
                  <rect width="320" height="160" fill="white" />
                </g>
                <rect width="320" height="160" fill="url(#stamp-speckle)" />
              </mask>
              <pattern
                id="stamp-speckle"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(18)"
              >
                <rect width="7" height="7" fill="black" fillOpacity="0" />
                <circle cx="1.5" cy="2" r="0.8" fill="black" fillOpacity="0.55" />
                <circle cx="5" cy="5.5" r="0.6" fill="black" fillOpacity="0.4" />
              </pattern>
            </defs>

            <g mask="url(#stamp-wear)" filter="url(#stamp-ink)" opacity="0.88">
              <rect
                x="6"
                y="6"
                width="308"
                height="148"
                fill="none"
                stroke={ink}
                strokeWidth="5"
              />
              <rect
                x="16"
                y="16"
                width="288"
                height="128"
                fill="none"
                stroke={ink}
                strokeWidth="1.5"
              />
              <text
                x="160"
                y="92"
                textAnchor="middle"
                fill={ink}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '42px',
                  fontWeight: 500,
                  letterSpacing: locale === 'ar' ? '0' : '6px',
                }}
              >
                {copy.success.stamp}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default CompletionStamp;
