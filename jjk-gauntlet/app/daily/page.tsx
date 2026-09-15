import { GauntletGame } from '@/components/gauntlet-game.tsx';
import { dailyKey, dailySeed } from '@/lib/draft.ts';

export const metadata = { title: 'Daily — JJK Gauntlet' };
// The Daily is the same for everyone within a UTC day, so the shell can be
// cached for an hour without anyone seeing a different draft.
export const revalidate = 3600;

export default function DailyPage() {
  const key = dailyKey();
  return (
    <GauntletGame
      mode="daily"
      fixedSeeds={{ hero: dailySeed('hero'), villain: dailySeed('villain') }}
      intro={
        <header className="flex flex-col gap-2 border-b border-sand pb-4">
          <span className="eyebrow">Daily · {key}</span>
          <h1 className="display text-3xl">Everyone gets the same three rolls today.</h1>
          <p className="max-w-2xl text-sm text-ash">
            Same groups, same four faces, same order, for every player until midnight UTC. What you
            take from each roll is the only thing that differs — and so is what the ladder does to
            you.
          </p>
        </header>
      }
    />
  );
}
