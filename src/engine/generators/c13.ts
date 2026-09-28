import type { TemplateDef, Generated } from '../template';
import { opt, diagnoseNumber, expectedNumber, responseNumber } from '../template';
import {
  addDaysToDate, daysInMonth, elapsedDays, inclusiveDateCount, lastWeekdayOfMonth, nthWeekdayOfMonth, weekdayOf, WEEKDAY_KEYS, addWeekdays,
} from '../math';
import { msg, type ChoiceOption } from '../types';
import type { Rng } from '../rng';

const day = (d: number) => msg(`day.${WEEKDAY_KEYS[d]}`);
const month = (m: number) => msg(`month.${m}`);
const dayOpt = (d: number): ChoiceOption => opt(`d${d}`, day(d));

/** Mostly the worksheet's July 2025 layout, sometimes other real months. */
function pickMonth(rng: Rng): { y: number; m: number } {
  if (rng.bool(0.45)) return { y: 2025, m: 7 };
  return { y: rng.int(2024, 2027), m: rng.int(1, 12) };
}

function weekdayChoice(rng: Rng, correct: number) {
  const others = rng.shuffle([addWeekdays(correct, 1), addWeekdays(correct, -1), addWeekdays(correct, rng.int(2, 5))]).filter((d, i, a) => d !== correct && a.indexOf(d) === i);
  return { kind: 'choice' as const, options: rng.shuffle([correct, ...others.slice(0, 3)]).map(dayOpt), value: `d${correct}` };
}

function weekdayOfDate(rng: Rng, story: boolean): Generated {
  const { y, m } = pickMonth(rng);
  const d = y === 2025 && m === 7 && rng.bool(0.5) ? rng.pick([11, 15]) : rng.int(1, daysInMonth(y, m));
  const wd = weekdayOf(y, m, d);
  return {
    prompt: story ? msg('c13.pocketMoney', { d, month: month(m), y }) : msg('c13.weekdayOf', { d, month: month(m), y }),
    scene: { type: 'calendar', year: y, month: m, marks: story ? [] : [d] },
    answer: weekdayChoice(rng, wd),
    hints: [msg('hint.c13.findDate', { d }), msg('hint.c13.lookUp')],
    explain: msg('c13.explainWeekday', { d, month: month(m), y, day: day(wd) }),
    plainPicture: true,
  };
}

const wdDiag: TemplateDef['diagnose'] = (q, r) => {
  if (r.kind !== 'choice' || !r.value) return 'no-answer';
  return r.value === (q.answer as { value: string }).value ? null : 'weekday-column';
};
const numDiag: TemplateDef['diagnose'] = (q, r) => diagnoseNumber(expectedNumber(q.answer)!, r);

