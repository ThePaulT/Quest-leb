import { notFound } from 'next/navigation';

import { CompletionStamp } from '@/components/CompletionStamp';
import { QuestCard } from '@/components/QuestCard';
import type { QuestSummary } from '@/lib/types';

/**
 * Card bench. Four cards: two English, two Arabic under a real dir="rtl"
 * subtree, so both directions can be checked side by side rather than by
 * flipping the whole app.
 */
export const metadata = { title: 'Quest card — test' };

const EN_SAMPLES: QuestSummary[] = [
  {
    slug: 'byblos-citadel',
    titleEn: 'Byblos Citadel',
    titleAr: 'قلعة جبيل',
    region: 'mount_lebanon',
    difficulty: 2,
    estDurationMin: 90,
    isActive: false,
  },
  {
    slug: 'qadisha-valley',
    titleEn: 'Qadisha Valley',
    titleAr: 'وادي قاديشا',
    region: 'north',
    difficulty: 5,
    estDurationMin: 240,
    isActive: false,
  },
];

const AR_SAMPLES: QuestSummary[] = [
  {
    slug: 'baalbek-temple-of-bacchus',
    titleEn: 'Baalbek',
    titleAr: 'بعلبك',
    region: 'bekaa',
    difficulty: 3,
    estDurationMin: 120,
    isActive: false,
  },
  {
    slug: 'sidon-sea-castle',
    titleEn: 'Sidon Sea Castle',
    titleAr: 'قلعة صيدا البحرية',
    region: 'south',
    difficulty: 2,
    estDurationMin: 45,
    isActive: false,
  },
];

export default function TestCardPage() {
  // A component bench is a development tool, not a page to ship.
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen bg-base px-5 py-10 md:px-10">
      <header className="mx-auto mb-8 max-w-[1100px]">
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          Component
        </p>
        <h1 className="font-display mt-1.5 text-[34px] leading-[1.1] text-ink">Quest card</h1>
        <hr className="mt-4 border-0 border-t border-sand" />
        <p className="font-body mt-3 max-w-[62ch] text-[14px] leading-[1.6] text-ink">
          Images are placeholder cement-tile patterns, not photographs. The right-hand
          pair sits inside a dir=&quot;rtl&quot; subtree with the Arabic faces.
        </p>
      </header>

      <main className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-2">
        <Panel label="English — LTR" dir="ltr" lang="en">
          {EN_SAMPLES.map((quest) => (
            <QuestCard key={quest.slug} quest={quest} locale="en" />
          ))}
        </Panel>

        <Panel label="العربية — RTL" dir="rtl" lang="ar">
          {AR_SAMPLES.map((quest, index) => (
            <QuestCard
              key={quest.slug}
              quest={quest}
              locale="ar"
              completed={index === 1}
            />
          ))}
        </Panel>
      </main>

      {/*
        The completion stamp only appears after a real submission, so it is
        previewed here — otherwise the one piece of the design with texture in
        it could never be reviewed without completing a quest.
      */}
      <section className="mx-auto mt-14 max-w-[1100px]">
        <h2 className="font-body mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink">
          Completion stamp
        </h2>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-body mb-2 text-[11px] uppercase tracking-[0.14em] text-sea">
              Verified — EN
            </p>
            <CompletionStamp photoUrl="/placeholder/tile-sea.svg" locale="en" status="verified" />
          </div>
          <div dir="rtl" lang="ar">
            <p className="font-body mb-2 text-[11px] uppercase tracking-[0.14em] text-sea">
              قيد المراجعة — AR
            </p>
            <CompletionStamp
              photoUrl="/placeholder/tile-terracotta.svg"
              locale="ar"
              status="flagged"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Panel({
  label,
  dir,
  lang,
  children,
}: {
  label: string;
  dir: 'ltr' | 'rtl';
  lang: 'en' | 'ar';
  children: React.ReactNode;
}) {
  return (
    <section dir={dir} lang={lang} className="flex flex-col">
      <h2 className="font-body mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink">
        {label}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}
