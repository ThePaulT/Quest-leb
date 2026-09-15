import type { Breakdown } from '@/lib/engine.ts';

const ROWS: { key: keyof Breakdown; label: string }[] = [
  { key: 'topPower', label: 'Top power' },
  { key: 'others', label: 'Support' },
  { key: 'flat', label: 'Rung bonus' },
  { key: 'synergy', label: 'Synergy' },
  { key: 'counters', label: 'Counters' },
  { key: 'domain', label: 'Domain' },
  { key: 'specials', label: 'Specials' },
  { key: 'blackFlash', label: 'Black Flash' },
  { key: 'rng', label: 'Swing' },
];

const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

export function CanonBadge({ status }: { status: string }) {
  if (status === 'fan_theory') {
    return (
      <span className="border border-blood px-1 py-px text-[9px] tracking-[0.1em] text-blood uppercase">
        fan theory
      </span>
    );
  }
  if (status === 'canon') return null;
  return (
    <span className="border border-sand px-1 py-px text-[9px] tracking-[0.1em] text-ash uppercase">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function BreakdownPanel({ label, b }: { label: string; b: Breakdown }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="display text-xl">{b.total.toFixed(1)}</span>
      </div>
      <dl className="flex flex-col text-[11px]">
        {ROWS.filter(({ key }) => (b[key] as number) !== 0).map(({ key, label: rowLabel }) => (
          <div key={key} className="flex justify-between border-t border-sand py-1">
            <dt className="text-ash">{rowLabel}</dt>
            <dd>{fmt(b[key] as number)}</dd>
          </div>
        ))}
      </dl>

      {b.firedCounters.length ? (
        <ul className="flex flex-col gap-1 pt-1">
          {b.firedCounters.map((c) => (
            <li key={`${c.attacker_tag}-${c.defender_tag}`} className="text-[11px] leading-relaxed">
              <span className="flex flex-wrap items-center gap-1">
                <span className="text-bone">
                  {c.attacker_tag.replace(/_/g, ' ')} → {c.defender_tag.replace(/_/g, ' ')}
                </span>
                <span className="text-ash">{c.bonus ? `+${c.bonus}` : 'no bonus'}</span>
                {c.copied ? <span className="text-curse">copied</span> : null}
                <CanonBadge status={c.canon_status} />
              </span>
              <span className="text-ash">{c.explanation}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {b.firedSynergies.length ? (
        <ul className="flex flex-col gap-1">
          {b.firedSynergies.map((s) => (
            <li key={s.id} className="text-[11px]">
              <span className="text-bone">{s.label}</span>{' '}
              <span className={s.bonus < 0 ? 'text-blood' : 'text-ash'}>
                {s.bonus > 0 ? `+${s.bonus}` : s.bonus}
              </span>{' '}
              <CanonBadge status={s.canon_status} />
            </li>
          ))}
        </ul>
      ) : null}

      {b.domainNotes.length ? (
        <ul className="flex flex-col gap-1">
          {b.domainNotes.map((d, i) => (
            <li key={`${d.rule}-${i}`} className="text-[11px] text-ash">
              <span className="text-bone">{d.rule.replace(/_/g, ' ')}</span> — {d.text}
            </li>
          ))}
        </ul>
      ) : null}

      {b.specialNotes.length ? (
        <ul className="flex flex-col gap-1">
          {b.specialNotes.map((n, i) => (
            <li key={i} className="text-[11px] text-ash">
              {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
