import type { TemplateDef, Generated } from '../template';
import { items, numberChoice, near, diagnoseNumber, expectedNumber } from '../template';
import { layoutPositions } from '../layout';
import { msg, joinMsgs, type Msg, type SceneObject } from '../types';
import type { Rng } from '../rng';

/** animal kind → noun key. Kinds are rendered from sprites (or SVG for turtle). */
export const ANIMALS = ['rabbit', 'bird', 'turtle', 'penguin', 'frog', 'squirrel'] as const;
type Animal = (typeof ANIMALS)[number];

function animalsScene(rng: Rng, counts: [Animal, number][]): SceneObject[] {
  const total = counts.reduce((s, [, n]) => s + n, 0);
  const pos = layoutPositions(total, total <= 5 ? 'row' : 'scatter', rng);
  // keep types grouped left-to-right in the queue so each animal is clearly visible
  const kinds: Animal[] = counts.flatMap(([a, n]) => Array(n).fill(a));
  const order = pos.map((p, i) => ({ p, i })).sort((u, v) => u.p.y - v.p.y || u.p.x - v.p.x);
  return order.map(({ p }, i) => ({ id: `a${i + 1}`, kind: kinds[i], x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

function sumMsg(counts: [Animal, number][]): Msg {
  return joinMsgs(counts.map(([a, n]) => items(n, a)));
}

function loadQuestion(rng: Rng, counts: [Animal, number][], keypad: boolean): Generated {
  const total = counts.reduce((s, [, n]) => s + n, 0);
  return {
    prompt: msg('c02.load'),
    plain: msg('c02.plain', { list: sumMsg(counts) }),
    scene: { type: 'ferry', animals: animalsScene(rng, counts), types: counts.map(([a]) => a) },
    answer: keypad ? { kind: 'number', value: total, min: 0, max: 60 } : numberChoice(rng, total, [...near(total, 2), counts[0][1]]),
    hints: [msg('hint.c02.loadEach'), msg('hint.c02.countTypes', { list: sumMsg(counts) }), msg('hint.c02.addUp')],
    explain: msg('c02.explain', { list: sumMsg(counts), eq: counts.map(([, n]) => n).join(' + '), total }),
    plainPicture: true,
  };
}

function pickTypes(rng: Rng, k: number): Animal[] {
  return rng.shuffle(ANIMALS).slice(0, k);
}

/** split total into k positive parts */
function split(rng: Rng, total: number, k: number): number[] {
  const parts = Array(k).fill(1);
  for (let i = k; i < total; i++) parts[rng.int(0, k - 1)]++;
  return parts;
}

const diag: TemplateDef['diagnose'] = (q, r) => {
  const e = expectedNumber(q.answer);
  return e === null ? null : diagnoseNumber(e, r);
};

export const C02: TemplateDef[] = [
  {
    id: 'c02-e-load', category: 'C02', stage: 'explore', subskill: 'C02.to5', source: 'observed',
    title: 'Load two kinds of animals (total up to 5) and count all', worksheetRefs: ['Q9 (how many altogether)'],
    generate: (rng) => {
      const [a, b] = pickTypes(rng, 2);
      const [x, y] = split(rng, rng.int(2, 5), 2);
      return loadQuestion(rng, [[a, x], [b, y]], true);
    },
    diagnose: diag,
  },
  {
    id: 'c02-e-groups', category: 'C02', stage: 'explore', subskill: 'C02.to5', source: 'observed',
    title: 'Two groups of different animals: how many altogether?',
    generate: (rng) => {
      const [a, b] = pickTypes(rng, 2);
      const [x, y] = split(rng, rng.int(3, 5), 2);
      return loadQuestion(rng, [[a, x], [b, y]], false);
    },
    diagnose: diag,
  },
  {
    id: 'c02-e-hopon', category: 'C02', stage: 'explore', subskill: 'C02.to5', source: 'prerequisite',
    title: 'Some passengers, then one more kind hops on (to 5)',
    generate: (rng) => {
      const [a, b] = pickTypes(rng, 2);
      const x = rng.int(1, 4);
      const y = rng.int(1, 5 - x);
      const g = loadQuestion(rng, [[a, x], [b, y]], false);
      g.prompt = msg('c02.hopOn', { first: items(x, a), second: items(y, b), nx: x, ny: y });
      g.plain = g.prompt;
      return g;
    },
    diagnose: diag,
  },
  {
    id: 'c02-p-load3', category: 'C02', stage: 'practise', subskill: 'C02.to20', source: 'observed',
    title: 'Three kinds of animals, total 6–20', worksheetRefs: ['Q9'],
    generate: (rng) => {
      const types = pickTypes(rng, 3);
      const parts = split(rng, rng.int(6, 20), 3);
      return loadQuestion(rng, types.map((t, i) => [t, parts[i]] as [Animal, number]), true);
    },
    diagnose: diag,
  },
  {
    id: 'c02-p-table', category: 'C02', stage: 'practise', subskill: 'C02.to20', source: 'prerequisite',
    title: 'Count each kind, then the total',
    generate: (rng) => {
      const types = pickTypes(rng, rng.int(2, 3));
      const parts = split(rng, rng.int(6, 18), types.length);
      const counts = types.map((t, i) => [t, parts[i]] as [Animal, number]);
      const g = loadQuestion(rng, counts, true);
      const total = parts.reduce((s, v) => s + v, 0);
      g.prompt = msg('c02.table');
      g.answer = {
        kind: 'fields',
        fields: [
          ...counts.map(([t, n]) => ({ id: t, label: msg(`items.${t}`), value: n, visual: { type: 'sprite' as const, id: t } })),
          { id: 'total', label: msg('label.altogether'), value: total },
        ],
      };
      return g;
    },
    diagnose: (q, r) => {
      if (r.kind !== 'fields' || q.answer.kind !== 'fields') return 'other';
      const f = q.answer.fields;
      const partsOk = f.slice(0, -1).every((x) => r.values[x.id] === x.value);
      if (partsOk) return 'other';
      return 'skipped-object';
    },
  },
  {
    id: 'c02-p-worksheet', category: 'C02', stage: 'practise', subskill: 'C02.to20', source: 'observed',
    title: 'Worksheet style: how many figures altogether (choice)', worksheetRefs: ['Q9'],
    generate: (rng) => {
      const types = pickTypes(rng, 3);
      const parts = split(rng, rng.int(7, 12), 3);
      const counts = types.map((t, i) => [t, parts[i]] as [Animal, number]);
      const total = parts.reduce((s, v) => s + v, 0);
      const g = loadQuestion(rng, counts, false);
      g.answer = numberChoice(rng, total, [...near(total, 2), parts[0] + parts[1]]);
      return g;
    },
    diagnose: diag,
  },
  {
    id: 'c02-a-boats', category: 'C02', stage: 'apply', subskill: 'C02.grouped50', source: 'extension',
    title: 'Full boats of ten plus extra passengers (to 50)',
    generate: (rng) => {
      const [a, b] = pickTypes(rng, 2);
      const boats = rng.int(2, 4);
      const loose = rng.int(1, 9);
      const total = boats * 10 + loose;
      return {
        prompt: msg('c02.boats', { boats, a: msg(`items.${a}`), loose: items(loose, b) }),
        scene: { type: 'ferry', animals: [], types: [a, b], grouped: [{ type: a, boats, loose: 0 }, { type: b, boats: 0, loose }] },
        answer: { kind: 'number', value: total, min: 0, max: 60 },
        hints: [msg('hint.c02.boatsTen', { boats, tens: boats * 10 }), msg('hint.c02.thenMore', { tens: boats * 10, loose })],
        explain: msg('c02.explainBoats', { boats, tens: boats * 10, loose, total }),
      };
    },
    diagnose: diag,
  },
  {
    id: 'c02-a-subtotals', category: 'C02', stage: 'apply', subskill: 'C02.grouped50', source: 'extension',
    title: 'Add subtotals of passengers (tens and ones)',
    generate: (rng) => {
      const types = pickTypes(rng, 3);
      const t1 = rng.int(1, 2) * 10;
      const t2 = rng.int(1, 2) * 10;
      const t3 = rng.int(1, 9);
      const total = t1 + t2 + t3;
      const counts: [Animal, number][] = [[types[0], t1], [types[1], t2], [types[2], t3]];
      return {
        prompt: msg('c02.subtotals', { list: sumMsg(counts) }),
        scene: { type: 'ferry', animals: [], types, subtotals: counts.map(([type, count]) => ({ type, count })) },
        answer: { kind: 'number', value: total, min: 0, max: 60 },
        hints: [msg('hint.c02.tensFirst', { a: t1, b: t2, s: t1 + t2 }), msg('hint.c02.thenMore', { tens: t1 + t2, loose: t3 })],
        explain: msg('c02.explain', { list: sumMsg(counts), eq: `${t1} + ${t2} + ${t3}`, total }),
      };
    },
    diagnose: diag,
  },
  {
    id: 'c02-a-missing', category: 'C02', stage: 'apply', subskill: 'C02.partWhole', source: 'extension',
    title: 'Total is known: find the missing group',
    generate: (rng) => {
      const [a, b, c] = pickTypes(rng, 3);
      const x = rng.int(1, 2) * 10;
      const y = 10;
      const z = rng.int(2, 9);
      const total = x + y + z;
      return {
        prompt: msg('c02.missing', { total, x: items(x, a), y: items(y, b), c: msg(`items.${c}`) }),
        scene: { type: 'ferry', animals: [], types: [a, b, c], subtotals: [{ type: a, count: x }, { type: b, count: y }, { type: c, count: -1 }] },
        answer: { kind: 'number', value: z, min: 0, max: 60 },
        hints: [msg('hint.c02.knownFirst', { x, y, s: x + y }), msg('hint.c02.countOn', { s: x + y, total })],
        explain: msg('c02.explainMissing', { s: x + y, total, z, c: msg(`items.${c}`) }),
      };
    },
    diagnose: (q, r) => {
      const e = expectedNumber(q.answer)!;
      const got = r.kind === 'number' ? r.value : null;
      if (got === null) return 'no-answer';
      if (q.scene.type === 'ferry' && q.scene.subtotals) {
        const total = q.scene.subtotals.reduce((s, t) => s + Math.max(0, t.count), 0) + e;
        if (got === total) return 'wrong-operation';
      }
      return diagnoseNumber(e, r);
    },
  },
];
