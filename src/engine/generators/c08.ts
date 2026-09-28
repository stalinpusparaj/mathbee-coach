import type { TemplateDef, Generated } from '../template';
import { numberChoice, near, responseNumber, diagnoseNumber, opt, items } from '../template';
import { tensOnes, needsRegroupAdd } from '../math';
import { msg } from '../types';
import type { Rng } from '../rng';

const FRUIT = ['apple', 'pear', 'orange', 'apple_green'] as const;
const noun = (f: string) => (f === 'apple_green' ? 'apple' : f);

function addQuestion(rng: Rng, a: number, b: number, rep: 'objects' | 'tenframe' | 'baseten' | 'numberline', keypad: boolean): Generated {
  const item = rng.pick(FRUIT);
  const s = a + b;
  const hints = rep === 'baseten'
    ? [
        msg('hint.c08.tensFirst', { at: tensOnes(a).tens, bt: tensOnes(b).tens, t: tensOnes(a).tens + tensOnes(b).tens }),
        msg('hint.c08.onesNext', { ao: a % 10, bo: b % 10, o: (a % 10) + (b % 10) }),
        ...((a % 10) + (b % 10) >= 10 ? [msg('hint.c08.tradeTen')] : []),
      ]
    : rep === 'tenframe'
      ? [msg('hint.c08.fillTen'), msg('hint.c08.tenAndMore')]
      : [msg('hint.c08.putTogether'), msg('hint.c08.countOn', { a, b })];
  return {
    prompt: msg('c08.add', { ga: items(a, noun(item)), gb: items(b, noun(item)), items: msg(`items.${noun(item)}`) }),
    plain: msg('eq.add', { a, b }),
    scene: { type: 'add', a, b, item, representation: rep },
    answer: keypad ? { kind: 'number', value: s, min: 0, max: 100 } : numberChoice(rng, s, [...near(s, 2), Math.abs(a - b)]),
    hints,
    explain: rep === 'baseten'
      ? msg('c08.explainTens', { a, b, s, t: tensOnes(a).tens + tensOnes(b).tens, o: (a % 10) + (b % 10) })
      : b === 0 || a === 0
        ? msg('c08.explainZero', { a, b, s })
        : msg('c08.explain', { a, b, s }),
  };
}

const addDiag: TemplateDef['diagnose'] = (q, r) => {
  if (q.scene.type !== 'add') return null;
  const { a, b } = q.scene;
  const got = responseNumber(r);
  if (got === null) return 'no-answer';
  if (got === a + b) return null;
  if (got === Math.abs(a - b) && b !== 0) return 'wrong-operation';
  if (a >= 10 || b >= 10) {
    if (needsRegroupAdd(a, b) && got === a + b - 10) return 'regroup-missed';
    const wrongPlace = tensOnes(a).tens + tensOnes(b).tens + 10 * ((a % 10) + (b % 10));
    if (got === wrongPlace) return 'ones-tens-mixed';
  }
  return diagnoseNumber(a + b, r);
};

