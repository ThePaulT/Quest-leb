import Image from 'next/image';

import type { QuestCategory, QuestRegion } from '@/lib/types';

/**
 * The quest card.
 *
 * A printed index card, not a UI panel: paper ground, a hairline rule, a photo
 * that does all the shouting. No shadow — a 1px sand border does the separating.
 *
 * Everything directional is written with logical properties (start/end, not
 * left/right), so the Arabic layout is the same component under dir="rtl"
 * rather than a mirrored special case.
 */

export interface QuestCardProps {
  slug: string;
  title: string;
  region: QuestRegion;
  category?: QuestCategory;
  /** 1–5. Rendered as filled marks, never as a number. */
  difficulty: number;
  estDurationMin?: number;
  photoUrl: string;
  /** Drives the region label text and the duration unit. */
  locale: 'en' | 'ar';
  /** A quest the user has already completed reads in pine, with a rule above it. */
  completed?: boolean;
}

const REGION_LABEL: Record<'en' | 'ar', Record<QuestRegion, string>> = {
  en: {
    beirut: 'Beirut',
    mount_lebanon: 'Mount Lebanon',
    north: 'North',
    south: 'South',
    bekaa: 'Bekaa',
  },
  ar: {
    beirut: 'بيروت',
    mount_lebanon: 'جبل لبنان',
    north: 'الشمال',
    south: 'الجنوب',
    bekaa: 'البقاع',
  },
};

const DURATION_LABEL: Record<'en' | 'ar', (minutes: number) => string> = {
  en: (minutes) => `${minutes} min`,
  ar: (minutes) => `${minutes} دقيقة`,
};

const COMPLETED_LABEL: Record<'en' | 'ar', string> = {
  en: 'Completed',
  ar: 'مكتملة',
};

const DIFFICULTY_LABEL: Record<'en' | 'ar', (value: number) => string> = {
  en: (value) => `Difficulty ${value} of 5`,
  ar: (value) => `الصعوبة ${value} من ٥`,
};

export function QuestCard({
  slug,
  title,
  region,
  difficulty,
  estDurationMin,
  photoUrl,
  locale,
  completed = false,
}: QuestCardProps) {
  const clamped = Math.max(1, Math.min(5, Math.round(difficulty)));

  return (
    <article
      lang={locale}
      className="group relative flex flex-col overflow-hidden rounded-[2px] border border-sand bg-base"
      data-slug={slug}
    >
      {/* The photo runs edge to edge: the only loud thing on the card. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-sand">
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 380px"
          className="object-cover"
          priority={false}
        />
        {completed && (
          <div className="absolute inset-x-0 bottom-0 bg-primary px-3 py-1.5">
            <span className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-base">
              {COMPLETED_LABEL[locale]}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {/* The one accent element. */}
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {REGION_LABEL[locale][region]}
        </p>

        <h3 className="font-display mt-1.5 text-[26px] leading-[1.15] text-ink">
          {title}
        </h3>

        {/* Sand hairline. Separates, without a box. */}
        <hr className="mt-3.5 border-0 border-t border-sand" />

        <div className="mt-3 flex items-center justify-between gap-4">
          <DifficultyMarks value={clamped} locale={locale} />
          {estDurationMin != null && (
            <span className="font-body text-[13px] tabular-nums text-sea">
              {DURATION_LABEL[locale](estDurationMin)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Difficulty as five small marks.
 *
 * A number would read as data; marks read as a rating you glance at. Filled in
 * pine, unfilled in sand — no third colour, and no size change between states,
 * so the row keeps its rhythm.
 */
function DifficultyMarks({ value, locale }: { value: number; locale: 'en' | 'ar' }) {
  return (
    <span
      className="flex items-center gap-[5px]"
      role="img"
      aria-label={DIFFICULTY_LABEL[locale](value)}
    >
      {[1, 2, 3, 4, 5].map((mark) => (
        <span
          key={mark}
          aria-hidden="true"
          className={`h-[7px] w-[7px] ${mark <= value ? 'bg-primary' : 'bg-sand'}`}
        />
      ))}
    </span>
  );
}

export default QuestCard;
