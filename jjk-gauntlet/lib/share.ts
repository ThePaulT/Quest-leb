/** What a shared run looks like once it is saved, and the copy on its card. */

import { DB, character } from './data.ts';
import type { RoundResult, RunResult } from './engine.ts';
import type { Mode, Side } from './types.ts';

export interface SavedRun {
  id: string;
  createdAt: string;
  mode: Mode;
  side: Side;
  seed: string;
  teamIds: string[];
  result: RunResult;
  /** One narration per round, same order as result.rounds. */
  stories: string[];
}

export interface CardFacts {
  record: string;
  rankTitle: string;
  mvpName: string | null;
  mvpId: string | null;
  lostAt: string | null;
  bestLine: string;
  upset: boolean;
  hype: boolean;
  teamNames: string[];
  sideLabel: string;
  /** Every rung of the ladder and whether the run got past it. */
  rungs: { name: string; cleared: boolean }[];
}

/** The single line from the story that earns the card. */
export function bestStoryLine(run: SavedRun): string {
  const rounds = run.result.rounds;
  const preferred =
    rounds.findIndex((r) => r.upset) >= 0
      ? rounds.findIndex((r) => r.upset)
      : run.result.fullClear
        ? rounds.length - 1
        : rounds.length - 1;
  const story = run.stories[preferred] ?? run.stories[run.stories.length - 1] ?? '';
  const sentences = story
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return '';
  // The longest sentence is almost always the one with the image in it, but a
  // card cannot hold a run-on.
  const usable = sentences.filter((s) => s.length <= 150);
  return (usable.length ? usable : sentences).reduce((best, s) =>
    s.length > best.length ? s : best,
  );
}

export function cardFacts(run: SavedRun): CardFacts {
  const { result } = run;
  const lost = result.fullClear
    ? null
    : (result.rounds[result.rounds.length - 1]?.enemyLabel ?? null);
  const ladder = DB.ladders[run.side];
  return {
    rungs: ladder.rungs.map((id, i) => ({
      name: character(id).name,
      cleared: i < result.rungsCleared,
    })),
    record: result.record,
    rankTitle: result.rankTitle,
    mvpId: result.mvpId,
    mvpName: result.mvpId ? character(result.mvpId).name : null,
    lostAt: lost,
    bestLine: bestStoryLine(run),
    upset: result.upsets > 0,
    hype: result.hype,
    teamNames: run.teamIds.map((id) => character(id).name),
    sideLabel: run.side === 'hero' ? 'Hero Gauntlet' : 'Villain Gauntlet',
  };
}

export function shareText(run: SavedRun): string {
  const f = cardFacts(run);
  const head = run.result.fullClear
    ? `Full clear. ${f.rankTitle}.`
    : `${f.record} — fell to ${f.lostAt}.`;
  return `${head} ${f.teamNames.join(' / ')} in the ${f.sideLabel}.${
    f.upset ? ' UPSET.' : ''
  }`;
}

export function roundHeadline(r: RoundResult): string {
  if (r.won) return `${r.enemyLabel} falls`;
  return `${r.enemyLabel} holds`;
}
