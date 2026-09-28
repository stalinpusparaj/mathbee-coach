import type { Rng } from './rng';
import type { SceneObject } from './types';

/**
 * Object positions in percent of the play field (centre points). Every layout places
 * objects in distinct grid cells, so objects can never overlap; `minSeparation`
 * is checked again by the question validator.
 */
export type LayoutKind = 'row' | 'grid' | 'scatter' | 'dice' | 'columns';

const DICE: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[30, 15], [70, 15], [30, 50], [70, 50], [30, 85], [70, 85]],
};

export function cellsFor(n: number): { cols: number; rows: number } {
  if (n <= 5) return { cols: Math.max(n, 1), rows: 1 };
  if (n <= 10) return { cols: 5, rows: 2 };
  if (n <= 15) return { cols: 5, rows: 3 };
  if (n <= 20) return { cols: 5, rows: 4 };
  return { cols: 10, rows: Math.ceil(n / 10) };
}

export function layoutPositions(n: number, kind: LayoutKind, rng: Rng): { x: number; y: number }[] {
  if (n === 0) return [];
  if (kind === 'dice' && n <= 6) return DICE[n].map(([x, y]) => ({ x, y }));
  if (kind === 'row') {
    const per = n <= 10 ? n : 10;
    const rows = Math.ceil(n / per);
    return Array.from({ length: n }, (_, i) => ({
      x: ((i % per) + 0.5) * (100 / per),
      y: (Math.floor(i / per) + 0.5) * (100 / rows),
    }));
  }
  if (kind === 'columns') {
    // worksheet style: columns of 2–3 stacked objects
    const colSizes: number[] = [];
    let left = n;
    while (left > 0) {
      const s = Math.min(left, left >= 3 && colSizes.length % 2 === 0 ? 3 : 2);
      colSizes.push(s);
      left -= s;
    }
    const cols = colSizes.length;
    const out: { x: number; y: number }[] = [];
    colSizes.forEach((s, c) => {
      for (let r = 0; r < s; r++) out.push({ x: (c + 0.5) * (100 / cols), y: (r + 0.5) * (100 / 3) });
    });
    return out;
  }
  const { cols, rows } = kind === 'scatter' ? scatterCells(n) : cellsFor(n);
  const cellIdx = Array.from({ length: cols * rows }, (_, i) => i);
  const chosen = kind === 'scatter' ? rng.shuffle(cellIdx).slice(0, n).sort((a, b) => a - b) : cellIdx.slice(0, n);
  const cw = 100 / cols;
  const ch = 100 / rows;
  return chosen.map((c) => {
    const jx = kind === 'scatter' ? (rng.next() - 0.5) * cw * 0.3 : 0;
    const jy = kind === 'scatter' ? (rng.next() - 0.5) * ch * 0.3 : 0;
    return { x: ((c % cols) + 0.5) * cw + jx, y: (Math.floor(c / cols) + 0.5) * ch + jy };
  });
}

/** Grid dimensions a layout uses, so renderers can size objects to their cells. */
export function gridDims(n: number, kind: LayoutKind): { cols: number; rows: number } {
  if (n === 0) return { cols: 1, rows: 1 };
  if (kind === 'dice') return { cols: 3, rows: 3 };
  if (kind === 'row') { const per = n <= 10 ? n : 10; return { cols: per, rows: Math.ceil(n / per) }; }
  if (kind === 'columns') {
    let cols = 0; let left = n;
    while (left > 0) { left -= Math.min(left, left >= 3 && cols % 2 === 0 ? 3 : 2); cols++; }
    return { cols, rows: 3 };
  }
  return kind === 'scatter' ? scatterCells(n) : cellsFor(n);
}

function scatterCells(n: number) {
  if (n <= 6) return { cols: 4, rows: 2 };
  if (n <= 12) return { cols: 5, rows: 3 };
  if (n <= 16) return { cols: 6, rows: 3 };
  if (n <= 24) return { cols: 6, rows: 4 };
  return { cols: 7, rows: 5 };
}

export function makeObjects(
  n: number,
  kind: LayoutKind,
  rng: Rng,
  spriteFor: (i: number) => string,
  prefix = 'o',
): SceneObject[] {
  return layoutPositions(n, kind, rng).map((p, i) => ({ id: `${prefix}${i + 1}`, kind: spriteFor(i), x: round(p.x), y: round(p.y) }));
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Minimum pairwise distance (percent units) — used by validation to reject crowded scenes. */
export function minSeparation(objs: { x: number; y: number }[]): number {
  let min = Infinity;
  for (let i = 0; i < objs.length; i++) {
    for (let j = i + 1; j < objs.length; j++) {
      const d = Math.hypot(objs[i].x - objs[j].x, objs[i].y - objs[j].y);
      if (d < min) min = d;
    }
  }
  return min;
}
