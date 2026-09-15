/**
 * Story generation.
 *
 * `rules.ai_role` in the DB: "Narrates the result it is given. Never decides
 * outcomes." The engine has already resolved the round when this runs; the
 * model receives the result as fact and writes 3-4 sentences about it. Nothing
 * it returns is fed back into the engine.
 */

import { character } from './data.ts';
import type { RoundResult } from './engine.ts';
import type { Side } from './types.ts';

export interface NarrationRequest {
  side: Side;
  round: RoundResult;
  /** Set on the last round of a run that ended. */
  runOver?: boolean;
  fullClear?: boolean;
}

const SYSTEM = `You narrate fights in a Jujutsu Kaisen fan game.

The fight has already been decided by the game engine before you are called.
You are given the result as fact. You never decide, change, hedge, or
contradict it: if the brief says a character fell, they fell; if it says the
team won, they won. Never invent a different winner, a survival, or a
"but then...". Never write a cliffhanger that reverses the result.

Write 3-4 sentences of tight, present-tense manga narration. Use the
techniques and the story hooks you are given — they are the material. Name the
characters. Keep it concrete and physical: what the technique does, where it
lands, what it costs. No emoji, no headings, no bullet points, no meta
commentary about rolls, scores, numbers, or probabilities. Do not use the
words "engine", "roll", "dice", or "simulation".`;

function brief(req: NarrationRequest): string {
  const { round, side } = req;
  const team = round.teamIds.map((id) => character(id));
  const enemies = round.enemyIds.map((id) => character(id));
  const fallen = round.fellIds.map((id) => character(id).name);
  const enemyFallen = round.enemyFellIds.map((id) => character(id).name);

  const describe = (c: ReturnType<typeof character>) =>
    `- ${c.name}: ${c.story_hook} Techniques: ${c.techniques.join('; ')}.`;

  const lines = [
    `Side: ${side === 'hero' ? 'sorcerers' : 'curses and killers'}.`,
    `Round ${round.round}${round.rung >= 0 ? ` — ladder rung ${round.rung + 1}` : ''}.`,
    '',
    'The team:',
    ...team.map(describe),
    '',
    'Facing:',
    ...enemies.map(describe),
    '',
    'WHAT HAPPENED (fact, not to be changed):',
    round.won
      ? `The team WINS this round. ${enemies.map((e) => e.name).join(' and ')} goes down.`
      : `The team LOSES this round. ${enemies.map((e) => e.name).join(' and ')} is still standing.`,
  ];

  if (round.upset && round.upsetReason) {
    const who =
      round.upsetSide === 'team'
        ? 'The team pulls off an UPSET and steals a round it was losing'
        : 'The team is UPSET: it was ahead and loses anyway';
    lines.push(`${who} — ${round.upsetReason.replace(/^UPSET — /, '')}`);
  }
  if (round.narrowWin && round.won) lines.push('It was won by a hair.');
  if (fallen.length) lines.push(`Knocked out of the fight: ${fallen.join(', ')}.`);
  if (enemyFallen.length) lines.push(`Also down on the other side: ${enemyFallen.join(', ')}.`);

  const counters = round.team.firedCounters.filter((c) => c.bonus > 0 || c.upset_chance > 0);
  if (counters.length) {
    lines.push(
      'Matchup facts to use:',
      ...counters.map(
        (c) =>
          `- ${c.attacker_tag.replace(/_/g, ' ')} against ${c.defender_tag.replace(/_/g, ' ')}: ${c.explanation}${
            c.canon_status === 'fan_theory' ? ' (fan theory — keep it hedged)' : ''
          }`,
      ),
    );
  }
  const domains = round.enemy.domainNotes.concat(round.team.domainNotes);
  if (domains.length) {
    lines.push('Domain situation: ' + domains.map((d) => d.text).join(' '));
  }
  const specials = [...round.team.specialNotes, ...round.notes]
    .filter(Boolean)
    .map((note) => note.replace(/\s*\([+-]?\d+(?:\s[a-z]+)?\)/g, '').trim());
  if (specials.length) lines.push('Beats to include:', ...specials.map((s) => `- ${s}`));

  if (req.runOver) {
    lines.push(
      req.fullClear
        ? 'This is the final round of the run and the team has cleared the whole ladder. End on that.'
        : 'This is the final round of the run: the team is wiped out here. End on that.',
    );
  }

  return lines.join('\n');
}

