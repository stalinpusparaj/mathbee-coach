import type { Attempt, DateStr, ReviewRecord, Settings } from './types';
import { addDays } from './dates';
import { isIndependentEvidence, type SkillEvidence, isSecure } from './mastery';

/**
 * Spaced review. Intervals are configurable (default 1, 3, 7, 14 days).
 * Missed days are not penalised: an overdue review simply stays due.
 */
export function scheduleNew(today: DateStr, intervals: number[]): ReviewRecord {
  return { stage: 0, due: addDays(today, intervals[0] ?? 1), history: [] };
}

/** Update a subskill's review record after an independent attempt made on or after the due date. */
export function applyReviewResult(rec: ReviewRecord, today: DateStr, pass: boolean, intervals: number[]): ReviewRecord {
  const history = [...rec.history, { date: today, pass }];
  if (pass) {
    const stage = Math.min(rec.stage + 1, intervals.length - 1);
    return { stage, due: addDays(today, intervals[stage] ?? 14), history };
  }
  // Not a demotion shown to the child: we just look again sooner.
  return { stage: 0, due: addDays(today, intervals[0] ?? 1), history };
}

/**
 * Recompute review records after new attempts. Pure: returns a new map.
 * - A subskill enters the schedule once it is secure (practising independently or better).
 * - An independent attempt on/after the due date counts as the review check.
 * - Immediate retries are not attempts (retries live inside one attempt), so they never count.
 */
export function updateReviews(
  reviews: Record<string, ReviewRecord>,
  newAttempts: Attempt[],
  evidence: Record<string, SkillEvidence>,
  today: DateStr,
  settings: Settings,
): Record<string, ReviewRecord> {
  const out = { ...reviews };
  for (const a of newAttempts) {
    const rec = out[a.subskill];
    if (rec && isIndependentEvidence(a) && a.date >= rec.due) {
      out[a.subskill] = applyReviewResult(rec, today, a.firstCorrect, settings.reviewIntervals);
    }
  }
  for (const [sub, ev] of Object.entries(evidence)) {
    if (!out[sub] && isSecure(ev)) out[sub] = scheduleNew(today, settings.reviewIntervals);
  }
  return out;
}

export function dueReviews(reviews: Record<string, ReviewRecord>, today: DateStr): string[] {
  return Object.entries(reviews)
    .filter(([, r]) => r.due <= today)
    .sort((a, b) => (a[1].due < b[1].due ? -1 : 1))
    .map(([k]) => k);
}
