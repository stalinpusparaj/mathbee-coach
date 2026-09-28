import type { CategoryId } from '../engine/types';
import type { Profile } from './types';
import { GARDEN_ITEMS } from '../curriculum/curriculum';
import { isIndependentEvidence } from './mastery';

/**
 * Gamification that only ever goes up: garden levels from lifetime nectar and a sticker
 * book. No lives, no rankings, no streaks that can be lost, nothing for speed. All pure,
 * computed from recorded progress, so it can never be inflated by refreshing.
 */

// ---------- garden levels ----------
export const LEVELS = [
  { key: 'seed', at: 0, icon: '🌱' },
  { key: 'sprout', at: 5, icon: '🌿' },
  { key: 'bud', at: 15, icon: '🌷' },
  { key: 'flower', at: 30, icon: '🌸' },
  { key: 'blossom', at: 50, icon: '🌼' },
  { key: 'buzzy', at: 80, icon: '🐝' },
  { key: 'keeper', at: 120, icon: '🍯' },
  { key: 'star', at: 170, icon: '⭐' },
  { key: 'wizard', at: 230, icon: '🌈' },
  { key: 'master', at: 300, icon: '👑' },
] as const;

/** Nectar ever earned (spending on garden items never lowers it). */
export function lifetimeNectar(p: Pick<Profile, 'nectar' | 'garden'>): number {
  const spent = GARDEN_ITEMS.filter((g) => p.garden.includes(g.id)).reduce((s, g) => s + g.cost, 0);
  return p.nectar + spent;
}

export function levelFor(nectar: number) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (nectar >= LEVELS[k].at) i = k;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    index: i,
    key: cur.key,
    icon: cur.icon,
    nextAt: next?.at ?? null,
    progress: next ? (nectar - cur.at) / (next.at - cur.at) : 1,
  };
}

// ---------- stickers ----------
export interface Sticker { id: string; icon: string; earned: (p: Profile) => boolean }

const solvedOwn = (p: Profile) => p.attempts.filter((a) => isIndependentEvidence(a) && a.firstCorrect);
const inCat = (p: Profile, c: CategoryId) => solvedOwn(p).filter((a) => a.category === c).length;
const days = (p: Profile) => new Set(p.attempts.map((a) => a.date)).size;

export const STICKERS: Sticker[] = [
  { id: 'first-correct', icon: '🌟', earned: (p) => solvedOwn(p).length >= 1 },
  { id: 'fixer', icon: '🔧', earned: (p) => p.attempts.some((a) => !a.firstCorrect && a.finalCorrect && !a.sawSolution) },
  { id: 'hint-hero', icon: '💡', earned: (p) => p.attempts.some((a) => a.hints > 0 && a.finalCorrect) },
  { id: 'ten-own', icon: '🐝', earned: (p) => solvedOwn(p).length >= 10 },
  { id: 'fifty-own', icon: '🏅', earned: (p) => solvedOwn(p).length >= 50 },
  { id: 'hundred-own', icon: '🏆', earned: (p) => solvedOwn(p).length >= 100 },
  { id: 'first-lesson', icon: '📖', earned: (p) => p.sessions.some((s) => s.mode === 'lesson' && s.completed) },
  { id: 'first-session', icon: '🎒', earned: (p) => p.sessions.some((s) => s.completed) },
  { id: 'explorer', icon: '🧭', earned: (p) => new Set(p.attempts.map((a) => a.category)).size >= 7 },
  { id: 'all-places', icon: '🗺️', earned: (p) => new Set(p.attempts.map((a) => a.category)).size >= 14 },
  { id: 'checkup', icon: '🩺', earned: (p) => p.screened.length >= 14 },
  { id: 'counter', icon: '🌼', earned: (p) => inCat(p, 'C01') >= 5 },
  { id: 'pair-maker', icon: '💐', earned: (p) => inCat(p, 'C07') >= 3 },
  { id: 'clock-reader', icon: '🕰️', earned: (p) => inCat(p, 'C12') >= 3 },
  { id: 'calendar-keeper', icon: '📅', earned: (p) => inCat(p, 'C13') >= 3 },
  { id: 'story-helper', icon: '📜', earned: (p) => inCat(p, 'C14') >= 3 },
  { id: 'worksheet-whiz', icon: '📝', earned: (p) => solvedOwn(p).filter((a) => a.format === 'plain').length >= 5 },
  { id: 'remember', icon: '🧠', earned: (p) => Object.values(p.reviews).some((r) => r.history.some((h) => h.pass)) },
  { id: 'gardener', icon: '🌳', earned: (p) => p.garden.length >= 3 },
  { id: 'three-days', icon: '☀️', earned: (p) => days(p) >= 3 },
  { id: 'seven-days', icon: '🌈', earned: (p) => days(p) >= 7 },
];

export function earnedStickers(p: Profile): string[] {
  return STICKERS.filter((s) => s.earned(p)).map((s) => s.id);
}

/** Stickers earned but not yet shown to the child (announced once on the results screen). */
export function newStickers(p: Profile): string[] {
  const seen = new Set(p.stickersSeen ?? []);
  return earnedStickers(p).filter((id) => !seen.has(id));
}

/** Distinct days with practice — shown as "garden visits", never as a streak that breaks. */
export function gardenVisits(p: Profile): number {
  return days(p);
}

// ---------- cheers ----------
export const CHEERS_NAMED = 12;
export const CHEERS_PLAIN = 8;

/** Pick a cheer different from the previous one (deterministic from a seed). */
export function pickCheer(seed: number, previous: string | null, opts: { named: boolean; fixed: boolean }): string {
  if (opts.fixed) return opts.named ? `cheerFix.named.${(seed % 3) + 1}` : `cheerFix.${(seed % 3) + 1}`;
  const n = opts.named ? CHEERS_NAMED : CHEERS_PLAIN;
  const base = opts.named ? 'cheerName' : 'cheer';
  let k = (seed % n) + 1;
  if (`${base}.${k}` === previous) k = (k % n) + 1;
  return `${base}.${k}`;
}

/** Friendly display form of a nickname ("mickey" → "Mickey"). */
export function displayName(nickname: string): string {
  const n = nickname.trim();
  return n ? n.charAt(0).toLocaleUpperCase() + n.slice(1) : '';
}
