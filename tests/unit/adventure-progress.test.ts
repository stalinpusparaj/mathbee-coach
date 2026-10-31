import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newProfile } from '../../src/persistence/schema';
import { startSession, checkCurrent, finishCurrent, useHint, showSolution, endSession } from '../../src/learning/session';
import { evaluateAll } from '../../src/learning/mastery';
import { earnedStickers, STICKERS } from '../../src/learning/gamification';
import { generateQuestion } from '../../src/engine/registry';
import { createRng } from '../../src/engine/rng';
import { addDays } from '../../src/learning/dates';
import { LEVEL_BY_ID, WORLD_BY_ID, worldExploreSubskills, levelsOf } from '../../src/adventure/levels';
import { planAdventureLevel } from '../../src/adventure/planner';
import {
  petalsForAttempt, petalsFor, starsFor, recordLevelResult, awardStarBonus, starsOf, isLevelUnlocked, isLevelVisible, worldStatus, nextLevelId,
  worldSummaries, totalStars, mapDecorations, markFriendCelebrated, emptyAdventure, STAR_BONUS, starBonusKey,
} from '../../src/adventure/progress';
import type { AnswerSpec, Response } from '../../src/engine/types';
import type { Attempt, Profile } from '../../src/learning/types';

const D = '2026-10-01';

function right(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'number': return { kind: 'number', value: a.value };
    case 'choice': return { kind: 'choice', value: a.value };
    case 'order': return { kind: 'order', value: [...a.value] };
    case 'fields': return { kind: 'fields', values: Object.fromEntries(a.fields.map((f) => [f.id, f.value])) };
    case 'time': return { kind: 'time', h: a.h, m: a.m };
  }
}
function wrong(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'number': return { kind: 'number', value: a.value + 1 };
    case 'choice': return { kind: 'choice', value: a.options.find((o) => o.id !== a.value)!.id };
    case 'order': return { kind: 'order', value: [...a.value].reverse() };
    case 'fields': return { kind: 'fields', values: Object.fromEntries(a.fields.map((f) => [f.id, f.value + 1])) };
    case 'time': return { kind: 'time', h: (a.h % 12) + 1, m: a.m };
  }
}

/** How the child answers each question: right first time, after k wrong tries, with a hint, after seeing the solution, or skipped. */
type Play = 'right' | 'wrong1' | 'wrong2' | 'hint' | 'solution' | 'skip';

/** Play a whole level through the real session engine, then do what closeSession does. */
function playLevel(p: Profile, levelId: string, sid: string, date: string, how: Play | ((i: number) => Play) = 'right', opts: { stopAfter?: number; seed?: number } = {}) {
  const level = LEVEL_BY_ID[levelId];
  const plan = planAdventureLevel(createRng(opts.seed ?? 42), p, level, date);
  const now = Date.parse(date);
  p = startSession(p, sid, 'adventure', plan, now, { adventure: { levelId, world: level.world, theme: WORLD_BY_ID[level.world].theme } });
  let k = 0;
  while (p.activeSession && !p.activeSession.finished && (opts.stopAfter === undefined || k < opts.stopAfter)) {
    const s = p.activeSession.plan[p.activeSession.index];
    const q = generateQuestion(s.templateId, s.seed, s.format);
    const a = typeof how === 'function' ? how(k) : how;
    k++;
    if (a === 'skip') { p = finishCurrent(p, date, now + k * 1000, { skipped: true }).profile; continue; }
    if (a === 'hint') p = useHint(p);
    if (a === 'solution') p = showSolution(p);
    if (a === 'wrong1' || a === 'wrong2') p = checkCurrent(p, wrong(q.answer), 3000, 0).profile;
    if (a === 'wrong2') p = checkCurrent(p, wrong(q.answer), 3000, 0).profile;
    p = checkCurrent(p, right(q.answer), 3000, 0).profile;
    p = finishCurrent(p, date, now + k * 1000).profile;
  }
  const prevStars = starsOf(p, levelId);
  const ended = endSession(p, date, now + 99_999);
  const recorded = recordLevelResult(ended.profile, levelId, sid, date);
  const { profile, bonus } = awardStarBonus(recorded, levelId);
  return { profile, record: ended.record!, bonus, prevStars, plan };
}

