import type { CategoryId } from '../engine/types';

/**
 * Story worlds for the session journey: the bee hops one platform per question toward a
 * friend at the end. Purely decorative progress — it never affects scoring, and every
 * finished question (with or without help) moves the bee forward.
 */
export type JourneyTheme = 'meadow' | 'river' | 'orchard' | 'ice' | 'trail' | 'town' | 'garden';

export interface ThemeDef {
  platform: string; // sprite id
  goal: string; // sprite id of the friend, or 'svg:hive'
  sky: [string, string];
  far: string; // distant hills
  mid: string; // trees / bushes
  near: string; // foreground grass
  ground: string;
}

export const THEMES: Record<JourneyTheme, ThemeDef> = {
  meadow: { platform: 'flower_potted', goal: 'bunny_florist', sky: ['#bfe6fb', '#fff4d6'], far: '#b9dca0', mid: '#7fbf5f', near: '#5a9e43', ground: '#9fd27f' },
  river: { platform: 'lily_pad', goal: 'frog', sky: ['#b5e2fa', '#eaf8ff'], far: '#a9d6c4', mid: '#6fb47d', near: '#4f9a5c', ground: '#79c2e2' },
  orchard: { platform: 'stepping_stone', goal: 'squirrel_gardener', sky: ['#ffe4b8', '#fff8e8'], far: '#d6d99a', mid: '#8cbf5a', near: '#6aa043', ground: '#b7d98b' },
  ice: { platform: 'ice_floe', goal: 'penguin_wave', sky: ['#cfeeff', '#f6fcff'], far: '#e3f3fb', mid: '#b9def0', near: '#9ccfe6', ground: '#8fcbe8' },
  trail: { platform: 'stepping_stone', goal: 'hedgehog', sky: ['#cfeabf', '#f6fbec'], far: '#9cc88a', mid: '#5f9a4c', near: '#467e37', ground: '#86b86b' },
  town: { platform: 'plank', goal: 'owl_keeper', sky: ['#ffd9b8', '#fff4e6'], far: '#e6c9a0', mid: '#c79f6b', near: '#a07b4b', ground: '#c9b07c' },
  garden: { platform: 'lily_pad', goal: 'svg:hive', sky: ['#c4e8fb', '#fff4d6'], far: '#bfe0a8', mid: '#86c46a', near: '#5f9f48', ground: '#a6d98a' },
};

const BY_CATEGORY: Record<CategoryId, JourneyTheme> = {
  C01: 'meadow', C03: 'meadow', C07: 'meadow',
  C02: 'river', C05: 'river',
  C08: 'orchard', C14: 'orchard',
  C09: 'ice',
  C10: 'trail',
  C04: 'town', C06: 'town', C11: 'town', C12: 'town', C13: 'town',
};

/** One topic → its world; mixed sessions travel through the garden to the Queen's hive. */
export function themeFor(categories: CategoryId[]): JourneyTheme {
  const unique = [...new Set(categories)];
  return unique.length === 1 ? BY_CATEGORY[unique[0]] : 'garden';
}

/**
 * The world is wider than the strip when there are many questions (about 5 platforms per
 * screen), so a camera follows the bee. Units: 1 = the strip's visible width.
 */
export function worldWidth(n: number): number {
  return Math.max(1, (n + 1) / 5);
}

/** Platform x (0..1 of the world) and y (percent of strip height) for n questions plus the goal. */
export function platformPositions(n: number): { x: number; y: number }[] {
  const count = Math.max(1, n);
  const WAVE = [64, 50, 60, 44, 57, 47, 62, 52];
  const pad = 0.06 / worldWidth(count);
  return Array.from({ length: count + 1 }, (_, k) => ({
    x: pad + (k * (1 - 2 * pad)) / count,
    y: k === count ? 52 : WAVE[k % WAVE.length],
  }));
}

/**
 * Camera offset (in strip widths) keeping the bee about a third of the way in, clamped to
 * the world. Parallax layers move by `offset × factor`.
 */
export function cameraOffset(beeX: number, world: number): number {
  return Math.min(Math.max(beeX * world - 0.35, 0), world - 1);
}

/** Story beat for the current step: intro at the start, cheer at halfway. */
export function storyBeat(index: number, total: number): 'intro' | 'mid' | null {
  if (index === 0) return 'intro';
  if (total >= 4 && index === Math.floor(total / 2)) return 'mid';
  return null;
}
