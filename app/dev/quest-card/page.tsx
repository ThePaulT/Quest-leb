import { notFound } from 'next/navigation';

import { QuestCard } from '@/components/quest-card';
import type { QuestRegion } from '@/lib/types';

/**
 * Component bench for the quest card. Dev-only: this returns 404 in production
 * rather than shipping a route nobody should find.
 *
 * ?lang=ar renders the whole page under dir="rtl" with the Arabic faces, which
 * is the point — RTL is checked as a real layout, not a mirrored screenshot.
 */
export const dynamic = 'force-dynamic';

interface Sample {
  slug: string;
  titleEn: string;
  titleAr: string;
  region: QuestRegion;
  difficulty: number;
  estDurationMin: number;
  photoUrl: string;
  completed?: boolean;
}

const SAMPLES: Sample[] = [
  {
    slug: 'byblos-citadel',
    titleEn: 'Byblos Citadel',
    titleAr: 'قلعة جبيل',
    region: 'mount_lebanon',
    difficulty: 2,
    estDurationMin: 90,
    photoUrl: '/placeholder/tile-pine.svg',
  },
  {
    slug: 'baalbek-temple-of-bacchus',
    titleEn: 'Baalbek',
    titleAr: 'بعلبك',
    region: 'bekaa',
    difficulty: 3,
    estDurationMin: 120,
    photoUrl: '/placeholder/tile-terracotta.svg',
  },
  {
    slug: 'qadisha-valley',
    titleEn: 'Qadisha Valley',
    titleAr: 'وادي قاديشا',
    region: 'north',
    difficulty: 5,
    estDurationMin: 240,
    photoUrl: '/placeholder/tile-sea.svg',
  },
  {
    slug: 'sidon-sea-castle',
    titleEn: 'Sidon Sea Castle',
    titleAr: 'قلعة صيدا البحرية',
    region: 'south',
    difficulty: 2,
    estDurationMin: 45,
    photoUrl: '/placeholder/tile-pine.svg',
    completed: true,
  },
];

export default async function QuestCardBench({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { lang } = await searchParams;
  const locale = lang === 'ar' ? 'ar' : 'en';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div lang={locale} dir={dir} className="min-h-screen bg-base px-5 py-10 md:px-10">
      <header className="mx-auto mb-10 max-w-[1100px]">
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {locale === 'ar' ? 'مكوّن' : 'Component'}
        </p>
        <h1 className="font-display mt-1.5 text-[34px] leading-[1.1] text-ink">
          {locale === 'ar' ? 'بطاقة المهمة' : 'Quest card'}
        </h1>
        <hr className="mt-4 border-0 border-t border-sand" />
        <p className="font-body mt-3 max-w-[60ch] text-[14px] leading-[1.6] text-ink/70">
          {locale === 'ar'
            ? 'الصور هنا أنماط بلاط إسمنتي مؤقتة، وليست صوراً حقيقية.'
            : 'Images are placeholder cement-tile patterns, not real photographs.'}
        </p>
      </header>

      <main className="mx-auto grid max-w-[1100px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLES.map((sample) => (
          <QuestCard
            key={sample.slug}
            slug={sample.slug}
            title={locale === 'ar' ? sample.titleAr : sample.titleEn}
            region={sample.region}
            difficulty={sample.difficulty}
            estDurationMin={sample.estDurationMin}
            photoUrl={sample.photoUrl}
            locale={locale}
            completed={sample.completed}
          />
        ))}
      </main>

      <footer className="mx-auto mt-10 max-w-[1100px]">
        <hr className="border-0 border-t border-sand" />
        <p className="font-body mt-3 text-[13px] text-ink/60">
          <a
            className="underline underline-offset-4"
            href={locale === 'ar' ? '/dev/quest-card' : '/dev/quest-card?lang=ar'}
          >
            {locale === 'ar' ? 'View in English' : 'اعرض بالعربية'}
          </a>
        </p>
      </footer>
    </div>
  );
}
