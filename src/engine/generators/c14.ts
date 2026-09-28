import type { TemplateDef, Generated } from '../template';
import { numberChoice, near, responseNumber, diagnoseNumber, expectedNumber } from '../template';
import { msg } from '../types';
import type { Rng } from '../rng';

/**
 * Story wordings. Several subtraction stories contain the word "more" and several
 * addition stories contain "left", so success cannot come from keyword tricks.
 */
interface Story { key: string; item: string; op: '+' | '-' }
export const STORIES: Story[] = [
  { key: 'story.apples.given', item: 'apple', op: '+' },
  { key: 'story.chocolates.added', item: 'chocolate', op: '+' },
  { key: 'story.birds.arrive', item: 'bird', op: '+' },
  { key: 'story.flowers.pick', item: 'flower', op: '+' },
  { key: 'story.birds.leftThenCame', item: 'bird', op: '+' },
  { key: 'story.apples.taken', item: 'apple', op: '-' },
  { key: 'story.coconuts.fall', item: 'coconut', op: '-' },
  { key: 'story.birds.flyaway', item: 'bird', op: '-' },
  { key: 'story.penguins.boat', item: 'penguin', op: '-' },
  { key: 'story.chocolates.eatMore', item: 'chocolate', op: '-' },
];

function oneStep(rng: Rng, story: Story, a: number, b: number, keypad: boolean): Generated {
  const ans = story.op === '+' ? a + b : a - b;
  if (ans < 0) throw new Error('negative story');
  return {
    prompt: msg(story.key, { a, b }),
    narration: msg(story.key, { a, b }),
    scene: { type: 'story', item: story.item, start: a, change: b, op: story.op, unknown: 'result' },
    answer: keypad ? { kind: 'number', value: ans, min: 0, max: 100 } : numberChoice(rng, ans, [...near(ans, 1), story.op === '+' ? Math.abs(a - b) : a + b]),
    hints: [
      msg('hint.c14.actOut'),
      msg(story.op === '+' ? 'hint.c14.getsBigger' : 'hint.c14.getsSmaller', { a }),
      msg(story.op === '+' ? 'hint.c14.addEq' : 'hint.c14.subEq', { a, b }),
    ],
    explain: msg(story.op === '+' ? 'c14.explainAdd' : 'c14.explainSub', { a, b, ans, items: msg(`items.${story.item}`) }),
  };
}

function storyOf(rng: Rng, op: '+' | '-') {
  return rng.pick(STORIES.filter((s) => s.op === op));
}

const storyDiag: TemplateDef['diagnose'] = (q, r) => {
  if (q.scene.type !== 'story') return null;
  const { start, change, op } = q.scene;
  const got = responseNumber(r);
  if (got === null) return 'no-answer';
  if (got === expectedNumber(q.answer)) return null;
  if (q.scene.unknown === 'result' && got === (op === '+' ? start - change : start + change)) return 'wrong-operation';
  return diagnoseNumber(expectedNumber(q.answer)!, r);
};

