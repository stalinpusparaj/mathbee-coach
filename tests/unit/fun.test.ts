import { describe, it, expect } from 'vitest';
import { newProfile } from '../../src/persistence/schema';
import {
  comboAt, questsFor, goldenDays, giftWaiting, openGift, treasureFor, treasureCounts, friendsMet, hatsUnlocked, currentHat, suggestRest, TREASURES, HATS, REST_AFTER,
  minutesPlayed, sessionEndDue,
} from '../../src/learning/fun';
import { t } from '../../src/i18n/i18n';
import type { Attempt, Profile, SessionRecord, SlotState } from '../../src/learning/types';

const D = '2026-09-29';
const base = (): Profile => newProfile('p', 'bee', 'mickey', 'en', D);
const att = (over: Partial<Attempt>): Attempt => ({
  id: Math.random().toString(36), sessionId: 's', slot: 0, date: D, ts: 1, templateId: 'c01-e-row', seed: 1, category: 'C01', stage: 'explore',
  subskill: 'C01.to5', format: 'interactive', mode: 'practice', purpose: 'need', independent: true, firstCorrect: true, finalCorrect: true, retries: 0,
  hints: 0, sawSolution: false, skipped: false, activeMs: 3000, interruptions: 0, unannounced: false, ...over,
});
const sess = (over: Partial<SessionRecord>): SessionRecord => ({
  id: Math.random().toString(36), mode: 'practice', date: D, startedAt: 1, endedAt: 2, questions: 6, independentCorrect: 5, supportedCompleted: 1, nectar: 5,
  categories: ['C01'], completed: true, ...over,
});
const slot = (over: Partial<SlotState>): SlotState => ({
  work: {}, checks: 1, hints: 0, hintsBeforeFirstCheck: 0, solved: true, sawSolution: false, skipped: false, done: true, activeMs: 1, interruptions: 0, firstResult: true, ...over,
});

describe('buzz combo', () => {
  it('counts first-try answers in a row and restarts quietly after a miss', () => {
    const slots = { 0: slot({}), 1: slot({ firstResult: false }), 2: slot({}), 3: slot({}), 4: slot({ solved: false, done: false, firstResult: undefined }) };
    expect(comboAt({ index: 4, slots })).toBe(2); // current question still open
    expect(comboAt({ index: 3, slots })).toBe(2);
    expect(comboAt({ index: 1, slots })).toBe(0);
    expect(comboAt({ index: 0, slots })).toBe(1);
    expect(comboAt({ index: 3, slots: { ...slots, 2: slot({ skipped: true }) } })).toBe(1);
  });
});

describe('daily quests', () => {
  it('gives three quests a day, always including a journey, and they fill from real play', () => {
    const p = base();
    const q = questsFor(p, D);
    expect(q).toHaveLength(3);
    expect(q[0].kind).toBe('journey');
    expect(new Set(q.map((x) => x.kind)).size).toBe(3);
    expect(q.every((x) => !x.done && x.have === 0)).toBe(true);
    expect(questsFor(p, D)).toEqual(q); // stable for the day
  });
  it('a busy day completes all quests and earns a golden sunflower; other days do not count', () => {
    const attempts = [
      ...Array.from({ length: 12 }, (_, i) => att({ category: i % 2 ? 'C01' : 'C08', format: 'plain', hints: i === 0 ? 1 : 0 })),
      att({ date: '2026-09-28' }),
    ];
    const sessions = [sess({}), sess({ mode: 'lesson' }), sess({ date: '2026-09-28', completed: false })];
    const p = { ...base(), attempts, sessions };
    expect(questsFor(p, D).every((x) => x.done)).toBe(true);
    expect(goldenDays(p)).toEqual([D]);
  });
  it('mock-test answers do not count toward quests', () => {
    const p = { ...base(), attempts: Array.from({ length: 12 }, () => att({ mode: 'mock' })) };
    expect(questsFor(p, D).every((x) => x.have === 0)).toBe(true);
  });
  it('every quest kind has English and Tamil text', () => {
    for (const k of ['journey', 'solve5', 'solve10', 'places2', 'firstTry3', 'lesson', 'hintHelp', 'worksheet3', 'stars2'])
      for (const lang of ['en', 'ta'] as const) expect(t({ k: `quest.${k}` }, lang)).not.toBe(`quest.${k}`);
  });
});

describe('daily gift', () => {
  it('waits only after a finished journey, opens once a day, and is the same treasure every time', () => {
    let p = base();
    expect(giftWaiting(p, D)).toBe(false);
    p = { ...p, sessions: [sess({ completed: false })] };
    expect(giftWaiting(p, D)).toBe(false);
    p = { ...p, sessions: [sess({})] };
    expect(giftWaiting(p, D)).toBe(true);
    expect(TREASURES).toContain(treasureFor(p.id, D));
    expect(treasureFor(p.id, D)).toBe(treasureFor(p.id, D));
    const once = openGift(p, D);
    expect(once.treasures).toEqual([{ date: D, id: treasureFor(p.id, D) }]);
    expect(openGift(once, D)).toBe(once); // idempotent
    expect(giftWaiting(once, D)).toBe(false);
    const two = { ...once, treasures: [...once.treasures!, { date: '2026-09-30', id: once.treasures![0].id }] };
    expect(treasureCounts(two)[once.treasures![0].id]).toBe(2);
  });
});

