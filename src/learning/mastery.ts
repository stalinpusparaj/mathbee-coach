import type { Attempt, DateStr, Settings, SkillState } from './types';
import { SUBSKILLS } from '../curriculum/curriculum';
import type { CategoryId } from '../engine/types';

/**
 * Evidence summary for one subskill. The thresholds come from Settings.mastery and are a
 * configurable product heuristic, not a validated educational standard.
 */
export interface SkillEvidence {
  subskill: string;
  state: SkillState;
  attempts: number;
  independentAttempts: number;
  independentCorrect: number;
  /** latest-window independent first attempts, oldest → newest */
  window: boolean[];
  windowCorrect: number;
  supportedCompletions: number;
  sessions: number;
  templates: number;
  retentionChecks: { date: DateStr; pass: boolean }[];
  transferChecks: { date: DateStr; pass: boolean; format: string }[];
  meetsAccuracy: boolean;
  lastDate: DateStr | null;
  /** state flags explaining the label */
  missing: ('accuracy' | 'sessions' | 'templates' | 'retention' | 'transfer')[];
}

/** Evidence counts only an attempt that could show independent knowledge. */
export function isIndependentEvidence(a: Attempt): boolean {
  return a.independent && !a.skipped && !a.sawSolution && a.phase !== 'worked' && a.phase !== 'guided';
}

/** A retention check: independent work on a later day than the previous evidence, not a lesson retry. */
export function retentionChecks(atts: Attempt[]): { date: DateStr; pass: boolean }[] {
  const out: { date: DateStr; pass: boolean }[] = [];
  let prevDate: DateStr | null = null;
  for (const a of atts) {
    if (!isIndependentEvidence(a)) {
      prevDate = a.date;
      continue;
    }
    if ((a.purpose === 'review' || (prevDate !== null && a.date > prevDate)) && a.mode !== 'lesson' && a.purpose !== 'follow-up') {
      out.push({ date: a.date, pass: a.firstCorrect });
    }
    prevDate = a.date;
  }
  return out;
}

/** Transfer: independent success in a different presentation (plain / illustrated) or unannounced mixed work. */
export function transferChecks(atts: Attempt[]) {
  return atts
    .filter((a) => isIndependentEvidence(a) && (a.format !== 'interactive' || a.unannounced))
    .map((a) => ({ date: a.date, pass: a.firstCorrect, format: a.format }));
}

export function evaluateSkill(subskill: string, all: Attempt[], cfg: Settings['mastery']): SkillEvidence {
  const atts = all.filter((a) => a.subskill === subskill).sort((x, y) => x.ts - y.ts);
  const indep = atts.filter(isIndependentEvidence);
  const window = indep.slice(-cfg.window).map((a) => a.firstCorrect);
  const windowCorrect = window.filter(Boolean).length;
  const supported = atts.filter((a) => !isIndependentEvidence(a) && a.finalCorrect && !a.skipped).length;
  const sessions = new Set(indep.filter((a) => a.firstCorrect).map((a) => a.sessionId)).size;
  const templates = new Set(indep.filter((a) => a.firstCorrect).map((a) => a.templateId)).size;
  const retention = retentionChecks(atts);
  const transfer = transferChecks(atts);
  const meetsAccuracy = window.length >= cfg.window && windowCorrect >= cfg.correct;
  const retentionPassed = retention.length > 0 && retention[retention.length - 1].pass;
  const transferPassed = transfer.some((t) => t.pass);

  const missing: SkillEvidence['missing'] = [];
  if (!meetsAccuracy) missing.push('accuracy');
  if (sessions < cfg.minSessions) missing.push('sessions');
  if (templates < cfg.minTemplates) missing.push('templates');
  if (!retentionPassed) missing.push('retention');
  if (!transferPassed) missing.push('transfer');

  let state: SkillState;
  const acc = window.length ? windowCorrect / window.length : 0;
  if (atts.length === 0) state = 'not-assessed';
  else if (indep.length < 3) state = supported >= 2 || (indep.length > 0 && acc < 0.5 && atts.length >= 3) ? 'learning-supported' : 'more-evidence';
  else if (acc < 0.6) state = 'learning-supported';
  else if (meetsAccuracy && sessions >= cfg.minSessions && templates >= cfg.minTemplates && retentionPassed) {
    state = transferPassed ? 'applying' : 'retained';
  } else state = 'practising-independently';

  return {
    subskill,
    state,
    attempts: atts.length,
    independentAttempts: indep.length,
    independentCorrect: indep.filter((a) => a.firstCorrect).length,
    window,
    windowCorrect,
    supportedCompletions: supported,
    sessions,
    templates,
    retentionChecks: retention,
    transferChecks: transfer,
    meetsAccuracy,
    lastDate: atts.length ? atts[atts.length - 1].date : null,
    missing,
  };
}

export function evaluateAll(attempts: Attempt[], cfg: Settings['mastery']): Record<string, SkillEvidence> {
  return Object.fromEntries(SUBSKILLS.map((s) => [s.id, evaluateSkill(s.id, attempts, cfg)]));
}

export const STATE_RANK: Record<SkillState, number> = {
  'not-assessed': 0,
  'more-evidence': 1,
  'learning-supported': 2,
  'practising-independently': 3,
  retained: 4,
  applying: 5,
};

export function isSecure(e: SkillEvidence | undefined): boolean {
  return !!e && STATE_RANK[e.state] >= STATE_RANK['practising-independently'];
}

/** A category's garden "bloom" level for the map: 0–3 (stages with secure evidence). */
export function categoryBloom(cat: CategoryId, ev: Record<string, SkillEvidence>): number {
  const stages = ['explore', 'practise', 'apply'] as const;
  return stages.filter((st) => SUBSKILLS.some((s) => s.category === cat && s.stage === st && isSecure(ev[s.id]))).length;
}
