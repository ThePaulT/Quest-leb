import { QuestMap } from '@/components/QuestMap';
import { listQuests } from '@/lib/quests';
import type { QuestSummary } from '@/lib/types';

/**
 * The map.
 *
 * Quests are data: this reads them from the database rather than importing the
 * seed file, so adding a quest stays an insert. Outside production the page
 * also loads inactive quests, because all ten seeds are is_active = false until
 * someone writes their safety notes — the toggle lives in the map UI.
 */
export const dynamic = 'force-dynamic';

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale = lang === 'ar' ? 'ar' : 'en';
  // Server-side only, and deliberately not NEXT_PUBLIC_: the decision is made
  // here and handed to the client as a prop, so the browser never needs the
  // variable and it is read at runtime rather than inlined at build time.
  // The toggle is off in production by default. The opt-in exists because all
  // ten seeded quests are inactive until someone writes their safety notes —
  // without it a preview deploy shows an empty map and cannot be demoed at all.
  // It only ever reveals is_active = false quests; it grants nothing else.
  const showInactiveTools =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_INACTIVE_TOGGLE === '1';

  const isDev = process.env.NODE_ENV !== 'production';
  let quests: QuestSummary[] = [];
  let error: string | null = null;

  try {
    quests = await listQuests({ includeInactive: showInactiveTools });
  } catch (cause) {
    // A missing database should read as a setup problem, not a stack trace.
    error = cause instanceof Error ? cause.message : String(cause);
  }

  if (error) {
    // The cause is for the developer's terminal, not the visitor's screen: a pg
    // error carries socket paths and host names. Supabase's free tier pauses
    // after 7 idle days, so this path WILL be hit in production.
    console.error('[map] could not load quests:', error);
    return <SetupNotice detail={isDev ? error : null} />;
  }

  return (
    <QuestMap
      quests={quests}
      locale={locale}
      allowInactiveToggle={showInactiveTools}
      inactiveIncluded={showInactiveTools}
    />
  );
}

function SetupNotice({ detail }: { detail: string | null }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base px-6">
      <div className="max-w-[52ch] border border-sand bg-base px-5 py-5">
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          Setup
        </p>
        <h1 className="font-display mt-1.5 text-[28px] leading-[1.15] text-ink">
          Map unavailable
        </h1>
        <hr className="mt-3.5 border-0 border-t border-sand" />
        <p className="font-body mt-3 text-[14px] leading-[1.65] text-ink">
          The quest map cannot be loaded right now. Please try again shortly.
        </p>
        {detail !== null && (
          <>
            <pre className="font-body mt-3 overflow-x-auto border border-sand px-3 py-2.5 text-[12px] leading-[1.7] text-ink">
{`npm run db:local      # prints DATABASE_URL
export DATABASE_URL=…
npm run seed`}
            </pre>
            <p className="font-body mt-3 text-[12px] leading-[1.6] text-sea">{detail}</p>
          </>
        )}
      </div>
    </main>
  );
}
