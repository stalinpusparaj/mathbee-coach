import type { TemplateDef, Generated } from '../template';
import { opt, numberChoice, diagnoseNumber, expectedNumber } from '../template';
import { addWeekdays, WEEKDAY_KEYS } from '../math';
import { msg, type ChoiceOption } from '../types';
import type { Rng } from '../rng';

const day = (d: number) => msg(`day.${WEEKDAY_KEYS[d]}`);
const dayOpt = (d: number): ChoiceOption => opt(`d${d}`, day(d));

function dayChoice(rng: Rng, correct: number, near: number[]) {
  const pool = [...new Set(near.map((d) => addWeekdays(d, 0)).filter((d) => d !== correct))];
  const others = rng.shuffle(pool).slice(0, 3);
  for (let d = 0; others.length < 3; d++) if (d !== correct && !others.includes(d)) others.push(d);
  return { kind: 'choice' as const, options: rng.shuffle([correct, ...others]).map(dayOpt), value: `d${correct}` };
}

function offsetQuestion(rng: Rng, start: number, offset: number, dir: 'after' | 'before', promptKey: string): Generated {
  const signed = dir === 'after' ? offset : -offset;
  const ans = addWeekdays(start, signed);
  const walk = Array.from({ length: offset }, (_, i) => day(addWeekdays(start, dir === 'after' ? i + 1 : -(i + 1))));
  return {
    prompt: msg(promptKey, { day: day(start), n: offset }),
    scene: { type: 'week', start, offset, direction: dir, cards: false },
    answer: dayChoice(rng, ans, [addWeekdays(ans, 1), addWeekdays(ans, -1), addWeekdays(start, dir === 'after' ? offset - 1 : -(offset - 1)), start]),
    hints: [
      msg(dir === 'after' ? 'hint.c11.walkForward' : 'hint.c11.walkBack', { day: day(start) }),
      msg('hint.c11.todayIsZero'),
      ...(offset > 1 ? [msg('hint.c11.countSteps', { n: offset })] : []),
      msg('hint.c11.wrap'),
    ],
    explain: offset === 1
      ? msg(dir === 'after' ? 'c11.explainAfter' : 'c11.explainBefore', { day: day(start), ans: day(ans) })
      : msg('c11.explainOffset', { day: day(start), n: offset, walk: { k: 'join', p: Object.fromEntries(walk.map((m, i) => [`i${i}`, m])) }, ans: day(ans) }),
  };
}

const dayDiag: TemplateDef['diagnose'] = (q, r) => {
  if (r.kind !== 'choice' || q.scene.type !== 'week' || !r.value) return 'no-answer';
  if (r.value === (q.answer as { value: string }).value) return null;
  const got = Number(r.value.slice(1));
  const { start = 0, offset = 1, direction = 'after' } = q.scene;
  const sign = direction === 'after' ? 1 : -1;
  if (got === addWeekdays(start, sign * (offset - 1)) || got === addWeekdays(start, sign * (offset + 1))) return 'week-offset-inclusive';
  if (got === addWeekdays(start, -sign * offset)) return 'sequence-direction';
  const crossing = direction === 'after' ? start + offset > 6 : start - offset < 0;
  return crossing ? 'week-wrap' : 'other';
};

