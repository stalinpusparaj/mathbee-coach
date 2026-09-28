import type { TemplateDef, Generated } from '../template';
import { numberChoice, near, responseNumber, expectedNumber, diagnoseNumber } from '../template';
import { makeObjects } from '../layout';
import { pairsOf } from '../math';
import { msg } from '../types';
import type { Rng } from '../rng';

const FLOWERS = ['rose', 'tulip', 'daisy'] as const;

function pairsQuestion(rng: Rng, n: number, mode: 'keypad' | 'choice' | 'fields'): Generated {
  const sprite = rng.pick(FLOWERS);
  const { pairs, leftover } = pairsOf(n);
  const flowers = makeObjects(n, n <= 10 ? 'row' : 'grid', rng, () => sprite, 'f');
  const answer: Generated['answer'] =
    mode === 'fields'
      ? { kind: 'fields', fields: [
          { id: 'pairs', label: msg('label.pairs'), value: pairs },
          { id: 'left', label: msg('label.leftOver'), value: leftover },
        ] }
      : mode === 'choice'
        ? numberChoice(rng, pairs, [n, ...near(pairs, 1)])
        : { kind: 'number', value: pairs, min: 0, max: 30 };
  return {
    prompt: msg(mode === 'fields' ? 'c07.pairsLeft' : 'c07.howManyPairs', { flowers: msg(`items.${sprite}`) }),
    scene: { type: 'pairs', flowers },
    answer,
    hints: [msg('hint.c07.twoMakeOne'), msg('hint.c07.joinTwo'), msg('hint.c07.countPairsNotFlowers')],
    explain: leftover
      ? msg('c07.explainLeft', { n, pairs, left: leftover })
      : msg('c07.explain', { n, pairs }),
    plainPicture: true,
  };
}

const pairsDiag: TemplateDef['diagnose'] = (q, r) => {
  if (q.scene.type !== 'pairs') return null;
  const n = q.scene.flowers.length;
  if (r.kind === 'fields') {
    const { pairs, leftover } = pairsOf(n);
    if (r.values.pairs === pairs && r.values.left === leftover) return null;
    if (r.values.pairs === n) return 'flowers-not-pairs';
    if (r.values.pairs === pairs) return 'pairs-leftover-missed';
    return 'other';
  }
  const got = responseNumber(r);
  if (got === null) return 'no-answer';
  if (got === expectedNumber(q.answer)) return null;
  if (got === n) return 'flowers-not-pairs';
  return 'other';
};

