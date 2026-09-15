import Image from 'next/image';

import type { QuestRegion, QuestSummary } from '@/lib/types';
import { placeholderFor } from '@/lib/ui/placeholder';

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
  quest: QuestSummary;
  locale: Locale;
  /** A quest the user has already completed is banded in pine. */
  completed?: boolean;
  /** Drops the photo, for the bottom sheet where vertical space is scarce. */
  compact?: boolean;
}

export type Locale = 'en' | 'ar';

export const REGION_LABEL: Record<Locale, Record<QuestRegion, string>> = {
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

const DURATION: Record<Locale, (minutes: number) => string> = {
  en: (minutes) => `${minutes} min`,
  ar: (minutes) => `${minutes} دقيقة`,
};

const COMPLETED: Record<Locale, string> = { en: 'Completed', ar: 'مكتملة' };
const INACTIVE: Record<Locale, string> = { en: 'Not yet active', ar: 'غير مفعّلة' };
const DIFFICULTY: Record<Locale, (value: number) => string> = {
  en: (value) => `Difficulty ${value} of 5`,
  ar: (value) => `الصعوبة ${value} من ٥`,
};

export function QuestCard({ quest, locale, completed = false, compact = false }: QuestCardProps) {
  const title = locale === 'ar' ? quest.titleAr : quest.titleEn;
  const difficulty = Math.max(1, Math.min(5, Math.round(quest.difficulty)));
  const inactive = quest.isActive === false;

  return (
    <article
      lang={locale}
      data-slug={quest.slug}
      className="flex flex-col overflow-hidden rounded-[2px] border border-sand bg-base"
    >
      {!compact && (
        /* The photo runs edge to edge: the only loud thing on the card. */
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-sand">
          <Image
            src={placeholderFor(quest.slug)}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 380px"
            className="object-cover"
          />
          {completed && (
            <div className="absolute inset-x-0 bottom-0 bg-primary px-3 py-1.5">
              <span className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-base">
                {COMPLETED[locale]}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {/* The one accent element on a card. */}
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {REGION_LABEL[locale][quest.region]}
        </p>

        <h3 className="font-display mt-1.5 text-[26px] leading-[1.15] text-ink">{title}</h3>

        {/* Sand hairline. Separates, without a box. */}
        <hr className="mt-3.5 border-0 border-t border-sand" />

        <div className="mt-3 flex items-center justify-between gap-4">
          <DifficultyMarks value={difficulty} locale={locale} />
          <div className="flex items-center gap-3">
            {inactive && (
              <span className="font-body text-[11px] uppercase tracking-[0.12em] text-sand">
                {INACTIVE[locale]}
              </span>
            )}
            {quest.estDurationMin != null && (
              <span className="font-body text-[13px] tabular-nums text-sea">
                {DURATION[locale](quest.estDurationMin)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Difficulty as five small marks.
 *
 * A number reads as data; marks read as a rating you glance at. Filled in pine,
 * unfilled in sand — no third colour, and no size change between states, so the
 * row keeps its rhythm. Squares, not stars: stars belong to app-store ratings.
 */
export function DifficultyMarks({ value, locale }: { value: number; locale: Locale }) {
  return (
    <span
      className="flex items-center gap-[5px]"
      role="img"
      aria-label={DIFFICULTY[locale](value)}
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
