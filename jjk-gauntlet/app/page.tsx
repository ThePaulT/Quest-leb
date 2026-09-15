import Link from 'next/link';

import { DB } from '@/lib/data.ts';

const MODES = [
  {
    href: '/gauntlet',
    name: 'Gauntlet',
    line: 'Pick a side, draft a trio over three rolls, then climb the five-rung ladder.',
    detail: 'One reroll per run. A loss knocks someone out and you try the rung again.',
  },
  {
    href: '/freestyle',
    name: 'Freestyle',
    line: 'Up to three per side, any mix, heroes against curses or anything else.',
    detail: 'Win % from 2,000 simulated fights before you commit to one.',
  },
  {
    href: '/daily',
    name: 'Daily',
    line: 'The same three draft rolls for everyone, seeded by the date.',
    detail: 'Everyone sees the same four faces. What you do with them is yours.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <p className="eyebrow">{DB.scope}</p>
        <h1 className="display max-w-2xl text-4xl leading-tight sm:text-5xl">
          Everyone argues about who beats who. This one actually runs the numbers.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ash">
          Every counter, domain rule, synergy and character special comes out of one database —{' '}
          {DB.characters.length} characters, {DB.counters.length} counters,{' '}
          {DB.synergies.length} synergies. The engine decides the fight from a seed, so a run
          replays exactly. The narration is written after the result is locked in, never before.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => (
          <Link key={m.href} href={m.href} className="panel flex flex-col gap-3 p-5 hover:border-ash">
            <span className="display text-2xl">{m.name}</span>
            <span className="text-sm leading-relaxed text-bone">{m.line}</span>
            <span className="text-xs leading-relaxed text-ash">{m.detail}</span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">How a round is decided</h2>
        <p className="max-w-2xl font-mono text-xs leading-relaxed text-ash">
          {DB.rules.team_formula}
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-ash">
          Counters marked <span className="text-blood">fan theory</span> are labelled everywhere
          they appear. They are popular speculation, never shown in the manga, and the database says
          so.
        </p>
      </section>
    </div>
  );
}
