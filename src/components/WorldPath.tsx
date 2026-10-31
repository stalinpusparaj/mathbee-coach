import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { HatBee } from './Fun';

/**
 * The world map path: one winding SVG line from the top of the map down to the friend's
 * house, with a flower bud per level. Layout is a pure function (unit-tested at 320 px);
 * the component measures its width and places HTML buttons over the SVG.
 *
 * Levels on the optional side branch (extensions hidden) sit on their own row at the far
 * side of the map, joined to the level before them by a dotted line — never on the path.
 */

/** Bud button size (child targets ≥ 64 px). */
export const NODE_PX = 72;
/** The friend's house at the end of the path. */
export const HOUSE_PX = 104;
/** Vertical distance between rows (about 110 px apart). */
export const ROW_PX = 112;
const TOP_PAD = 70;
const BOTTOM_PAD = 90;
const EDGE = 8;
/** Narrowest width the layout supports (small phones are 320 px). */
export const MIN_WIDTH = 300;
/** Main-path x positions (fractions of the usable span), repeating. */
const WAVE = [0.5, 0.82, 0.5, 0.18];

export interface PathEntry {
  id: string;
  /** on the dotted side branch */
  side?: boolean;
  /** the friend's house (drawn bigger, centred) */
  big?: boolean;
}

export interface PathNode {
  id: string;
  x: number;
  y: number;
  /** half the button size */
  r: number;
  side: boolean;
  big: boolean;
  /** which side of the bud the title sits on, and how wide it may be without leaving the map */
  labelSide: 'left' | 'right' | 'below';
  labelMax: number;
}

export interface PathLayout {
  width: number;
  height: number;
  nodes: PathNode[];
  /** SVG path through the main-path nodes */
  main: string;
  /** dotted branches to side levels */
  branches: string[];
}

/** Lay out the path for a map `width` px wide. Every row has its own height, so buds never overlap. */
export function layoutWorldPath(entries: PathEntry[], width: number): PathLayout {
  const w = Math.max(MIN_WIDTH, Math.round(width));
  const margin = EDGE + NODE_PX / 2;
  const span = w - 2 * margin;
  const mainIdx = entries.map((e, i) => (e.side ? -1 : i)).filter((i) => i >= 0);
  const xs: number[] = new Array(entries.length).fill(w / 2);
  mainIdx.forEach((i, k) => {
    xs[i] = entries[i].big ? w / 2 : margin + WAVE[k % WAVE.length] * span;
  });
  entries.forEach((e, i) => {
    if (!e.side) return;
    // the path crosses this row about halfway between its neighbours: go to the other edge
    const prev = [...mainIdx].reverse().find((m) => m < i);
    const next = mainIdx.find((m) => m > i);
    const a = prev !== undefined ? xs[prev] : w / 2;
    const b = next !== undefined ? xs[next] : a;
    xs[i] = (a + b) / 2 >= w / 2 ? margin : w - margin;
  });
  const nodes: PathNode[] = entries.map((e, i) => {
    const r = (e.big ? HOUSE_PX : NODE_PX) / 2;
    const x = xs[i];
    const y = TOP_PAD + i * ROW_PX;
    const labelSide: PathNode['labelSide'] = e.big ? 'below' : x <= w / 2 ? 'right' : 'left';
    const room = labelSide === 'right' ? w - (x + r) - 2 * EDGE : labelSide === 'left' ? x - r - 2 * EDGE : w - 2 * EDGE;
    return { id: e.id, x, y, r, side: !!e.side, big: !!e.big, labelSide, labelMax: Math.max(0, Math.min(150, Math.floor(room))) };
  });
  const main = mainIdx.map((i, k) => {
    const n = nodes[i];
    if (k === 0) return `M${n.x} ${n.y - 40}L${n.x} ${n.y}`;
    const p = nodes[mainIdx[k - 1]];
    const dy = n.y - p.y;
    return `C${p.x} ${p.y + dy * 0.5} ${n.x} ${n.y - dy * 0.5} ${n.x} ${n.y}`;
  }).join('');
  const branches = entries.map((e, i) => {
    if (!e.side) return '';
    const prev = [...mainIdx].reverse().find((m) => m < i);
    const p = prev !== undefined ? nodes[prev] : { x: w / 2, y: TOP_PAD - ROW_PX / 2 };
    const n = nodes[i];
    return `M${p.x} ${p.y}Q${n.x} ${p.y} ${n.x} ${n.y}`;
  }).filter(Boolean);
  const last = nodes[nodes.length - 1];
  return { width: w, height: (last ? last.y + last.r : TOP_PAD) + BOTTOM_PAD, nodes, main, branches };
}

/** Reduced motion from the app setting (html.reduce-motion) or the system (unless "full motion"). */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return true;
  const cl = document.documentElement.classList;
  if (cl.contains('reduce-motion')) return true;
  if (cl.contains('full-motion')) return false;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export type BudState = 'done' | 'open' | 'locked';

