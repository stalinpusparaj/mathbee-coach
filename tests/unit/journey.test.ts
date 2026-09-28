import { describe, it, expect } from 'vitest';
import { themeFor, platformPositions, worldWidth, cameraOffset, storyBeat, THEMES } from '../../src/activities/journey';
import { CATEGORIES } from '../../src/curriculum/curriculum';
import { t } from '../../src/i18n/i18n';

describe('journey', () => {
  it('every topic has a world; mixed practice goes to the garden hive', () => {
    for (const c of CATEGORIES) expect(THEMES[themeFor([c.id])]).toBeDefined();
    expect(themeFor(['C01', 'C09'])).toBe('garden');
    expect(themeFor(['C09', 'C09'])).toBe('ice');
  });
  it('platforms move left to right and the goal is last', () => {
    for (const n of [1, 4, 8, 16]) {
      const p = platformPositions(n);
      expect(p).toHaveLength(n + 1);
      for (let i = 1; i < p.length; i++) expect(p[i].x).toBeGreaterThan(p[i - 1].x);
      expect(p[0].x).toBeGreaterThan(0);
      expect(p[n].x).toBeLessThan(1);
    }
  });
  it('the camera never scrolls past either end of the world', () => {
    for (const n of [3, 8, 16]) {
      const w = worldWidth(n);
      for (const q of platformPositions(n)) {
        const c = cameraOffset(q.x, w);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(w - 1 + 1e-9);
      }
    }
    expect(cameraOffset(0.9, 1)).toBe(0); // short sessions fit on one screen
  });
  it('story beats: intro at the start and a cheer halfway', () => {
    expect(storyBeat(0, 8)).toBe('intro');
    expect(storyBeat(4, 8)).toBe('mid');
    expect(storyBeat(3, 8)).toBeNull();
  });
  it('story text exists for every world in English and Tamil', () => {
    for (const th of Object.keys(THEMES)) {
      for (const lang of ['en', 'ta'] as const) {
        const intro = t({ k: `journey.intro.${th}`, p: { name: 'Mickey' } }, lang);
        expect(intro).toContain('Mickey');
        expect(t(`journey.end.${th}`, lang)).not.toBe(`journey.end.${th}`);
        expect(t(`friend.${th}`, lang)).not.toBe(`friend.${th}`);
      }
    }
  });
});
