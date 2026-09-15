'use client';

import { useMemo, useState } from 'react';

import { DB, character } from '@/lib/data.ts';
import { explainMatchup, runFreestyle } from '@/lib/engine.ts';
import type { FreestyleResult } from '@/lib/engine.ts';
import { randomSeed } from '@/lib/rng.ts';
import { simulateFreestyle } from '@/lib/sim.ts';
import type { WinOdds } from '@/lib/sim.ts';

import { BreakdownPanel } from './breakdown-panel.tsx';
import { CharacterCard } from './character-card.tsx';
import { RoundView } from './round-view.tsx';

const FIGHTS = 2000;
const MAX_PER_SIDE = 3;

function Roster({
  chosen,
  other,
  onToggle,
}: {
  chosen: string[];
  other: string[];
  onToggle: (id: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const list = DB.characters.filter(
    (c) =>
      !other.includes(c.id) &&
      (filter === '' ||
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.tags.some((t) => t.includes(filter.toLowerCase()))),
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name or tag"
        className="border border-sand bg-panel px-3 py-2 text-xs outline-none focus:border-ash"
      />
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
        {list.map((c) => {
          const picked = chosen.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              disabled={!picked && chosen.length >= MAX_PER_SIDE}
              className={[
                'flex items-baseline justify-between border px-3 py-1.5 text-left text-xs',
                picked ? 'border-bone bg-panel-2' : 'border-sand hover:border-ash',
                !picked && chosen.length >= MAX_PER_SIDE ? 'opacity-30' : 'cursor-pointer',
              ].join(' ')}
            >
              <span>{c.name}</span>
              <span className={c.side === 'hero' ? 'text-curse' : 'text-blood'}>
                {c.tier} · {c.power}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FreestyleGame() {
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [odds, setOdds] = useState<WinOdds | null>(null);
  const [simming, setSimming] = useState(false);
  const [fight, setFight] = useState<FreestyleResult | null>(null);
  const [stories, setStories] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({});

  const ready = a.length > 0 && b.length > 0;
  const preview = useMemo(() => (ready ? explainMatchup(a, b, 'freestyle') : null), [a, b, ready]);

  const toggle = (side: 'a' | 'b') => (id: string) => {
    const [list, set] = side === 'a' ? [a, setA] : [b, setB];
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, MAX_PER_SIDE));
    setOdds(null);
    setFight(null);
    setStories({});
  };

  const simulate = () => {
    setSimming(true);
    // Yielded to the browser so the button can repaint before 2,000 fights run.
    setTimeout(() => {
      setOdds(simulateFreestyle(randomSeed(), a, b, FIGHTS));
      setSimming(false);
    }, 0);
  };

  const runOne = async () => {
    const seed = randomSeed();
    const result = runFreestyle(seed, a, b);
    setFight(result);
    setStories({});
    for (const [index, round] of result.rounds.entries()) {
      setPending((p) => ({ ...p, [index]: true }));
      try {
        const response = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            side: character(a[0]).side,
            round,
            runOver: index === result.rounds.length - 1,
          }),
        });
        const data = (await response.json()) as { story?: string };
        setStories((s) => ({ ...s, [index]: data.story ?? '' }));
      } catch {
        setStories((s) => ({ ...s, [index]: '' }));
      } finally {
        setPending((p) => ({ ...p, [index]: false }));
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-sand pb-4">
        <span className="eyebrow">Freestyle</span>
        <h1 className="display text-3xl">Up to three a side. Any mix.</h1>
        <p className="max-w-2xl text-sm text-ash">
          Cross-side synergies only exist here — Gojo and Geto, Toji and Megumi — and so do the
          rivalries that cost you power for putting them on the same team.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow">Side A {a.length ? `· ${a.length}/${MAX_PER_SIDE}` : ''}</h2>
          <Roster chosen={a} other={b} onToggle={toggle('a')} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow">Side B {b.length ? `· ${b.length}/${MAX_PER_SIDE}` : ''}</h2>
          <Roster chosen={b} other={a} onToggle={toggle('b')} />
        </section>
      </div>

      {ready ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[a, b].map((team, i) => (
            <div key={i} className="flex flex-col gap-3">
              {team.map((id) => (
                <CharacterCard key={id} id={id} compact />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {preview ? (
        <section className="panel grid gap-6 p-5 sm:grid-cols-2">
          <BreakdownPanel label="Side A (before the swing)" b={preview.a} />
          <BreakdownPanel label="Side B (before the swing)" b={preview.b} />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="button" onClick={simulate} disabled={!ready || simming}>
          {simming ? 'Running 2,000 fights…' : `Simulate ${FIGHTS.toLocaleString()} fights`}
        </button>
        <button className="btn btn-primary" type="button" onClick={runOne} disabled={!ready}>
          Fight once
        </button>
      </div>

      {odds ? (
        <section className="panel flex flex-col gap-4 p-5">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Side A wins</span>
            <span className="display text-4xl">{odds.aWinPct.toFixed(1)}%</span>
          </div>
          <div className="flex h-3 w-full">
            <div className="bg-curse" style={{ width: `${odds.aWinPct}%` }} />
            <div className="bg-blood" style={{ width: `${100 - odds.aWinPct}%` }} />
          </div>
          <p className="text-xs text-ash">
            {odds.aWins.toLocaleString()} – {odds.bWins.toLocaleString()} over{' '}
            {odds.fights.toLocaleString()} fights. An upset decided a round in{' '}
            {odds.upsetRate.toFixed(1)}% of them. The winner finished with{' '}
            {odds.avgSurvivors.toFixed(2)} still standing on average.
          </p>
        </section>
      ) : null}

      {fight ? (
        <section className="flex flex-col gap-4">
          <h2 className="display text-2xl">
            {fight.winner === 'a' ? 'Side A takes it' : 'Side B takes it'}
          </h2>
          {fight.rounds.map((r, i) => (
            <RoundView
              key={i}
              round={r}
              story={stories[i]}
              storyState={pending[i] ? 'loading' : 'ready'}
              showBreakdown
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
