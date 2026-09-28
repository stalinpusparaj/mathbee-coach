import { dayNumber, fromDayNumber } from '../engine/math';
import type { DateStr } from './types';

/** Local calendar date (the child's day), as YYYY-MM-DD. */
export function todayStr(now: Date = new Date()): DateStr {
  return fmt(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function fmt(y: number, m: number, d: number): DateStr {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDate(s: DateStr): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}

export function addDays(s: DateStr, n: number): DateStr {
  const r = fromDayNumber(dayNumber(...parseDate(s)) + n);
  return fmt(r.y, r.m, r.d);
}

export function daysBetween(a: DateStr, b: DateStr): number {
  return dayNumber(...parseDate(b)) - dayNumber(...parseDate(a));
}

export function isValidDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  try {
    dayNumber(...parseDate(s));
    return true;
  } catch {
    return false;
  }
}
