import type { TemplateDef, Generated } from '../template';
import { opt, numberChoice, diagnoseNumber, expectedNumber, responseNumber } from '../template';
import { msg, type ShapeKind } from '../types';
import type { Rng } from '../rng';

const BASIC: ShapeKind[] = ['circle', 'triangle', 'square', 'rectangle'];
export const SIDES: Record<ShapeKind, number> = { circle: 0, triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 };
export const CORNERS = SIDES;

function dims(shape: ShapeKind, rng: Rng) {
  if (shape === 'rectangle') return rng.bool() ? { w: 1.6, h: 0.9 } : { w: 0.8, h: 1.5 };
  return { w: 1, h: 1 };
}

/**
 * A square is also a rectangle, so never ask the child to pick "the rectangle" when a
 * square is also on offer, and never offer "rectangle" as a wrong name for a square.
 */
function compatibleSet(target: ShapeKind, pool: ShapeKind[]): ShapeKind[] {
  return pool.filter((s) => s !== target && !(target === 'rectangle' && s === 'square') && !(target === 'square' && s === 'rectangle'));
}

function nameQuestion(rng: Rng, rotated: boolean): Generated {
  const target = rng.pick(rotated ? (['triangle', 'square', 'rectangle'] as ShapeKind[]) : BASIC);
  const others = rng.shuffle(compatibleSet(target, BASIC)).slice(0, 2);
  const rotation = rotated ? rng.pick([20, 30, 45, 60, 70]) : 0;
  const d = dims(target, rng);
  return {
    prompt: msg('c06.name'),
    scene: { type: 'shapes', shapes: [{ id: 's1', shape: target, rotation, ...d }], mode: 'name' },
    answer: { kind: 'choice', options: rng.shuffle([target, ...others]).map((s) => opt(s, msg(`shape.${s}`))), value: target },
    hints: [msg('hint.c06.countSidesFirst'), msg(`hint.c06.about.${target}`)],
    explain: msg(rotated ? 'c06.explainRotated' : 'c06.explainName', { shape: msg(`shape.${target}`), about: msg(`hint.c06.about.${target}`) }),
    plainPicture: true,
  };
}

function countQuestion(rng: Rng, what: 'sides' | 'corners', pool: ShapeKind[], keypad: boolean): Generated {
  const shape = rng.pick(pool);
  const n = SIDES[shape];
  const d = dims(shape, rng);
  return {
    prompt: msg(what === 'sides' ? 'c06.sides' : 'c06.corners', { shape: msg(`shape.${shape}`) }),
    scene: { type: 'shapes', shapes: [{ id: 's1', shape, rotation: 0, ...d }], mode: what },
    answer: keypad ? { kind: 'number', value: n, min: 0, max: 10 } : numberChoice(rng, n, [3, 4, 5, 6, 2, 0]),
    hints: [msg(what === 'sides' ? 'hint.c06.traceSides' : 'hint.c06.markCorners'), msg('hint.c06.startMark')],
    explain: shape === 'circle'
      ? msg(what === 'sides' ? 'c06.explainCircleSides' : 'c06.explainCircleCorners')
      : msg(what === 'sides' ? 'c06.explainSides' : 'c06.explainCorners', { shape: msg(`shape.${shape}`), n }),
    plainPicture: true,
  };
}

const sidesDiag: TemplateDef['diagnose'] = (q, r) => {
  const e = expectedNumber(q.answer)!;
  const got = responseNumber(r);
  if (got === null) return 'no-answer';
  if (got === e) return null;
  if (q.scene.type === 'shapes' && q.scene.shapes[0].shape === 'circle') return 'circle-sides';
  return diagnoseNumber(e, r);
};

