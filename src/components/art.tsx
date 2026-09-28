import { useState, type CSSProperties } from 'react';
import type { BirdSpecies, ShapeKind } from '../engine/types';
import { SPRITES, spriteUrl, hasSprite } from '../assets/manifest';

/** Animal/object kind → sprite id. Kinds without a sprite are drawn in SVG. */
const KIND_TO_SPRITE: Record<string, string> = {
  rabbit: 'rabbit_helper',
  bird: 'bluebird',
  penguin: 'penguin',
  frog: 'frog',
  squirrel: 'squirrel_gardener',
  apple: 'apple',
  apple_green: 'apple_green',
  pear: 'pear',
  orange: 'orange',
  daisy: 'daisy',
  tulip: 'tulip',
  rose: 'rose',
  chocolate: 'chocolate',
  coconut: 'coconut',
  flower: 'daisy',
};

const FALLBACK_COLOR: Record<string, string> = {
  apple: '#d9412b', pear: '#c9c23a', orange: '#f08a1c', daisy: '#f4c430', tulip: '#e86a92', rose: '#c8102e', rabbit: '#b08a64',
  bird: '#3d7bd9', penguin: '#333', frog: '#5aa845', squirrel: '#b5562a', chocolate: '#5b3a1e', coconut: '#7a4b2a',
};

interface SpriteProps { id: string; size?: number | string; alt?: string; style?: CSSProperties; className?: string; decorative?: boolean }

/**
 * Raster sprite with a guaranteed fallback. If the image is missing or fails to load a
 * simple drawn token is shown, so gameplay (e.g. counting) is never blocked by art.
 */
