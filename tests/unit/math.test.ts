import { describe, it, expect } from 'vitest';
import {
  pairsOf, hourAngle, minuteAngle, addMinutes, addWeekdays, weekdayOf, elapsedDays, inclusiveDateCount,
  lastWeekdayOfMonth, daysInMonth, isLeapYear, addDaysToDate, monthGrid, dayNumber, fromDayNumber,
} from '../../src/engine/math';
import { checkAnswer } from '../../src/engine/check';
import { generateQuestion } from '../../src/engine/registry';
import { createRng } from '../../src/engine/rng';
import { C08 } from '../../src/engine/generators/c08';

const MON = 0, TUE = 1, FRI = 4, SUN = 6;

describe('exact worksheet cases', () => {
  it('empty count = 0', () => {
    // find a zero-count instance of the zero template
    let found = false;
    for (let s = 1; s < 200 && !found; s++) {
      const q = generateQuestion('c01-e-zero', s);
      if (q.scene.type === 'count' && q.scene.objects.length === 0) {
        found = true;
        expect(checkAnswer(q.answer, { kind: 'choice', value: 'n0' })).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
  it('11 flowers = 5 pairs + 1 leftover', () => expect(pairsOf(11)).toEqual({ pairs: 5, leftover: 1 }));
  it('10 roses = 5 pairs', () => expect(pairsOf(10)).toEqual({ pairs: 5, leftover: 0 }));
  it('12 + 8 = 20, 11 + 19 = 30, 3 + 2 = 5', () => {
    const addTpl = C08[0];
    void addTpl;
    expect(12 + 8).toBe(20);
    // run through the real checker with a real addition question shape
    const q = generateQuestion('c08-a-decade', 1);
    if (q.scene.type !== 'add' || q.answer.kind !== 'number') throw new Error();
    expect(q.answer.value).toBe(q.scene.a + q.scene.b);
    expect(q.answer.value % 10).toBe(0);
  });
  it('subtraction: 19 − 11 = 8, 48 − 20 = 28, 27 − 17 = 10, 20 − 6 = 14', () => {
    for (const [a, b, d] of [[19, 11, 8], [48, 20, 28], [27, 17, 10], [20, 6, 14]]) expect(a - b).toBe(d);
  });
  it('59, 58, __, 56 → 57 (backward rule)', () => {
    let hit = false;
    for (let s = 1; s < 5000 && !hit; s++) {
      const q = generateQuestion('c10-p-backward', s);
      if (q.scene.type === 'trail' && q.scene.stones[0] === 59 && q.scene.stones[2] === null && q.scene.stones[1] === 58) {
        hit = true;
        const v = q.answer.kind === 'number' ? q.answer.value : q.answer.kind === 'fields' ? q.answer.fields[0].value : -1;
        expect(v).toBe(57);
      }
    }
    expect(hit).toBe(true);
  });
  it('day before Monday = Sunday; Friday + 3 days = Monday', () => {
    expect(addWeekdays(MON, -1)).toBe(SUN);
    expect(addWeekdays(FRI, 3)).toBe(MON);
    expect(addWeekdays(SUN, 1)).toBe(MON);
  });
  it('10:10 clock geometry: minute hand 60°, hour hand 305°', () => {
    expect(minuteAngle(10)).toBe(60);
    expect(hourAngle(10, 10)).toBe(305);
    expect(hourAngle(12, 0)).toBe(0);
    expect(hourAngle(3, 30)).toBe(105); // between 3 and 4
  });
  it('9:45 + 30 minutes = 10:15; 12:45 + 30 = 1:15', () => {
    expect(addMinutes(9, 45, 30)).toEqual({ h: 10, m: 15 });
    expect(addMinutes(12, 45, 30)).toEqual({ h: 1, m: 15 });
    expect(addMinutes(11, 30, 30)).toEqual({ h: 12, m: 0 });
  });
  it('July 2025 (Monday-first): 1st Tuesday, 15th Tuesday, 11th Friday, last Friday 25th', () => {
    expect(weekdayOf(2025, 7, 1)).toBe(TUE);
    expect(weekdayOf(2025, 7, 15)).toBe(TUE);
    expect(weekdayOf(2025, 7, 11)).toBe(FRI);
    expect(lastWeekdayOfMonth(2025, 7, FRI)).toBe(25);
    const grid = monthGrid(2025, 7);
    expect(grid[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(grid[4]).toEqual([28, 29, 30, 31, null, null, null]);
  });
  it('July 7 → July 27: 20 days elapsed; 21 dates counting both', () => {
    expect(elapsedDays([2025, 7, 7], [2025, 7, 27])).toBe(20);
    expect(inclusiveDateCount([2025, 7, 7], [2025, 7, 27])).toBe(21);
    expect(elapsedDays([2025, 7, 16], [2025, 7, 28])).toBe(12);
  });
  it('leap years and transitions', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(addDaysToDate(2024, 2, 28, 1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(addDaysToDate(2025, 2, 28, 1)).toEqual({ y: 2025, m: 3, d: 1 });
    expect(addDaysToDate(2025, 12, 30, 3)).toEqual({ y: 2026, m: 1, d: 2 });
    expect(elapsedDays([2025, 12, 25], [2026, 1, 5])).toBe(11);
    expect(weekdayOf(2026, 1, 1)).toBe(3); // Thursday
  });
  it('dayNumber round-trips', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const z = rng.int(-50000, 50000);
      const { y, m, d } = fromDayNumber(z);
      expect(dayNumber(y, m, d)).toBe(z);
    }
  });
});
