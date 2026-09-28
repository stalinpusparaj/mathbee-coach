import type { TemplateDef, Generated } from '../template';
import { responseNumber, diagnoseNumber, expectedNumber } from '../template';
import { sequence } from '../math';
import { msg, type QuestionInstance, type Response } from '../types';
import type { Rng } from '../rng';

/**
 * Every trail states its rule ("count on by 1", "count back by 5"), so each gap has
 * exactly one correct value — no "guess the pattern" puzzles.
 */
function trail(rng: Rng, opts: { start: number; step: number; dir: 'forward' | 'backward'; len: number; gaps: number[] }): Generated {
  const values = sequence(opts.start, opts.step, opts.dir, opts.len);
  if (values.some((v) => v < 0 || v > 100)) throw new Error('trail out of range');
  const stones = values.map((v, i) => (opts.gaps.includes(i) ? null : v));
  const gapIds = opts.gaps.map((i) => `g${i}`);
  const ruleMsg = msg(opts.dir === 'forward' ? 'rule.on' : 'rule.back', { step: opts.step });
  const answer: Generated['answer'] = opts.gaps.length === 1
    ? { kind: 'number', value: values[opts.gaps[0]], min: 0, max: 100 }
    : { kind: 'fields', fields: opts.gaps.map((i, k) => ({ id: gapIds[k], label: msg('label.gap', { n: k + 1 }), value: values[i] })) };
  const firstGap = opts.gaps[0];
  const prevKnown = firstGap > 0 ? values[firstGap - 1] : null;
  void rng;
  return {
    prompt: msg('c10.fill', { rule: ruleMsg }),
    plain: msg('c10.plain', { rule: ruleMsg, seq: stones.map((v) => (v === null ? '__' : String(v))).join(', ') }),
    scene: { type: 'trail', stones, rule: { step: opts.step, dir: opts.dir }, gapIds },
    answer,
    hints: [
      ruleMsg,
      prevKnown !== null
        ? msg(opts.dir === 'forward' ? 'hint.c10.afterIs' : 'hint.c10.beforeIs', { n: prevKnown, step: opts.step })
        : msg('hint.c10.lookNeighbours'),
      msg('hint.c10.checkNext'),
    ],
    explain: msg('c10.explain', { rule: ruleMsg, seq: values.join(', ') }),
  };
}

function gapDiag(q: QuestionInstance, r: Response) {
  if (q.scene.type !== 'trail') return null;
  const { step, dir } = q.scene.rule;
  const expected: number[] = q.answer.kind === 'fields' ? q.answer.fields.map((f) => f.value) : [expectedNumber(q.answer)!];
  const got: (number | null)[] = r.kind === 'fields' ? (q.answer.kind === 'fields' ? q.answer.fields.map((f) => r.values[f.id] ?? null) : []) : [responseNumber(r)];
  if (got.every((g) => g === null)) return 'no-answer' as const;
  if (got.every((g, i) => g === expected[i])) return null;
  const opposite = dir === 'forward' ? -2 * step : 2 * step;
  if (got.some((g, i) => g === expected[i] + opposite)) return 'sequence-direction' as const;
  if (got.some((g, i) => g !== null && Math.abs(g - expected[i]) === 1)) return 'off-by-one' as const;
  return 'other' as const;
}

function beforeAfter(rng: Rng, which: 'before' | 'after', lo: number, hi: number): Generated {
  const n = rng.int(lo, hi);
  const ans = which === 'after' ? n + 1 : n - 1;
  const stones = which === 'after' ? [n, null] : [null, n];
  return {
    prompt: msg(which === 'after' ? 'c10.after' : 'c10.before', { n }),
    scene: { type: 'trail', stones, rule: { step: 1, dir: 'forward' }, gapIds: [which === 'after' ? 'g1' : 'g0'] },
    answer: { kind: 'number', value: ans, min: 0, max: 100 },
    hints: [msg(which === 'after' ? 'hint.c10.afterMeans' : 'hint.c10.beforeMeans'), msg(which === 'after' ? 'hint.c10.oneMore' : 'hint.c10.oneLess', { n })],
    explain: msg(which === 'after' ? 'c10.explainAfter' : 'c10.explainBefore', { n, ans }),
  };
}

const baDiag: TemplateDef['diagnose'] = (q, r) => {
  const e = expectedNumber(q.answer)!;
  const got = responseNumber(r);
  if (got !== null && Math.abs(got - e) === 2) return 'sequence-direction';
  return diagnoseNumber(e, r);
};

