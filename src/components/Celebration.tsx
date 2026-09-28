import { useEffect, useMemo } from 'react';
import { Sprite } from './art';
import { pickSprite } from '../assets/manifest';
import { useT } from '../i18n/useT';

const COLORS = ['#F7BF35', '#ED8C70', '#487A3D', '#6FB6E0', '#E86A92', '#FFD84D'];
const FLOATERS = ['⭐', '💛', '✨', '🌸', '⭐', '💚', '✨', '🌼'];
const VARIANTS = ['pop', 'swoop', 'spin'] as const;

/**
 * Happy celebration after a correct answer: the bee arrives (pop / swoop / spin, rotating),
 * cheers the child by name, confetti bursts and stars float up. It never blocks the
 * controls (pointer-events: none) and removes itself. With reduced motion only the bee and
 * the message appear.
 */
export function Celebration({ seed, cheerKey, name, onDone, durationMs = 2000, n, big }: {
  seed: number; cheerKey: string; name: string; onDone: () => void; durationMs?: number; n?: number; big?: boolean;
}) {
  const t = useT();
  useEffect(() => {
    const id = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(id);
  }, [onDone, durationMs]);
  const variant = VARIANTS[seed % VARIANTS.length];
  const confetti = useMemo(() => Array.from({ length: big ? 48 : 26 }, (_, i) => {
    const a = ((seed * 37 + i * 97) % 360) * (Math.PI / 180);
    const dist = (big ? 140 : 100) + ((seed + i * 53) % 110);
    return { dx: Math.round(Math.cos(a) * dist), dy: Math.round(Math.sin(a) * dist), color: COLORS[i % COLORS.length], delay: (i % 6) * 35, shape: i % 3 };
  }), [seed]);
  const floaters = useMemo(() => FLOATERS.map((f, i) => ({ f, x: -150 + ((seed * 13 + i * 43) % 300), delay: 150 + i * 90, size: 22 + ((seed + i * 7) % 16) })), [seed]);
  return (
    <div className={`celebration v-${variant} ${big ? 'big' : ''}`} role="status" aria-live="polite" data-testid="celebration">
      <div className="celebration-burst" aria-hidden>
        {confetti.map((p, i) => (
          <span key={i} className={`confetti s${p.shape}`}
            style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, background: p.color, animationDelay: `${p.delay}ms` }} />
        ))}
        {floaters.map((p, i) => (
          <span key={`f${i}`} className="floater" style={{ ['--fx' as string]: `${p.x}px`, animationDelay: `${p.delay}ms`, fontSize: p.size }}>{p.f}</span>
        ))}
      </div>
      <div className="celebration-bee">
        <span className="ring" aria-hidden />
        <Sprite id={pickSprite('bee_celebrate', 'bee')} size={140} decorative />
        <span className="cheer-bubble" data-testid="cheer">{t(cheerKey, { name, n: n ?? 0 })}</span>
      </div>
    </div>
  );
}