export const C14: TemplateDef[] = [
  {
    id: 'c14-e-join', category: 'C14', stage: 'explore', subskill: 'C14.to5', source: 'observed',
    title: 'One-step joining story within 5', worksheetRefs: ['Q22 (birds arrive)'],
    generate: (rng) => {
      const a = rng.int(1, 4);
      return oneStep(rng, storyOf(rng, '+'), a, rng.int(1, 5 - a), false);
    },
    diagnose: storyDiag,
  },
  {
    id: 'c14-e-separate', category: 'C14', stage: 'explore', subskill: 'C14.to5', source: 'observed',
    title: 'One-step taking-away story within 5', worksheetRefs: ['Q23 (coconuts fall)'],
    generate: (rng) => {
      const a = rng.int(2, 5);
      return oneStep(rng, storyOf(rng, '-'), a, rng.int(1, a - 1), false);
    },
    diagnose: storyDiag,
  },
  {
    id: 'c14-e-act', category: 'C14', stage: 'explore', subskill: 'C14.to5', source: 'prerequisite',
    title: 'Act out a story within 5, then type the answer',
    generate: (rng) => {
      const op = rng.bool() ? '+' : '-';
      const a = op === '+' ? rng.int(1, 4) : rng.int(2, 5);
      const b = op === '+' ? rng.int(1, 5 - a) : rng.int(1, a - 1);
      return oneStep(rng, storyOf(rng, op), a, b, true);
    },
    diagnose: storyDiag,
  },
  {
    id: 'c14-p-add', category: 'C14', stage: 'practise', subskill: 'C14.to20', source: 'observed',
    title: 'Addition stories within 20, varied wording', worksheetRefs: ['Q17 (12 chocolates + 8)', 'Q22 (11 birds + 5)'],
    generate: (rng) => {
      const a = rng.int(5, 15);
      return oneStep(rng, storyOf(rng, '+'), a, rng.int(2, 20 - a), true);
    },
    diagnose: storyDiag,
  },
  {
    id: 'c14-p-sub', category: 'C14', stage: 'practise', subskill: 'C14.to20', source: 'observed',
    title: 'Taking-away stories within 20, varied wording', worksheetRefs: ['Q16 (20 apples − 6)', 'Q23 (12 coconuts − 2)'],
    generate: (rng) => {
      const a = rng.int(8, 20);
      return oneStep(rng, storyOf(rng, '-'), a, rng.int(2, a - 1), true);
    },
    diagnose: storyDiag,
  },
  {
    id: 'c14-p-worksheet', category: 'C14', stage: 'practise', subskill: 'C14.to20', source: 'observed',
    title: 'The worksheet stories (20−6, 12+8, 11+5, 12−2) and close variations', worksheetRefs: ['Q16', 'Q17', 'Q22', 'Q23'],
    generate: (rng) => {
      const seeds: [string, number, number][] = [
        ['story.apples.taken', 20, 6],
        ['story.chocolates.added', 12, 8],
        ['story.birds.arrive', 11, 5],
        ['story.coconuts.fall', 12, 2],
      ];
      const [key, a0, b0] = rng.pick(seeds);
      const story = STORIES.find((s) => s.key === key)!;
      const vary = rng.bool(0.5);
      const a = vary ? Math.min(20, Math.max(3, a0 + rng.int(-3, 3))) : a0;
      const b = vary ? Math.max(1, Math.min(story.op === '-' ? a - 1 : 20 - a, b0 + rng.int(-2, 2))) : b0;
      return oneStep(rng, story, a, b, false);
    },
    diagnose: storyDiag,
  },
  {
    id: 'c14-a-twostep', category: 'C14', stage: 'apply', subskill: 'C14.twoStep', source: 'extension',
    title: 'EXTENSION: two-step story; each step answered (12 + 8 = 20, 20 − 6 = 14)',
    generate: (rng) => {
      const a = rng.int(6, 20);
      const b = rng.int(2, 10);
      const c = rng.int(2, a + b - 1);
      const mid = a + b;
      const end = mid - c;
      return {
        prompt: msg('story.twoStep', { a, b, c }),
        narration: msg('story.twoStep', { a, b, c }),
        scene: { type: 'story', item: 'apple', start: a, change: b, op: '+', steps: [{ change: b, op: '+' }, { change: c, op: '-' }], unknown: 'result' },
        answer: { kind: 'fields', fields: [
          { id: 'step1', label: msg('label.afterGift'), value: mid },
          { id: 'step2', label: msg('label.atEnd'), value: end },
        ] },
        hints: [msg('hint.c14.oneStepAtATime'), msg('hint.c14.addEq', { a, b }), msg('hint.c14.subEq', { a: mid, b: c })],
        explain: msg('c14.explainTwoStep', { a, b, mid, c, end }),
      };
    },
    diagnose: (q, r) => {
      if (r.kind !== 'fields' || q.answer.kind !== 'fields') return 'other';
      const [s1, s2] = q.answer.fields;
      if (r.values.step1 === s1.value && r.values.step2 === s2.value) return null;
      if (r.values.step1 !== s1.value) return 'intermediate-step';
      return 'other';
    },
  },
  {
    id: 'c14-a-missingstart', category: 'C14', stage: 'apply', subskill: 'C14.missing', source: 'extension',
    title: 'EXTENSION: missing start (some birds, 5 arrive, now 16)',
    generate: (rng) => {
      const b = rng.int(2, 9);
      const total = rng.int(b + 3, 30);
      const start = total - b;
      return {
        prompt: msg('story.missingStart', { b, total }),
        narration: msg('story.missingStart', { b, total }),
        scene: { type: 'story', item: 'bird', start, change: b, op: '+', unknown: 'start' },
        answer: { kind: 'number', value: start, min: 0, max: 100 },
        hints: [msg('hint.c14.whatUnknown'), msg('hint.c14.partWhole', { total, b })],
        explain: msg('c14.explainMissingStart', { b, total, start }),
      };
    },
    diagnose: (q, r) => {
      if (q.scene.type !== 'story') return null;
      const got = responseNumber(r);
      if (got === q.scene.start + 2 * q.scene.change) return 'wrong-operation';
      return diagnoseNumber(expectedNumber(q.answer)!, r);
    },
  },
  {
    id: 'c14-a-missingchange', category: 'C14', stage: 'apply', subskill: 'C14.missing', source: 'extension',
    title: 'EXTENSION: missing change (12 coconuts, some fall, 10 left)',
    generate: (rng) => {
      const start = rng.int(8, 30);
      const left = rng.int(2, start - 1);
      const fell = start - left;
      return {
        prompt: msg('story.missingChange', { start, left }),
        narration: msg('story.missingChange', { start, left }),
        scene: { type: 'story', item: 'coconut', start, change: fell, op: '-', unknown: 'change' },
        answer: { kind: 'number', value: fell, min: 0, max: 100 },
        hints: [msg('hint.c14.whatUnknown'), msg('hint.c14.countUpFrom', { left, start })],
        explain: msg('c14.explainMissingChange', { start, left, fell }),
      };
    },
    diagnose: (q, r) => {
      if (q.scene.type !== 'story') return null;
      const got = responseNumber(r);
      if (got === q.scene.start + (q.scene.start - q.scene.change)) return 'wrong-operation';
      return diagnoseNumber(expectedNumber(q.answer)!, r);
    },
  },
];
