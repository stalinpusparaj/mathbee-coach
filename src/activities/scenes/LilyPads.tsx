import type { PadKind } from './skins';

/**
 * Lily-Pad Hop: the number line drawn as pads on water (ice floes in W4, stones in W5).
 * Same numbers, same start, same hops as the plain number line — the bee sits on the pad it
 * has hopped to, so each tap of the existing hop button is one counted step.
 */
export function LilyLine({ from, to, start, hops, dir, showHops, pad, label }: {
  from: number; to: number; start: number; hops: number; dir: 1 | -1; showHops: number; pad: PadKind; label?: string;
}) {
  const n = Math.max(1, to - from);
  const W = 600;
  const x = (v: number) => 22 + ((v - from) / n) * (W - 44);
  const step = x(from + 1) - x(from);
  const rx = Math.min(16, step * 0.46);
  const shown = Math.min(showHops, hops);
  const at = start + dir * shown;
  const visited = new Set(Array.from({ length: shown + 1 }, (_, k) => start + dir * k));
  return (
    <svg viewBox={`0 0 ${W} 132`} className={`lily-line pad-${pad}`} role="img" aria-label={label}>
      <rect x="2" y="56" width={W - 4} height="50" rx="25" className="lily-water" />
      {Array.from({ length: n + 1 }, (_, i) => {
        const v = from + i;
        const cls = `lily-pad ${v === start ? 'start' : ''} ${visited.has(v) && v !== start ? 'visited' : ''}`;
        const big = n <= 20 || v % 5 === 0;
        return (
          <g key={v}>
            {pad === 'ice'
              ? <polygon className={cls} points={`${x(v) - rx},${80} ${x(v) - rx * 0.4},${70} ${x(v) + rx * 0.7},${71} ${x(v) + rx},${82} ${x(v) + rx * 0.3},${91} ${x(v) - rx * 0.8},${89}`} />
              : pad === 'stone'
                ? <ellipse className={cls} cx={x(v)} cy="81" rx={rx} ry={rx * 0.62} />
                : <path className={cls} d={`M${x(v)} 81 L${x(v) + rx * 0.9} ${81 - rx * 0.3} A${rx} ${rx * 0.62} 0 1 0 ${x(v) + rx * 0.9} ${81 + rx * 0.3} Z`} />}
            {big && <text x={x(v)} y="124" textAnchor="middle" fontSize={n > 20 ? 12 : 16} className="lily-num">{v}</text>}
          </g>
        );
      })}
      {Array.from({ length: shown }, (_, i) => {
        const a = x(start + dir * i);
        const b = x(start + dir * (i + 1));
        return <path key={i} d={`M${a} 70 Q${(a + b) / 2} 30 ${b} 70`} className={`lily-hop ${dir > 0 ? 'fwd' : 'back'}`} />;
      })}
      <g className="lily-bee" style={{ transform: `translate(${x(at)}px, 0px)` }} aria-hidden>
        <ellipse cx="0" cy="58" rx="13" ry="10" className="lily-bee-body" />
        <path d="M-4 49 L-4 67 M4 49 L4 67" className="lily-bee-stripe" />
        <ellipse cx="-5" cy="46" rx="7" ry="5" className="lily-bee-wing" />
        <ellipse cx="6" cy="45" rx="7" ry="5" className="lily-bee-wing" />
      </g>
    </svg>
  );
}
