import type { Attempt, AdventureLevelProgress, AdventureProgress, DateStr, Profile, WorldId } from '../learning/types';
import type { CategoryId } from '../engine/types';
import { SUBSKILL_BY_ID } from '../curriculum/curriculum';
import { isSecure, type SkillEvidence } from '../learning/mastery';
import { isUnlocked } from '../learning/planner';
import {
  LEVEL_BY_ID, STORY_WORLDS, friendLevelOf, isSideBranch, levelsOf, mainPath, worldExploreSubskills, type LevelDef,
} from './levels';

/**
 * Adventure progress: petals, stars (shown to the child as 1–3 blooms), unlocking and world
 * summaries. All pure. Stars reward trying on your own — hints never cost petals, time is
 * never read, finishing always earns the first star, and stars never block the path.
 */

export function emptyAdventure(): AdventureProgress {
  return { version: 1, levels: {}, friendsCelebrated: [], lastLevelId: null };
}

const adventureOf = (p: Pick<Profile, 'adventure'>): AdventureProgress => p.adventure ?? emptyAdventure();

export function levelProgress(p: Pick<Profile, 'adventure'>, levelId: string): AdventureLevelProgress | undefined {
  return p.adventure?.levels[levelId];
}

export function starsOf(p: Pick<Profile, 'adventure'>, levelId: string): 0 | 1 | 2 | 3 {
  return levelProgress(p, levelId)?.stars ?? 0;
}

// ---------- petals and stars ----------
/**
 * 2 petals: solved, solution not seen, not skipped, at most one retry (hints never reduce petals).
 * 1 petal: solved after more retries. 0: solution seen, skipped or not solved.
 * Uses only the attempt's own flags — never the evidence cap and never time.
 */
export function petalsForAttempt(a: Pick<Attempt, 'finalCorrect' | 'sawSolution' | 'skipped' | 'retries'>): 0 | 1 | 2 {
  if (!a.finalCorrect || a.sawSolution || a.skipped) return 0;
  return a.retries <= 1 ? 2 : 1;
}

/** Planned questions of a run: inserted follow-up / prerequisite questions are not scored. */
export function scoredAttempts(attempts: Attempt[], sessionId: string): Attempt[] {
  return attempts.filter((a) => a.sessionId === sessionId && a.purpose !== 'follow-up');
}

export function petalsFor(attempts: Attempt[], sessionId: string): { petals: number; max: number } {
  const scored = scoredAttempts(attempts, sessionId);
  return { petals: scored.reduce((s, a) => s + petalsForAttempt(a), 0), max: 2 * scored.length };
}

/** 1 = finished, 2 = at least 60% of petals, 3 = at least 85%. Takes no time argument. */
export function starsFor(petals: number, max: number): 1 | 2 | 3 {
  const r = max > 0 ? petals / max : 0;
  return r >= 0.85 ? 3 : r >= 0.6 ? 2 : 1;
}

/**
 * Record a finished run. Idempotent (the same session is recorded once) and keeps the best
 * result, so stars never go down. Also marks the level's categories as screened, so daily
 * practice can plan without the check-up. Unfinished runs change nothing.
 */
export function recordLevelResult(profile: Profile, levelId: string, sessionId: string, today: DateStr): Profile {
  const level = LEVEL_BY_ID[levelId];
  const rec = profile.sessions.find((s) => s.id === sessionId);
  if (!level || !rec?.completed) return profile;
  const adv = adventureOf(profile);
  const prev = adv.levels[levelId];
  if (prev?.lastSessionId === sessionId) return profile;
  const scored = scoredAttempts(profile.attempts, sessionId);
  if (!scored.length) return profile;
  const petals = scored.reduce((s, a) => s + petalsForAttempt(a), 0);
  const max = 2 * scored.length;
  const stars = starsFor(petals, max);
  const better = !prev || petals / max > prev.bestPetals / Math.max(1, prev.maxPetals);
  const next: AdventureLevelProgress = {
    stars: Math.max(prev?.stars ?? 0, stars) as AdventureLevelProgress['stars'],
    bestPetals: better ? petals : prev.bestPetals,
    maxPetals: better ? max : prev.maxPetals,
    plays: (prev?.plays ?? 0) + 1,
    firstClearedOn: prev?.firstClearedOn ?? today,
    lastPlayedOn: today,
    lastSessionId: sessionId,
  };
  const cats = new Set<CategoryId>(scored.map((a) => a.category));
  return {
    ...profile,
    screened: [...new Set([...profile.screened, ...cats])],
    adventure: { ...adv, levels: { ...adv.levels, [levelId]: next }, lastLevelId: levelId },
  };
}

