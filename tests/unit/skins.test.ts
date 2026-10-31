import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SceneView } from '../../src/activities/SceneView';
import { activeSkin } from '../../src/activities/scenes/skins';
import { LEVELS } from '../../src/adventure/levels';
import { generateQuestion } from '../../src/engine/registry';
import { checkAnswer, emptyResponse } from '../../src/engine/check';
import { skinFamily, type AnswerSpec, type MiniSkin, type QuestionInstance, type Response } from '../../src/engine/types';

/** A correct response built from the answer spec (so checking can be compared both ways). */
function correct(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'number': return { kind: 'number', value: a.value };
    case 'choice': return { kind: 'choice', value: a.value };
    case 'order': return { kind: 'order', value: [...a.value] };
    case 'fields': return { kind: 'fields', values: Object.fromEntries(a.fields.map((f) => [f.id, f.value])) };
    case 'time': return { kind: 'time', h: a.h, m: a.m };
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o as Record<string, unknown>).forEach(deepFreeze);
  }
  return o;
}

/** Work states a child can reach in each scene (taps marked, hops made, animals moved, steps walked). */
const WORKS: Record<string, unknown>[] = [{}, { marked: ['o1', 'o2'] }, { hops: 1 }, { hops: 3 }, { onBoard: ['a1'] }, { steps: 2 }];

function render(q: QuestionInstance, work: Record<string, unknown>, skin: MiniSkin | undefined, interactive: boolean, reveal = 0): string {
  return renderToStaticMarkup(createElement(SceneView, {
    q, work, setWork: () => {}, setResponse: () => {}, response: emptyResponse(q.answer), interactive, reveal, skin,
  }));
}
const testIds = (html: string) => [...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]).sort();

const SKINNED = LEVELS.filter((l) => l.skin).flatMap((l) => l.templates.map((t) => ({ level: l.id, skin: l.skin!, template: t })));

describe('mini-game skins (presentation only)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('every mini level has a skin and every skin has at least one level', () => {
    expect(LEVELS.filter((l) => l.kind === 'mini').every((l) => l.skin)).toBe(true);
    const used = new Set(SKINNED.map((s) => s.skin));
    for (const s of ['bubbles', 'lily-hop', 'lily-hop-ice', 'lily-hop-stone', 'ferry-loader', 'postman'] as MiniSkin[]) expect(used.has(s)).toBe(true);
  });

  it('skinned and unskinned questions check answers identically and keep the same controls', () => {
    let skinnedRenders = 0;
    for (const { skin, template } of SKINNED) {
      for (let seed = 1; seed <= 12; seed++) {
        const q = deepFreeze(generateQuestion(template, seed * 7919, 'interactive'));
        const before = JSON.stringify(q);
        const right = correct(q.answer);
        const blank = emptyResponse(q.answer);
        const checks = [checkAnswer(q.answer, right), checkAnswer(q.answer, blank)];
        const applies = activeSkin(skin, q);
        for (const work of WORKS) {
          for (const interactive of [true, false]) {
            const plain = render(q, work, undefined, interactive);
            const skinned = render(q, work, skin, interactive);
            // same buttons and fields (work keys and answers are driven by the same controls)
            expect(testIds(skinned), `${template} ${skin}`).toEqual(testIds(plain));
            if (applies) {
              expect(skinned).toContain(`data-skin="${skinFamily(skin)}"`);
              skinnedRenders++;
            } else {
              expect(skinned).toBe(plain);
            }
          }
        }
        // the full worked solution renders under the skin too
        expect(() => render(q, {}, skin, false, 99)).not.toThrow();
        // the frozen question is untouched and checking gives the same results
        expect(JSON.stringify(q)).toBe(before);
        expect([checkAnswer(q.answer, right), checkAnswer(q.answer, blank)]).toEqual(checks);
        expect(checks[0]).toBe(true);
      }
    }
    expect(skinnedRenders).toBeGreaterThan(100);
  });

  it('each skin family really draws on its templates', () => {
    const fams = new Set<string>();
    for (const { skin, template } of SKINNED) {
      for (let seed = 1; seed <= 12; seed++) {
        const a = activeSkin(skin, generateQuestion(template, seed * 31, 'interactive'));
        if (a) fams.add(a.family === 'lily-hop' ? `lily-hop:${a.pad}` : a.family);
      }
    }
    expect([...fams].sort()).toEqual(['bubbles', 'ferry-loader', 'lily-hop:ice', 'lily-hop:lily', 'lily-hop:stone', 'postman']);
  });

  it('a skin that does not fit the scene is ignored', () => {
    const groups = generateQuestion('c01-p-columns', 5, 'interactive');
    expect(activeSkin('lily-hop', groups)).toBeNull();
    expect(activeSkin('postman', generateQuestion('c11-e-order', 3, 'interactive'))).toBeNull();
    expect(activeSkin(undefined, generateQuestion('c01-e-row', 3, 'interactive'))).toBeNull();
    // worksheet (black-and-white) rendering is never skinned
    const q = generateQuestion('c01-e-row', 3, 'plain');
    const bw = renderToStaticMarkup(createElement(SceneView, { q, work: {}, setWork: () => {}, setResponse: () => {}, interactive: false, reveal: 0, bw: true, skin: 'bubbles' }));
    expect(bw).not.toContain('data-skin');
  });

  it('no skin uses a timer', () => {
    const t1 = vi.spyOn(globalThis, 'setTimeout');
    const t2 = vi.spyOn(globalThis, 'setInterval');
    for (const { skin, template } of SKINNED) render(generateQuestion(template, 11, 'interactive'), { hops: 1, marked: ['o1'] }, skin, true);
    expect(t1).not.toHaveBeenCalled();
    expect(t2).not.toHaveBeenCalled();
    const dir = 'src/activities/scenes';
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/);
    }
  });
});