export const C11: TemplateDef[] = [
  {
    id: 'c11-e-order', category: 'C11', stage: 'explore', subskill: 'C11.order', source: 'observed',
    title: 'Put the seven day cards in order (Monday first)', worksheetRefs: ['Q21 (days in a week)'],
    generate: (rng) => ({
      prompt: msg('c11.order'),
      scene: { type: 'week', cards: true },
      answer: { kind: 'order', items: rng.shuffle([0, 1, 2, 3, 4, 5, 6]).map(dayOpt), value: [0, 1, 2, 3, 4, 5, 6].map((d) => `d${d}`) },
      hints: [msg('hint.c11.startMonday'), msg('hint.c11.sing')],
      explain: msg('c11.explainOrder'),
    }),
  },
  {
    id: 'c11-e-count', category: 'C11', stage: 'explore', subskill: 'C11.order', source: 'observed',
    title: 'How many days in a week / in the weekend?', worksheetRefs: ['Q21'],
    generate: (rng) => {
      const weekend = rng.bool(0.4);
      return {
        prompt: msg(weekend ? 'c11.weekendDays' : 'c11.daysInWeek'),
        scene: { type: 'week', cards: false, highlight: weekend ? [5, 6] : [0, 1, 2, 3, 4, 5, 6] },
        answer: weekend ? numberChoice(rng, 2, [1, 3, 7]) : numberChoice(rng, 7, [5, 6, 8]),
        hints: [msg('hint.c11.countCards')],
        explain: msg(weekend ? 'c11.explainWeekend' : 'c11.explainWeek'),
      };
    },
    diagnose: (q, r) => diagnoseNumber(expectedNumber(q.answer)!, r),
  },
  {
    id: 'c11-e-next', category: 'C11', stage: 'explore', subskill: 'C11.order', source: 'prerequisite',
    title: 'The day after (no week crossing)',
    generate: (rng) => offsetQuestion(rng, rng.int(0, 5), 1, 'after', 'c11.after'),
    diagnose: dayDiag,
  },
  {
    id: 'c11-p-before', category: 'C11', stage: 'practise', subskill: 'C11.beforeAfter', source: 'observed',
    title: 'The day before, including the day before Monday', worksheetRefs: ['Q20 (day before Monday)'],
    generate: (rng) => offsetQuestion(rng, rng.bool(0.35) ? 0 : rng.int(1, 6), 1, 'before', 'c11.before'),
    diagnose: dayDiag,
  },
  {
    id: 'c11-p-after', category: 'C11', stage: 'practise', subskill: 'C11.beforeAfter', source: 'prerequisite',
    title: 'The day after, including the day after Sunday',
    generate: (rng) => offsetQuestion(rng, rng.bool(0.35) ? 6 : rng.int(0, 5), 1, 'after', 'c11.after'),
    diagnose: dayDiag,
  },
  {
    id: 'c11-p-yesterday', category: 'C11', stage: 'practise', subskill: 'C11.beforeAfter', source: 'prerequisite',
    title: 'Yesterday and tomorrow',
    generate: (rng) => {
      const dir = rng.bool() ? 'after' : 'before';
      return offsetQuestion(rng, rng.int(0, 6), 1, dir, dir === 'after' ? 'c11.tomorrow' : 'c11.yesterday');
    },
    diagnose: dayDiag,
  },
  {
    id: 'c11-a-after', category: 'C11', stage: 'apply', subskill: 'C11.offsets', source: 'extension',
    title: 'N days after a day, across the week (e.g. Friday + 3 = Monday)',
    generate: (rng) => offsetQuestion(rng, rng.int(0, 6), rng.int(2, 6), 'after', 'c11.daysAfter'),
    diagnose: dayDiag,
  },
  {
    id: 'c11-a-before', category: 'C11', stage: 'apply', subskill: 'C11.offsets', source: 'extension',
    title: 'N days before a day, across the week',
    generate: (rng) => offsetQuestion(rng, rng.int(0, 6), rng.int(2, 6), 'before', 'c11.daysBefore'),
    diagnose: dayDiag,
  },
  {
    id: 'c11-a-howmany', category: 'C11', stage: 'apply', subskill: 'C11.offsets', source: 'extension',
    title: 'How many days later is one day than another?',
    generate: (rng) => {
      const a = rng.int(0, 6);
      const n = rng.int(1, 6);
      const b = addWeekdays(a, n);
      return {
        prompt: msg('c11.howManyLater', { a: day(a), b: day(b) }),
        scene: { type: 'week', start: a, offset: n, direction: 'after', cards: false },
        answer: { kind: 'number', value: n, min: 0, max: 7 },
        hints: [msg('hint.c11.todayIsZero'), msg('hint.c11.countJumps')],
        explain: msg('c11.explainHowMany', { a: day(a), b: day(b), n }),
      };
    },
    diagnose: (q, r) => {
      const e = expectedNumber(q.answer)!;
      const got = r.kind === 'number' ? r.value : null;
      if (got === e + 1) return 'week-offset-inclusive';
      return diagnoseNumber(e, r);
    },
  },
];
