import type { TemplateDef, Generated } from '../template';
import { opt } from '../template';
import { msg, type ChoiceOption } from '../types';
import type { Rng } from '../rng';

const LETTERS = 'ABCDE';
const label = (i: number) => msg('label.letter', { l: LETTERS[i] });

/** Distinct sizes with a clear visual step (uniform scaling of the same sprite). */
function sizes(rng: Rng, n: number, minStep: number): number[] {
  const all: number[] = [];
  for (let s = 0.35; s <= 1.0001; s += minStep) all.push(Math.round(s * 100) / 100);
  const picked = rng.shuffle(all).slice(0, n);
  return picked;
}

function items(rng: Rng, n: number, step: number) {
  const s = sizes(rng, n, step);
  return s.map((size, i) => ({ id: LETTERS[i], size }));
}

const options = (list: { id: string }[]): ChoiceOption[] => list.map((it, i) => opt(it.id, label(i)));

function pickExtreme(rng: Rng, which: 'big' | 'small', sprite: string, keyPrompt: string): Generated {
  const list = items(rng, 2, 0.3);
  const target = [...list].sort((a, b) => (which === 'big' ? b.size - a.size : a.size - b.size))[0];
  return {
    prompt: msg(keyPrompt),
    scene: { type: 'sizes', items: list, sprite },
    answer: { kind: 'choice', options: options(list), value: target.id },
    hints: [msg('hint.c04.sameShape'), msg(which === 'big' ? 'hint.c04.bigTakesSpace' : 'hint.c04.smallTakesSpace')],
    explain: msg(which === 'big' ? 'c04.explainBig' : 'c04.explainSmall', { id: target.id }),
    plainPicture: true,
  };
}

function orderQuestion(rng: Rng, dir: 'up' | 'down'): Generated {
  const n = rng.int(3, 5);
  const list = items(rng, n, 0.13);
  const sorted = [...list].sort((a, b) => (dir === 'up' ? a.size - b.size : b.size - a.size));
  return {
    prompt: msg(dir === 'up' ? 'c04.orderUp' : 'c04.orderDown'),
    scene: { type: 'sizes', items: list, sprite: 'pot_terracotta' },
    answer: { kind: 'order', items: options(list), value: sorted.map((s) => s.id) },
    hints: [msg(dir === 'up' ? 'hint.c04.findSmallestFirst' : 'hint.c04.findBiggestFirst'), msg('hint.c04.thenNext')],
    explain: msg('c04.explainOrder', { order: sorted.map((s) => s.id).join(', ') }),
    plainPicture: true,
  };
}

