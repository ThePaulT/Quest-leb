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

Write 3-4 sentences of tight, present-tense manga narration. Plain prose only:
no markdown, no asterisks or underscores around words, no quotation marks
around technique names. Use the
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

/** Which model writes the story. Gemini first: it has a free tier, which is
 *  what this project runs on. Claude if that key is the one present. Neither
 *  is required — the template below keeps the app playable. */
export type NarrationSource = 'gemini' | 'claude' | 'fallback';

export function activeProvider(): NarrationSource {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return 'fallback';
}

/** Models reach for markdown emphasis even when told not to, and the UI prints
 *  the story as plain text, so the asterisks would show up literally. */
export function cleanStory(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\w)[*_](\S(?:.*?\S)?)[*_](?!\w)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-–—•]\s+/gm, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const GEMINI_HOST = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Google AI Studio's free tier covers the Flash models. Override with
 *  GEMINI_MODEL if Google renames or retires this one — though when it does,
 *  the 404 names the replacement and `narrateWithGemini` follows it. */
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

async function narrateWithGemini(system: string, userBrief: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  const body = (withThinkingOff: boolean) => ({
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userBrief }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 1,
      // Flash models think by default, and thinking tokens come out of the
      // same budget. A 3-4 sentence narration does not need it.
      ...(withThinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  });

  const send = (target: string, withThinkingOff: boolean) =>
    fetch(`${GEMINI_HOST}/${encodeURIComponent(target)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body(withThinkingOff)),
    });

  let used = model;
  let response = await send(used, true);
  let data = (await response.json()) as GeminiResponse;

  // A model that does not accept thinkingConfig rejects the whole request.
  // Retry once without it — but only for that, not for a bad key, which is
  // also a 400.
  if (!response.ok && /thinking/i.test(data.error?.message ?? '')) {
    response = await send(used, false);
    data = (await response.json()) as GeminiResponse;
  }

  // Google retires models, and says so in the 404: "This model models/X is no
  // longer available to new users. Please update your code to use models/Y".
  // Follow the pointer once rather than leaving every round on the template.
  if (!response.ok) {
    const replacement = /use\s+models\/([\w.-]+)/i.exec(data.error?.message ?? '')?.[1];
    if (replacement && replacement !== used) {
      console.error(
        `narration: ${used} is retired; Google points at ${replacement}. ` +
          `Using it for now — set GEMINI_MODEL=${replacement} to make it permanent.`,
      );
      used = replacement;
      response = await send(used, true);
      data = (await response.json()) as GeminiResponse;
      if (!response.ok && /thinking/i.test(data.error?.message ?? '')) {
        response = await send(used, false);
        data = (await response.json()) as GeminiResponse;
      }
    }
  }

  if (!response.ok) {
    const message = data.error?.message ?? 'unknown error';
    console.error(`narration: Gemini ${response.status} (${used}): ${message}`);
    if (/API key not valid|API_KEY_INVALID/i.test(message)) {
      console.error('narration: check GEMINI_API_KEY in .env.local');
    } else if (response.status === 404 || /not found|not supported/i.test(message)) {
      console.error(
        `narration: "${used}" is not available to this key. Set GEMINI_MODEL to one listed by ` +
          'https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY',
      );
    }
    return null;
  }
  if (data.promptFeedback?.blockReason) {
    console.error(`narration: Gemini blocked the prompt (${data.promptFeedback.blockReason})`);
    return null;
  }

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
    console.error(`narration: Gemini stopped early (${candidate.finishReason})`);
    return null;
  }

  const text = cleanStory((candidate?.content?.parts ?? []).map((part) => part.text ?? '').join(''));
  return text || null;
}

async function narrateWithClaude(system: string, userBrief: string): Promise<string | null> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1000,
      system,
      // Narration is a short, well-specified writing task: low effort keeps it
      // fast and cheap without turning thinking off.
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: userBrief }],
    });

    if (response.stop_reason === 'refusal') return null;

    return (
      cleanStory(
        response.content
          .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('\n'),
      ) || null
    );
  } catch (error) {
    const Sdk = (await import('@anthropic-ai/sdk')).default;
    if (error instanceof Sdk.APIError) {
      console.error(`narration: Claude API error ${error.status}: ${error.message}`);
    } else {
      console.error('narration: Claude call failed', error);
    }
    return null;
  }
}

export async function narrateRound(req: NarrationRequest): Promise<{
  story: string;
  source: NarrationSource;
}> {
  const provider = activeProvider();
  if (provider === 'fallback') return { story: fallbackNarration(req), source: 'fallback' };

  const userBrief = brief(req);
  let story: string | null = null;
  try {
    story =
      provider === 'gemini'
        ? await narrateWithGemini(SYSTEM, userBrief)
        : await narrateWithClaude(SYSTEM, userBrief);
  } catch (error) {
    console.error('narration failed', error);
  }

  // Any failure — bad key, quota, safety block, empty answer — lands here, and
  // the round still gets a story.
  return story ? { story, source: provider } : { story: fallbackNarration(req), source: 'fallback' };
}