const base = () => newProfile('p', 'bee', 'Ari', 'en', D);
const ev0 = (p: Profile) => evaluateAll(p.attempts, p.settings.mastery);
const att = (over: Partial<Attempt>): Attempt => ({
  id: 'a', sessionId: 's', slot: 0, date: D, ts: 1, templateId: 'c01-e-row', seed: 1, category: 'C01', stage: 'explore', subskill: 'C01.to5',
  format: 'interactive', mode: 'adventure', purpose: 'need', independent: true, firstCorrect: true, finalCorrect: true, retries: 0, hints: 0,
  sawSolution: false, skipped: false, activeMs: 1, interruptions: 0, unannounced: false, ...over,
});

describe('petals and stars', () => {
  it('petals come from the attempt itself: hints never reduce them, more retries give 1, solution or skip give 0', () => {
    expect(petalsForAttempt(att({}))).toBe(2);
    expect(petalsForAttempt(att({ hints: 3, independent: false }))).toBe(2);
    expect(petalsForAttempt(att({ retries: 1, firstCorrect: false }))).toBe(2);
    expect(petalsForAttempt(att({ retries: 2, firstCorrect: false }))).toBe(1);
    expect(petalsForAttempt(att({ sawSolution: true }))).toBe(0);
    expect(petalsForAttempt(att({ skipped: true, finalCorrect: false }))).toBe(0);
    // the evidence cap never lowers petals
    expect(petalsForAttempt(att({ countsAsEvidence: false }))).toBe(2);
  });

  it('stars: 1 for finishing, 2 at 60%, 3 at 85% — and never read time', () => {
    expect(starsFor.length).toBe(2);
    expect(starsFor(0, 12)).toBe(1);
    expect(starsFor(7, 12)).toBe(1);
    expect(starsFor(8, 12)).toBe(2); // 66%
    expect(starsFor(10, 12)).toBe(2); // 83%
    expect(starsFor(11, 12)).toBe(3); // 92%
    expect(starsFor(0, 0)).toBe(1);
    expect(readFileSync('src/adventure/progress.ts', 'utf8')).not.toMatch(/activeMs/);
  });

  it('a level played with hints still blooms fully', () => {
    const { profile } = playLevel(base(), 'w1-01', 's1', D, 'hint');
    expect(starsOf(profile, 'w1-01')).toBe(3);
  });

  it('inserted follow-up questions are not scored, and a level grows by at most 2', () => {
    const { profile, plan } = playLevel(base(), 'w1-06', 's1', D, 'wrong2');
    const run = profile.attempts.filter((a) => a.sessionId === 's1');
    expect(run.length).toBeGreaterThan(plan.length);
    expect(run.length).toBeLessThanOrEqual(plan.length + 2);
    expect(petalsFor(profile.attempts, 's1')).toEqual({ petals: plan.length, max: 2 * plan.length });
    expect(profile.adventure!.levels['w1-06'].maxPetals).toBe(2 * LEVEL_BY_ID['w1-06'].questions);
    expect(starsOf(profile, 'w1-06')).toBe(1);
  });
});