export const C04: TemplateDef[] = [
  {
    id: 'c04-e-big', category: 'C04', stage: 'explore', subskill: 'C04.bigSmall', source: 'observed',
    title: 'Which pot is big? (two same-shaped pots)', worksheetRefs: ['Q10'],
    generate: (rng) => pickExtreme(rng, 'big', 'pot_terracotta', 'c04.whichBig'),
  },
  {
    id: 'c04-e-small', category: 'C04', stage: 'explore', subskill: 'C04.bigSmall', source: 'observed',
    title: 'Which circle is small? (worksheet style)', worksheetRefs: ['Q10'],
    generate: (rng) => pickExtreme(rng, 'small', 'circle', 'c04.whichSmall'),
  },
  {
    id: 'c04-e-match', category: 'C04', stage: 'explore', subskill: 'C04.bigSmall', source: 'prerequisite',
    title: 'Put the big plant in the big pot',
    generate: (rng) => {
      const g = pickExtreme(rng, 'big', 'pot_green', 'c04.bigPlantPot');
      g.hints = [msg('hint.c04.bigPlantNeeds'), ...g.hints];
      return g;
    },
  },
  {
    id: 'c04-p-order-up', category: 'C04', stage: 'practise', subskill: 'C04.order', source: 'extension',
    title: 'Order 3–5 pots from smallest to biggest',
    generate: (rng) => orderQuestion(rng, 'up'),
    diagnose: (q, r) => (r.kind === 'order' && q.answer.kind === 'order' && r.value.join() === [...q.answer.value].reverse().join() ? 'reversed-order' : 'other'),
  },
  {
    id: 'c04-p-order-down', category: 'C04', stage: 'practise', subskill: 'C04.order', source: 'extension',
    title: 'Order 3–5 pots from biggest to smallest',
    generate: (rng) => orderQuestion(rng, 'down'),
    diagnose: (q, r) => (r.kind === 'order' && q.answer.kind === 'order' && r.value.join() === [...q.answer.value].reverse().join() ? 'reversed-order' : 'other'),
  },
  {
    id: 'c04-p-smallest', category: 'C04', stage: 'practise', subskill: 'C04.order', source: 'prerequisite',
    title: 'Find the smallest or biggest of four',
    generate: (rng) => {
      const list = items(rng, 4, 0.13);
      const which = rng.bool() ? 'small' : 'big';
      const target = [...list].sort((a, b) => (which === 'big' ? b.size - a.size : a.size - b.size))[0];
      return {
        prompt: msg(which === 'big' ? 'c04.whichBiggest' : 'c04.whichSmallest'),
        scene: { type: 'sizes', items: list, sprite: 'pot_cream' },
        answer: { kind: 'choice', options: options(list), value: target.id },
        hints: [msg('hint.c04.compareTwo'), msg('hint.c04.keepWinner')],
        explain: msg(which === 'big' ? 'c04.explainBiggest' : 'c04.explainSmallest', { id: target.id }),
        plainPicture: true,
      };
    },
  },
  {
    id: 'c04-a-fit', category: 'C04', stage: 'apply', subskill: 'C04.constraint', source: 'extension',
    title: 'Choose the smallest pot that is at least as wide as the plant',
    generate: (rng) => {
      const w = rng.int(4, 7);
      const smaller = rng.int(2, w - 1);
      const fit = w + rng.int(0, 1);
      const bigger = rng.int(fit + 1, 10);
      const widths = rng.shuffle([smaller, fit, bigger, ...(rng.bool() ? [rng.int(fit + 1, 10)] : [])]);
      const unique = [...new Set(widths)];
      const list = unique.map((size, i) => ({ id: LETTERS[i], size }));
      const answer = list.filter((it) => it.size >= w).sort((a, b) => a.size - b.size)[0];
      return {
        prompt: msg('c04.fit', { w }),
        scene: { type: 'sizes', items: list, sprite: 'pot_svg', constraint: { kind: 'min-width', value: w }, measured: true },
        answer: { kind: 'choice', options: options(list), value: answer.id },
        hints: [msg('hint.c04.tooSmall', { w }), msg('hint.c04.smallestOfFitting')],
        explain: msg('c04.explainFit', { w, id: answer.id, width: answer.size }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      if (r.kind !== 'choice' || q.scene.type !== 'sizes') return 'other';
      const chosen = q.scene.items.find((i) => i.id === r.value);
      if (!chosen) return 'no-answer';
      return chosen.size < (q.scene.constraint?.value ?? 0) ? 'size-length-confusion' : 'other';
    },
  },
  {
    id: 'c04-a-shelf', category: 'C04', stage: 'apply', subskill: 'C04.constraint', source: 'extension',
    title: 'Choose the biggest pot that still fits under a shelf',
    generate: (rng) => {
      const h = rng.int(5, 8);
      const fit = h - rng.int(0, 1);
      const smaller = rng.int(2, fit - 1);
      const tooTall = rng.int(h + 1, 10);
      const list = rng.shuffle([smaller, fit, tooTall]).map((size, i) => ({ id: LETTERS[i], size }));
      const answer = list.filter((it) => it.size <= h).sort((a, b) => b.size - a.size)[0];
      return {
        prompt: msg('c04.shelf', { h }),
        scene: { type: 'sizes', items: list, sprite: 'pot_svg', constraint: { kind: 'max-height', value: h }, measured: true },
        answer: { kind: 'choice', options: options(list), value: answer.id },
        hints: [msg('hint.c04.tooTall', { h }), msg('hint.c04.biggestOfFitting')],
        explain: msg('c04.explainShelf', { h, id: answer.id, height: answer.size }),
        plainPicture: true,
      };
    },
  },
  {
    id: 'c04-a-between', category: 'C04', stage: 'apply', subskill: 'C04.constraint', source: 'extension',
    title: 'Choose the pot bigger than one pot but smaller than another',
    generate: (rng) => {
      const list = items(rng, 4, 0.13);
      const sorted = [...list].sort((a, b) => a.size - b.size);
      const lo = sorted[0];
      const mid = sorted[1];
      const hi = sorted[2];
      return {
        prompt: msg('c04.between', { lo: lo.id, hi: hi.id }),
        scene: { type: 'sizes', items: list, sprite: 'pot_terracotta' },
        answer: { kind: 'choice', options: options(list).filter((o) => o.id !== lo.id && o.id !== hi.id), value: mid.id },
        hints: [msg('hint.c04.biggerThan', { id: lo.id }), msg('hint.c04.smallerThan', { id: hi.id })],
        explain: msg('c04.explainBetween', { lo: lo.id, mid: mid.id, hi: hi.id }),
        plainPicture: true,
      };
    },
  },
];
