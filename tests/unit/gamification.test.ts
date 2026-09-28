import { describe, it, expect } from 'vitest';
import { newProfile } from '../../src/persistence/schema';
import { levelFor, lifetimeNectar, earnedStickers, newStickers, pickCheer, displayName, STICKERS, CHEERS_NAMED } from '../../src/learning/gamification';
import { t } from '../../src/i18n/i18n';
import type { Attempt, Profile } from '../../src/learning/types';

const base = (): Profile => newProfile('p', 'bee', 'mickey', 'en', '2026-09-01');
function att(over: Partial<Attempt>): Attempt {
  return {
    id: Math.random().toString(36), sessionId: 's', slot: 0, date: '2026-09-01', ts: 1, templateId: 'c01-e-row', seed: 1, category: 'C01', stage: 'explore',
    subskill: 'C01.to5', format: 'interactive', mode: 'practice', purpose: 'need', independent: true, firstCorrect: true, finalCorrect: true, retries: 0,
    hints: 0, sawSolution: false, skipped: false, activeMs: 3000, interruptions: 0, unannounced: false, ...over,
  };
}

describe('gamification', () => {
  it('levels only go up with lifetime nectar, and spending does not lower them', () => {
    expect(levelFor(0).key).toBe('seed');
    expect(levelFor(5).key).toBe('sprout');
    expect(levelFor(299).key).toBe('wizard');
    expect(levelFor(1000).progress).toBe(1);
    const p = { ...base(), nectar: 2, garden: ['chair', 'lantern'] }; // 5 + 6 spent
    expect(lifetimeNectar(p)).toBe(13);
  });
  it('stickers come only from recorded progress; each is announced once', () => {
    let p = base();
    expect(earnedStickers(p)).toEqual([]);
    p = { ...p, attempts: [att({})] };
    expect(earnedStickers(p)).toContain('first-correct');
    expect(newStickers(p)).toEqual(['first-correct']);
    p = { ...p, stickersSeen: ['first-correct'] };
    expect(newStickers(p)).toEqual([]);
  });
  it('fixing a mistake earns the Fixer sticker; seeing the solution does not', () => {
    expect(earnedStickers({ ...base(), attempts: [att({ firstCorrect: false, finalCorrect: true, sawSolution: true, independent: false })] })).not.toContain('fixer');
    expect(earnedStickers({ ...base(), attempts: [att({ firstCorrect: false, finalCorrect: true })] })).toContain('fixer');
  });
  it('practice days count up and never reset (no streaks)', () => {
    const p = { ...base(), attempts: ['2026-09-01', '2026-09-05', '2026-09-20'].map((date) => att({ date })) };
    expect(earnedStickers(p)).toContain('three-days');
  });
  it('named cheers use the nickname, vary, and never repeat back to back', () => {
    expect(displayName('mickey')).toBe('Mickey');
    expect(displayName('  ')).toBe('');
    let prev: string | null = null;
    const seen = new Set<string>();
    for (let s = 0; s < 60; s++) {
      const k = pickCheer(s, prev, { named: true, fixed: false });
      expect(k).not.toBe(prev);
      const text = t({ k, p: { name: 'Mickey' } }, 'en');
      expect(text).toContain('Mickey');
      expect(t({ k, p: { name: 'Mickey' } }, 'ta')).toContain('Mickey');
      seen.add(k);
      prev = k;
    }
    expect(seen.size).toBe(CHEERS_NAMED);
    expect(t({ k: pickCheer(1, null, { named: true, fixed: true }), p: { name: 'Mickey' } }, 'en')).toMatch(/fix|figured/i);
    expect(t(pickCheer(3, null, { named: false, fixed: false }), 'en')).not.toMatch(/\{name\}/);
  });
  it('every sticker has English and Tamil names', () => {
    for (const s of STICKERS) {
      expect(t(`sticker.${s.id}`, 'en')).not.toBe(`sticker.${s.id}`);
      expect(t(`sticker.${s.id}`, 'ta')).not.toBe(t(`sticker.${s.id}`, 'en'));
    }
  });
});