describe('friends, hats and rest', () => {
  it('meets a friend by finishing a journey in their world', () => {
    const p = { ...base(), sessions: [sess({ categories: ['C09'] }), sess({ categories: ['C01', 'C08'] }), sess({ categories: ['C02'], completed: false })] };
    expect(friendsMet(p)).toEqual(['ice', 'garden']);
  });
  it('unlocks one hat per level and ignores a hat that is not unlocked', () => {
    const p = base();
    expect(hatsUnlocked(p)).toEqual([]);
    expect(currentHat({ ...p, beeHat: HATS[0] })).toBeNull();
    const rich = { ...p, nectar: 1000 };
    expect(hatsUnlocked(rich)).toEqual([...HATS]);
    expect(currentHat({ ...rich, beeHat: '👑' })).toBe('👑');
    expect(hatsUnlocked({ ...p, nectar: 5 })).toEqual([HATS[0]]);
  });
  it('suggests a rest after a few finished journeys in one day', () => {
    const p = { ...base(), sessions: Array.from({ length: REST_AFTER - 1 }, () => sess({})) };
    expect(suggestRest(p, D)).toBe(false);
    expect(suggestRest({ ...p, sessions: [...p.sessions, sess({})] }, D)).toBe(true);
    expect(suggestRest({ ...p, sessions: [...p.sessions, sess({})] }, '2026-09-30')).toBe(false);
  });
});

describe('quest variety', () => {
  it('never pairs two quests of the same sort over a year of days', () => {
    for (let d = 0; d < 365; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      const kinds = questsFor(base(), date).map((q) => (q.kind.startsWith('solve') ? 'solve' : q.kind));
      expect(new Set(kinds).size).toBe(3);
    }
  });
});

describe('adventure and fun', () => {
  const adv = (over: Partial<SessionRecord>) => sess({ mode: 'adventure', theme: 'meadow', ...over });

  it('friends are the union: practice journeys as before, plus finished adventure friend levels only', () => {
    // an adventure core level about pot sizes (C04) does not meet the town's owl, and stopped friend levels do not count
    const p = { ...base(), sessions: [adv({ levelId: 'w1-03', categories: ['C04'] }), adv({ levelId: 'w2-11', theme: 'river', categories: ['C02', 'C03'], completed: false })] };
    expect(friendsMet(p)).toEqual([]);
    const q = { ...p, sessions: [...p.sessions, adv({ levelId: 'w1-12', categories: ['C01', 'C04', 'C07'] }), sess({ categories: ['C09'] })] };
    expect(friendsMet(q)).toEqual(['meadow', 'ice']);
    expect(friendsMet({ sessions: [adv({ levelId: 'w7-12', theme: 'garden', categories: ['C01', 'C08'] })] })).toEqual(['garden']);
  });

  it('quests keep the same rotation for children without adventure, and never change during a day', () => {
    const plain = base();
    const withAdv = { ...base(), sessions: [adv({ levelId: 'w1-01' })] }; // adventure played today only
    const noAdvField = { ...plain, adventure: undefined };
    for (let d = 0; d < 60; d++) {
      const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
      const kinds = questsFor(plain, date).map((q) => q.kind);
      expect(questsFor(noAdvField, date).map((q) => q.kind)).toEqual(kinds);
      expect(kinds).not.toContain('stars2');
      if (date <= D) expect(questsFor(withAdv, date).map((q) => q.kind)).toEqual(questsFor({ ...withAdv, sessions: [] }, date).map((q) => q.kind));
    }
  });

  it('the adventure quest can appear only after an adventure day, and fills from finished levels', () => {
    const p = { ...base(), sessions: [adv({ levelId: 'w1-01', date: '2026-09-01' })] };
    const dates = Array.from({ length: 120 }, (_, d) => new Date(Date.UTC(2026, 8, 2 + d)).toISOString().slice(0, 10));
    const date = dates.find((x) => questsFor(p, x).some((q) => q.kind === 'stars2'))!;
    expect(date).toBeDefined();
    const today = { ...p, sessions: [...p.sessions, adv({ levelId: 'w1-02', date }), adv({ levelId: 'w1-03', date }), adv({ levelId: 'w1-04', date, completed: false })] };
    expect(questsFor(today, date).find((q) => q.kind === 'stars2')).toMatchObject({ have: 2, done: true });
  });

  it('the daily limit is off by default; when set it ends play between levels and replaces the 3-run rest rule', () => {
    const run = (min: number, over: Partial<SessionRecord> = {}) => sess({ startedAt: 0, endedAt: min * 60_000, ...over });
    const p = { ...base(), sessions: [run(8), run(9, { completed: false }), run(600, { date: '2026-09-28' })] };
    expect(minutesPlayed(p, D)).toBe(17);
    expect(sessionEndDue(p, D)).toBe(false); // limit 0 = off
    const limited = { ...p, settings: { ...p.settings, dailyLimitMin: 15 as const } };
    expect(sessionEndDue(limited, D)).toBe(true);
    expect(sessionEndDue({ ...limited, settings: { ...limited.settings, dailyLimitMin: 20 as const } }, D)).toBe(false);
    // one rest system: with a limit set, three short runs no longer suggest a rest
    const three = { ...limited, settings: { ...limited.settings, dailyLimitMin: 30 as const }, sessions: [run(2), run(2), run(2)] };
    expect(suggestRest(three, D)).toBe(false);
    expect(suggestRest({ ...three, settings: { ...three.settings, dailyLimitMin: 0 as const } }, D)).toBe(true);
    // a forgotten open run counts for at most 30 minutes
    expect(minutesPlayed({ sessions: [run(500)] }, D)).toBe(30);
  });
});
