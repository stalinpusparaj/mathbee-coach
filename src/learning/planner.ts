import type { CategoryId, Format, Stage } from '../engine/types';
import type { Rng } from '../engine/rng';
import { templatesForSubskill } from '../engine/registry';
import { ASSESSMENT_ORDER, SUBSKILLS, SUBSKILL_BY_ID, type Subskill } from '../curriculum/curriculum';
import type { ActiveSession, DateStr, Profile, Slot } from './types';
import { evaluateAll, isSecure, STATE_RANK, type SkillEvidence } from './mastery';
import { dueReviews } from './review';

/** Roughly one question per 75 seconds of the chosen session length (default 10 min → 8). */
export function questionCount(minutes: number): number {
  return Math.max(4, Math.min(16, Math.round(minutes * 0.8)));
}

export function isUnlocked(sub: Subskill, ev: Record<string, SkillEvidence>, profile: Pick<Profile, 'settings'>): boolean {
  if (!sub.gated) return profile.settings.showExtensions || sub.source !== 'extension';
  if (profile.settings.unlockRegrouping) return true;
  return (sub.prereq ?? []).every((p) => isSecure(ev[p]));
}

function pickTemplate(rng: Rng, subskill: string, avoid: string[] = []): string {
  const ts = templatesForSubskill(subskill);
  const fresh = ts.filter((t) => !avoid.includes(t.id));
  return rng.pick(fresh.length ? fresh : ts).id;
}

function slot(rng: Rng, subskill: string, purpose: Slot['purpose'], format: Format = 'interactive', avoid: string[] = [], extra: Partial<Slot> = {}): Slot {
  return { templateId: pickTemplate(rng, subskill, avoid), seed: rng.int(1, 2 ** 31 - 1), format, purpose, subskill, ...extra };
}

function firstSubskill(cat: CategoryId, stage: Stage): Subskill {
  const list = SUBSKILLS.filter((s) => s.category === cat && s.stage === stage && !s.gated);
  return list.find((s) => s.source === 'observed') ?? list[0];
}

// ---------------- assessment ----------------
export const ASSESS_CATEGORIES_PER_SESSION = 4;

export function planAssessment(rng: Rng, profile: Profile): Slot[] {
  const todo = ASSESSMENT_ORDER.filter((c) => !profile.screened.includes(c)).slice(0, ASSESS_CATEGORIES_PER_SESSION);
  const cats = todo.length ? todo : rng.shuffle(ASSESSMENT_ORDER).slice(0, ASSESS_CATEGORIES_PER_SESSION);
  return cats.map((c) => slot(rng, firstSubskill(c, 'explore').id, 'assess'));
}

/**
 * Adaptive follow-up during assessment: success → one step harder in the same topic;
 * a first error → a different question on the same subskill, to tell a slip from a gap.
 * At most three questions per topic, so the child is not exhausted.
 */
export function assessmentFollowUp(rng: Rng, session: ActiveSession, done: Slot, firstCorrect: boolean): Slot | null {
  const cat = SUBSKILL_BY_ID[done.subskill].category;
  const inCat = session.plan.filter((s) => SUBSKILL_BY_ID[s.subskill].category === cat).length;
  if (inCat >= 3) return null;
  const stage = SUBSKILL_BY_ID[done.subskill].stage;
  if (firstCorrect) {
    if (stage === 'apply') return null;
    const next = firstSubskill(cat, stage === 'explore' ? 'practise' : 'apply');
    return slot(rng, next.id, 'assess');
  }
  if (done.purpose === 'follow-up') return null;
  const used = session.plan.filter((s) => s.subskill === done.subskill).map((s) => s.templateId);
  return slot(rng, done.subskill, 'follow-up', 'interactive', used);
}