export function Sprite({ id, size = 48, alt, style, className, decorative }: SpriteProps) {
  const [failed, setFailed] = useState(false);
  const mapped = KIND_TO_SPRITE[id] ?? id;
  const url = spriteUrl(mapped);
  const label = decorative ? '' : alt ?? SPRITES[mapped]?.alt ?? id;
  const dim = typeof size === 'number' ? `${size}px` : size;
  if (id === 'turtle' && !hasSprite('turtle')) return <Turtle size={dim} label={label} className={className} style={style} />;
  if (id.startsWith('bird:')) return <Bird species={id.slice(5) as BirdSpecies} size={dim} label={label} />;
  if (!url || failed) {
    return (
      <svg viewBox="0 0 40 40" width={dim} height={dim} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={!label} className={className} style={style}>
        <circle cx="20" cy="20" r="16" fill={FALLBACK_COLOR[id] ?? '#e7a92f'} stroke="#3d2b1f" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      aria-hidden={!label}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
      style={{ width: dim, height: dim, objectFit: 'contain', ...style }}
    />
  );
}

export function Turtle({ size, label, className, style }: { size: string; label: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 70" width={size} height={size} role={label ? 'img' : undefined} aria-label={label || undefined} className={className} style={style}>
      <ellipse cx="82" cy="40" rx="12" ry="9" fill="#8bbf5a" stroke="#3d2b1f" strokeWidth="2.5" />
      <circle cx="86" cy="37" r="2" fill="#3d2b1f" />
      <ellipse cx="28" cy="56" rx="8" ry="6" fill="#8bbf5a" stroke="#3d2b1f" strokeWidth="2.5" />
      <ellipse cx="66" cy="56" rx="8" ry="6" fill="#8bbf5a" stroke="#3d2b1f" strokeWidth="2.5" />
      <path d="M12 50 Q16 14 46 12 Q76 14 78 50 Z" fill="#7a5a2f" stroke="#3d2b1f" strokeWidth="3" />
      <path d="M30 22 L46 32 L62 22 M46 32 L46 50 M22 40 L46 32 L70 40" stroke="#c9a26a" strokeWidth="3" fill="none" />
    </svg>
  );
}

/**
 * Birds drawn with clearly different silhouettes (not just colours):
 * owl = round with ear tufts and big eyes; swan = long curved neck on water;
 * parrot = hooked beak and long tail; ostrich = very long legs and neck;
 * rooster = red comb and arched tail; crow = small black; penguin = upright black-and-white.
 */
export function Bird({ species, size = '48px', label }: { species: BirdSpecies; size?: string; label?: string }) {
  // generated bird art, when present, replaces the drawn silhouette (same species, same role)
  const art = spriteUrl(`bird_${species}`);
  if (art) return <img src={art} alt={label ?? ''} aria-hidden={!label} draggable={false} style={{ width: size, height: size, objectFit: 'contain' }} />;
  const common = { width: size, height: size, viewBox: '0 0 100 100', role: label ? 'img' : undefined, 'aria-label': label || undefined, 'aria-hidden': !label } as const;
  const ink = '#3d2b1f';
  switch (species) {
    case 'owl':
      return (
        <svg {...common}>
          <path d="M28 22 L34 36 L40 26 Z M72 22 L66 36 L60 26 Z" fill="#8a5a2b" stroke={ink} strokeWidth="2" />
          <ellipse cx="50" cy="58" rx="26" ry="32" fill="#a0703d" stroke={ink} strokeWidth="3" />
          <ellipse cx="50" cy="66" rx="16" ry="20" fill="#e8cfa2" />
          <circle cx="40" cy="44" r="10" fill="#fff" stroke={ink} strokeWidth="2" />
          <circle cx="60" cy="44" r="10" fill="#fff" stroke={ink} strokeWidth="2" />
          <circle cx="40" cy="44" r="5" fill={ink} />
          <circle cx="60" cy="44" r="5" fill={ink} />
          <path d="M46 52 L50 60 L54 52 Z" fill="#f0a020" />
          <path d="M40 90 L44 84 M60 90 L56 84" stroke="#f0a020" strokeWidth="3" />
        </svg>
      );
    case 'swan':
      return (
        <svg {...common}>
          <path d="M6 84 Q50 92 94 84" stroke="#6fb6e0" strokeWidth="5" fill="none" />
          <path d="M22 76 Q20 58 44 60 L70 62 Q86 64 82 78 Z" fill="#fff" stroke={ink} strokeWidth="3" />
          <path d="M66 64 Q58 40 62 24 Q66 12 74 16" stroke={ink} strokeWidth="11" fill="none" strokeLinecap="round" />
          <path d="M66 64 Q58 40 62 24 Q66 12 74 16" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M74 14 L86 20 L74 22 Z" fill="#f07820" stroke={ink} strokeWidth="1.5" />
          <circle cx="70" cy="17" r="1.8" fill={ink} />
        </svg>
      );
    case 'parrot':
      return (
        <svg {...common}>
          <path d="M40 70 L30 98 L42 96 L48 72 Z" fill="#2f8f3a" stroke={ink} strokeWidth="2" />
          <ellipse cx="50" cy="50" rx="18" ry="26" fill="#3cb44b" stroke={ink} strokeWidth="3" />
          <path d="M40 48 Q30 62 42 74" fill="#e53935" stroke={ink} strokeWidth="2" />
          <circle cx="54" cy="30" r="14" fill="#3cb44b" stroke={ink} strokeWidth="3" />
          <path d="M64 28 Q76 30 70 44 Q66 36 62 36 Z" fill="#f4c430" stroke={ink} strokeWidth="2" />
          <circle cx="56" cy="27" r="3" fill="#fff" stroke={ink} />
          <circle cx="56.5" cy="27" r="1.5" fill={ink} />
          <path d="M44 76 L42 84 M54 76 L56 84" stroke={ink} strokeWidth="3" />
        </svg>
      );
    case 'ostrich':
      return (
        <svg {...common}>
          <path d="M44 62 L40 96 M56 62 L60 96" stroke="#d8a07a" strokeWidth="4" />
          <ellipse cx="50" cy="52" rx="24" ry="14" fill="#2b2b2b" stroke={ink} strokeWidth="2" />
          <path d="M28 50 Q20 44 26 38 Q34 46 34 50" fill="#fff" stroke={ink} strokeWidth="2" />
          <path d="M64 46 Q70 26 68 10" stroke="#e7b99a" strokeWidth="6" fill="none" strokeLinecap="round" />
          <ellipse cx="70" cy="9" rx="6" ry="5" fill="#e7b99a" stroke={ink} strokeWidth="2" />
          <path d="M75 9 L83 11 L75 13 Z" fill="#f0a020" />
          <circle cx="70" cy="8" r="1.5" fill={ink} />
        </svg>
      );
    case 'rooster':
      return (
        <svg {...common}>
          <path d="M30 56 Q6 40 16 18 Q24 36 34 40 Q20 22 30 8 Q36 32 44 44 Z" fill="#1f7a4d" stroke={ink} strokeWidth="2" />
          <ellipse cx="52" cy="60" rx="22" ry="18" fill="#c0612b" stroke={ink} strokeWidth="3" />
          <circle cx="68" cy="36" r="11" fill="#e08a3c" stroke={ink} strokeWidth="3" />
          <path d="M60 26 Q62 16 66 24 Q68 14 72 24 Q76 16 76 28" fill="#e53935" stroke={ink} strokeWidth="2" />
          <path d="M78 36 L88 39 L78 42 Z" fill="#f4c430" stroke={ink} strokeWidth="1.5" />
          <path d="M74 44 Q78 52 72 52 Q70 46 72 44 Z" fill="#e53935" />
          <circle cx="71" cy="34" r="2" fill={ink} />
          <path d="M46 76 L44 92 M58 76 L60 92" stroke="#f0a020" strokeWidth="4" />
        </svg>
      );
    case 'crow':
      return (
        <svg {...common}>
          <path d="M18 60 L6 70 L22 66 Z" fill="#222" />
          <ellipse cx="44" cy="58" rx="24" ry="14" fill="#222" stroke="#000" strokeWidth="2" />
          <circle cx="68" cy="46" r="10" fill="#222" />
          <path d="M76 44 L90 48 L76 50 Z" fill="#555" />
          <circle cx="70" cy="44" r="1.8" fill="#fff" />
          <path d="M40 70 L38 84 M50 70 L52 84" stroke="#222" strokeWidth="3" />
        </svg>
      );
    case 'penguin':
      return (
        <svg {...common}>
          <ellipse cx="50" cy="56" rx="22" ry="32" fill="#222" stroke="#000" strokeWidth="2" />
          <ellipse cx="50" cy="62" rx="14" ry="24" fill="#fff" />
          <circle cx="44" cy="36" r="3" fill="#fff" />
          <circle cx="56" cy="36" r="3" fill="#fff" />
          <path d="M46 44 L50 50 L54 44 Z" fill="#f0a020" />
          <path d="M40 88 L34 94 L46 92 M60 88 L66 94 L54 92" fill="#f0a020" stroke="#f0a020" strokeWidth="2" />
        </svg>
      );
  }
}

/** Precise SVG geometry for shapes. `w`/`h` are relative sizes (1 = standard). */
export function ShapeSvg({ shape, rotation = 0, w = 1, h = 1, size = 120, outline, fill = '#bde6f5', label, onSide, onCorner, marked }: {
  shape: ShapeKind; rotation?: number; w?: number; h?: number; size?: number; outline?: boolean; fill?: string; label?: string;
  onSide?: (i: number) => void; onCorner?: (i: number) => void; marked?: { sides: number[]; corners: number[] };
}) {
  const pts = shapePoints(shape, w, h);
  const stroke = outline ? '#3d2b1f' : '#3d2b1f';
  const dash = outline ? '6 5' : undefined;
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} role="img" aria-label={label}>
      <g transform={`rotate(${rotation})`}>
        {shape === 'circle' ? (
          <circle cx="0" cy="0" r={40 * Math.min(w, h)} fill={outline ? 'none' : fill} stroke={stroke} strokeWidth="3" strokeDasharray={dash} />
        ) : (
          <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={outline ? 'none' : fill} stroke={stroke} strokeWidth="3" strokeDasharray={dash} strokeLinejoin="round" />
        )}
        {onSide && shape !== 'circle' && pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length];
          const on = marked?.sides.includes(i);
          return (
            <line key={`s${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={on ? '#487A3D' : 'transparent'} strokeWidth={on ? 7 : 14}
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }} onClick={() => onSide(i)} data-testid={`side-${i}`} />
          );
        })}
        {onCorner && shape !== 'circle' && pts.map((p, i) => {
          const on = marked?.corners.includes(i);
          return <circle key={`c${i}`} cx={p[0]} cy={p[1]} r={on ? 6 : 9} fill={on ? '#ED8C70' : 'rgba(0,0,0,0.001)'} stroke={on ? '#3d2b1f' : 'none'} style={{ cursor: 'pointer' }} onClick={() => onCorner(i)} data-testid={`corner-${i}`} />;
        })}
      </g>
    </svg>
  );
}

export function shapePoints(shape: ShapeKind, w = 1, h = 1): [number, number][] {
  const R = 42;
  const reg = (n: number, start = -90) => Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180;
    return [Math.round(R * Math.cos(a) * 10) / 10, Math.round(R * Math.sin(a) * 10) / 10] as [number, number];
  });
  switch (shape) {
    case 'triangle': return reg(3);
    case 'square': { const s = 34 * Math.min(w, h); return [[-s, -s], [s, -s], [s, s], [-s, s]]; }
    case 'rectangle': {
      const k = 50 / Math.max(w, h);
      const hw = (w * k) / 1.15;
      const hh = (h * k) / 1.15;
      return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    }
    case 'pentagon': return reg(5);
    case 'hexagon': return reg(6, 0);
    case 'circle': return [];
  }
}