describe('recording results', () => {
  it('keeps the best result: a weaker replay never lowers stars or best petals', () => {
    let { profile } = playLevel(base(), 'w1-01', 's1', D);
    const best = profile.adventure!.levels['w1-01'];
    expect(best).toMatchObject({ stars: 3, bestPetals: 10, maxPetals: 10, plays: 1, firstClearedOn: D, lastPlayedOn: D });
    ({ profile } = playLevel(profile, 'w1-01', 's2', addDays(D, 1), 'solution'));
    const after = profile.adventure!.levels['w1-01'];
    expect(after).toMatchObject({ stars: 3, bestPetals: 10, plays: 2, firstClearedOn: D, lastPlayedOn: addDays(D, 1) });
    expect(profile.adventure!.lastLevelId).toBe('w1-01');
  });

  it('is idempotent per run and ignores unfinished runs', () => {
    const { profile } = playLevel(base(), 'w1-01', 's1', D);
    expect(recordLevelResult(profile, 'w1-01', 's1', D)).toBe(profile);
    const stopped = playLevel(base(), 'w1-01', 's2', D, 'right', { stopAfter: 2 });
    expect(stopped.record.completed).toBe(false);
    expect(stopped.profile.adventure!.levels['w1-01']).toBeUndefined();
    expect(recordLevelResult(profile, 'nope', 's1', D)).toBe(profile);
  });

  it('adds the level\'s categories to the screened list so daily practice can plan', () => {
    const { profile } = playLevel(base(), 'w1-03', 's1', D);
    expect(profile.screened).toContain('C04');
  });

  it('pays the star bonus once ever per star', () => {
    let r = playLevel(base(), 'w1-01', 's1', D, 'solution');
    expect(starsOf(r.profile, 'w1-01')).toBe(1);
    expect(r.bonus).toBe(STAR_BONUS);
    r = playLevel(r.profile, 'w1-01', 's2', addDays(D, 1));
    expect(r.prevStars).toBe(1);
    expect(r.bonus).toBe(2 * STAR_BONUS); // stars 2 and 3
    r = playLevel(r.profile, 'w1-01', 's3', addDays(D, 2));
    expect(r.bonus).toBe(0);
    expect(r.profile.awarded.filter((k) => k.startsWith('adv:w1-01:star'))).toEqual([1, 2, 3].map((k) => starBonusKey('w1-01', k)));
    expect(awardStarBonus(r.profile, 'w1-01').bonus).toBe(0);
  });

  it('pays question and session nectar only on the first play of a level each day', () => {
    const first = playLevel(base(), 'w1-01', 's1', D);
    expect(first.record.nectar).toBe(6); // 5 questions + finishing
    const again = playLevel(first.profile, 'w1-01', 's2', D);
    expect(again.record.nectar).toBe(0);
    expect(again.profile.nectar).toBe(first.profile.nectar);
    const other = playLevel(again.profile, 'w1-02', 's3', D);
    expect(other.record.nectar).toBe(6); // a different level pays
    const tomorrow = playLevel(other.profile, 'w1-01', 's4', addDays(D, 1));
    expect(tomorrow.record.nectar).toBe(6);
  });

  it('stopping a level early never takes nectar away from the first full run that day', () => {
    const stopped = playLevel(base(), 'w1-01', 's1', D, 'right', { stopAfter: 1 });
    expect(stopped.record.nectar).toBe(1);
    expect(stopped.profile.nectar).toBe(1);
    const full = playLevel(stopped.profile, 'w1-01', 's2', D);
    // question 1 was already paid; the other 4 questions and the finishing bonus pay now
    expect(full.record.nectar).toBe(5);
    expect(full.profile.nectar - full.bonus).toBe(6);
    const again = playLevel(full.profile, 'w1-01', 's3', D);
    expect(again.record.nectar).toBe(0);
  });

  it('marks a friend cutscene as shown once', () => {
    const p = markFriendCelebrated(base(), 'w1');
    expect(p.adventure!.friendsCelebrated).toEqual(['w1']);
    expect(markFriendCelebrated(p, 'w1')).toBe(p);
  });
});

describe('unlocking', () => {
  it('a new child starts at the first meadow level; the next level opens when the one before is finished', () => {
    let p = base();
    expect(isLevelUnlocked(LEVEL_BY_ID['w1-01'], p, ev0(p))).toBe(true);
    expect(isLevelUnlocked(LEVEL_BY_ID['w1-02'], p, ev0(p))).toBe(false);
    expect(worldStatus('w2', p, ev0(p)).open).toBe(false);
    p = playLevel(p, 'w1-01', 's1', D, 'skip').profile; // even skipping everything finishes the level
    expect(starsOf(p, 'w1-01')).toBe(1);
    expect(isLevelUnlocked(LEVEL_BY_ID['w1-02'], p, ev0(p))).toBe(true);
  });

  it('the next world opens when the friend level is finished', () => {
    let p = base();
    p = { ...p, settings: { ...p.settings, adventureOpenAll: true } };
    p = playLevel(p, 'w1-12', 's1', D).profile;
    p = { ...p, settings: { ...p.settings, adventureOpenAll: false } };
    expect(worldStatus('w2', p, ev0(p))).toEqual({ open: true, knowsPath: false });
    expect(isLevelUnlocked(LEVEL_BY_ID['w2-01'], p, ev0(p))).toBe(true);
    expect(isLevelUnlocked(LEVEL_BY_ID['w2-02'], p, ev0(p))).toBe(false);
  });

  it('"your bee already knows this path": a world opens when its explore skills are secure', () => {
    const p = base();
    const ev = ev0(p);
    for (const s of worldExploreSubskills('w3', p.settings)) ev[s] = { ...ev[s], state: 'practising-independently' };
    expect(worldStatus('w3', p, ev)).toEqual({ open: true, knowsPath: true });
    expect(isLevelUnlocked(LEVEL_BY_ID['w3-01'], p, ev)).toBe(true);
    expect(isLevelUnlocked(LEVEL_BY_ID['w3-02'], p, ev)).toBe(false);
    // W7 has no explore skills, so it never opens this way
    for (const k of Object.keys(ev)) ev[k] = { ...ev[k], state: 'applying' };
    expect(worldStatus('w7', p, ev).knowsPath).toBe(false);
  });

  it('the parent\'s "open all" opens every world and level', () => {
    const p = { ...base(), settings: { ...base().settings, adventureOpenAll: true } };
    for (const w of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'] as const) {
      expect(worldStatus(w, p, ev0(p)).open).toBe(true);
      for (const l of levelsOf(w)) expect(isLevelUnlocked(l, p, ev0(p))).toBe(true);
    }
  });

  it('with extensions hidden, Ext levels sit on a side branch and never block', () => {
    let p = { ...base(), settings: { ...base().settings, showExtensions: false } };
    for (const id of ['w1-01', 'w1-02', 'w1-03', 'w1-04', 'w1-05', 'w1-06', 'w1-07', 'w1-08']) p = playLevel(p, id, `s-${id}`, D).profile;
    expect(isLevelUnlocked(LEVEL_BY_ID['w1-09'], p, ev0(p))).toBe(true); // optional, still playable
    expect(isLevelUnlocked(LEVEL_BY_ID['w1-10'], p, ev0(p))).toBe(true); // not blocked by w1-09
    expect(nextLevelId(p, ev0(p), 'w1-08')).toBe('w1-10');
    // with extensions shown, the same level is on the main path
    const shown = { ...p, settings: { ...p.settings, showExtensions: true } };
    expect(isLevelUnlocked(LEVEL_BY_ID['w1-10'], shown, ev0(shown))).toBe(false);
    expect(nextLevelId(shown, ev0(shown), 'w1-08')).toBe('w1-09');
  });

  it('bonus levels appear only when the regrouping skill is unlocked', () => {
    const p = base();
    expect(isLevelVisible(LEVEL_BY_ID['bonus-01'], p, ev0(p))).toBe(false);
    expect(isLevelUnlocked(LEVEL_BY_ID['bonus-01'], p, ev0(p))).toBe(false);
    expect(worldStatus('bonus', p, ev0(p)).open).toBe(false);
    const open = { ...p, settings: { ...p.settings, unlockRegrouping: true } };
    expect(isLevelUnlocked(LEVEL_BY_ID['bonus-01'], open, ev0(open))).toBe(true);
    expect(worldStatus('bonus', open, ev0(open)).open).toBe(true);
  });
});