// ---------------- teaching loop ----------------
/** Worked example → try with objects → less help → new independent question → different format. */
export function planLesson(rng: Rng, subskill: string): Slot[] {
  const used: string[] = [];
  const mk = (phase: Slot['phase'], format: Format) => {
    const s = slot(rng, subskill, 'lesson', format, phase === 'independent' || phase === 'transfer' ? used : [], { phase });
    used.push(s.templateId);
    return s;
  };
  return [mk('worked', 'interactive'), mk('guided', 'interactive'), mk('faded', 'interactive'), mk('independent', 'interactive'), mk('transfer', 'plain')];
}

export function planPractice(rng: Rng, subskill: string, n: number): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const format: Format = i === n - 1 ? 'plain' : i === n - 2 ? 'illustrated' : 'interactive';
    const prev = out.slice(-2).map((s) => s.templateId);
    out.push(slot(rng, subskill, 'need', format, prev));
  }
  return out;
}

export function planCategoryPractice(rng: Rng, profile: Profile, cat: CategoryId, stage: Stage, n: number): Slot[] {
  const ev = evaluateAll(profile.attempts, profile.settings.mastery);
  const subs = SUBSKILLS.filter((s) => s.category === cat && s.stage === stage && isUnlocked(s, ev, profile));
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const sub = subs[i % subs.length];
    const format: Format = i === n - 1 ? 'plain' : 'interactive';
    out.push(slot(rng, sub.id, 'need', format, out.slice(-2).map((s) => s.templateId)));
  }
  return rng.shuffle(out.slice(0, -1)).concat(out.slice(-1));
}

// ---------------- daily mixed practice ----------------
export interface DailyMix { needs: string[]; reviews: string[]; mixed: string[]; assess: CategoryId[] }

/**
 * Default mix: 50% demonstrated learning needs, 30% spaced review, 20% mixed application /
 * new learning. When most skills have no evidence yet, part of the session is assessment.
 */
export function chooseDailyMix(profile: Profile, today: DateStr, n: number): DailyMix {
  const ev = evaluateAll(profile.attempts, profile.settings.mastery);
  const unlocked = SUBSKILLS.filter((s) => isUnlocked(s, ev, profile));
  const needs = unlocked
    .filter((s) => ['learning-supported', 'more-evidence', 'practising-independently'].includes(ev[s.id].state))
    .sort((a, b) => STATE_RANK[ev[a.id].state] - STATE_RANK[ev[b.id].state] || ev[b.id].attempts - ev[a.id].attempts)
    .map((s) => s.id);
  const due = dueReviews(profile.reviews, today).filter((s) => SUBSKILL_BY_ID[s]);
  const retained = unlocked.filter((s) => STATE_RANK[ev[s.id].state] >= STATE_RANK.retained && !due.includes(s.id)).map((s) => s.id);
  // next steps: subskills whose prerequisites are secure but which have little evidence
  const next = unlocked
    .filter((s) => ev[s.id].attempts === 0 && (s.prereq ?? []).length > 0 && (s.prereq ?? []).every((p) => isSecure(ev[p])))
    .map((s) => s.id);
  const secure = unlocked.filter((s) => isSecure(ev[s.id])).map((s) => s.id);
  const unscreened = ASSESSMENT_ORDER.filter((c) => !profile.screened.includes(c));

  let nNeeds = Math.round(n * 0.5);
  let nReview = Math.round(n * 0.3);
  let nMixed = n - nNeeds - nReview;
  const assess: CategoryId[] = [];
  if (unscreened.length > 7) {
    // evidence is very incomplete: prioritise gentle assessment
    const k = Math.min(unscreened.length, Math.ceil(n / 2));
    assess.push(...unscreened.slice(0, k));
    nMixed = Math.max(0, nMixed - k);
    nReview = Math.max(0, nReview - Math.max(0, k - (n - nNeeds - nReview)));
  } else if (unscreened.length) {
    assess.push(unscreened[0]);
    nMixed = Math.max(0, nMixed - 1);
  }
  const reviewPool = [...due, ...retained];
  const reviews = reviewPool.slice(0, nReview);
  nNeeds += nReview - reviews.length; // no reviews available → more needs
  const needsPicked = needs.slice(0, nNeeds);
  const mixedPool = [...next, ...secure.filter((s) => !needsPicked.includes(s) && !reviews.includes(s))];
  const mixed = mixedPool.slice(0, nMixed + (nNeeds - needsPicked.length));
  return { needs: needsPicked, reviews, mixed, assess };
}