/** Nectar for each newly reached star on a level. */
export const STAR_BONUS = 2;
export const starBonusKey = (levelId: string, k: number) => `adv:${levelId}:star${k}`;

/** Pay the one-off star bonus for every star reached and not yet paid (once ever per star). */
export function awardStarBonus(profile: Profile, levelId: string): { profile: Profile; bonus: number } {
  const stars = starsOf(profile, levelId);
  const keys = Array.from({ length: stars }, (_, i) => starBonusKey(levelId, i + 1)).filter((k) => !profile.awarded.includes(k));
  if (!keys.length) return { profile, bonus: 0 };
  const bonus = keys.length * STAR_BONUS;
  return { profile: { ...profile, nectar: profile.nectar + bonus, awarded: [...profile.awarded, ...keys] }, bonus };
}

/** The friend cutscene is shown once per world. */
export function markFriendCelebrated(profile: Profile, world: WorldId): Profile {
  const adv = adventureOf(profile);
  if (adv.friendsCelebrated.includes(world)) return profile;
  return { ...profile, adventure: { ...adv, friendsCelebrated: [...adv.friendsCelebrated, world] } };
}

// ---------- unlocking ----------
type Ctx = Pick<Profile, 'adventure' | 'settings'>;

export interface WorldStatus {
  open: boolean;
  /** opened because every explore subskill is already secure: "Your bee already knows this path!" */
  knowsPath: boolean;
}

/**
 * A world opens when the previous friend level is finished, or when every explore subskill
 * in it is already secure from other play, or with the parent's "open all". A world that
 * has been played stays open. The bonus world opens with its gated levels.
 */
export function worldStatus(world: WorldId, p: Ctx, ev: Record<string, SkillEvidence>): WorldStatus {
  if (world === 'bonus') return { open: p.settings.adventureOpenAll || levelsOf('bonus').some((l) => isLevelVisible(l, p, ev)), knowsPath: false };
  const i = STORY_WORLDS.indexOf(world);
  const prevFriend = i > 0 ? friendLevelOf(STORY_WORLDS[i - 1]) : undefined;
  const byPath = i === 0 || (!!prevFriend && starsOf(p, prevFriend.id) >= 1) || levelsOf(world).some((l) => starsOf(p, l.id) >= 1);
  if (byPath || p.settings.adventureOpenAll) return { open: true, knowsPath: false };
  const explore = worldExploreSubskills(world, p.settings);
  const knows = explore.length > 0 && explore.every((s) => isSecure(ev[s]));
  return { open: knows, knowsPath: knows };
}

export function isWorldOpen(world: WorldId, p: Ctx, ev: Record<string, SkillEvidence>): boolean {
  return worldStatus(world, p, ev).open;
}

/** Bonus levels appear only when their gated subskill is unlocked; every other level is always shown. */
export function isLevelVisible(level: LevelDef, p: Ctx, ev: Record<string, SkillEvidence>): boolean {
  if (!level.gatedSubskill) return true;
  const sub = SUBSKILL_BY_ID[level.gatedSubskill];
  return !!sub && isUnlocked(sub, ev, p);
}

/**
 * Level n+1 opens when the main-path level before it is finished (≥ 1 star). Side-branch
 * levels open from the main-path level before them and never block anything.
 */
