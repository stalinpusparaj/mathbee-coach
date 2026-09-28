import type { TemplateDef, Generated } from '../template';
import { numberChoice, near, responseNumber, diagnoseNumber } from '../template';
import { tensOnes, needsRegroupSub } from '../math';
import { msg } from '../types';
import type { Rng } from '../rng';

function subQuestion(rng: Rng, start: number, remove: number, rep: 'objects' | 'baseten' | 'numberline', keypad: boolean): Generated {
  if (remove > start) throw new Error('negative subtraction');
  const d = start - remove;
  const hints = rep === 'baseten'
    ? [
        msg('hint.c09.tensFirst', { at: tensOnes(start).tens, bt: tensOnes(remove).tens }),
        msg('hint.c09.onesNext', { ao: start % 10, bo: remove % 10 }),
        ...(needsRegroupSub(start, remove) ? [msg('hint.c09.breakTen')] : []),
      ]
    : [msg('hint.c09.moveToBoat', { remove }), msg('hint.c09.countLeft')];
  return {
    prompt: msg(rep === 'objects' ? 'c09.boat' : 'c09.sub', { start, remove }),
    plain: msg('eq.sub', { a: start, b: remove }),
    scene: { type: 'subtract', start, remove, representation: rep },
    answer: keypad ? { kind: 'number', value: d, min: 0, max: 100 } : numberChoice(rng, d, [...near(d, 2), start + remove].filter((v) => v <= 100)),
    hints,
    explain: remove === 0
      ? msg('c09.explainZero', { start })
      : remove === start
        ? msg('c09.explainAll', { start })
        : rep === 'baseten'
          ? msg('c09.explainTens', { start, remove, d })
          : msg('c09.explain', { start, remove, d }),
  };
}

const subDiag: TemplateDef['diagnose'] = (q, r) => {
  if (q.scene.type !== 'subtract') return null;
  const { start, remove } = q.scene;
  const got = responseNumber(r);
  if (got === null) return 'no-answer';
  if (got === start - remove) return null;
  if (got === start + remove && remove !== 0) return 'wrong-operation';
  if (needsRegroupSub(start, remove)) {
    // "smaller from larger" in the ones column, e.g. 42 − 17 → 35
    const ones = Math.abs((start % 10) - (remove % 10));
    if (got === (tensOnes(start).tens - tensOnes(remove).tens) * 10 + ones) return 'regroup-missed';
  }
  return diagnoseNumber(start - remove, r);
};

export const C09: TemplateDef[] = [
  {
    id: 'c09-e-boat', category: 'C09', stage: 'explore', subskill: 'C09.to5', source: 'observed',
    title: 'Penguins leave on the boat: how many are left? (within 5)', worksheetRefs: ['Q24 (penguins, partly readable)'],
    generate: (rng) => {
      const start = rng.int(2, 5);
      return subQuestion(rng, start, rng.int(1, start - 1), 'objects', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-e-choose', category: 'C09', stage: 'explore', subskill: 'C09.to5', source: 'observed',
    title: 'Picture subtraction within 5 (choice)', worksheetRefs: ['Q8 10−3 (boxes)'],
    generate: (rng) => {
      const start = rng.int(3, 5);
      return subQuestion(rng, start, rng.int(1, start - 1), 'objects', false);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-e-numberline', category: 'C09', stage: 'explore', subskill: 'C09.to5', source: 'prerequisite',
    title: 'Hop back on a number line (within 5)',
    generate: (rng) => {
      const start = rng.int(2, 5);
      return subQuestion(rng, start, rng.int(1, start - 1), 'numberline', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-p-within20', category: 'C09', stage: 'practise', subskill: 'C09.to20', source: 'observed',
    title: 'Subtract within 20 with penguins', worksheetRefs: ['Q16 20−6', 'Q18 19−11', 'Q43 16−7'],
    generate: (rng) => {
      const start = rng.int(6, 20);
      return subQuestion(rng, start, rng.int(1, start - 1), 'objects', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-p-zeroall', category: 'C09', stage: 'practise', subskill: 'C09.to20', source: 'prerequisite',
    title: 'Take away zero, or take away all',
    generate: (rng) => {
      const start = rng.int(3, 20);
      return subQuestion(rng, start, rng.bool() ? 0 : start, rng.bool() ? 'objects' : 'numberline', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-p-facts', category: 'C09', stage: 'practise', subskill: 'C09.to20', source: 'observed',
    title: 'Subtraction facts within 20 on a number line', worksheetRefs: ['Q36 20−11', 'Q8 10−3'],
    generate: (rng) => {
      const start = rng.int(10, 20);
      return subQuestion(rng, start, rng.int(2, start - 1), 'numberline', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-a-tens', category: 'C09', stage: 'apply', subskill: 'C09.twoDigit', source: 'observed',
    title: 'Two-digit subtraction, no regrouping (e.g. 27 − 17 = 10)', worksheetRefs: ['Q45 27−17'],
    generate: (rng) => {
      for (let i = 0; i < 200; i++) {
        const start = rng.int(21, 99);
        const remove = rng.int(11, start - 1);
        if (!needsRegroupSub(start, remove) && remove % 10 !== 0) return subQuestion(rng, start, remove, 'baseten', true);
      }
      return subQuestion(rng, 27, 17, 'baseten', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-a-wholetens', category: 'C09', stage: 'apply', subskill: 'C09.twoDigit', source: 'observed',
    title: 'Take away whole tens (e.g. 48 − 20 = 28)', worksheetRefs: ['Q44 48−20'],
    generate: (rng) => {
      const start = rng.int(21, 99);
      const remove = rng.int(1, Math.floor(start / 10)) * 10;
      return subQuestion(rng, start, remove, 'baseten', true);
    },
    diagnose: subDiag,
  },
  {
    id: 'c09-a-regroup', category: 'C09', stage: 'apply', subskill: 'C09.regroup', source: 'extension',
    title: 'EXTENSION: subtraction with regrouping (e.g. 42 − 17 = 25)',
    generate: (rng) => {
      for (let i = 0; i < 200; i++) {
        const start = rng.int(21, 99);
        const remove = rng.int(11, start - 1);
        if (needsRegroupSub(start, remove)) return subQuestion(rng, start, remove, 'baseten', true);
      }
      return subQuestion(rng, 42, 17, 'baseten', true);
    },
    diagnose: subDiag,
  },
];