export function planDaily(rng: Rng, profile: Profile, today: DateStr): Slot[] {
  const n = questionCount(profile.settings.sessionMinutes);
  const mix = chooseDailyMix(profile, today, n);
  const slots: Slot[] = [];
  mix.assess.forEach((c) => slots.push(slot(rng, firstSubskill(c, 'explore').id, 'assess')));
  // needs may repeat to fill their share
  const needShare = Math.max(0, Math.round(n * 0.5));
  for (let i = 0; i < needShare && mix.needs.length; i++) slots.push(slot(rng, mix.needs[i % mix.needs.length], 'need'));
  mix.reviews.forEach((s) => slots.push(slot(rng, s, 'review', rng.bool(0.5) ? 'illustrated' : 'interactive')));
  mix.mixed.forEach((s) => slots.push(slot(rng, s, 'mixed', rng.pick(['plain', 'illustrated', 'interactive'] as Format[]), [], { unannounced: true })));
  // brand-new learner: fill with first explore skills
  let k = 0;
  while (slots.length < n) {
    const c = ASSESSMENT_ORDER[k++ % ASSESSMENT_ORDER.length];
    slots.push(slot(rng, firstSubskill(c, 'explore').id, 'new'));
  }
  const trimmed = slots.slice(0, n);
  // mixed sessions do not announce the operation
  return rng.shuffle(trimmed).map((s) => ({ ...s, unannounced: true }));
}

export function planReview(rng: Rng, profile: Profile, today: DateStr, n: number): Slot[] {
  const due = dueReviews(profile.reviews, today).filter((s) => SUBSKILL_BY_ID[s]);
  const out: Slot[] = [];
  for (let i = 0; i < Math.min(n, due.length * 2); i++) {
    const sub = due[i % due.length];
    out.push(slot(rng, sub, 'review', i % 2 ? 'plain' : 'interactive', out.map((s) => s.templateId)));
  }
  return out;
}

export function planFluency(rng: Rng, subskill: string): Slot[] {
  return Array.from({ length: 6 }, () => slot(rng, subskill, 'fluency', 'plain'));
}

export function planWorksheet(rng: Rng, profile: Profile, cats: CategoryId[], n: number): Slot[] {
  const ev = evaluateAll(profile.attempts, profile.settings.mastery);
  const subs = SUBSKILLS.filter((s) => cats.includes(s.category) && isUnlocked(s, ev, profile) && s.stage !== 'apply');
  return Array.from({ length: n }, (_, i) => slot(rng, subs[i % subs.length].id, 'worksheet', 'plain'));
}

/**
 * After two first-attempt errors in a row on one subskill: offer a prerequisite check
 * (or a simpler Explore question) next. Progress is never erased.
 */
export function prerequisiteSlot(rng: Rng, subskill: string, profile: Profile): Slot | null {
  const sub = SUBSKILL_BY_ID[subskill];
  const ev = evaluateAll(profile.attempts, profile.settings.mastery);
  const prereq = (sub.prereq ?? []).find((p) => !isSecure(ev[p])) ?? (sub.stage !== 'explore' ? firstSubskill(sub.category, 'explore').id : null);
  if (!prereq) return null;
  return slot(rng, prereq, 'follow-up');
}

/** One follow-up after a first-attempt error (outside assessment), to separate slips from gaps. */
export function errorFollowUp(rng: Rng, session: ActiveSession, done: Slot): Slot | null {
  if (done.purpose === 'follow-up' || done.phase === 'worked' || done.phase === 'guided') return null;
  const already = session.plan.filter((s) => s.purpose === 'follow-up').length;
  if (already >= 2) return null;
  const used = session.plan.filter((s) => s.subskill === done.subskill).map((s) => s.templateId);
  return slot(rng, done.subskill, 'follow-up', 'interactive', used);
}
