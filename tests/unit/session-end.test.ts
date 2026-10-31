import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionEndScreen, lastBlooms, restDueAfterSession } from '../../src/components/SessionEnd';
import { store } from '../../src/app/store';
import { emptyState, newProfile } from '../../src/persistence/schema';
import type { Profile, SessionRecord } from '../../src/learning/types';
import { todayStr } from '../../src/learning/dates';

const TODAY = '2026-10-31';
const MIN = 60_000;

function run(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `s${Math.random()}`, mode: 'practice', date: TODAY, startedAt: 0, endedAt: 8 * MIN, questions: 6,
    independentCorrect: 4, supportedCompleted: 2, nectar: 5, categories: ['C01'], completed: true, ...over,
  };
}

function child(sessions: SessionRecord[], dailyLimitMin: 0 | 15 | 20 | 30, extra: Partial<Profile> = {}): Profile {
  const p = newProfile('p1', 'bee', 'Ana', 'en', TODAY);
  return { ...p, sessions, settings: { ...p.settings, dailyLimitMin }, ...extra };
}

describe('natural session end: daily limit', () => {
  it('never shows without a daily limit, however long the play', () => {
    expect(restDueAfterSession(child([run(), run(), run(), run()], 0), TODAY)).toBe(false);
  });

  it('shows after a run once today’s play reaches the limit (and not before)', () => {
    expect(restDueAfterSession(child([run()], 15), TODAY)).toBe(false); // 8 min
    expect(restDueAfterSession(child([run(), run()], 15), TODAY)).toBe(true); // 16 min
    expect(restDueAfterSession(child([run(), run()], 20), TODAY)).toBe(false);
  });

  it('only counts today', () => {
    expect(restDueAfterSession(child([run({ date: '2026-10-30' }), run({ date: '2026-10-30' }), run()], 15), TODAY)).toBe(false);
  });
});

describe('natural session end: last blooms', () => {
  it('shows the best blooms of today’s last finished adventure level', () => {
    const adventure = { version: 1 as const, levels: { 'w1-01': { stars: 2 as const, bestPetals: 8, maxPetals: 10, plays: 1, firstClearedOn: TODAY, lastPlayedOn: TODAY } }, friendsCelebrated: [], lastLevelId: 'w1-01' };
    const p = child([run({ mode: 'adventure', levelId: 'w1-01' }), run()], 15, { adventure });
    expect(lastBlooms(p, TODAY)).toBe(2);
    expect(lastBlooms(child([run()], 15), TODAY)).toBeNull();
    expect(lastBlooms(child([run({ mode: 'adventure', levelId: 'w1-01', completed: false })], 15, { adventure }), TODAY)).toBeNull();
  });
});

describe('SessionEndScreen', () => {
  it('offers only "Show my garden" and "Done" — no "one more"', () => {
    const p = child([run({ date: todayStr() }), run({ date: todayStr() })], 15);
    store.setApp({ ...emptyState(), profiles: [p], activeProfileId: p.id });
    const html = renderToStaticMarkup(createElement(SessionEndScreen));
    const buttons = [...html.matchAll(/<button[^>]*data-testid="([^"]+)"/g)].map((m) => m[1]);
    expect(buttons).toEqual(['session-end-garden', 'session-end-done']);
    expect(html).toContain('Show my garden');
    expect(html).toContain('Done');
    expect(html).toContain('data-testid="session-end-limit"');
    expect(html).not.toMatch(/one more|play again|next level/i);
    expect(html).toContain('se-firefly');
  });

  it('renders calmly without a profile', () => {
    store.setApp(emptyState());
    const html = renderToStaticMarkup(createElement(SessionEndScreen));
    expect(html).toContain('data-testid="session-end"');
    expect([...html.matchAll(/<button/g)]).toHaveLength(2);
  });
});
