import { GauntletGame } from '@/components/gauntlet-game.tsx';
import { RULES } from '@/lib/data.ts';

export const metadata = { title: 'Gauntlet — JJK Gauntlet' };

export default function GauntletPage() {
  return (
    <GauntletGame
      mode="gauntlet"
      intro={
        <header className="flex flex-col gap-2 border-b border-sand pb-4">
          <span className="eyebrow">Gauntlet</span>
          <h1 className="display text-3xl">Pick a side.</h1>
          <p className="max-w-2xl text-sm text-ash">
            {RULES.draft_rounds} draft rolls, {RULES.options_per_round} faces each, one reroll for
            the whole run. Then five rungs, each one harder than the last.
          </p>
        </header>
      }
    />
  );
}