export const C10: TemplateDef[] = [
  {
    id: 'c10-e-after', category: 'C10', stage: 'explore', subskill: 'C10.beforeAfter10', source: 'prerequisite',
    title: 'Number just after (within 10)',
    generate: (rng) => beforeAfter(rng, 'after', 0, 9),
    diagnose: baDiag,
  },
  {
    id: 'c10-e-before', category: 'C10', stage: 'explore', subskill: 'C10.beforeAfter10', source: 'observed',
    title: 'Number just before (within 10)', worksheetRefs: ['Q19 (number before 28)'],
    generate: (rng) => beforeAfter(rng, 'before', 1, 10),
    diagnose: baDiag,
  },
  {
    id: 'c10-e-gap', category: 'C10', stage: 'explore', subskill: 'C10.beforeAfter10', source: 'observed',
    title: 'One gap in a counting-on trail within 10', worksheetRefs: ['Q26–Q30 (missing numbers)'],
    generate: (rng) => {
      const len = rng.int(4, 6);
      const start = rng.int(0, 10 - len + 1);
      return trail(rng, { start, step: 1, dir: 'forward', len, gaps: [rng.int(1, len - 2)] });
    },
    diagnose: gapDiag,
  },
  {
    id: 'c10-p-forward', category: 'C10', stage: 'practise', subskill: 'C10.seq100', source: 'observed',
    title: 'Counting on within 100 with two gaps (e.g. 17, __, 19, 20, __, 22)', worksheetRefs: ['Q26', 'Q28'],
    generate: (rng) => {
      const start = rng.int(8, 94);
      const g1 = rng.int(1, 2);
      const g2 = rng.int(g1 + 2, 5);
      return trail(rng, { start, step: 1, dir: 'forward', len: 6, gaps: [g1, g2] });
    },
    diagnose: gapDiag,
  },
  {
    id: 'c10-p-backward', category: 'C10', stage: 'practise', subskill: 'C10.seq100', source: 'observed',
    title: 'Counting back within 100 (e.g. 59, 58, __, 56, 55)', worksheetRefs: ['Q27', 'Q30'],
    generate: (rng) => {
      const start = rng.int(15, 100);
      const g1 = rng.int(1, 2);
      const g2 = rng.int(g1 + 2, 5);
      return trail(rng, { start, step: 1, dir: 'backward', len: 6, gaps: rng.bool() ? [g1, g2] : [g1] });
    },
    diagnose: gapDiag,
  },
  {
    id: 'c10-p-beforeafter', category: 'C10', stage: 'practise', subskill: 'C10.seq100', source: 'observed',
    title: 'Number before or after within 100', worksheetRefs: ['Q19 (before 28)'],
    generate: (rng) => beforeAfter(rng, rng.bool() ? 'before' : 'after', 11, 99),
    diagnose: baDiag,
  },
  {
    id: 'c10-a-multi', category: 'C10', stage: 'apply', subskill: 'C10.multiGap', source: 'observed',
    title: 'Two gaps side by side (e.g. 36, __, __, 33, 32, 31)', worksheetRefs: ['Q29', 'Q30'],
    generate: (rng) => {
      const dir = rng.bool() ? 'backward' : 'forward';
      const start = dir === 'backward' ? rng.int(20, 100) : rng.int(5, 90);
      const g = rng.int(1, 3);
      return trail(rng, { start, step: 1, dir, len: 6, gaps: [g, g + 1] });
    },
    diagnose: gapDiag,
  },
  {
    id: 'c10-a-skip', category: 'C10', stage: 'apply', subskill: 'C10.skip', source: 'extension',
    title: 'EXTENSION: skip-count by 2, 5 or 10 (rule stated)',
    generate: (rng) => {
      const step = rng.pick([2, 5, 10]);
      const dir = rng.bool(0.7) ? 'forward' : 'backward';
      const len = 5;
      const span = step * (len - 1);
      const k = dir === 'forward' ? rng.int(0, Math.floor((100 - span) / step)) : rng.int(Math.ceil(span / step), Math.floor(100 / step));
      const start = k * step;
      return trail(rng, { start, step, dir, len, gaps: rng.bool() ? [rng.int(1, 3)] : [1, 3] });
    },
    diagnose: gapDiag,
  },
  {
    id: 'c10-a-between', category: 'C10', stage: 'apply', subskill: 'C10.multiGap', source: 'prerequisite',
    title: 'The number between two numbers',
    generate: (rng) => {
      const n = rng.int(1, 98);
      return {
        prompt: msg('c10.between', { a: n, b: n + 2 }),
        scene: { type: 'trail', stones: [n, null, n + 2], rule: { step: 1, dir: 'forward' }, gapIds: ['g1'] },
        answer: { kind: 'number', value: n + 1, min: 0, max: 100 },
        hints: [msg('hint.c10.oneMore', { n })],
        explain: msg('c10.explainBetween', { a: n, b: n + 2, m: n + 1 }),
      };
    },
    diagnose: baDiag,
  },
];
