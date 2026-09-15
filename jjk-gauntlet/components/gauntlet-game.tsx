'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { DB, RULES, character } from '@/lib/data.ts';
import { rollDraft } from '@/lib/draft.ts';
import type { RunResult } from '@/lib/engine.ts';
import { runGauntlet } from '@/lib/engine.ts';
import { randomSeed } from '@/lib/rng.ts';
import type { Mode, Side } from '@/lib/types.ts';

import { CharacterCard } from './character-card.tsx';
import { RoundView } from './round-view.tsx';
import { ShareButtons } from './share-buttons.tsx';

type Phase = 'side' | 'draft' | 'fight' | 'done';

interface Props {
  mode: Mode;
  /** Daily supplies its seeds from the server, so every player in a UTC day
   *  gets the same ones. The Gauntlet rolls a fresh seed per run instead. */
  fixedSeeds?: Record<Side, string>;
  intro?: React.ReactNode;
}

export function GauntletGame({ mode, fixedSeeds, intro }: Props) {
  const [phase, setPhase] = useState<Phase>('side');
  const [side, setSide] = useState<Side>('hero');
  const [seed, setSeed] = useState('');
  const [picks, setPicks] = useState<string[]>([]);
  const [rerolls, setRerolls] = useState<Record<number, number>>({});
  const [rerollsLeft, setRerollsLeft] = useState(RULES.rerolls_per_run);
  const [result, setResult] = useState<RunResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [stories, setStories] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<{ id: string; warning?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const round = picks.length;
  const roll = useMemo(
    () => (seed && phase === 'draft' ? rollDraft(seed, side, round, rerolls[round] ?? 0) : null),
    [seed, side, round, rerolls, phase],
  );

  const start = (chosen: Side) => {
    setSide(chosen);
    setSeed(fixedSeeds ? fixedSeeds[chosen] : randomSeed());
    setPicks([]);
    setRerolls({});
    setRerollsLeft(RULES.rerolls_per_run);
    setResult(null);
    setRevealed(0);
    setStories({});
    setSaved(null);
    setPhase('draft');
  };

  const pick = (id: string) => {
    const next = [...picks, id];
    setPicks(next);
    if (next.length === RULES.draft_rounds) {
      setResult(runGauntlet(seed, side, next, mode));
      setPhase('fight');
    }
  };

  const reroll = () => {
    if (rerollsLeft <= 0) return;
    setRerolls((r) => ({ ...r, [round]: (r[round] ?? 0) + 1 }));
    setRerollsLeft((n) => n - 1);
  };

  const narrate = useCallback(
    async (index: number) => {
      if (!result) return;
      const r = result.rounds[index];
      setPending((p) => ({ ...p, [index]: true }));
      try {
        const response = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            side,
            round: r,
            runOver: index === result.rounds.length - 1,
            fullClear: result.fullClear,
          }),
        });
        const data = (await response.json()) as { story?: string };
        setStories((s) => ({ ...s, [index]: data.story ?? '' }));
      } catch {
        setStories((s) => ({ ...s, [index]: '' }));
      } finally {
        setPending((p) => ({ ...p, [index]: false }));
      }
    },
    [result, side],
  );

  // Narration is kicked off by the reveal, not by an effect watching it: the
  // click already knows which round it is uncovering.
  const advance = () => {
    if (!result) return;
    const next = revealed + 1;
    setRevealed(next);
    if (stories[next - 1] === undefined) void narrate(next - 1);
    if (next >= result.rounds.length) setPhase('done');
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          side,
          seed,
          teamIds: picks,
          stories: result.rounds.map((_, i) => stories[i] ?? ''),
        }),
      });
      const data = (await response.json()) as { id?: string; warning?: string; error?: string };
      if (data.id) setSaved({ id: data.id, warning: data.warning });
    } finally {
      setSaving(false);
    }
  };

  // ---- side ---------------------------------------------------------------
  if (phase === 'side') {
    return (
      <div className="flex flex-col gap-8">
        {intro}
        <div className="grid gap-4 sm:grid-cols-2">
          {(['hero', 'villain'] as const).map((s) => {
            const ladder = DB.ladders[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => start(s)}
                className="panel flex cursor-pointer flex-col gap-3 p-6 text-left hover:border-bone"
              >
                <span className="eyebrow">{s === 'hero' ? 'Sorcerers' : 'Curses & killers'}</span>
                <span className="display text-3xl">{ladder.label}</span>
                <span className="text-xs text-ash">
                  {ladder.rungs.map((id) => character(id).name).join(' → ')}
                </span>
                <span className={`text-xs ${s === 'hero' ? 'text-curse' : 'text-blood'}`}>
                  Final boss: {character(ladder.final_boss).name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- draft --------------------------------------------------------------
  if (phase === 'draft' && roll) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-sand pb-4">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">
              Draft {round + 1} of {RULES.draft_rounds} · {roll.groupLabel}
            </span>
            <h1 className="display text-3xl">
              {roll.legendary ? 'A legendary rolled.' : 'Take one.'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-ash">seed {seed}</span>
            <button className="btn" type="button" onClick={reroll} disabled={rerollsLeft <= 0}>
              Reroll ({rerollsLeft})
            </button>
          </div>
        </header>

        {picks.length ? (
          <div className="flex flex-wrap gap-2">
            {picks.map((id) => (
              <span key={id} className="border border-sand px-2 py-1 text-xs text-bone">
                {character(id).name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roll.optionIds.map((id) => (
            <CharacterCard
              key={id}
              id={id}
              disabled={picks.includes(id)}
              onPick={picks.includes(id) ? undefined : () => pick(id)}
              footer={
                id === roll.legendaryId ? (
                  <span className="stamp stamp-press mt-1 self-start text-blood">Legendary</span>
                ) : picks.includes(id) ? (
                  <span className="text-[11px] text-ash">Already drafted</span>
                ) : null
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // ---- fight / done -------------------------------------------------------
  if (!result) return null;

  const ladder = DB.ladders[side];
  const shown = result.rounds.slice(0, revealed);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-sand pb-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">
            {ladder.label} · seed {seed}
          </span>
          <h1 className="display text-3xl">{picks.map((id) => character(id).name).join(' / ')}</h1>
        </div>
        <div className="flex gap-1">
          {ladder.rungs.map((id, i) => {
            const state =
              i < result.rungsCleared && i < revealed
                ? 'done'
                : shown.some((r) => r.rung === i)
                  ? 'live'
                  : 'pending';
            return (
              <span
                key={id}
                title={character(id).name}
                className={[
                  'h-2 w-8',
                  state === 'done' ? 'bg-curse' : state === 'live' ? 'bg-blood' : 'bg-sand',
                ].join(' ')}
              />
            );
          })}
        </div>
      </header>

      {revealed === 0 ? (
        <div className="panel flex flex-col items-start gap-4 p-6">
          <p className="max-w-xl text-sm leading-relaxed text-ash">
            Five rungs, ending at {character(ladder.final_boss).name}. Lose one and somebody is
            carried out; the rung is worn down by {RULES.loss_opponent_weaken} and you go again.
            When nobody is left standing, the run is over.
          </p>
          <button className="btn btn-primary" type="button" onClick={advance}>
            Begin
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {shown.map((r, i) => (
          <RoundView
            key={`${r.rung}-${r.round}`}
            round={r}
            story={stories[i]}
            storyState={pending[i] ? 'loading' : 'ready'}
            showBreakdown
          />
        ))}
      </div>

      {phase === 'fight' && revealed > 0 ? (
        <button className="btn btn-primary self-start" type="button" onClick={advance}>
          {revealed >= result.rounds.length - 1 ? 'See how it ends' : 'Next round'}
        </button>
      ) : null}

      {phase === 'done' ? (
        <section className="panel flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="eyebrow">{result.fullClear ? 'Result' : 'Record'}</span>
              <span className="display text-5xl">
                {result.fullClear ? 'Full clear' : result.record}
              </span>
              <span className="text-lg">{result.rankTitle}</span>
            </div>
            <div className="flex flex-col items-end gap-2">
              {result.upsets > 0 ? <span className="stamp stamp-press text-blood">Upset</span> : null}
              {result.hype ? <span className="stamp text-curse">Hype</span> : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            <div className="flex flex-col border-t border-sand pt-2">
              <dt className="text-ash">MVP</dt>
              <dd>{result.mvpId ? character(result.mvpId).name : '—'}</dd>
            </div>
            <div className="flex flex-col border-t border-sand pt-2">
              <dt className="text-ash">Still standing</dt>
              <dd>
                {result.survivorIds.length
                  ? result.survivorIds.map((id) => character(id).name).join(', ')
                  : 'Nobody'}
              </dd>
            </div>
            <div className="flex flex-col border-t border-sand pt-2">
              <dt className="text-ash">Mastery XP</dt>
              <dd>{result.xp}</dd>
            </div>
            <div className="flex flex-col border-t border-sand pt-2">
              <dt className="text-ash">Seed</dt>
              <dd className="font-mono">{seed}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {saved ? (
              <>
                <Link className="btn" href={`/run/${saved.id}`}>
                  Open run page
                </Link>
                <ShareButtons
                  id={saved.id}
                  text={
                    result.fullClear
                      ? `Full clear. ${result.rankTitle}.`
                      : `${result.record} — ${result.rankTitle}.`
                  }
                />
              </>
            ) : (
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save & share'}
              </button>
            )}
            <button className="btn" type="button" onClick={() => setPhase('side')}>
              Run it again
            </button>
          </div>
          {saved?.warning ? <p className="text-[11px] text-blood">{saved.warning}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
