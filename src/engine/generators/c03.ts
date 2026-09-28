import type { TemplateDef, Generated } from '../template';
import { opt, numberChoice, near, responseNumber, expectedNumber } from '../template';
import { layoutPositions } from '../layout';
import { msg, joinMsgs, type BirdSpecies, type Msg, type QuestionInstance, type Response, type SceneObject } from '../types';
import type { Rng } from '../rng';

export const MAIN_BIRDS: BirdSpecies[] = ['owl', 'swan', 'parrot', 'ostrich', 'rooster'];
const DISTRACTORS: BirdSpecies[] = ['crow', 'penguin'];

function birdScene(rng: Rng, counts: [BirdSpecies, number][]): SceneObject[] {
  const kinds = rng.shuffle(counts.flatMap(([s, n]) => Array<BirdSpecies>(n).fill(s)));
  const pos = layoutPositions(kinds.length, 'scatter', rng);
  return kinds.map((k, i) => ({ id: `b${i + 1}`, kind: k, x: Math.round(pos[i].x * 10) / 10, y: Math.round(pos[i].y * 10) / 10 }));
}

const bname = (s: BirdSpecies, plural = true): Msg => msg(`${plural ? 'birds' : 'bird'}.${s}`);

function split(rng: Rng, species: BirdSpecies[], min: number, max: number, each: [number, number]): [BirdSpecies, number][] {
  for (let tries = 0; tries < 50; tries++) {
    const counts = species.map((s) => [s, rng.int(each[0], each[1])] as [BirdSpecies, number]);
    const total = counts.reduce((a, [, n]) => a + n, 0);
    if (total >= min && total <= max) return counts;
  }
  return species.map((s) => [s, each[0]] as [BirdSpecies, number]);
}

function countTarget(rng: Rng, counts: [BirdSpecies, number][], target: BirdSpecies, keypad: boolean): Generated {
  const n = counts.find(([s]) => s === target)![1];
  const total = counts.reduce((a, [, c]) => a + c, 0);
  const others = counts.filter(([s]) => s !== target).map(([s]) => s);
  return {
    prompt: msg('c03.countTarget', { birds: bname(target) }),
    scene: { type: 'birds', birds: birdScene(rng, counts), target: [target], habitats: [target, ...others.slice(0, 1)] },
    answer: keypad ? { kind: 'number', value: n, min: 0, max: 30 } : numberChoice(rng, n, [...near(n, 2), total]),
    hints: [msg('hint.c03.lookFor', { bird: bname(target, false) }), msg('hint.c03.moveTarget', { birds: bname(target) }), msg('hint.c03.countHabitat')],
    explain: msg('c03.explainTarget', { n, birds: bname(target), total }),
    plainPicture: true,
  };
}

function diagnoseTarget(q: QuestionInstance, r: Response) {
  const got = responseNumber(r);
  const e = expectedNumber(q.answer);
  if (got === null) return 'no-answer' as const;
  if (e === null || got === e) return null;
  if (q.scene.type === 'birds') {
    if (got === q.scene.birds.length) return 'counted-all-not-target' as const;
    const bySpecies = new Map<string, number>();
    q.scene.birds.forEach((b) => bySpecies.set(b.kind, (bySpecies.get(b.kind) ?? 0) + 1));
    for (const [s, c] of bySpecies) if (c === got && !q.scene.target?.includes(s as BirdSpecies)) return 'bird-vocabulary' as const;
  }
  return Math.abs(got - e) === 1 ? ('off-by-one' as const) : ('other' as const);
}

function fieldsForSpecies(counts: [BirdSpecies, number][]) {
  return counts.map(([s, n]) => ({ id: s, label: bname(s), value: n, visual: { type: 'bird' as const, species: s } }));
}

