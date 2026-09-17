import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GeofenceInset } from '@/components/GeofenceInset';
import { DifficultyMarks } from '@/components/QuestCard';
import { SubmitProof } from '@/components/SubmitProof';
import { dirFor, localeFrom, t } from '@/lib/i18n';
import { getQuestBySlug } from '@/lib/quests';
import { placeholderFor } from '@/lib/ui/placeholder';
import { UNVERIFIED_MARKER } from '@/supabase/seed/quests';

export const dynamic = 'force-dynamic';

export default async function QuestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const locale = localeFrom(lang);
  const copy = t(locale);
  const dir = dirFor(locale);

  const quest = await getQuestBySlug(slug).catch(() => null);

  // An inactive quest is visible while reviewing content, but never in
  // production — the same rule the map's toggle follows.
  const maySeeInactive =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_INACTIVE_TOGGLE === '1';
  if (!quest || (!quest.isActive && !maySeeInactive)) notFound();

  const title = locale === 'ar' ? quest.titleAr : quest.titleEn;
  const summary = locale === 'ar' ? quest.summaryAr : quest.summaryEn;
  const story = locale === 'ar' ? quest.storyAr : quest.storyEn;
  const proofHint = locale === 'ar' ? quest.proofHintAr : quest.proofHintEn;
  // Safety information is never withheld for want of a translation: an Arabic
  // reader with no notes at all is worse off than one reading English notes
  // under a clear label. safety_notes_ar is null on every quest today.
  const localisedSafety = locale === 'ar' ? quest.safetyNotesAr : quest.safetyNotesEn;
  const safety = localisedSafety ?? quest.safetyNotesEn;
  const safetyIsFallback = localisedSafety === null && safety !== null;

  // The draft marker is a working note, not copy to show a visitor: strip it
  // and render the caveat as a styled line instead.
  const safetyIsDraft = Boolean(safety?.startsWith(UNVERIFIED_MARKER));
  const safetyBody = safetyIsDraft
    ? safety!.slice(UNVERIFIED_MARKER.length).trim()
    : safety?.trim();

  const otherLang = locale === 'ar' ? `/quest/${slug}` : `/quest/${slug}?lang=ar`;

  return (
    <div lang={locale} dir={dir} className="min-h-dvh bg-base">
      {/* Hero photo: the only loud element on the page. */}
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-sand sm:aspect-[21/9]">
        <Image
          src={placeholderFor(quest.slug)}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      </div>

      <div className="mx-auto max-w-[68ch] px-5 pb-16 pt-6 md:px-8">
        <nav className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={locale === 'ar' ? '/?lang=ar' : '/'}
            className="font-body text-[13px] text-sea underline underline-offset-4"
          >
            {copy.common.back}
          </Link>
          <Link
            href={otherLang}
            className="font-body text-[13px] text-sea underline underline-offset-4"
          >
            {copy.common.viewOtherLanguage}
          </Link>
        </nav>

        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {copy.region[quest.region]}
        </p>
        <h1 className="font-display mt-1.5 text-[38px] leading-[1.1] text-ink">{title}</h1>
        <p className="font-body mt-3 text-[16px] leading-[1.7] text-ink">{summary}</p>

        <hr className="mt-5 border-0 border-t border-sand" />
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <DifficultyMarks value={quest.difficulty} locale={locale} />
          {quest.estDurationMin != null && (
            <span className="font-body text-[13px] tabular-nums text-sea">
              {copy.common.minutes(quest.estDurationMin)}
            </span>
          )}
          {!quest.isActive && (
            <span className="font-body text-[11px] uppercase tracking-[0.12em] text-sea">
              {copy.common.notYetActive}
            </span>
          )}
        </div>

        {story && (
          <section className="mt-9">
            <h2 className="font-body text-[11px] uppercase tracking-[0.16em] text-sea">
              {copy.quest.story}
            </h2>
            <p className="font-display mt-2.5 text-[20px] leading-[1.6] text-ink">{story}</p>
          </section>
        )}

        {proofHint && (
          <section className="mt-9">
            <h2 className="font-body text-[11px] uppercase tracking-[0.16em] text-sea">
              {copy.quest.howToProve}
            </h2>
            <hr className="mt-2 border-0 border-t border-sand" />
            <p className="font-body mt-2.5 text-[15px] leading-[1.7] text-ink">{proofHint}</p>
          </section>
        )}

        <section className="mt-9">
          <h2 className="font-body text-[11px] uppercase tracking-[0.16em] text-sea">
            {copy.quest.geofence}
          </h2>
          <hr className="mt-2 border-0 border-t border-sand" />
          <p className="font-body mb-2.5 mt-2.5 text-[15px] leading-[1.7] text-ink">
            {copy.quest.geofenceExplainer(quest.geofenceRadiusM)}
          </p>
          <GeofenceInset
            lat={quest.lat}
            lng={quest.lng}
            radiusM={quest.geofenceRadiusM}
            label={`${title} — ${copy.quest.geofence}`}
          />
        </section>

        {safetyBody && (
          <section className="mt-9">
            <h2 className="font-body text-[11px] uppercase tracking-[0.16em] text-sea">
              {copy.quest.safety}
            </h2>
            <div className="mt-2.5 border border-sand px-4 py-3.5">
              {safetyIsDraft && (
                <p className="font-body mb-2 text-[11px] uppercase tracking-[0.12em] text-accent">
                  {copy.quest.safetyUnverified}
                </p>
              )}
              {safetyIsFallback && (
                <p
                  lang="ar"
                  className="font-body mb-2 text-[12px] leading-[1.6] text-sea"
                >
                  {copy.quest.safetyEnglishOnly}
                </p>
              )}
              <p
                lang={safetyIsFallback ? 'en' : locale}
                dir={safetyIsFallback ? 'ltr' : undefined}
                className="font-body whitespace-pre-line text-[15px] leading-[1.75] text-ink"
              >
                {safetyBody}
              </p>
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-[26px] leading-[1.2] text-ink">
            {copy.quest.submitProof}
          </h2>
          <hr className="mt-3 border-0 border-t border-sand" />
          <div className="mt-4">
            {quest.isActive ? (
              <SubmitProof
                questId={quest.id}
                questSlug={quest.slug}
                locale={locale}
                geofenceRadiusM={quest.geofenceRadiusM}
              />
            ) : (
              <p className="font-body text-[14px] leading-[1.65] text-sea">
                {copy.quest.inactiveNotice}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