export const C08: TemplateDef[] = [
  {
    id: 'c08-e-baskets', category: 'C08', stage: 'explore', subskill: 'C08.to5', source: 'observed',
    title: 'Pour two baskets together (sum to 5)', worksheetRefs: ['Q14'],
    generate: (rng) => {
      const a = rng.int(1, 4);
      return addQuestion(rng, a, rng.int(1, 5 - a), 'objects', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-e-words', category: 'C08', stage: 'explore', subskill: 'C08.to5', source: 'observed',
    title: 'Add two groups and choose the answer written in words', worksheetRefs: ['Q14 (answers as words)'],
    generate: (rng) => {
      const a = rng.int(1, 4);
      const b = rng.int(1, 5 - a);
      const g = addQuestion(rng, a, b, 'objects', false);
      const s = a + b;
      const vals = rng.shuffle([s, ...rng.shuffle([1, 2, 3, 4, 5, 6].filter((v) => v !== s)).slice(0, 3)]);
      g.answer = { kind: 'choice', options: vals.map((v) => opt(`n${v}`, msg(`word.${v}`))), value: `n${s}` };
      return g;
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-e-numberline', category: 'C08', stage: 'explore', subskill: 'C08.to5', source: 'prerequisite',
    title: 'Hop on a number line (sum to 5)',
    generate: (rng) => {
      const a = rng.int(0, 4);
      return addQuestion(rng, a, rng.int(1, 5 - a), 'numberline', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-p-tenframe', category: 'C08', stage: 'practise', subskill: 'C08.to20', source: 'observed',
    title: 'Add within 20 with ten-frames', worksheetRefs: ['Q37 6+14', 'Q41 4+12', 'Q42 8+4'],
    generate: (rng) => {
      const a = rng.int(2, 12);
      return addQuestion(rng, a, rng.int(1, 20 - a), 'tenframe', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-p-maketen', category: 'C08', stage: 'practise', subskill: 'C08.makeTen', source: 'observed',
    title: 'Make ten first (e.g. 8 + 5, 12 + 8 = 20)', worksheetRefs: ['Q17 12+8', 'Q38 9+11'],
    generate: (rng) => {
      if (rng.bool(0.35)) {
        const b = rng.int(1, 9);
        return addQuestion(rng, 20 - b, b, 'tenframe', true);
      }
      const a = rng.int(6, 9);
      const b = rng.int(10 - a, 9);
      return addQuestion(rng, a, b, 'tenframe', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-p-zero', category: 'C08', stage: 'practise', subskill: 'C08.to20', source: 'observed',
    title: 'Adding zero and other facts within 20 (number line)', worksheetRefs: ['Q39 10+0'],
    generate: (rng) => {
      if (rng.bool(0.4)) {
        const a = rng.int(1, 20);
        return rng.bool() ? addQuestion(rng, a, 0, 'numberline', true) : addQuestion(rng, 0, a, 'numberline', true);
      }
      const a = rng.int(1, 15);
      return addQuestion(rng, a, rng.int(1, 20 - a), 'numberline', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-a-tensones', category: 'C08', stage: 'apply', subskill: 'C08.twoDigit', source: 'extension',
    title: 'Two-digit addition with tens and ones (no regrouping)',
    generate: (rng) => {
      for (let i = 0; i < 200; i++) {
        const a = rng.int(11, 78);
        const b = rng.int(10, 99 - a);
        if (!needsRegroupAdd(a, b) && b % 10 !== 0) return addQuestion(rng, a, b, 'baseten', true);
      }
      return addQuestion(rng, 23, 14, 'baseten', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-a-decade', category: 'C08', stage: 'apply', subskill: 'C08.decade', source: 'observed',
    title: 'Ones make a new ten (e.g. 11 + 19 = 30)', worksheetRefs: ['Q40 11+19'],
    generate: (rng) => {
      const ao = rng.int(1, 9);
      const a = rng.int(1, 4) * 10 + ao;
      const b = rng.int(0, 3) * 10 + (10 - ao);
      return addQuestion(rng, a, b, 'baseten', true);
    },
    diagnose: addDiag,
  },
  {
    id: 'c08-a-regroup', category: 'C08', stage: 'apply', subskill: 'C08.regroup', source: 'extension',
    title: 'EXTENSION: two-digit addition with regrouping (e.g. 27 + 16 = 43)',
    generate: (rng) => {
      for (let i = 0; i < 200; i++) {
        const a = rng.int(12, 69);
        const b = rng.int(11, 99 - a);
        if (needsRegroupAdd(a, b) && (a + b) % 10 !== 0) return addQuestion(rng, a, b, 'baseten', true);
      }
      return addQuestion(rng, 27, 16, 'baseten', true);
    },
    diagnose: addDiag,
  },
];