export const C03: TemplateDef[] = [
  {
    id: 'c03-e-target', category: 'C03', stage: 'explore', subskill: 'C03.oneTarget', source: 'observed',
    title: 'Count one bird type among two very different types (3–6 birds)', worksheetRefs: ['Q46–Q50'],
    generate: (rng) => {
      const [t, o] = rng.shuffle(MAIN_BIRDS).slice(0, 2);
      const counts = split(rng, [t, o], 3, 6, [1, 4]);
      return countTarget(rng, counts, t, false);
    },
    diagnose: diagnoseTarget,
  },
  {
    id: 'c03-e-sort', category: 'C03', stage: 'explore', subskill: 'C03.oneTarget', source: 'observed',
    title: 'Move the target birds to their home, then count them',
    generate: (rng) => {
      const [t, o] = rng.shuffle(MAIN_BIRDS).slice(0, 2);
      const counts = split(rng, [t, o], 4, 6, [1, 4]);
      const g = countTarget(rng, counts, t, true);
      g.prompt = msg('c03.sortTarget', { birds: bname(t) });
      return g;
    },
    diagnose: diagnoseTarget,
  },
  {
    id: 'c03-e-vocab', category: 'C03', stage: 'explore', subskill: 'C03.vocab', source: 'prerequisite',
    title: 'Bird names (tracked separately from counting)',
    generate: (rng) => {
      const choices = rng.shuffle(MAIN_BIRDS).slice(0, 3);
      const t = rng.pick(choices);
      return {
        prompt: msg('c03.whichIs', { bird: bname(t, false) }),
        scene: { type: 'birds', birds: [], habitats: [] },
        answer: { kind: 'choice', options: choices.map((s) => opt(s, bname(s, false), { type: 'bird', species: s })), value: t },
        hints: [msg(`hint.c03.feature.${t}`)],
        explain: msg('c03.explainVocab', { bird: bname(t, false), feature: msg(`hint.c03.feature.${t}`) }),
      };
    },
    diagnose: () => 'bird-vocabulary',
  },
  {
    id: 'c03-p-sortall', category: 'C03', stage: 'practise', subskill: 'C03.sortCount', source: 'observed',
    title: 'Sort three or four kinds and count each (6–15 birds)', worksheetRefs: ['Q46–Q50'],
    generate: (rng) => {
      const species = rng.shuffle(MAIN_BIRDS).slice(0, rng.int(3, 4));
      const counts = split(rng, species, 6, 15, [1, 5]);
      return {
        prompt: msg('c03.sortAll'),
        scene: { type: 'birds', birds: birdScene(rng, counts), target: species, habitats: species },
        answer: { kind: 'fields', fields: fieldsForSpecies(counts) },
        hints: [msg('hint.c03.oneKindAtATime'), msg('hint.c03.countHabitat')],
        explain: msg('c03.explainAll', { list: joinMsgs(counts.map(([sp, n]) => msg('countOf', { n, what: bname(sp) }))) }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      if (r.kind !== 'fields' || q.answer.kind !== 'fields') return 'other';
      const wrong = q.answer.fields.filter((f) => r.values[f.id] !== f.value);
      if (wrong.length === 0) return null;
      if (wrong.some((f) => Math.abs((r.values[f.id] ?? -99) - f.value) === 1)) return 'off-by-one';
      return 'other';
    },
  },
  {
    id: 'c03-p-one', category: 'C03', stage: 'practise', subskill: 'C03.sortCount', source: 'observed',
    title: 'Count one kind among four or five kinds',
    generate: (rng) => {
      const species = rng.shuffle(MAIN_BIRDS).slice(0, rng.int(4, 5));
      const counts = split(rng, species, 8, 15, [1, 5]);
      return countTarget(rng, counts, species[0], true);
    },
    diagnose: diagnoseTarget,
  },
  {
    id: 'c03-p-worksheet', category: 'C03', stage: 'practise', subskill: 'C03.sortCount', source: 'observed',
    title: 'Worksheet picture: count each of the five birds (with other birds mixed in)', worksheetRefs: ['Q46–Q50'],
    generate: (rng) => {
      const counts = split(rng, MAIN_BIRDS, 9, 15, [1, 4]);
      const extra: [BirdSpecies, number][] = DISTRACTORS.map((d) => [d, rng.int(1, 2)]);
      return {
        prompt: msg('c03.worksheet'),
        scene: { type: 'birds', birds: birdScene(rng, [...counts, ...extra]), target: MAIN_BIRDS, habitats: MAIN_BIRDS },
        answer: { kind: 'fields', fields: fieldsForSpecies(counts) },
        hints: [msg('hint.c03.otherBirds'), msg('hint.c03.oneKindAtATime')],
        explain: msg('c03.explainWorksheet'),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      if (r.kind !== 'fields' || q.answer.kind !== 'fields') return 'other';
      const wrong = q.answer.fields.filter((f) => r.values[f.id] !== f.value);
      if (wrong.length === 0) return null;
      return wrong.some((f) => Math.abs((r.values[f.id] ?? -99) - f.value) === 1) ? 'off-by-one' : 'other';
    },
  },
  {
    id: 'c03-a-compare', category: 'C03', stage: 'apply', subskill: 'C03.compare', source: 'extension',
    title: 'Which group has more birds? (15–25 birds)',
    generate: (rng) => {
      const species = rng.shuffle(MAIN_BIRDS).slice(0, 4);
      let counts = split(rng, species, 15, 25, [2, 8]);
      if (counts[0][1] === counts[1][1]) counts = counts.map((c, i) => (i === 0 ? [c[0], c[1] + 1] : c)) as [BirdSpecies, number][];
      const [a, b] = [counts[0], counts[1]];
      const more = a[1] > b[1] ? a[0] : b[0];
      return {
        prompt: msg('c03.whichMore', { a: bname(a[0]), b: bname(b[0]) }),
        scene: { type: 'birds', birds: birdScene(rng, counts), target: [a[0], b[0]], habitats: [a[0], b[0]] },
        answer: { kind: 'choice', options: [opt(a[0], bname(a[0]), { type: 'bird', species: a[0] }), opt(b[0], bname(b[0]), { type: 'bird', species: b[0] })], value: more },
        hints: [msg('hint.c03.countBoth', { a: bname(a[0]), b: bname(b[0]) }), msg('hint.c03.biggerNumber')],
        explain: msg('c03.explainMore', { a: bname(a[0]), na: a[1], b: bname(b[0]), nb: b[1], more: bname(more) }),
        plainPicture: true,
      };
    },
  },
  {
    id: 'c03-a-howmanymore', category: 'C03', stage: 'apply', subskill: 'C03.compare', source: 'extension',
    title: 'How many more of one bird than another?',
    generate: (rng) => {
      const species = rng.shuffle(MAIN_BIRDS).slice(0, 3);
      let counts: [BirdSpecies, number][] = [];
      for (let i = 0; i < 40; i++) {
        counts = split(rng, species, 15, 22, [2, 9]);
        if (counts[0][1] > counts[1][1]) break;
      }
      if (counts[0][1] <= counts[1][1]) counts = [[species[0], 8], [species[1], 4], [species[2], 5]];
      const [a, b] = counts;
      const diff = a[1] - b[1];
      return {
        prompt: msg('c03.howManyMore', { a: bname(a[0]), b: bname(b[0]) }),
        scene: { type: 'birds', birds: birdScene(rng, counts), target: [a[0], b[0]], habitats: [a[0], b[0]] },
        answer: { kind: 'number', value: diff, min: 0, max: 30 },
        hints: [msg('hint.c03.countBoth', { a: bname(a[0]), b: bname(b[0]) }), msg('hint.c03.matchUp')],
        explain: msg('c03.explainHowManyMore', { a: bname(a[0]), na: a[1], b: bname(b[0]), nb: b[1], diff }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      const e = expectedNumber(q.answer)!;
      if (got === null) return 'no-answer';
      if (got === e) return null;
      if (q.scene.type === 'birds' && q.scene.target) {
        const counts = q.scene.target.map((t) => q.scene.type === 'birds' ? q.scene.birds.filter((b) => b.kind === t).length : 0);
        if (counts.includes(got)) return 'wrong-operation';
      }
      return Math.abs(got - e) === 1 ? 'off-by-one' : 'other';
    },
  },
  {
    id: 'c03-a-multi', category: 'C03', stage: 'apply', subskill: 'C03.compare', source: 'extension',
    title: 'Two instructions: count two kinds together',
    generate: (rng) => {
      const species = rng.shuffle(MAIN_BIRDS).slice(0, 4);
      const counts = split(rng, species, 15, 25, [2, 8]);
      const [a, b] = counts;
      const g: Generated = {
        prompt: msg('c03.together', { a: bname(a[0]), b: bname(b[0]) }),
        scene: { type: 'birds', birds: birdScene(rng, counts), target: [a[0], b[0]], habitats: [a[0], b[0]] },
        answer: { kind: 'number', value: a[1] + b[1], min: 0, max: 30 },
        hints: [msg('hint.c03.countBoth', { a: bname(a[0]), b: bname(b[0]) }), msg('hint.c02.addUp')],
        explain: msg('c03.explainTogether', { a: bname(a[0]), na: a[1], b: bname(b[0]), nb: b[1], total: a[1] + b[1] }),
        plainPicture: true,
      };
      return g;
    },
    diagnose: diagnoseTarget,
  },
];