export function isLevelUnlocked(level: LevelDef, p: Ctx, ev: Record<string, SkillEvidence>): boolean {
  if (!isLevelVisible(level, p, ev)) return false;
  if (p.settings.adventureOpenAll || starsOf(p, level.id) >= 1) return true;
  if (level.world === 'bonus') return true;
  if (!isWorldOpen(level.world, p, ev)) return false;
  const all = levelsOf(level.world);
  const before = all.slice(0, all.indexOf(level)).filter((l) => !isSideBranch(l, p.settings));
  const prev = before[before.length - 1];
  return !prev || starsOf(p, prev.id) >= 1;
}

// ---------- what next ----------
/**
 * The level to suggest next: after `afterId`, the next unlocked level on the main path in
 * the same world (or the first one in the next open world); otherwise the first unlocked
 * main-path level not finished yet. Null when everything open is finished.
 */
export function nextLevelId(p: Ctx, ev: Record<string, SkillEvidence>, afterId?: string): string | null {
  const order = STORY_WORLDS.flatMap((w) => mainPath(w, p.settings));
  const fresh = (l: LevelDef) => starsOf(p, l.id) === 0 && isLevelUnlocked(l, p, ev);
  const after = afterId ? LEVEL_BY_ID[afterId] : undefined;
  if (after && after.world !== 'bonus') {
    // path position (world, n): side-branch levels continue from the main-path level after them
    const key = (l: LevelDef) => STORY_WORLDS.indexOf(l.world) * 100 + l.n;
    const start = order.findIndex((l) => key(l) > key(after));
    const hit = start >= 0 ? order.slice(start).find(fresh) : undefined;
    if (hit) return hit.id;
  }
  return order.find(fresh)?.id ?? null;
}

export interface WorldSummary {
  world: WorldId;
  open: boolean;
  knowsPath: boolean;
  /** stars collected on the levels shown */
  stars: number;
  maxStars: number;
  /** finished main-path levels / all main-path levels */
  done: number;
  total: number;
  /** the friend (or finale) level is finished */
  friendMet: boolean;
  /** the world the child is in now (where the next level is) */
  current: boolean;
}

export function worldSummaries(p: Ctx, ev: Record<string, SkillEvidence>): WorldSummary[] {
  const next = nextLevelId(p, ev);
  const currentWorld = next ? LEVEL_BY_ID[next].world : LEVEL_BY_ID[p.adventure?.lastLevelId ?? '']?.world ?? null;
  return [...STORY_WORLDS, 'bonus' as const].map((w) => {
    const st = worldStatus(w, p, ev);
    const shown = levelsOf(w).filter((l) => isLevelVisible(l, p, ev));
    const path = mainPath(w, p.settings).filter((l) => isLevelVisible(l, p, ev));
    const friend = w === 'bonus' ? undefined : friendLevelOf(w);
    return {
      world: w,
      open: st.open,
      knowsPath: st.knowsPath,
      stars: shown.reduce((s, l) => s + starsOf(p, l.id), 0),
      maxStars: 3 * shown.length,
      done: path.filter((l) => starsOf(p, l.id) >= 1).length,
      total: path.length,
      friendMet: !!friend && starsOf(p, friend.id) >= 1,
      current: w === currentWorld,
    };
  });
}

/** Stars over all levels (cosmetic only). */
export function totalStars(p: Pick<Profile, 'adventure'>): number {
  return Object.entries(p.adventure?.levels ?? {}).reduce((s, [id, l]) => s + (LEVEL_BY_ID[id] ? l.stars : 0), 0);
}

/** Every 15 stars adds a map decoration (cosmetic; nothing is gated by stars). */
export const STARS_PER_DECORATION = 15;
export function mapDecorations(p: Pick<Profile, 'adventure'>): number {
  return Math.floor(totalStars(p) / STARS_PER_DECORATION);
}
