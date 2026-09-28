import type { Attempt } from './types';
import type { ErrorTag } from '../engine/types';
import { isIndependentEvidence } from './mastery';

/**
 * Tentative observations about errors. These are hypotheses for a parent to consider,
 * never clinical diagnoses, and one error alone is never treated as a weakness.
 */
export type ErrorKind = 'concept-gap' | 'counting-slip' | 'reading-vocabulary' | 'interface' | 'rushing' | 'uncertain';

export interface Observation {
  subskill: string;
  tag: ErrorTag;
  kind: ErrorKind;
  /** number of distinct questions with this error on the first try */
  occurrences: number;
  followUps: { correct: number; total: number };
  confidence: 'single-observation' | 'recurring' | 'resolved';
  evidence: { date: string; templateId: string; attemptId: string }[];
}

const COUNTING_TAGS: ErrorTag[] = ['off-by-one', 'double-count', 'skipped-object'];
const RUSH_MS = 2500;

export function observe(attempts: Attempt[]): Observation[] {
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  const groups = new Map<string, Attempt[]>();
  for (const a of sorted) {
    if (!a.errorTag || a.firstCorrect || a.mode === 'lesson') continue;
    const key = `${a.subskill}|${a.errorTag}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const out: Observation[] = [];
  for (const [key, errs] of groups) {
    const [subskill, tag] = key.split('|') as [string, ErrorTag];
    const distinct = new Set(errs.map((e) => `${e.templateId}:${e.seed}`)).size;
    // follow-up = the next independent attempt on the same subskill after each error
    let fuCorrect = 0;
    let fuTotal = 0;
    let lastFollowUpCorrect: boolean | null = null;
    for (const e of errs) {
      const next = sorted.find((x) => x.ts > e.ts && x.subskill === subskill && isIndependentEvidence(x));
      if (next) {
        fuTotal++;
        if (next.firstCorrect) fuCorrect++;
        lastFollowUpCorrect = next.firstCorrect;
      }
    }
    const fast = errs.filter((e) => e.activeMs > 0 && e.activeMs < RUSH_MS).length;
    let kind: ErrorKind = 'uncertain';
    if (tag === 'bird-vocabulary') kind = 'reading-vocabulary';
    else if (tag === 'no-answer') kind = 'interface';
    // one observation is not enough to suggest any cause
    else if (distinct < 2) kind = 'uncertain';
    else if (fast >= Math.ceil(errs.length / 2) && fuCorrect > 0) kind = 'rushing';
    else if (subskill.startsWith('C14') && errs.every((e) => e.format === 'plain') && fuCorrect > 0) kind = 'reading-vocabulary';
    else if (distinct >= 2 && fuTotal > 0 && fuCorrect < fuTotal) kind = 'concept-gap';
    else if (COUNTING_TAGS.includes(tag) && fuCorrect > 0) kind = 'counting-slip';

    const confidence: Observation['confidence'] =
      lastFollowUpCorrect === true && distinct < 2 ? 'resolved' : distinct >= 2 ? 'recurring' : 'single-observation';
    out.push({
      subskill,
      tag,
      kind,
      occurrences: distinct,
      followUps: { correct: fuCorrect, total: fuTotal },
      confidence,
      evidence: errs.slice(-5).map((e) => ({ date: e.date, templateId: e.templateId, attemptId: e.id })),
    });
  }
  return out.sort((a, b) => b.occurrences - a.occurrences);
}
