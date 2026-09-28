/** Ten-frames, base-ten blocks and number lines — rendered from numbers, never from art. */

export function TenFrame({ filled, color = '#d9412b', second = 0, secondColor = '#487A3D', label }: { filled: number; color?: string; second?: number; secondColor?: string; label?: string }) {
  return (
    <svg viewBox="0 0 250 104" className="tenframe" role="img" aria-label={label ?? `${filled + second} of 10`}>
      <rect x="2" y="2" width="246" height="100" rx="8" fill="#fff" stroke="#3d2b1f" strokeWidth="3" />
      {Array.from({ length: 10 }, (_, i) => {
        const x = 2 + (i % 5) * 49.2;
        const y = 2 + Math.floor(i / 5) * 50;
        const fillC = i < filled ? color : i < filled + second ? secondColor : null;
        return (
          <g key={i}>
            <rect x={x} y={y} width="49.2" height="50" fill="none" stroke="#3d2b1f" strokeWidth="1.5" />
            {fillC && <circle cx={x + 24.6} cy={y + 25} r="17" fill={fillC} stroke="#3d2b1f" strokeWidth="2" />}
          </g>
        );
      })}
    </svg>
  );
}

export function BaseTen({ n = 0, tens: tensIn, ones: onesIn, label, highlightOnes = 0, crossed = 0, crossedTens = 0 }: {
  n?: number; tens?: number; ones?: number; label?: string; highlightOnes?: number; crossed?: number; crossedTens?: number;
}) {
  const tens = tensIn ?? Math.floor(n / 10);
  const ones = onesIn ?? n % 10;
  return (
    <div className="baseten" role="img" aria-label={label ?? `${tens} tens and ${ones} ones`}>
      <div className="tens">
        {Array.from({ length: tens }, (_, i) => (
          <svg key={i} viewBox="0 0 22 110" className={`rod ${i >= tens - crossedTens ? 'crossed' : ''}`} aria-hidden>
            {Array.from({ length: 10 }, (_, k) => <rect key={k} x="1" y={1 + k * 10.8} width="20" height="10.8" fill="#F7BF35" stroke="#3d2b1f" strokeWidth="1.5" />)}
          </svg>
        ))}
      </div>
      <div className="ones wrap">
        {Array.from({ length: ones }, (_, i) => (
          <svg key={i} viewBox="0 0 22 22" className={`unit ${i >= ones - crossed ? 'crossed' : ''} ${i < highlightOnes ? 'hl' : ''}`} aria-hidden>
            <rect x="1" y="1" width="20" height="20" fill="#bde6f5" stroke="#3d2b1f" strokeWidth="1.5" />
          </svg>
        ))}
      </div>
    </div>
  );
}

export function NumberLine({ from, to, start, hops, dir, label, showHops }: { from: number; to: number; start: number; hops: number; dir: 1 | -1; label?: string; showHops: number }) {
  const n = to - from;
  const W = 600;
  const x = (v: number) => 20 + ((v - from) / n) * (W - 40);
  return (
    <svg viewBox={`0 0 ${W} 110`} className="numberline" role="img" aria-label={label}>
      <line x1="10" y1="80" x2={W - 10} y2="80" stroke="#3d2b1f" strokeWidth="3" />
      {Array.from({ length: n + 1 }, (_, i) => {
        const v = from + i;
        const big = n <= 20 || v % 5 === 0;
        return (
          <g key={v}>
            <line x1={x(v)} y1={big ? 70 : 74} x2={x(v)} y2={90} stroke="#3d2b1f" strokeWidth="2" />
            {big && <text x={x(v)} y="106" textAnchor="middle" fontSize={n > 20 ? 12 : 16} fill="#3d2b1f">{v}</text>}
          </g>
        );
      })}
      <circle cx={x(start)} cy="80" r="7" fill="#F7BF35" stroke="#3d2b1f" strokeWidth="2" />
      {Array.from({ length: Math.min(showHops, hops) }, (_, i) => {
        const a = x(start + dir * i);
        const b = x(start + dir * (i + 1));
        return <path key={i} d={`M${a} 72 Q${(a + b) / 2} 30 ${b} 72`} fill="none" stroke={dir > 0 ? '#487A3D' : '#c0392b'} strokeWidth="3" markerEnd="" />;
      })}
    </svg>
  );
}
