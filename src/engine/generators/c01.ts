import type { TemplateDef, Generated } from '../template';
import { items, numberChoice, near, diagnoseNumber, responseNumber } from '../template';
import { makeObjects } from '../layout';
import { msg, type SceneObject } from '../types';
import type { Rng } from '../rng';

const COUNTABLES = ['daisy', 'tulip', 'rose', 'apple', 'pear', 'orange'] as const;
const nounOf = (sprite: string) => (['daisy', 'tulip', 'rose'].includes(sprite) ? 'flower' : sprite);

function countQuestion(rng: Rng, n: number, layout: 'row' | 'grid' | 'scatter' | 'dice' | 'columns', keypad: boolean): Generated {
  const sprite = rng.pick(COUNTABLES);
  const item = nounOf(sprite);
  const objects = makeObjects(n, layout, rng, () => sprite);
  return {
    prompt: msg('c01.count', { items: msg(`items.${item}`) }),
    plain: msg('c01.countPlain', { items: msg(`items.${item}`) }),
    scene: { type: 'count', objects, layout, worksheetIcon: sprite },
    answer: keypad ? { kind: 'number', value: n, min: 0, max: 60 } : numberChoice(rng, n, near(n, 2)),
    hints: [msg('hint.c01.markEach'), msg('hint.c01.sayNumbers'), msg('hint.c01.lastNumber')],
    explain: n === 0 ? msg('c01.explainZero', { items: msg(`items.${item}`) }) : msg('c01.explain', { total: items(n, item), n }),
    plainPicture: true,
  };
}

const countDiagnose: TemplateDef['diagnose'] = (q, r) => {
  const got = responseNumber(r);
  const expected = q.answer.kind === 'number' ? q.answer.value : Number((q.answer as { value: string }).value.slice(1));
  if (got === null) return 'no-answer';
  if (got > expected) return 'double-count';
  if (got < expected) return 'skipped-object';
  return null;
};

function groupedQuestion(rng: Rng, groupSize: 5 | 10, sizes: number[]): Generated {
  const sprite = rng.pick(['daisy', 'apple'] as const);
  const item = nounOf(sprite);
  const total = sizes.reduce((a, b) => a + b, 0);
  const groups = sizes.map((filled, i) => ({ id: `g${i + 1}`, size: groupSize, filled }));
  const objects: SceneObject[] = [];
  groups.forEach((g) => {
    for (let k = 0; k < g.filled; k++) objects.push({ id: `${g.id}o${k + 1}`, kind: sprite, x: 0, y: 0, group: g.id });
  });
  const full = sizes.filter((s) => s === groupSize).length;
  const rest = total - full * groupSize;
  return {
    prompt: msg(groupSize === 10 ? 'c01.groupsTen' : 'c01.groupsFive', { items: msg(`items.${item}`) }),
    plain: msg('c01.groupsPlain', { items: msg(`items.${item}`), size: groupSize }),
    scene: { type: 'count', objects, layout: 'grid', groups, worksheetIcon: sprite },
    answer: { kind: 'number', value: total, min: 0, max: 60 },
    hints: [
      msg('hint.c01.fullGroups', { size: groupSize }),
      msg('hint.c01.countByGroups', { size: groupSize, full, fullTotal: full * groupSize }),
      msg('hint.c01.addRest', { fullTotal: full * groupSize, rest }),
    ],
    explain: msg('c01.explainGroups', { full, size: groupSize, fullTotal: full * groupSize, rest, total }),
    plainPicture: true,
  };
}

export const C01: TemplateDef[] = [
  {
    id: 'c01-e-row', category: 'C01', stage: 'explore', subskill: 'C01.to5', source: 'observed',
    title: 'Count 1–5 objects in a row', worksheetRefs: ['Q1–Q7 (count and write)'],
    generate: (rng) => countQuestion(rng, rng.int(1, 5), 'row', true),
    diagnose: countDiagnose,
  },
  {
    id: 'c01-e-dice', category: 'C01', stage: 'explore', subskill: 'C01.to5', source: 'prerequisite',
    title: 'Match a neat arrangement (1–5) to its numeral',
    generate: (rng) => countQuestion(rng, rng.int(1, 5), 'dice', false),
    diagnose: countDiagnose,
  },
  {
    id: 'c01-e-zero', category: 'C01', stage: 'explore', subskill: 'C01.zero', source: 'prerequisite',
    title: 'Zero as an empty container, and small amounts in a basket',
    generate: (rng) => {
      const n = rng.bool(0.5) ? 0 : rng.int(1, 5);
      const g = countQuestion(rng, n, 'row', false);
      if (g.scene.type === 'count') g.scene.container = 'basket';
      g.prompt = msg('c01.inBasket', { items: (g.prompt.p as { items: never }).items });
      g.answer = numberChoice(rng, n, [0, 1, 2, 3, 4, 5].filter((v) => v !== n));
      return g;
    },
    diagnose: (q, r) => diagnoseNumber(Number((q.answer as { value: string }).value.slice(1)), r),
  },
  {
    id: 'c01-p-rows', category: 'C01', stage: 'practise', subskill: 'C01.to20', source: 'observed',
    title: 'Count 6–20 objects in rows', worksheetRefs: ['Q1–Q6'],
    generate: (rng) => countQuestion(rng, rng.int(6, 20), 'grid', true),
    diagnose: countDiagnose,
  },
  {
    id: 'c01-p-scatter', category: 'C01', stage: 'practise', subskill: 'C01.to20', source: 'observed',
    title: 'Count 6–20 scattered objects', worksheetRefs: ['Q7 (scattered shapes)'],
    generate: (rng) => countQuestion(rng, rng.int(6, 20), 'scatter', true),
    diagnose: countDiagnose,
  },
  {
    id: 'c01-p-columns', category: 'C01', stage: 'practise', subskill: 'C01.to20', source: 'observed',
    title: 'Count stacked columns (worksheet style)', worksheetRefs: ['Q5 (apples in columns)'],
    generate: (rng) => countQuestion(rng, rng.int(8, 18), 'columns', true),
    diagnose: countDiagnose,
  },
  {
    id: 'c01-a-tens', category: 'C01', stage: 'apply', subskill: 'C01.groups50', source: 'extension',
    title: 'Count full ten-frames plus extras (21–50)',
    generate: (rng) => {
      const tens = rng.int(2, 4);
      const ones = rng.int(1, 9);
      const sizes = [...Array(tens).fill(10), ones];
      return groupedQuestion(rng, 10, sizes.filter((s) => s > 0));
    },
    diagnose: countDiagnose,
  },
  {
    id: 'c01-a-fives', category: 'C01', stage: 'apply', subskill: 'C01.groups50', source: 'extension',
    title: 'Count groups of five plus extras',
    generate: (rng) => {
      const fives = rng.int(4, 9);
      const loose = rng.int(1, 4);
      return groupedQuestion(rng, 5, [...Array(fives).fill(5), loose]);
    },
    diagnose: countDiagnose,
  },
  {
    id: 'c01-a-partial', category: 'C01', stage: 'apply', subskill: 'C01.groups50', source: 'extension',
    title: 'Count ten-frames that are not all full',
    generate: (rng) => {
      const full = rng.int(2, 3);
      const partial = rng.int(3, 8);
      const sizes = rng.shuffle([...Array(full).fill(10), partial]);
      return groupedQuestion(rng, 10, sizes);
    },
    diagnose: countDiagnose,
  },
];