export const C06: TemplateDef[] = [
  {
    id: 'c06-e-name', category: 'C06', stage: 'explore', subskill: 'C06.names', source: 'prerequisite',
    title: 'Name a circle, triangle, square or rectangle',
    generate: (rng) => nameQuestion(rng, false),
  },
  {
    id: 'c06-e-find', category: 'C06', stage: 'explore', subskill: 'C06.names', source: 'prerequisite',
    title: 'Tap the named shape',
    generate: (rng) => {
      const target = rng.pick(BASIC);
      const others = rng.shuffle(compatibleSet(target, BASIC)).slice(0, 2);
      const list = rng.shuffle([target, ...others]).map((s, i) => ({ id: `s${i + 1}`, shape: s, rotation: 0, ...dims(s, rng) }));
      const t = list.find((s) => s.shape === target)!;
      return {
        prompt: msg('c06.find', { shape: msg(`shape.${target}`) }),
        scene: { type: 'shapes', shapes: list, mode: 'pick' },
        answer: { kind: 'choice', options: list.map((s) => opt(s.id, msg(`shape.${s.shape}`), { type: 'shape', shape: s.shape, w: s.w, h: s.h })), value: t.id },
        hints: [msg(`hint.c06.about.${target}`)],
        explain: msg('c06.explainName', { shape: msg(`shape.${target}`), about: msg(`hint.c06.about.${target}`) }),
        plainPicture: true,
      };
    },
  },
  {
    id: 'c06-e-outline', category: 'C06', stage: 'explore', subskill: 'C06.names', source: 'prerequisite',
    title: 'Match a shape to its outline',
    generate: (rng) => {
      const target = rng.pick(BASIC);
      const d = dims(target, rng);
      const others = rng.shuffle(compatibleSet(target, BASIC)).slice(0, 2);
      const opts = rng.shuffle([target, ...others]).map((s) => opt(s, msg(`shape.${s}`), { type: 'shape', shape: s, ...(s === target ? d : dims(s, rng)) }));
      return {
        prompt: msg('c06.outline'),
        scene: { type: 'shapes', shapes: [{ id: 'outline', shape: target, rotation: 0, ...d }], mode: 'outline' },
        answer: { kind: 'choice', options: opts, value: target },
        hints: [msg('hint.c06.countSidesFirst'), msg(`hint.c06.about.${target}`)],
        explain: msg('c06.explainName', { shape: msg(`shape.${target}`), about: msg(`hint.c06.about.${target}`) }),
        plainPicture: true,
      };
    },
  },
  {
    id: 'c06-p-sides', category: 'C06', stage: 'practise', subskill: 'C06.sidesCorners', source: 'observed',
    title: 'Trace and count straight sides (circle has no straight sides)', worksheetRefs: ['Q12', 'Q13'],
    generate: (rng) => countQuestion(rng, 'sides', BASIC, true),
    diagnose: sidesDiag,
  },
  {
    id: 'c06-p-corners', category: 'C06', stage: 'practise', subskill: 'C06.sidesCorners', source: 'prerequisite',
    title: 'Mark and count corners',
    generate: (rng) => countQuestion(rng, 'corners', BASIC, true),
    diagnose: (q, r) => {
      const e = expectedNumber(q.answer)!;
      const got = responseNumber(r);
      if (got === null) return 'no-answer';
      if (got === e) return null;
      return q.scene.type === 'shapes' && q.scene.shapes[0].shape === 'circle' ? 'circle-sides' : 'sides-corners-confusion';
    },
  },
  {
    id: 'c06-p-worksheet', category: 'C06', stage: 'practise', subskill: 'C06.sidesCorners', source: 'observed',
    title: 'Worksheet style: number of sides (choice)', worksheetRefs: ['Q12 (rectangle)', 'Q13 (triangle)'],
    generate: (rng) => countQuestion(rng, 'sides', ['rectangle', 'triangle', 'square'], false),
    diagnose: sidesDiag,
  },
  {
    id: 'c06-a-rotated', category: 'C06', stage: 'apply', subskill: 'C06.rotateCompose', source: 'extension',
    title: 'Name a turned (rotated) shape by its sides and corners',
    generate: (rng) => nameQuestion(rng, true),
  },
  {
    id: 'c06-a-compose', category: 'C06', stage: 'apply', subskill: 'C06.rotateCompose', source: 'extension',
    title: 'How many small squares make this rectangle?',
    generate: (rng) => {
      const w = rng.int(2, 4);
      const h = rng.int(1, 2);
      return {
        prompt: msg('c06.compose'),
        scene: { type: 'shapes', shapes: [{ id: 'target', shape: w === h ? 'square' : 'rectangle', rotation: 0, w, h }], mode: 'compose', composeTarget: w === h ? 'square' : 'rectangle' },
        answer: { kind: 'number', value: w * h, min: 0, max: 20 },
        hints: [msg('hint.c06.fillRows', { w }), msg('hint.c06.countRows', { h, w })],
        explain: msg('c06.explainCompose', { w, h, n: w * h }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => diagnoseNumber(expectedNumber(q.answer)!, r),
  },
  {
    id: 'c06-a-poly', category: 'C06', stage: 'apply', subskill: 'C06.polygons', source: 'extension',
    title: 'EXTENSION: sides of pentagons and hexagons (not in the supplied worksheets)',
    generate: (rng) => {
      const g = countQuestion(rng, rng.bool() ? 'sides' : 'corners', ['pentagon', 'hexagon'], true);
      if (g.scene.type === 'shapes') g.scene.shapes[0].rotation = rng.pick([0, 15, 30, 45]);
      return g;
    },
    diagnose: sidesDiag,
  },
];