export const C07: TemplateDef[] = [
  {
    id: 'c07-e-make', category: 'C07', stage: 'explore', subskill: 'C07.makePairs', source: 'observed',
    title: 'Join 2–6 flowers into pairs; count the pairs', worksheetRefs: ['Q15'],
    generate: (rng) => pairsQuestion(rng, rng.pick([2, 4, 6]), 'choice'),
    diagnose: pairsDiag,
  },
  {
    id: 'c07-e-toflowers', category: 'C07', stage: 'explore', subskill: 'C07.makePairs', source: 'prerequisite',
    title: 'One to three pairs: how many flowers?',
    generate: (rng) => {
      const p = rng.int(1, 3);
      const sprite = rng.pick(FLOWERS);
      return {
        prompt: msg('c07.pairsToFlowers', { p, flowers: msg(`items.${sprite}`) }),
        scene: { type: 'pairs', flowers: [], orderPairs: p },
        answer: numberChoice(rng, 2 * p, [p, ...near(2 * p, 1)]),
        hints: [msg('hint.c07.twoMakeOne'), msg('hint.c07.twoEach', { p })],
        explain: msg('c07.explainNeeded', { p, n: 2 * p }),
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      if (q.scene.type === 'pairs' && got === q.scene.orderPairs) return 'flowers-not-pairs';
      return diagnoseNumber(expectedNumber(q.answer)!, r);
    },
  },
  {
    id: 'c07-e-match', category: 'C07', stage: 'explore', subskill: 'C07.makePairs', source: 'prerequisite',
    title: 'Join matching flowers into pairs (two or three kinds)',
    generate: (rng) => {
      const kinds = rng.shuffle(FLOWERS).slice(0, rng.int(2, 3));
      const list = rng.shuffle(kinds.flatMap((k) => [k, k]));
      const flowers = makeObjects(list.length, 'row', rng, (i) => list[i], 'f');
      return {
        prompt: msg('c07.matchPairs'),
        scene: { type: 'pairs', flowers },
        answer: numberChoice(rng, kinds.length, [list.length, 1, 4].filter((v) => v !== kinds.length)),
        hints: [msg('hint.c07.sameKind'), msg('hint.c07.countPairsNotFlowers')],
        explain: msg('c07.explain', { n: list.length, pairs: kinds.length }),
        plainPicture: true,
      };
    },
    diagnose: pairsDiag,
  },
  {
    id: 'c07-p-count', category: 'C07', stage: 'practise', subskill: 'C07.countPairs', source: 'observed',
    title: 'Count pairs in 8–20 flowers', worksheetRefs: ['Q15 (10 roses)'],
    generate: (rng) => pairsQuestion(rng, rng.int(4, 10) * 2, 'keypad'),
    diagnose: pairsDiag,
  },
  {
    id: 'c07-p-leftover', category: 'C07', stage: 'practise', subskill: 'C07.countPairs', source: 'extension',
    title: 'Odd number of flowers: pairs and one left over',
    generate: (rng) => pairsQuestion(rng, rng.int(2, 9) * 2 + 1, 'fields'),
    diagnose: pairsDiag,
  },
  {
    id: 'c07-p-worksheet', category: 'C07', stage: 'practise', subskill: 'C07.countPairs', source: 'observed',
    title: 'Worksheet style: how many pairs of roses? (choice)', worksheetRefs: ['Q15'],
    generate: (rng) => {
      const g = pairsQuestion(rng, rng.int(3, 7) * 2, 'choice');
      return g;
    },
    diagnose: pairsDiag,
  },
  {
    id: 'c07-a-needed', category: 'C07', stage: 'apply', subskill: 'C07.pairsApply', source: 'extension',
    title: 'An order of N pairs: how many flowers are needed?',
    generate: (rng) => {
      const p = rng.int(3, 10);
      return {
        prompt: msg('c07.order', { p }),
        scene: { type: 'pairs', flowers: [], orderPairs: p },
        answer: { kind: 'number', value: 2 * p, min: 0, max: 40 },
        hints: [msg('hint.c07.twoEach', { p }), msg('hint.c07.countByTwos')],
        explain: msg('c07.explainNeeded', { p, n: 2 * p }),
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      if (q.scene.type === 'pairs' && got === q.scene.orderPairs) return 'flowers-not-pairs';
      return diagnoseNumber(expectedNumber(q.answer)!, r);
    },
  },
  {
    id: 'c07-a-leftover', category: 'C07', stage: 'apply', subskill: 'C07.pairsApply', source: 'extension',
    title: '11–20 flowers: pairs and leftovers (e.g. 11 = 5 pairs + 1)',
    generate: (rng) => pairsQuestion(rng, rng.int(11, 20), 'fields'),
    diagnose: pairsDiag,
  },
  {
    id: 'c07-a-more', category: 'C07', stage: 'apply', subskill: 'C07.pairsApply', source: 'extension',
    title: 'Have some flowers; how many more for N pairs?',
    generate: (rng) => {
      const p = rng.int(4, 9);
      const have = rng.int(p, 2 * p - 1);
      const sprite = rng.pick(FLOWERS);
      return {
        prompt: msg('c07.more', { have, p, flowers: msg(`items.${sprite}`) }),
        scene: { type: 'pairs', flowers: makeObjects(have, have <= 10 ? 'row' : 'grid', rng, () => sprite, 'f'), orderPairs: p },
        answer: { kind: 'number', value: 2 * p - have, min: 0, max: 40 },
        hints: [msg('hint.c07.twoEach', { p }), msg('hint.c07.countOn', { have, need: 2 * p })],
        explain: msg('c07.explainMore', { p, need: 2 * p, have, more: 2 * p - have }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      if (q.scene.type === 'pairs' && q.scene.orderPairs && got === q.scene.orderPairs * 2) return 'intermediate-step';
      return diagnoseNumber(expectedNumber(q.answer)!, r);
    },
  },
];
