import { describe, it, expect } from 'vitest';
import { newProfile } from '../../src/persistence/schema';
import { createRng } from '../../src/engine/rng';
import { getTemplate, generateQuestion } from '../../src/engine/registry';
import { addDays } from '../../src/learning/dates';
import { LEVELS, LEVEL_BY_ID, isExtensionTemplate, levelTemplates } from '../../src/adventure/levels';
import { planAdventureLevel } from '../../src/adventure/planner';
import type { Profile } from '../../src/learning/types';

const D = '2026-10-01';
const base = (): Profile => newProfile('p', 'bee', 'Ari', 'en', D);
const plan = (id: string, seed = 7, p: Profile = base(), date = D) => planAdventureLevel(createRng(seed), p, LEVEL_BY_ID[id], date);

describe('adventure planner', () => {
  it('is deterministic by seed, and a new seed gives new questions', () => {
    for (const l of LEVELS) expect(planAdventureLevel(createRng(5), base(), l, D)).toEqual(planAdventureLevel(createRng(5), base(), l, D));
    expect(plan('w1-06', 1).map((s) => s.seed)).not.toEqual(plan('w1-06', 2).map((s) => s.seed));
  });

  it('plans exactly the level\'s questions from its own templates, never as follow-ups, and every question generates', () => {
    for (const l of LEVELS) {
      for (const showExtensions of [true, false]) {
        const p = { ...base(), settings: { ...base().settings, showExtensions } };
        const slots = planAdventureLevel(createRng(3), p, l, D);
        expect(slots, l.id).toHaveLength(l.questions);
        for (const s of slots) {
          expect(levelTemplates(l, p.settings), l.id).toContain(s.templateId);
          expect(s.subskill).toBe(getTemplate(s.templateId).subskill);
          expect(s.purpose).not.toBe('follow-up');
          expect(() => generateQuestion(s.templateId, s.seed, s.format)).not.toThrow();
        }
      }
    }
  });

  it('round-robins the templates so none repeats within the last two when there are three or more', () => {
    const ids = plan('w1-03').map((s) => s.templateId);
    for (let i = 2; i < ids.length; i++) expect([ids[i - 1], ids[i - 2]]).not.toContain(ids[i]);
    expect(new Set(plan('w1-01').map((s) => s.templateId)).size).toBe(2);
  });

  it('formats by kind: explore core all interactive; practise/apply core ends illustrated', () => {
    const explore = plan('w1-01');
    expect(explore.every((s) => s.format === 'interactive' && s.purpose === 'need' && !s.unannounced)).toBe(true);
    const practise = plan('w1-06');
    expect(practise.map((s) => s.format)).toEqual(['interactive', 'interactive', 'interactive', 'interactive', 'interactive', 'illustrated']);
    expect(plan('bonus-01').at(-1)!.format).toBe('illustrated');
  });

  it('mini levels carry the skin on every question, interactive, same maths', () => {
    const mini = plan('w1-04');
    expect(mini.every((s) => s.skin === 'bubbles' && s.format === 'interactive' && s.purpose === 'need')).toBe(true);
    expect(plan('w4-06').every((s) => s.skin === 'lily-hop-ice')).toBe(true);
    expect(plan('w1-01').some((s) => s.skin)).toBe(false);
  });

  it('friend and finale levels are mixed and unannounced, ending with a plain worksheet question', () => {
    for (const id of ['w1-12', 'w7-12']) {
      const f = plan(id);
      expect(f.every((s) => s.purpose === 'mixed' && s.unannounced)).toBe(true);
      expect(f.at(-1)!.format).toBe('plain');
      expect(f.slice(0, -1).every((s) => s.format === 'interactive')).toBe(true);
    }
  });

  it('memory levels take this world\'s due reviews first; the rest are mixed and unannounced', () => {
    const due = addDays(D, -1);
    const p: Profile = {
      ...base(),
      reviews: {
        'C07.makePairs': { stage: 1, due, history: [] }, // in the meadow, not in w1-11's own list but in the world
        'C04.bigSmall': { stage: 1, due, history: [] }, // in the meadow
        'C09.to5': { stage: 1, due, history: [] }, // another world: not here
        'C01.to5': { stage: 1, due: addDays(D, 5), history: [] }, // not due yet
      },
    };
    const m = plan('w1-11', 9, p);
    expect(m).toHaveLength(6);
    expect(m.every((s) => s.unannounced)).toBe(true);
    const reviews = m.filter((s) => s.purpose === 'review');
    expect(reviews.map((s) => s.subskill).sort()).toEqual(['C04.bigSmall', 'C07.makePairs']);
    expect(m.filter((s) => s.purpose === 'mixed')).toHaveLength(4);
    expect(m.some((s) => s.subskill === 'C09.to5')).toBe(false);
    // no reviews due: all mixed
    expect(plan('w1-11', 9).every((s) => s.purpose === 'mixed')).toBe(true);
  });

  it('with extensions hidden, levels with fallbacks play only non-extension templates', () => {
    const p = { ...base(), settings: { ...base().settings, showExtensions: false } };
    for (const id of ['w2-11', 'w5-11', 'w7-07', 'w7-08', 'w7-12']) {
      const slots = plan(id, 11, p);
      expect(slots.some((s) => isExtensionTemplate(s.templateId)), id).toBe(false);
    }
    expect(plan('w7-12', 11).some((s) => isExtensionTemplate(s.templateId))).toBe(true); // shown: the real finale
  });
});