describe('what next and world summaries', () => {
  it('suggests the next unfinished level and moves on through the worlds', () => {
    let p = base();
    expect(nextLevelId(p, ev0(p))).toBe('w1-01');
    p = playLevel(p, 'w1-01', 's1', D).profile;
    expect(nextLevelId(p, ev0(p))).toBe('w1-02');
    expect(nextLevelId(p, ev0(p), 'w1-01')).toBe('w1-02');
  });

  it('summarises each world: stars over the maximum, finished levels, friend met, current world', () => {
    let p = base();
    p = playLevel(p, 'w1-01', 's1', D).profile;
    const sums = worldSummaries(p, ev0(p));
    expect(sums.map((s) => s.world)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'bonus']);
    expect(sums[0]).toMatchObject({ open: true, stars: 3, maxStars: 36, done: 1, total: 12, friendMet: false, current: true });
    expect(sums[1]).toMatchObject({ open: false, stars: 0, current: false });
    expect(sums[7]).toMatchObject({ open: false, maxStars: 0, total: 0 });
    expect(totalStars(p)).toBe(3);
    expect(mapDecorations(p)).toBe(0);
    expect(totalStars({ adventure: { ...emptyAdventure(), levels: { ghost: { stars: 3, bestPetals: 0, maxPetals: 0, plays: 1, firstClearedOn: null, lastPlayedOn: null } } } })).toBe(0);
  });
});

describe('adventure stickers', () => {
  it('finishing earns stickers; there is no all-three-star trophy', () => {
    let p = { ...base(), settings: { ...base().settings, adventureOpenAll: true } };
    expect(earnedStickers(p)).not.toContain('first-star');
    p = playLevel(p, 'w1-01', 's1', D, 'solution').profile; // one bloom is enough
    expect(earnedStickers(p)).toContain('first-star');
    expect(earnedStickers(p)).not.toContain('world-friend-w1');
    p = playLevel(p, 'w1-12', 's2', D, 'skip').profile;
    expect(earnedStickers(p)).toContain('world-friend-w1');
    expect(earnedStickers(p)).not.toContain('adventurer');
    const ids = STICKERS.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['first-star', 'adventurer', ...[1, 2, 3, 4, 5, 6, 7].map((n) => `world-friend-w${n}`)]));
    expect(ids.some((id) => /three-star|perfect/.test(id))).toBe(false);
  });
});
