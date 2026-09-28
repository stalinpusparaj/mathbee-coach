import type { TemplateDef, Generated } from '../template';
import { opt, diagnoseNumber, expectedNumber, responseNumber } from '../template';
import { msg } from '../types';
import type { Rng } from '../rng';

const LETTERS = 'ABCDE';

function planks(rng: Rng, n: number, min: number, max: number, minDiff: number) {
  for (let t = 0; t < 100; t++) {
    const u = Array.from({ length: n }, () => rng.int(min, max));
    const s = [...u].sort((a, b) => a - b);
    if (s.every((v, i) => i === 0 || v - s[i - 1] >= minDiff)) return u.map((units, i) => ({ id: LETTERS[i], units }));
  }
  return Array.from({ length: n }, (_, i) => ({ id: LETTERS[i], units: min + i * minDiff }));
}

function pick(rng: Rng, which: 'long' | 'short', arrows: boolean): Generated {
  const list = planks(rng, 2, 2, 10, 3);
  const target = [...list].sort((a, b) => (which === 'long' ? b.units - a.units : a.units - b.units))[0];
  return {
    prompt: msg(which === 'long' ? 'c05.whichLong' : 'c05.whichShort'),
    scene: { type: 'lengths', planks: list, arrows },
    answer: { kind: 'choice', options: list.map((p, i) => opt(p.id, msg('label.letter', { l: LETTERS[i] }))), value: target.id },
    hints: [msg('hint.c05.sameStart'), msg(which === 'long' ? 'hint.c05.furtherEnd' : 'hint.c05.nearerEnd')],
    explain: msg(which === 'long' ? 'c05.explainLong' : 'c05.explainShort', { id: target.id }),
    plainPicture: true,
  };
}

const numDiag: TemplateDef['diagnose'] = (q, r) => diagnoseNumber(expectedNumber(q.answer)!, r);

export const C05: TemplateDef[] = [
  {
    id: 'c05-e-long', category: 'C05', stage: 'explore', subskill: 'C05.longShort', source: 'observed',
    title: 'Which plank is long? (shared starting line)', worksheetRefs: ['Q11'],
    generate: (rng) => pick(rng, 'long', false),
  },
  {
    id: 'c05-e-short', category: 'C05', stage: 'explore', subskill: 'C05.longShort', source: 'observed',
    title: 'Which plank is short?', worksheetRefs: ['Q11'],
    generate: (rng) => pick(rng, 'short', false),
  },
  {
    id: 'c05-e-arrows', category: 'C05', stage: 'explore', subskill: 'C05.longShort', source: 'observed',
    title: 'Worksheet style: which arrow is long?', worksheetRefs: ['Q11'],
    generate: (rng) => pick(rng, 'long', true),
  },
  {
    id: 'c05-p-order', category: 'C05', stage: 'practise', subskill: 'C05.measure', source: 'extension',
    title: 'Order 3–5 planks from shortest to longest',
    generate: (rng) => {
      const list = planks(rng, rng.int(3, 5), 2, 10, 2);
      const sorted = [...list].sort((a, b) => a.units - b.units);
      return {
        prompt: msg('c05.order'),
        scene: { type: 'lengths', planks: list },
        answer: { kind: 'order', items: list.map((p, i) => opt(p.id, msg('label.letter', { l: LETTERS[i] }))), value: sorted.map((p) => p.id) },
        hints: [msg('hint.c05.sameStart'), msg('hint.c05.shortestFirst')],
        explain: msg('c05.explainOrder', { order: sorted.map((p) => p.id).join(', ') }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => (r.kind === 'order' && q.answer.kind === 'order' && r.value.join() === [...q.answer.value].reverse().join() ? 'reversed-order' : 'other'),
  },
  {
    id: 'c05-p-measure', category: 'C05', stage: 'practise', subskill: 'C05.measure', source: 'extension',
    title: 'Measure a plank with equal blocks (no gaps, no overlaps)',
    generate: (rng) => {
      const units = rng.int(3, 10);
      return {
        prompt: msg('c05.measure'),
        scene: { type: 'lengths', planks: [{ id: 'A', units }], unitBlocks: true },
        answer: { kind: 'number', value: units, min: 0, max: 20 },
        hints: [msg('hint.c05.blocksTouch'), msg('hint.c05.countBlocks')],
        explain: msg('c05.explainMeasure', { units }),
        plainPicture: true,
      };
    },
    diagnose: numDiag,
  },
  {
    id: 'c05-p-find', category: 'C05', stage: 'practise', subskill: 'C05.measure', source: 'extension',
    title: 'Which plank is N blocks long?',
    generate: (rng) => {
      const list = planks(rng, 3, 2, 10, 2);
      const target = rng.pick(list);
      return {
        prompt: msg('c05.findUnits', { n: target.units }),
        scene: { type: 'lengths', planks: list, unitBlocks: true },
        answer: { kind: 'choice', options: list.map((p, i) => opt(p.id, msg('label.letter', { l: LETTERS[i] }))), value: target.id },
        hints: [msg('hint.c05.countBlocks')],
        explain: msg('c05.explainFind', { id: target.id, n: target.units }),
        plainPicture: true,
      };
    },
  },
  {
    id: 'c05-a-build', category: 'C05', stage: 'apply', subskill: 'C05.build', source: 'extension',
    title: 'Build a bridge of exactly the gap length',
    generate: (rng) => {
      const gap = rng.int(4, 10);
      return {
        prompt: msg('c05.build', { gap }),
        plain: msg('c05.buildPlain', { gap }),
        scene: { type: 'lengths', planks: [], gap, placed: 0, unitBlocks: true },
        answer: { kind: 'number', value: gap, min: 0, max: 20 },
        hints: [msg('hint.c05.fillGap'), msg('hint.c05.noOverlap')],
        explain: msg('c05.explainBuild', { gap }),
        plainPicture: true,
      };
    },
    diagnose: numDiag,
  },
  {
    id: 'c05-a-missing', category: 'C05', stage: 'apply', subskill: 'C05.build', source: 'extension',
    title: 'Some blocks are placed: how many more are needed?',
    generate: (rng) => {
      const gap = rng.int(5, 10);
      const placed = rng.int(1, gap - 2);
      return {
        prompt: msg('c05.missing', { gap, placed }),
        scene: { type: 'lengths', planks: [], gap, placed, unitBlocks: true },
        answer: { kind: 'number', value: gap - placed, min: 0, max: 20 },
        hints: [msg('hint.c05.countEmpty'), msg('hint.c05.countOn', { placed, gap })],
        explain: msg('c05.explainMissing', { gap, placed, need: gap - placed }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      if (got !== null && q.scene.type === 'lengths' && got === q.scene.gap) return 'wrong-operation';
      return numDiag!(q, r);
    },
  },
  {
    id: 'c05-a-difference', category: 'C05', stage: 'apply', subskill: 'C05.build', source: 'extension',
    title: 'How many blocks longer is one plank than another?',
    generate: (rng) => {
      const a = rng.int(5, 10);
      const b = rng.int(2, a - 1);
      return {
        prompt: msg('c05.difference'),
        scene: { type: 'lengths', planks: [{ id: 'A', units: a }, { id: 'B', units: b }], unitBlocks: true },
        answer: { kind: 'number', value: a - b, min: 0, max: 20 },
        hints: [msg('hint.c05.sameStart'), msg('hint.c05.extraPart')],
        explain: msg('c05.explainDifference', { a, b, d: a - b }),
        plainPicture: true,
      };
    },
    diagnose: numDiag,
  },
];
