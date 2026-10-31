import { describe, it, expect } from 'vitest';
import {
  LEVELS, LEVEL_BY_ID, WORLDS, STORY_WORLDS, levelsOf, friendLevelOf, isExtensionTemplate, isExtLevel, isSideBranch, levelTemplates,
  levelSubskills, mainPath, usesExtensions,
} from '../../src/adventure/levels';
import { getTemplate } from '../../src/engine/registry';
import { SUBSKILL_BY_ID } from '../../src/curriculum/curriculum';
import { THEMES } from '../../src/activities/journey';
import { hasKey } from '../../src/i18n/i18n';

const HIDE = { showExtensions: false };
const SHOW = { showExtensions: true };

describe('adventure level table', () => {
  it('has 81 levels: 7 worlds of 79 levels plus 2 bonus levels, with unique ids', () => {
    expect(LEVELS).toHaveLength(81);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(81);
    expect(STORY_WORLDS.reduce((s, w) => s + levelsOf(w).length, 0)).toBe(79);
    expect(levelsOf('bonus')).toHaveLength(2);
    expect(STORY_WORLDS.map((w) => levelsOf(w).length)).toEqual([12, 11, 11, 10, 11, 12, 12]);
    for (const w of STORY_WORLDS) expect(levelsOf(w).map((l) => l.n)).toEqual(levelsOf(w).map((_, i) => i + 1));
  });

  it('every template and fallback id resolves, and derived subskills are consistent', () => {
    for (const l of LEVELS) {
      for (const t of [...l.templates, ...(l.fallbackTemplates ?? [])]) expect(() => getTemplate(t), `${l.id} ${t}`).not.toThrow();
      for (const settings of [SHOW, HIDE]) {
        const subs = levelSubskills(l, settings);
        expect(subs.length).toBeGreaterThan(0);
        for (const t of levelTemplates(l, settings)) expect(subs).toContain(getTemplate(t).subskill);
        for (const s of subs) expect(SUBSKILL_BY_ID[s], s).toBeDefined();
      }
    }
  });

  it('questions are between 5 and 8 per level', () => {
    for (const l of LEVELS) {
      expect(l.questions, l.id).toBeGreaterThanOrEqual(5);
      expect(l.questions, l.id).toBeLessThanOrEqual(8);
    }
  });

  it('every story world ends with its friend level (finale in W7), with at most one memory level and one mini level in W1–W6', () => {
    for (const w of STORY_WORLDS) {
      const ls = levelsOf(w);
      const last = ls[ls.length - 1];
      expect(last.kind).toBe(w === 'w7' ? 'finale' : 'friend');
      expect(friendLevelOf(w)).toBe(last);
      expect(ls.filter((l) => l.kind === 'friend' || l.kind === 'finale')).toHaveLength(1);
      if (w !== 'w7') {
        expect(ls.filter((l) => l.kind === 'memory').length, w).toBeLessThanOrEqual(1);
        expect(ls.filter((l) => l.kind === 'mini'), w).toHaveLength(1);
      }
    }
  });

  it('worlds use the journey themes; skins are only on mini levels', () => {
    for (const w of WORLDS) expect(THEMES[w.theme]).toBeDefined();
    for (const l of LEVELS) expect(!!l.skin, l.id).toBe(l.kind === 'mini');
    expect(LEVEL_BY_ID['w4-06'].skin).toBe('lily-hop-ice');
    expect(LEVEL_BY_ID['w5-04'].skin).toBe('lily-hop-stone');
  });

  it('Ext status is derived from curriculum source, not hand labels', () => {
    for (const l of LEVELS)
      expect(usesExtensions(l)).toBe(l.templates.some((t) => SUBSKILL_BY_ID[getTemplate(t).subskill].source === 'extension'));
    const ext = LEVELS.filter(isExtLevel).map((l) => l.id);
    expect(ext).toEqual(['w1-09', 'w2-07', 'w5-07', 'w5-08', 'w5-10', 'w7-01', 'w7-02', 'w7-03', 'w7-04', 'w7-05', 'w7-06', 'w7-09', 'w7-10', 'w7-11']);
    // the levels the plan got wrong now have non-extension fallbacks
    for (const id of ['w7-07', 'w7-08', 'w7-12', 'w2-11', 'w5-11']) {
      expect(usesExtensions(LEVEL_BY_ID[id])).toBe(true);
      expect(LEVEL_BY_ID[id].fallbackTemplates).toBeDefined();
    }
  });

  it('every fallback template is non-extension', () => {
    for (const l of LEVELS) for (const t of l.fallbackTemplates ?? []) expect(isExtensionTemplate(t), `${l.id} ${t}`).toBe(false);
  });

  it('with extensions hidden, every main-path level resolves only to non-extension subskills', () => {
    for (const w of STORY_WORLDS) {
      const path = mainPath(w, HIDE);
      expect(path[path.length - 1], w).toBe(friendLevelOf(w)); // the world is still completable
      for (const l of path) for (const s of levelSubskills(l, HIDE)) expect(SUBSKILL_BY_ID[s].source, `${l.id} ${s}`).not.toBe('extension');
    }
    expect(mainPath('w7', HIDE).map((l) => l.id)).toEqual(['w7-07', 'w7-08', 'w7-12']);
  });

  it('with extensions shown, nothing is a side branch and the main templates are played', () => {
    for (const l of LEVELS) {
      expect(isSideBranch(l, SHOW)).toBe(false);
      expect(levelTemplates(l, SHOW)).toBe(l.templates);
    }
    expect(LEVEL_BY_ID['w1-09'] && isSideBranch(LEVEL_BY_ID['w1-09'], HIDE)).toBe(true);
  });

  it('bonus levels are gated by the regrouping subskills', () => {
    expect(levelsOf('bonus').map((l) => l.gatedSubskill)).toEqual(['C08.regroup', 'C09.regroup']);
    for (const l of levelsOf('bonus')) expect(SUBSKILL_BY_ID[l.gatedSubskill!].gated).toBe(true);
  });

  it('every world, level and friend line has English and Tamil text, and every mode has a name', () => {
    const keys = [
      ...WORLDS.map((w) => w.nameKey),
      ...LEVELS.map((l) => l.titleKey),
      ...STORY_WORLDS.flatMap((w) => ['intro', 'thanks', 'together'].map((k) => `adv.friend.${w}.${k}`)),
      ...['assessment', 'lesson', 'practice', 'daily', 'review', 'worksheet', 'test', 'mock', 'fluency', 'adventure'].map((m) => `mode.${m}`),
      'quest.stars2',
    ];
    for (const lang of ['en', 'ta'] as const) expect(keys.filter((k) => !hasKey(k, lang)), lang).toEqual([]);
  });
});
