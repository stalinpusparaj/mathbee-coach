import type { CategoryId, Msg } from '../engine/types';
import { msg } from '../engine/types';
import { CATEGORIES, SUBSKILLS, WORKSHEET_ITEMS } from '../curriculum/curriculum';
import type { Attempt, DateStr, Profile, SkillState } from '../learning/types';
import { evaluateAll, isIndependentEvidence, isSecure, STATE_RANK, type SkillEvidence } from '../learning/mastery';
import { observe, type Observation } from '../learning/diagnosis';
import { dueReviews } from '../learning/review';

export interface Ratio { correct: number; total: number }
const ratio = (atts: Attempt[], pred: (a: Attempt) => boolean): Ratio => {
  const sel = atts.filter(pred);
  return { correct: sel.filter((a) => a.firstCorrect).length, total: sel.length };
};

export interface CategoryRow {
  category: CategoryId;
  independent: Ratio;
  assisted: { completed: number; total: number };
  plain: Ratio;
  states: Record<SkillState, number>;
}

export interface SpeedRow { subskill: string; earlierMs: number; recentMs: number; n: number }

export interface NextAction { key: string; msg: Msg; action: { kind: 'lesson' | 'practice' | 'review' | 'assessment' | 'worksheet' | 'fluency'; subskill?: string; category?: CategoryId } }

export interface Report {
  evidence: Record<string, SkillEvidence>;
  coverage: { ref: string; description: string; category: CategoryId; readable: string; status: 'not-assessed' | 'needs-evidence' | 'learning' | 'secure' }[];
  unassessed: string[];
  categories: CategoryRow[];
  observations: Observation[];
  retention: { subskill: string; checks: { date: DateStr; pass: boolean }[] }[];
  plainOverall: Ratio;
  interactiveOverall: Ratio;
  speed: SpeedRow[];
  statements: { kind: 'can' | 'support' | 'assess'; subskill: string }[];
  nextActions: NextAction[];
  totals: Record<SkillState, number>;
  attemptsTotal: number;
  dueReviews: string[];
}

