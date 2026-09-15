/**
 * The shared result-card artwork, rendered by next/og for both the vertical
 * "save image" card and the 1200x630 OG image for /run/[id].
 *
 * Satori (what next/og renders with) only lays out flexbox, so every container
 * here is explicitly flex and every style is inline.
 */

import type { CardFacts } from './share.ts';

export const INK = '#0B0B0C';
export const BONE = '#EDE9E3';
export const BLOOD = '#C4352B';
export const CURSE = '#4E8F92';
export const ASH = '#6E6A64';

interface CardProps extends CardFacts {
  width: number;
  height: number;
  url: string;
  fullClear: boolean;
}

function Stamp({ label, color, rotate }: { label: string; color: string; rotate: number }) {
  return (
    <div
      style={{
        display: 'flex',
        border: `4px solid ${color}`,
        color,
        padding: '6px 18px',
        fontSize: 30,
        letterSpacing: 6,
        fontWeight: 700,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {label}
    </div>
  );
}

export function ResultCard(props: CardProps) {
  const {
    width,
    height,
    record,
    rankTitle,
    mvpName,
    lostAt,
    bestLine,
    upset,
    hype,
    teamNames,
    sideLabel,
    rungs,
    url,
    fullClear,
  } = props;
  const vertical = height > width;
  const scale = vertical ? 1 : 0.62;
  const px = (n: number) => Math.round(n * scale);
  const accent = sideLabel.startsWith('Hero') ? CURSE : BLOOD;

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: INK,
        color: BONE,
        padding: px(64),
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `2px solid ${ASH}`,
            paddingBottom: px(20),
          }}
        >
          <div style={{ display: 'flex', fontSize: px(30), letterSpacing: px(8), color: BONE }}>
            JJK GAUNTLET
          </div>
          <div style={{ display: 'flex', fontSize: px(26), letterSpacing: px(3), color: accent }}>
            {sideLabel.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: px(56) }}>
          <div style={{ display: 'flex', fontSize: px(28), letterSpacing: px(6), color: ASH }}>
            {fullClear ? 'RESULT' : 'RECORD'}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: px(fullClear ? 130 : 190),
              fontWeight: 700,
              lineHeight: 1,
              color: fullClear ? accent : BONE,
              marginTop: px(8),
            }}
          >
            {fullClear ? 'FULL CLEAR' : record}
          </div>
          <div style={{ display: 'flex', fontSize: px(46), marginTop: px(16), color: BONE }}>
            {rankTitle}
          </div>
          {!fullClear && lostAt ? (
            <div style={{ display: 'flex', fontSize: px(30), marginTop: px(12), color: ASH }}>
              Fell at {lostAt}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: px(24),
            letterSpacing: px(5),
            color: ASH,
            marginTop: px(vertical ? 0 : 26),
          }}
        >
          THE LADDER
        </div>
        {vertical ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: px(16) }}>
            {rungs.map((rung, i) => (
              <div
                key={rung.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: `1px solid ${ASH}`,
                  padding: `${px(14)}px 0`,
                  color: rung.cleared ? BONE : ASH,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', width: px(60), fontSize: px(26), color: ASH }}>
                    {i + 1}
                  </div>
                  <div style={{ display: 'flex', fontSize: px(36) }}>{rung.name}</div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: px(24),
                    letterSpacing: px(3),
                    color: rung.cleared ? accent : BLOOD,
                  }}
                >
                  {rung.cleared ? 'CLEARED' : 'HELD'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 1200x630 has no room for five rows: one bar of five cells instead.
          <div style={{ display: 'flex', marginTop: px(14) }}>
            {rungs.map((rung) => (
              <div
                key={rung.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginRight: px(14),
                  borderTop: `${px(8)}px solid ${rung.cleared ? accent : BLOOD}`,
                  paddingTop: px(8),
                  width: px(210),
                  fontSize: px(26),
                  color: rung.cleared ? BONE : ASH,
                }}
              >
                {rung.name}
              </div>
            ))}
          </div>
        )}
        {bestLine ? (
          <div
            style={{
              display: 'flex',
              fontSize: px(vertical ? 44 : 38),
              lineHeight: 1.35,
              color: BONE,
              borderLeft: `${px(6)}px solid ${accent}`,
              paddingLeft: px(24),
              marginTop: px(48),
            }}
          >
            {bestLine}
          </div>
        ) : null}
        {upset || hype ? (
          <div style={{ display: 'flex', gap: px(24), marginTop: px(40) }}>
            {upset ? <Stamp label="UPSET" color={BLOOD} rotate={-4} /> : null}
            {hype ? <Stamp label="HYPE" color={CURSE} rotate={3} /> : null}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: px(28) }}>
          <div style={{ display: 'flex', fontSize: px(24), letterSpacing: px(5), color: ASH }}>
            SQUAD
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: px(10) }}>
            {teamNames.map((name) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  fontSize: px(34),
                  border: `1px solid ${ASH}`,
                  padding: `${px(8)}px ${px(16)}px`,
                  marginRight: px(12),
                  marginTop: px(10),
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: `2px solid ${ASH}`,
            paddingTop: px(20),
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: px(22), letterSpacing: px(4), color: ASH }}>
              MVP
            </div>
            <div style={{ display: 'flex', fontSize: px(34), color: BONE }}>{mvpName ?? '—'}</div>
          </div>
          <div style={{ display: 'flex', fontSize: px(24), color: ASH }}>{url}</div>
        </div>
      </div>
    </div>
  );
}
