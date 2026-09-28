import { describe, it, expect } from 'vitest';
import { newProfile } from '../../src/persistence/schema';
import {
  comboAt, questsFor, goldenDays, giftWaiting, openGift, treasureFor, treasureCounts, friendsMet, hatsUnlocked, currentHat, suggestRest, TREASURES, HATS, REST_AFTER,
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
    for (const k of ['journey', 'solve5', 'solve10', 'places2', 'firstTry3', 'lesson', 'hintHelp', 'worksheet3'])
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