export const C13: TemplateDef[] = [
  {
    id: 'c13-e-weekday', category: 'C13', stage: 'explore', subskill: 'C13.read', source: 'observed',
    title: 'Which day of the week is a date? (July 2025: 11th = Friday)', worksheetRefs: ['Q35 (11th July)'],
    generate: (rng) => weekdayOfDate(rng, false),
    diagnose: wdDiag,
  },
  {
    id: 'c13-e-find', category: 'C13', stage: 'explore', subskill: 'C13.read', source: 'prerequisite',
    title: 'Read the marked date',
    generate: (rng) => {
      const { y, m } = pickMonth(rng);
      const d = rng.int(1, daysInMonth(y, m));
      return {
        prompt: msg('c13.whichMarked', { month: month(m) }),
        scene: { type: 'calendar', year: y, month: m, marks: [d] },
        answer: { kind: 'number', value: d, min: 1, max: 31 },
        hints: [msg('hint.c13.lookFlower')],
        explain: msg('c13.explainMarked', { d, month: month(m) }),
        plainPicture: true,
      };
    },
    diagnose: numDiag,
  },
  {
    id: 'c13-e-first', category: 'C13', stage: 'explore', subskill: 'C13.read', source: 'prerequisite',
    title: 'The date of the first Monday/Tuesday/… of the month',
    generate: (rng) => {
      const { y, m } = pickMonth(rng);
      const wd = rng.int(0, 6);
      const d = nthWeekdayOfMonth(y, m, wd, 1)!;
      return {
        prompt: msg('c13.first', { day: day(wd), month: month(m), y }),
        scene: { type: 'calendar', year: y, month: m },
        answer: { kind: 'number', value: d, min: 1, max: 31 },
        hints: [msg('hint.c13.findColumn', { day: day(wd) }), msg('hint.c13.topOfColumn')],
        explain: msg('c13.explainFirst', { day: day(wd), month: month(m), d }),
        plainPicture: true,
      };
    },
    diagnose: numDiag,
  },
  {
    id: 'c13-p-last', category: 'C13', stage: 'practise', subskill: 'C13.named', source: 'observed',
    title: 'Date of the last Friday (or other day) of the month', worksheetRefs: ['Q32 (last Friday of July)'],
    generate: (rng) => {
      const { y, m } = pickMonth(rng);
      const wd = y === 2025 && m === 7 ? 4 : rng.int(0, 6);
      const d = lastWeekdayOfMonth(y, m, wd);
      return {
        prompt: msg('c13.last', { day: day(wd), month: month(m), y }),
        scene: { type: 'calendar', year: y, month: m },
        answer: { kind: 'number', value: d, min: 1, max: 31 },
        hints: [msg('hint.c13.findColumn', { day: day(wd) }), msg('hint.c13.bottomOfColumn')],
        explain: msg('c13.explainLast', { day: day(wd), month: month(m), d }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      const e = expectedNumber(q.answer)!;
      if (got === e - 7) return 'weekday-column';
      if (got !== null && got !== e && q.scene.type === 'calendar' && got === daysInMonth(q.scene.year, q.scene.month)) return 'weekday-column';
      return diagnoseNumber(e, r);
    },
  },
  {
    id: 'c13-p-length', category: 'C13', stage: 'practise', subskill: 'C13.named', source: 'prerequisite',
    title: 'How many days are in this month? (incl. leap-year February)',
    generate: (rng) => {
      const y = rng.int(2024, 2028);
      const m = rng.bool(0.3) ? 2 : rng.int(1, 12);
      const n = daysInMonth(y, m);
      return {
        prompt: msg('c13.length', { month: month(m), y }),
        scene: { type: 'calendar', year: y, month: m },
        answer: { kind: 'number', value: n, min: 1, max: 31 },
        hints: [msg('hint.c13.lastDate')],
        explain: msg('c13.explainLength', { month: month(m), y, n }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const got = responseNumber(r);
      const e = expectedNumber(q.answer)!;
      if (got !== null && got !== e && [28, 29, 30, 31].includes(got)) return 'month-length';
      return diagnoseNumber(e, r);
    },
  },
  {
    id: 'c13-p-named', category: 'C13', stage: 'practise', subskill: 'C13.named', source: 'observed',
    title: 'A named date in a story: which weekday? (15th July 2025 = Tuesday)', worksheetRefs: ['Q34 (pocket money on the 15th)'],
    generate: (rng) => weekdayOfDate(rng, true),
    diagnose: wdDiag,
  },
  {
    id: 'c13-a-elapsed', category: 'C13', stage: 'apply', subskill: 'C13.intervals', source: 'observed',
    title: 'Days that pass from one date to another (July 7 → July 27 = 20)', worksheetRefs: ['Q31', 'Q33 (wording made explicit)'],
    generate: (rng) => {
      const { y, m } = pickMonth(rng);
      const a = rng.int(1, 20);
      const b = rng.int(a + 3, daysInMonth(y, m));
      const n = elapsedDays([y, m, a], [y, m, b]);
      return {
        prompt: msg('c13.elapsed', { a, b, month: month(m) }),
        scene: { type: 'calendar', year: y, month: m, marks: [a, b] },
        answer: { kind: 'number', value: n, min: 0, max: 60 },
        hints: [msg('hint.c13.jumps'), msg('hint.c13.subtract', { a, b })],
        explain: msg('c13.explainElapsed', { a, b, month: month(m), n, inc: n + 1 }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const e = expectedNumber(q.answer)!;
      if (responseNumber(r) === e + 1) return 'elapsed-vs-inclusive';
      return diagnoseNumber(e, r);
    },
  },
  {
    id: 'c13-a-inclusive', category: 'C13', stage: 'apply', subskill: 'C13.intervals', source: 'observed',
    title: 'Count the dates from one date to another, counting both (July 7–27 = 21 dates)', worksheetRefs: ['Q31', 'Q33 (other reading)'],
    generate: (rng) => {
      const { y, m } = pickMonth(rng);
      const a = rng.int(1, 20);
      const b = rng.int(a + 3, daysInMonth(y, m));
      const n = inclusiveDateCount([y, m, a], [y, m, b]);
      return {
        prompt: msg('c13.inclusive', { a, b, month: month(m) }),
        scene: { type: 'calendar', year: y, month: m, range: [a, b] },
        answer: { kind: 'number', value: n, min: 0, max: 60 },
        hints: [msg('hint.c13.countBoth'), msg('hint.c13.plusOne', { a, b, d: b - a })],
        explain: msg('c13.explainInclusive', { a, b, month: month(m), n, e: n - 1 }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      const e = expectedNumber(q.answer)!;
      if (responseNumber(r) === e - 1) return 'elapsed-vs-inclusive';
      return diagnoseNumber(e, r);
    },
  },
  {
    id: 'c13-a-transition', category: 'C13', stage: 'apply', subskill: 'C13.transitions', source: 'extension',
    title: 'N days after a date, into the next month (incl. February and December)',
    generate: (rng) => {
      const y = rng.int(2024, 2028);
      const m = rng.pick([2, 2, 7, 12, rng.int(1, 12)]);
      const len = daysInMonth(y, m);
      const d = rng.int(len - 4, len);
      const n = rng.int(len - d + 1, len - d + 6);
      const end = addDaysToDate(y, m, d, n);
      const id = (mm: number, dd: number) => `D${mm}-${dd}`;
      const lbl = (mm: number, dd: number, yy: number) => opt(id(mm, dd), msg('dateLabel', { d: dd, month: month(mm), y: yy }));
      const wrongNoWrap = d + n; // e.g. "July 34" is not a real date, so use the day-number confusion instead
      const opts = [lbl(end.m, end.d, end.y)];
      const alt1 = addDaysToDate(y, m, d, n - 1);
      const alt2 = addDaysToDate(y, m, d, n + 1);
      opts.push(lbl(alt1.m, alt1.d, alt1.y), lbl(alt2.m, alt2.d, alt2.y));
      if (wrongNoWrap <= 31) opts.push(lbl(m, Math.min(wrongNoWrap, len), y));
      const unique = opts.filter((o, i) => opts.findIndex((p) => p.id === o.id) === i);
      return {
        prompt: msg('c13.after', { d, month: month(m), y, n }),
        scene: { type: 'calendar', year: y, month: m, marks: [d], showNextMonth: true },
        answer: { kind: 'choice', options: rng.shuffle(unique), value: id(end.m, end.d) },
        hints: [msg('hint.c13.monthEnds', { month: month(m), len, y }), msg('hint.c13.keepCounting', { left: len - d, more: n - (len - d) })],
        explain: msg('c13.explainAfter', { d, month: month(m), n, len, left: len - d, more: n - (len - d), ed: end.d, emonth: month(end.m), ey: end.y }),
        plainPicture: true,
      };
    },
    diagnose: (q, r) => {
      if (r.kind !== 'choice' || !r.value) return 'no-answer';
      if (r.value === (q.answer as { value: string }).value) return null;
      if (q.scene.type === 'calendar' && r.value.startsWith(`D${q.scene.month}-`)) return 'month-length';
      return 'off-by-one';
    },
  },
];
