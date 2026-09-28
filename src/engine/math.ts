/**
 * Pure mathematical functions. Correct answers are computed here, never from art,
 * animation, narration or any language model.
 */

// ---------- pairs ----------
export function pairsOf(n: number): { pairs: number; leftover: number } {
  assertCount(n);
  return { pairs: Math.floor(n / 2), leftover: n % 2 };
}

export function assertCount(n: number): void {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid count ${n}`);
}

// ---------- clock ----------
/** Degrees clockwise from 12 for the minute hand. */
export function minuteAngle(minutes: number): number {
  return 6 * minutes;
}
/** Degrees clockwise from 12 for the hour hand; moves continuously between marks. */
export function hourAngle(hour: number, minutes: number): number {
  return 30 * (hour % 12) + 0.5 * minutes;
}
/** Add minutes on a 12-hour clock face. Hours are 1..12. */
export function addMinutes(h: number, m: number, delta: number): { h: number; m: number } {
  const total = (((h % 12) * 60 + m + delta) % 720 + 720) % 720;
  const hh = Math.floor(total / 60);
  return { h: hh === 0 ? 12 : hh, m: total % 60 };
}
export function formatTime(h: number, m: number): string {
  return `${h}:${String(m).padStart(2, '0')}`;
}
/** Hour number a reader should say for the short hand at h:m (it is the last hour passed). */
export function hourHandHour(h: number): number {
  return h;
}

// ---------- week (Monday = 0 … Sunday = 6, matching the worksheet's Monday-first calendar) ----------
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export function addWeekdays(day: number, offset: number): number {
  return (((day + offset) % 7) + 7) % 7;
}

// ---------- calendar (date-only integer arithmetic; no Date objects, no time zones) ----------
export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
export function daysInMonth(y: number, m: number): number {
  if (m < 1 || m > 12) throw new Error(`bad month ${m}`);
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
/** Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's algorithm). */
export function dayNumber(y: number, m: number, d: number): number {
  if (d < 1 || d > daysInMonth(y, m)) throw new Error(`bad date ${y}-${m}-${d}`);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
export function fromDayNumber(z: number): { y: number; m: number; d: number } {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: era * 400 + yoe + (m <= 2 ? 1 : 0), m, d };
}
/** Monday = 0 … Sunday = 6. 1970-01-01 was a Thursday (3). */
export function weekdayOf(y: number, m: number, d: number): number {
  return addWeekdays(3, dayNumber(y, m, d));
}
export function addDaysToDate(y: number, m: number, d: number, n: number) {
  return fromDayNumber(dayNumber(y, m, d) + n);
}
/** Number of days that pass going from date A to date B (B − A). July 7 → July 27 = 20. */
export function elapsedDays(a: [number, number, number], b: [number, number, number]): number {
  return dayNumber(...b) - dayNumber(...a);
}
/** Number of calendar dates from A to B counting both A and B. July 7 … July 27 = 21. */
export function inclusiveDateCount(a: [number, number, number], b: [number, number, number]): number {
  const e = elapsedDays(a, b);
  if (e < 0) throw new Error('range reversed');
  return e + 1;
}
export function lastWeekdayOfMonth(y: number, m: number, weekday: number): number {
  const last = daysInMonth(y, m);
  const wd = weekdayOf(y, m, last);
  return last - addWeekdays(wd, -weekday);
}
export function nthWeekdayOfMonth(y: number, m: number, weekday: number, n: number): number | null {
  const first = weekdayOf(y, m, 1);
  const d = 1 + addWeekdays(weekday, -first) + 7 * (n - 1);
  return d <= daysInMonth(y, m) ? d : null;
}
/** Monday-first grid rows; null for cells outside the month. */
export function monthGrid(y: number, m: number): (number | null)[][] {
  const lead = weekdayOf(y, m, 1);
  const total = daysInMonth(y, m);
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ---------- sequences ----------
export function sequence(start: number, step: number, dir: 'forward' | 'backward', length: number): number[] {
  const s = dir === 'forward' ? step : -step;
  return Array.from({ length }, (_, i) => start + i * s);
}

// ---------- place value ----------
export function tensOnes(n: number): { tens: number; ones: number } {
  assertCount(n);
  return { tens: Math.floor(n / 10), ones: n % 10 };
}
export function needsRegroupAdd(a: number, b: number): boolean {
  return (a % 10) + (b % 10) >= 10;
}
export function needsRegroupSub(a: number, b: number): boolean {
  return a % 10 < b % 10;
}
