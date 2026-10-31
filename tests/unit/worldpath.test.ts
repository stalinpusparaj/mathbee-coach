import { describe, it, expect } from 'vitest';
import { layoutWorldPath, Blooms, NODE_PX, HOUSE_PX, ROW_PX, type PathEntry } from '../../src/components/WorldPath';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdventureWorldsScreen, WorldMapScreen, LevelResultsScreen } from '../../src/screens/AdventureScreens';
import { store } from '../../src/app/store';
import { newProfile } from '../../src/persistence/schema';
import { LEVELS, STORY_WORLDS, WORLDS, isSideBranch, levelsOf, mainPath } from '../../src/adventure/levels';
import type { Profile, SessionRecord } from '../../src/learning/types';

/** The world's levels as the map draws them (friend/finale level = the house). */
function entries(world: (typeof STORY_WORLDS)[number], showExtensions: boolean): PathEntry[] {
  return levelsOf(world).map((l) => ({ id: l.id, side: isSideBranch(l, { showExtensions }), big: l.kind === 'friend' || l.kind === 'finale' }));
}

describe('world map path layout', () => {
  for (const width of [320, 360, 412, 520]) {
    it(`every bud and title fits a ${width} px map`, () => {
      for (const w of STORY_WORLDS) {
        for (const ext of [true, false]) {
          const lay = layoutWorldPath(entries(w, ext), width);
          expect(lay.width).toBe(width);
          for (const n of lay.nodes) {
            expect(n.x - n.r, `${n.id} left`).toBeGreaterThanOrEqual(0);
            expect(n.x + n.r, `${n.id} right`).toBeLessThanOrEqual(width);
            expect(n.y - n.r).toBeGreaterThanOrEqual(0);
            expect(n.y + n.r).toBeLessThanOrEqual(lay.height);
            // titles beside the bud have room and stay inside the map
            expect(n.labelMax, `${n.id} label`).toBeGreaterThanOrEqual(80);
            if (n.labelSide === 'right') expect(n.x + n.r + 6 + n.labelMax).toBeLessThanOrEqual(width);
            if (n.labelSide === 'left') expect(n.x - n.r - 6 - n.labelMax).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  }

  it('buds are at least 64 px and rows are about 110 px apart; buds never overlap', () => {
    expect(NODE_PX).toBeGreaterThanOrEqual(64);
    expect(HOUSE_PX).toBeGreaterThanOrEqual(NODE_PX);
    expect(ROW_PX).toBeGreaterThanOrEqual(100);
    expect(ROW_PX).toBeLessThanOrEqual(120);
    for (const w of STORY_WORLDS) {
      const lay = layoutWorldPath(entries(w, false), 320);
      for (let i = 1; i < lay.nodes.length; i++) expect(lay.nodes[i].y - lay.nodes[i - 1].y).toBe(ROW_PX);
      for (const a of lay.nodes) for (const b of lay.nodes) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it('the path winds left and right and ends at the friend house in the middle', () => {
    const lay = layoutWorldPath(entries('w1', true), 360);
    const xs = new Set(lay.nodes.map((n) => Math.round(n.x)));
    expect(xs.size).toBeGreaterThanOrEqual(3);
    const last = lay.nodes[lay.nodes.length - 1];
    expect(last.big).toBe(true);
    expect(last.x).toBe(180);
    expect(lay.main.startsWith('M')).toBe(true);
    expect((lay.main.match(/C/g) ?? []).length).toBe(lay.nodes.length - 1);
  });

  it('with extensions hidden, Ext levels sit on dotted side branches off the main path', () => {
    let sides = 0;
    for (const w of STORY_WORLDS) {
      const es = entries(w, false);
      const lay = layoutWorldPath(es, 320);
      const side = lay.nodes.filter((n) => n.side);
      sides += side.length;
      expect(lay.branches).toHaveLength(side.length);
      // the main path visits only main-path levels, and the world is still completable
      expect((lay.main.match(/C/g) ?? []).length).toBe(mainPath(w, { showExtensions: false }).length - 1);
      expect(mainPath(w, { showExtensions: false }).some((l) => l.kind === 'friend' || l.kind === 'finale')).toBe(true);
      // side buds go to the outer edge
      for (const n of side) expect(Math.abs(n.x - 160)).toBeGreaterThan(80);
    }
    expect(sides).toBeGreaterThan(0);
  });

  it('copes with an empty or tiny map', () => {
    expect(layoutWorldPath([], 320).nodes).toEqual([]);
    const tiny = layoutWorldPath([{ id: 'a' }], 200);
    expect(tiny.width).toBeGreaterThanOrEqual(300);
    expect(WORLDS.length).toBe(8);
  });
});

// ---------- render smoke tests for the adventure screens (fixture profiles) ----------

function fixture(kind: 'new' | 'mid-w3' | 'complete', showExtensions = true): Profile {
  const p = newProfile('p1', 'bee', 'Mickey', 'en', '2026-10-01');
  const done = kind === 'new' ? [] : kind === 'complete' ? LEVELS : LEVELS.filter((l) => l.world === 'w1' || l.world === 'w2' || ['w3-01', 'w3-02', 'w3-03'].includes(l.id));
  const levels = Object.fromEntries(done.map((l, i) => [l.id, { stars: (1 + (i % 3)) as 1 | 2 | 3, bestPetals: 8, maxPetals: 10, plays: 1, firstClearedOn: '2026-10-01', lastPlayedOn: '2026-10-01' }]));
  return {
    ...p,
    settings: { ...p.settings, showExtensions, adventureOpenAll: kind === 'complete' },
    adventure: { version: 1, levels, friendsCelebrated: [], lastLevelId: done.length ? done[done.length - 1].id : null },
  };
}
function use(p: Profile) {
  store.setApp({ ...store.get().app, profiles: [p], activeProfileId: p.id });
}
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const record = (levelId: string): SessionRecord => ({
  id: 's-x', mode: 'adventure', date: '2026-10-01', startedAt: 0, endedAt: 1, questions: 5, independentCorrect: 5, supportedCompleted: 0,
  nectar: 6, categories: ['C01'], completed: true, levelId, theme: 'meadow',
});

describe('adventure screens render', () => {
  it('worlds: a new child sees world 1 open and current, later worlds closed, friends greyed', () => {
    use(fixture('new'));
    const out = html(createElement(AdventureWorldsScreen));
    expect(out).toContain('data-testid="adventure"');
    for (const w of STORY_WORLDS) expect(out).toContain(`data-testid="adv-world-${w}"`);
    expect(out).toMatch(/class="world-card\s+current"[^>]*data-testid="adv-world-w1"/);
    expect(out).toMatch(/<button[^>]*aria-disabled="true"[^>]*data-testid="adv-world-w2"/);
    expect(out).toContain('adv-friend grey');
    expect(out).not.toContain('adv-world-bonus');
    expect(out).not.toMatch(/trophy|perfect/i);
  });

  it('worlds: mid-W3 shows W3 as current and W1/W2 friends met', () => {
    use(fixture('mid-w3'));
    const out = html(createElement(AdventureWorldsScreen));
    expect(out).toMatch(/class="world-card\s+current"[^>]*data-testid="adv-world-w3"/);
    expect(out).toMatch(/<button[^>]*aria-disabled="true"[^>]*data-testid="adv-world-w4"/);
  });

  it('world map: buds with aria labels, closed buds (no padlocks), house last, the bee on the current bud', () => {
    use(fixture('mid-w3'));
    const out = html(createElement(WorldMapScreen, { world: 'w3' }));
    for (const l of levelsOf('w3')) expect(out).toContain(`data-testid="level-${l.id}"`);
    expect(out).toMatch(/wp-node open current[^"]*"[^>]*><button[^>]*aria-label="Level 4, Orchard Stories, ready to play"[^>]*data-testid="level-w3-04"/);
    expect(out).toMatch(/aria-label="Level 1, Two Baskets, ([23] flowers|1 flower)"/);
    expect(out).toContain('bud-closed');
    expect(out).not.toMatch(/padlock|🔒/);
    expect(out).toContain('friend-house');
    expect(out).toContain('data-testid="map-bee"');
    expect(out).toContain('data-world="orchard"');
  });

  it('world map with extensions hidden draws a dotted side branch', () => {
    use(fixture('new', false));
    const out = html(createElement(WorldMapScreen, { world: 'w1' }));
    expect(out).toContain('wp-branch');
    expect(out).toMatch(/wp-node [a-z]+ +side/);
  });

  it('level results: blooms, next level and world map buttons; never a full trophy', () => {
    use(fixture('complete'));
    const out = html(createElement(LevelResultsScreen, { levelId: 'w1-03', record: record('w1-03'), newNectar: 8, prevStars: 0 }));
    expect(out).toContain('data-testid="level-results"');
    expect(out).toContain('data-testid="to-world"');
    expect(out).toContain('data-testid="new-bloom"');
    expect(out).not.toMatch(/trophy|perfect/i);
    use(fixture('mid-w3'));
    const mid = html(createElement(LevelResultsScreen, { levelId: 'w3-03', record: record('w3-03'), newNectar: 6, prevStars: 0 }));
    expect(mid).toContain('data-testid="next-level"');
  });

  it('blooms show only what was earned: no empty slots, no grey petals', () => {
    expect(html(createElement(Blooms, { n: 0 }))).toBe('');
    const two = html(createElement(Blooms, { n: 2 }));
    expect(two.match(/✿/g)).toHaveLength(2);
    expect(two).not.toMatch(/class=""/);
    use(fixture('complete'));
    const out = html(createElement(LevelResultsScreen, { levelId: 'w1-03', record: record('w1-03'), newNectar: 8, prevStars: 0 }));
    const runBlooms = Number(/data-blooms="(\d)"/.exec(out)![1]);
    expect(out.match(/class="big-bloom on"/g)).toHaveLength(runBlooms);
    expect(out).not.toMatch(/class="big-bloom "|class="petal "/);
    expect(out).toContain('data-testid="results-hear"');
  });

  it('level results on a friend level plays the friend cutscene once', () => {
    const p = fixture('mid-w3');
    use(p);
    const first = html(createElement(LevelResultsScreen, { levelId: 'w2-11', record: record('w2-11'), newNectar: 6, prevStars: 0 }));
    expect(first).toContain('data-testid="cutscene"');
    expect(first).toContain('data-testid="cutscene-skip"');
    use({ ...p, adventure: { ...p.adventure!, friendsCelebrated: ['w2'] } });
    const again = html(createElement(LevelResultsScreen, { levelId: 'w2-11', record: record('w2-11'), newNectar: 6, prevStars: 0 }));
    expect(again).not.toContain('data-testid="cutscene"');
  });
});