export interface WorldPathNode extends PathEntry {
  /** 1-based number shown inside the bud */
  n: number;
  title: string;
  /** full spoken label, e.g. "Level 3, Big Pot Small Pot, 2 flowers" */
  label: string;
  state: BudState;
  /** 0–3 blooms */
  stars: number;
  current: boolean;
  /** art for the friend's house */
  art?: ReactNode;
}

/** A bud: closed when locked (never a padlock), opening when ready, a flower when finished. */
export function Bud({ state, n }: { state: BudState; n: number }) {
  return (
    <svg viewBox="0 0 72 72" className="bud-art" aria-hidden>
      <ellipse cx="36" cy="62" rx="20" ry="6" className="bud-shadow" />
      <path d="M36 66 C36 56 36 52 36 46" className="bud-stem" />
      {state === 'locked' ? (
        <>
          <path d="M36 12 C22 22 22 44 36 50 C50 44 50 22 36 12 Z" className="bud-closed" />
          <path d="M36 50 C28 46 24 40 25 32 C30 38 33 44 36 50 Z M36 50 C44 46 48 40 47 32 C42 38 39 44 36 50 Z" className="bud-sepal" />
        </>
      ) : (
        <>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx="36" cy={state === 'done' ? 17 : 22} rx={state === 'done' ? 10 : 8} ry={state === 'done' ? 15 : 12}
              transform={`rotate(${a} 36 34)`} className={state === 'done' ? 'bud-petal' : 'bud-petal opening'} />
          ))}
          <circle cx="36" cy="34" r="15" className="bud-heart" />
        </>
      )}
      <text x="36" y={state === 'locked' ? 37 : 40} textAnchor="middle" className="bud-num">{n}</text>
    </svg>
  );
}

/**
 * The 1–3 blooms a level earned. Only earned flowers are drawn (no empty slots, so nothing
 * reads as missed or invites a replay "to fill it"); nothing at all before the first bloom.
 */
export function Blooms({ n, label }: { n: number; label?: string }) {
  const count = Math.max(0, Math.min(3, Math.round(n)));
  if (count === 0) return null;
  return (
    <span className="adv-blooms" aria-label={label} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true}>
      {Array.from({ length: count }, (_, i) => <span key={i} className="on" aria-hidden>✿</span>)}
    </span>
  );
}

export function WorldPath({ nodes, onOpen, beeAt, beeFrom, hat, label }: {
  nodes: WorldPathNode[];
  onOpen: (id: string) => void;
  /** level the bee sits on */
  beeAt: string | null;
  /** level the bee flies from (900 ms; instant under reduced motion) */
  beeFrom?: string | null;
  hat: string | null;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 360);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = layoutWorldPath(nodes, width);
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  // the bee starts where it was and flies to the current node on the next frame
  const [beeId, setBeeId] = useState<string | null>(beeFrom && byId.has(beeFrom) ? beeFrom : beeAt);
  useEffect(() => {
    if (beeId === beeAt) return;
    if (prefersReducedMotion()) { setBeeId(beeAt); return; }
    const raf = requestAnimationFrame(() => setBeeId(beeAt));
    return () => cancelAnimationFrame(raf);
  }, [beeAt, beeId]);

  // 3-layer parallax: far layers drift slower than the path while the page scrolls
  useEffect(() => {
    const el = box.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--wp-scroll', String(Math.max(0, -el.getBoundingClientRect().top)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const bee = beeId ? byId.get(beeId) : undefined;
  return (
    <div className="wp" ref={box} style={{ height: layout.height }} role="group" aria-label={label}>
      <div className="wp-layer far" aria-hidden />
      <div className="wp-layer mid" aria-hidden />
      <div className="wp-layer near" aria-hidden />
      <svg className="wp-svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden>
        {layout.branches.map((d, i) => <path key={i} d={d} className="wp-branch" />)}
        <path d={layout.main} className="wp-path-edge" />
        <path d={layout.main} className="wp-path" />
      </svg>
      {nodes.map((n) => {
        const p = byId.get(n.id)!;
        return (
          <div key={n.id} className={`wp-node ${n.state} ${n.current ? 'current' : ''} ${n.side ? 'side' : ''} ${n.big ? 'house' : ''}`}
            style={{ left: p.x, top: p.y, width: 2 * p.r, height: 2 * p.r }}>
            <button type="button" className="wp-bud" onClick={() => onOpen(n.id)} aria-label={n.label} data-testid={`level-${n.id}`}
              aria-disabled={n.state === 'locked' || undefined} data-state={n.state}>
              {n.art ?? <Bud state={n.state} n={n.n} />}
            </button>
            <span className={`wp-label ${p.labelSide}`} style={{ maxWidth: p.labelMax }} aria-hidden>
              <span className="wp-title">{n.title}</span>
              {n.state !== 'locked' && <Blooms n={n.stars} />}
            </span>
          </div>
        );
      })}
      {bee && (
        <span className="wp-bee" style={{ transform: `translate(${bee.x + bee.r * 0.55}px, ${bee.y - bee.r - 30}px)` }} data-testid="map-bee" aria-hidden>
          <HatBee hat={hat} size={48} className="bee-idle" />
        </span>
      )}
    </div>
  );
}
