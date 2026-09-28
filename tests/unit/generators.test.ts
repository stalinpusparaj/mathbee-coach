import { describe, it, expect } from 'vitest';
import { TEMPLATES, templatesFor, generateQuestion } from '../../src/engine/registry';
import { validateQuestion } from '../../src/engine/validate';
import { checkAnswer } from '../../src/engine/check';
import { createRng } from '../../src/engine/rng';
import type { CategoryId, Response, Stage, QuestionInstance, AnswerSpec } from '../../src/engine/types';
import { STAGES } from '../../src/engine/types';
import { pairsOf } from '../../src/engine/math';

const CATS = Array.from({ length: 14 }, (_, i) => `C${String(i + 1).padStart(2, '0')}` as CategoryId);
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);

export function correctResponse(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'number': return { kind: 'number', value: a.value };
    case 'choice': return { kind: 'choice', value: a.value };
    case 'order': return { kind: 'order', value: [...a.value] };
    case 'fields': return { kind: 'fields', values: Object.fromEntries(a.fields.map((f) => [f.id, f.value])) };
    case 'time': return { kind: 'time', h: a.h, m: a.m };
  }
}

describe('all 42 category-stage combinations', () => {
  for (const c of CATS) {
    for (const s of STAGES) {
      it(`${c} ${s}: ≥3 templates, valid questions over ${SEEDS.length} seeds`, () => {
        const ts = templatesFor(c, s as Stage);
        expect(ts.length).toBeGreaterThanOrEqual(3);
        for (const t of ts) {
          const seen = new Set<string>();
          for (const seed of SEEDS) {
            const q = generateQuestion(t.id, seed);
            expect(validateQuestion(q), `${t.id} seed ${seed}`).toEqual([]);
            expect(checkAnswer(q.answer, correctResponse(q.answer))).toBe(true);
            expect(q.hints.length).toBeGreaterThan(0);
            seen.add(JSON.stringify([q.scene, q.answer]));
          }
          // parameter variation, not one hard-coded question
          expect(seen.size, `${t.id} variety`).toBeGreaterThan(t.id === 'c11-e-order' ? 1 : 2);
        }
      });
    }
  }
  it('has 14 × 3 × ≥3 templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(126);
  });
});

describe('determinism', () => {
  it('same template + seed → identical question', () => {
    for (const t of TEMPLATES) {
      expect(generateQuestion(t.id, 42)).toEqual(generateQuestion(t.id, 42));
    }
  });
  it('rng is deterministic', () => {
    const a = createRng(5); const b = createRng(5);
    expect([a.next(), a.int(1, 9), a.next()]).toEqual([b.next(), b.int(1, 9), b.next()]);
  });
});

function many(id: string, n = 200): QuestionInstance[] {
  return Array.from({ length: n }, (_, i) => generateQuestion(id, i * 31 + 1));
}

describe('stage bounds', () => {
  it('C01 explore counts 0–5, practise 6–20, apply ≤ 50', () => {
    for (const q of many('c01-e-row')) expect(q.scene.type === 'count' && q.scene.objects.length).toBeLessThanOrEqual(5);
    for (const q of many('c01-p-scatter')) { const n = q.scene.type === 'count' ? q.scene.objects.length : 0; expect(n >= 6 && n <= 20).toBe(true); }
    for (const id of ['c01-a-tens', 'c01-a-fives', 'c01-a-partial']) for (const q of many(id)) expect((q.answer as { value: number }).value).toBeLessThanOrEqual(50);
  });
  it('early subtraction never goes negative and explore stays within 5', () => {
    for (const id of ['c09-e-boat', 'c09-e-choose', 'c09-e-numberline', 'c09-p-within20', 'c09-p-zeroall', 'c09-p-facts']) {
      for (const q of many(id)) {
        if (q.scene.type !== 'subtract') throw new Error('scene');
        expect(q.scene.start - q.scene.remove).toBeGreaterThanOrEqual(0);
        if (id.includes('-e-')) expect(q.scene.start).toBeLessThanOrEqual(5);
        if (id.includes('-p-')) expect(q.scene.start).toBeLessThanOrEqual(20);
      }
    }
  });
  it('addition stages respect limits; regrouping only in its own template', () => {
    for (const q of many('c08-e-baskets')) if (q.scene.type === 'add') expect(q.scene.a + q.scene.b).toBeLessThanOrEqual(5);
    for (const q of many('c08-p-tenframe')) if (q.scene.type === 'add') expect(q.scene.a + q.scene.b).toBeLessThanOrEqual(20);
    for (const q of many('c08-a-tensones')) if (q.scene.type === 'add') expect((q.scene.a % 10) + (q.scene.b % 10)).toBeLessThan(10);
    for (const q of many('c08-a-regroup')) if (q.scene.type === 'add') expect((q.scene.a % 10) + (q.scene.b % 10)).toBeGreaterThanOrEqual(10);
    for (const q of many('c09-a-tens')) if (q.scene.type === 'subtract') expect(q.scene.start % 10).toBeGreaterThanOrEqual(q.scene.remove % 10);
  });
  it('pairs fields match floor/2 and remainder', () => {
    for (const q of many('c07-a-leftover')) {
      if (q.scene.type !== 'pairs' || q.answer.kind !== 'fields') throw new Error();
      const { pairs, leftover } = pairsOf(q.scene.flowers.length);
      expect(q.answer.fields.map((f) => f.value)).toEqual([pairs, leftover]);
    }
  });
  it('shape questions never offer "rectangle" as a wrong name for a square', () => {
    for (const id of ['c06-e-name', 'c06-a-rotated', 'c06-e-find', 'c06-e-outline']) {
      for (const q of many(id)) {
        if (q.answer.kind !== 'choice' || q.scene.type !== 'shapes') continue;
        const ids = q.answer.options.map((o) => (o.visual && o.visual.type === 'shape' ? o.visual.shape : o.id));
        const target = q.answer.value;
        const targetShape = q.answer.options.find((o) => o.id === target);
        const ts = targetShape?.visual && targetShape.visual.type === 'shape' ? targetShape.visual.shape : target;
        if (ts === 'square') expect(ids).not.toContain('rectangle');
        if (ts === 'rectangle') expect(ids).not.toContain('square');
      }
    }
  });
  it('word problems include "more" in subtraction and "left" in addition (no keyword tricks)', async () => {
    const { STORIES } = await import('../../src/engine/generators/c14');
    expect(STORIES.some((s) => s.op === '-' && /more/i.test(s.key))).toBe(true);
    expect(STORIES.some((s) => s.op === '+' && /left/i.test(s.key))).toBe(true);
  });
});