/** Used when no API key is configured, and when the API call fails. The app is
 *  playable without a key; the story is just flatter. */
export function fallbackNarration(req: NarrationRequest): string {
  const { round } = req;
  const enemy = round.enemyIds.map((id) => character(id).name).join(' and ');
  const team = round.teamIds.map((id) => character(id));
  const fallen = round.fellIds.map((id) => character(id).name);
  // Stable per round, so the same run always reads the same way.
  const pick = <T,>(options: T[]): T =>
    options[Math.abs(Math.round(round.teamScore * 10) + round.round) % options.length];

  const lead = team[0] ?? character('yuji');
  const anchor = team[team.length - 1] ?? lead;
  const parts: string[] = [];

  parts.push(
    round.won
      ? pick([
          `${lead.name} finds the opening first and does not give it back.`,
          `${enemy} sets the pace for about four seconds. ${lead.name} takes it after that.`,
          `It is ${anchor.name} who turns it, in the half-second ${enemy} spends deciding.`,
        ])
      : pick([
          `${enemy} never gives ${lead.name} the opening, and the exchange runs out of room.`,
          `${lead.name} gets close twice. ${enemy} makes sure there is no third time.`,
          `Every answer ${anchor.name} has, ${enemy} has already accounted for.`,
        ]),
  );

  // Ordered by what a reader would miss most if it were cut.
  const middles: string[] = [];
  if (fallen.length) {
    middles.push(
      `${fallen.join(' and ')} ${fallen.length > 1 ? 'are' : 'is'} carried out of it.`,
    );
  }
  if (round.upset && round.upsetReason) {
    const reason = round.upsetReason.replace(/^UPSET — /, '');
    middles.push(
      round.upsetSide === 'team'
        ? `Against every read of it: ${reason}`
        : `It should not have gone this way: ${reason}`,
    );
  }
  // round.notes are prose; specialNotes carry "+3"-style scoring text meant for
  // the breakdown panel, so they never go into a sentence.
  const beat = round.notes.find((n) => !n.startsWith('UPSET'));
  if (beat) middles.push(beat.endsWith('.') ? beat : `${beat}.`);
  const counter = round.team.firedCounters.find((c) => c.bonus > 0);
  if (counter) middles.push(counter.explanation);

  // The closer carries the result, so it is never the sentence that gets cut.
  const closer = round.won
    ? `${enemy} goes down.`
    : `${enemy} is still standing when the dust drops.`;

  const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  let budget = 4 - sentences(parts[0]) - 1;
  for (const middle of middles) {
    const cost = sentences(middle);
    if (cost > budget) continue;
    parts.push(middle);
    budget -= cost;
  }
  parts.push(closer);

  return parts.join(' ');
}

export async function narrateRound(req: NarrationRequest): Promise<{
  story: string;
  source: 'claude' | 'fallback';
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { story: fallbackNarration(req), source: 'fallback' };
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1000,
      system: SYSTEM,
      // Narration is a short, well-specified writing task: low effort keeps it
      // fast and cheap without turning thinking off.
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: brief(req) }],
    });

    if (response.stop_reason === 'refusal') return { story: fallbackNarration(req), source: 'fallback' };

    const story = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return story ? { story, source: 'claude' } : { story: fallbackNarration(req), source: 'fallback' };
  } catch (error) {
    const Sdk = (await import('@anthropic-ai/sdk')).default;
    if (error instanceof Sdk.APIError) {
      console.error(`narration: API error ${error.status}: ${error.message}`);
    } else {
      console.error('narration failed', error);
    }
    return { story: fallbackNarration(req), source: 'fallback' };
  }
}