function emptyStates(): Record<SkillState, number> {
  return { 'not-assessed': 0, 'more-evidence': 0, 'learning-supported': 0, 'practising-independently': 0, retained: 0, applying: 0 };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildReport(profile: Profile, today: DateStr): Report {
  const atts = profile.attempts;
  const evidence = evaluateAll(atts, profile.settings.mastery);
  const totals = emptyStates();
  SUBSKILLS.forEach((s) => totals[evidence[s.id].state]++);

  const coverage = WORKSHEET_ITEMS.map((w) => {
    const states = w.subskills.map((s) => evidence[s].state);
    const status: Report['coverage'][number]['status'] = states.every((s) => s === 'not-assessed')
      ? 'not-assessed'
      : states.some((s) => s === 'learning-supported')
        ? 'learning'
        : states.every((s) => STATE_RANK[s] >= STATE_RANK['practising-independently'])
          ? 'secure'
          : 'needs-evidence';
    return { ref: w.ref, description: w.description, category: w.category, readable: w.readable, status };
  });

  const categories: CategoryRow[] = CATEGORIES.map((c) => {
    const ca = atts.filter((a) => a.category === c.id && !a.skipped);
    const states = emptyStates();
    SUBSKILLS.filter((s) => s.category === c.id).forEach((s) => states[evidence[s.id].state]++);
    const assistedAtts = ca.filter((a) => !isIndependentEvidence(a));
    return {
      category: c.id,
      independent: ratio(ca, isIndependentEvidence),
      assisted: { completed: assistedAtts.filter((a) => a.finalCorrect).length, total: assistedAtts.length },
      plain: ratio(ca, (a) => isIndependentEvidence(a) && a.format === 'plain'),
      states,
    };
  });

  const retention = SUBSKILLS.map((s) => ({ subskill: s.id, checks: evidence[s.id].retentionChecks })).filter((r) => r.checks.length);

  // Speed: compare the child with their own earlier comparable work (same subskill and format, independent and correct).
  const speed: SpeedRow[] = [];
  for (const s of SUBSKILLS) {
    const xs = atts
      .filter((a) => a.subskill === s.id && isIndependentEvidence(a) && a.firstCorrect && a.activeMs > 0 && a.format === 'interactive')
      .sort((a, b) => a.ts - b.ts)
      .map((a) => a.activeMs);
    if (xs.length >= 6) {
      const half = Math.floor(xs.length / 2);
      speed.push({ subskill: s.id, earlierMs: median(xs.slice(0, half)), recentMs: median(xs.slice(half)), n: xs.length });
    }
  }

  const statements: Report['statements'] = [];
  for (const s of SUBSKILLS) {
    const st = evidence[s.id].state;
    if (STATE_RANK[st] >= STATE_RANK['practising-independently']) statements.push({ kind: 'can', subskill: s.id });
    else if (st === 'learning-supported') statements.push({ kind: 'support', subskill: s.id });
  }
  // "needs more assessment" only for worksheet topics, so the list stays short
  for (const c of CATEGORIES) {
    const main = SUBSKILLS.filter((s) => s.category === c.id && s.source === 'observed');
    if (main.every((s) => ['not-assessed', 'more-evidence'].includes(evidence[s.id].state))) statements.push({ kind: 'assess', subskill: main[0]?.id ?? `${c.id}` });
  }

  const observations = observe(atts);
  const due = dueReviews(profile.reviews, today);
  const unassessed = SUBSKILLS.filter((s) => evidence[s.id].state === 'not-assessed').map((s) => s.id);
  const nextActions = chooseNextActions(profile, evidence, observations, due);

  return {
    evidence,
    coverage,
    unassessed,
    categories,
    observations,
    retention,
    plainOverall: ratio(atts, (a) => isIndependentEvidence(a) && a.format === 'plain'),
    interactiveOverall: ratio(atts, (a) => isIndependentEvidence(a) && a.format === 'interactive'),
    speed,
    statements,
    nextActions,
    totals,
    attemptsTotal: atts.length,
    dueReviews: due,
  };
}

function chooseNextActions(profile: Profile, ev: Record<string, SkillEvidence>, obs: Observation[], due: string[]): NextAction[] {
  const out: NextAction[] = [];
  const push = (a: NextAction) => { if (out.length < 3 && !out.some((o) => o.key === a.key)) out.push(a); };
  const gap = obs.find((o) => o.confidence === 'recurring');
  if (gap) push({ key: `lesson:${gap.subskill}`, msg: msg('next.lesson', { skill: msg(`sub.${gap.subskill}`) }), action: { kind: 'lesson', subskill: gap.subskill } });
  if (due.length) push({ key: 'review', msg: msg('next.review', { n: due.length }), action: { kind: 'review' } });
  const support = SUBSKILLS.filter((s) => ev[s.id].state === 'learning-supported').sort((a, b) => ev[b.id].attempts - ev[a.id].attempts)[0];
  if (support) push({ key: `practice:${support.id}`, msg: msg('next.practice', { skill: msg(`sub.${support.id}`) }), action: { kind: 'lesson', subskill: support.id } });
  const unscreened = CATEGORIES.filter((c) => !profile.screened.includes(c.id));
  if (unscreened.length) push({ key: 'assess', msg: msg('next.assess', { n: unscreened.length }), action: { kind: 'assessment' } });
  const noTransfer = SUBSKILLS.find((s) => isSecure(ev[s.id]) && ev[s.id].missing.includes('transfer'));
  if (noTransfer) push({ key: `worksheet:${noTransfer.category}`, msg: msg('next.worksheet', { skill: msg(`sub.${noTransfer.id}`) }), action: { kind: 'worksheet', category: noTransfer.category } });
  const fluent = SUBSKILLS.find((s) => STATE_RANK[ev[s.id].state] >= STATE_RANK.retained);
  if (fluent) push({ key: `fluency:${fluent.id}`, msg: msg('next.fluency', { skill: msg(`sub.${fluent.id}`) }), action: { kind: 'fluency', subskill: fluent.id } });
  const more = SUBSKILLS.find((s) => ev[s.id].state === 'more-evidence' || ev[s.id].state === 'practising-independently');
  if (more) push({ key: `practice2:${more.id}`, msg: msg('next.practice', { skill: msg(`sub.${more.id}`) }), action: { kind: 'practice', subskill: more.id } });
  if (!out.length) push({ key: 'start', msg: msg('next.start'), action: { kind: 'assessment' } });
  return out;
}

