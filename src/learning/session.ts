import type { CategoryId, ErrorTag, Mode, Response } from '../engine/types';
import { createRng, hashString } from '../engine/rng';
import { generateQuestion, getTemplate } from '../engine/registry';
import { checkAnswer } from '../engine/check';
import { SUBSKILL_BY_ID } from '../curriculum/curriculum';
import type { ActiveSession, Attempt, DateStr, Profile, SessionRecord, Slot, SlotState } from './types';
import { evaluateAll } from './mastery';
import { updateReviews } from './review';
import { assessmentFollowUp, errorFollowUp, prerequisiteSlot } from './planner';

export const NECTAR_PER_QUESTION = 1;
export const NECTAR_PER_SESSION = 1;

export function newSlotState(): SlotState {
  return { work: {}, checks: 0, hints: 0, hintsBeforeFirstCheck: 0, solved: false, sawSolution: false, skipped: false, done: false, activeMs: 0, interruptions: 0 };
}

export function startSession(profile: Profile, id: string, mode: Mode, plan: Slot[], now: number, extra: Partial<ActiveSession> = {}): Profile {
  const session: ActiveSession = { id, mode, startedAt: now, plan, index: 0, slots: { 0: newSlotState() }, errorStreak: {}, finished: plan.length === 0, ...extra };
  return { ...profile, activeSession: session };
}

function withSlot(profile: Profile, fn: (s: SlotState, session: ActiveSession) => SlotState): Profile {
  const session = profile.activeSession;
  if (!session) return profile;
  const cur = session.slots[session.index] ?? newSlotState();
  return { ...profile, activeSession: { ...session, slots: { ...session.slots, [session.index]: fn(cur, session) } } };
}

export function setWork(profile: Profile, work: Record<string, unknown>, response?: Response): Profile {
  return withSlot(profile, (s) => (s.done ? s : { ...s, work, response: response ?? s.response }));
}

/** A mathematical hint (instruction replays are not hints and never call this). */
export function useHint(profile: Profile): Profile {
  return withSlot(profile, (s) => (s.done ? s : { ...s, hints: s.hints + 1, hintsBeforeFirstCheck: s.checks === 0 ? s.hintsBeforeFirstCheck + 1 : s.hintsBeforeFirstCheck }));
}

export function showSolution(profile: Profile): Profile {
  // Seeing the worked solution before the first check is the strongest kind of help.
  return withSlot(profile, (s) => (s.done ? s : { ...s, sawSolution: true, hintsBeforeFirstCheck: s.checks === 0 ? s.hintsBeforeFirstCheck + 1 : s.hintsBeforeFirstCheck }));
}

export interface CheckOutcome { profile: Profile; correct: boolean; errorTag: ErrorTag | null; duplicate: boolean }

/**
 * Check the current response. Duplicate checks of a solved question are ignored.
 * The first result is recorded once and never overwritten by retries.
 */
export function checkCurrent(profile: Profile, response: Response, activeMs: number, interruptions: number): CheckOutcome {
  const session = profile.activeSession;
  if (!session || session.finished) return { profile, correct: false, errorTag: null, duplicate: true };
  const cur = session.slots[session.index] ?? newSlotState();
  if (cur.solved || cur.done) return { profile, correct: cur.solved, errorTag: null, duplicate: true };
  const s = session.plan[session.index];
  const q = generateQuestion(s.templateId, s.seed, s.format);
  const correct = checkAnswer(q.answer, response);
  const tag = correct ? null : getTemplate(s.templateId).diagnose?.(q, response) ?? 'other';
  const first = cur.checks === 0;
  const next: SlotState = {
    ...cur,
    response,
    checks: cur.checks + 1,
    firstResult: first ? correct : cur.firstResult,
    firstResponse: first && !correct ? response : cur.firstResponse,
    firstErrorTag: first && !correct ? tag ?? undefined : cur.firstErrorTag,
    solved: correct,
    activeMs: first ? activeMs : cur.activeMs,
    interruptions: Math.max(cur.interruptions, interruptions),
  };
  const errorStreak = { ...session.errorStreak };
  if (first) errorStreak[s.subskill] = correct ? 0 : (errorStreak[s.subskill] ?? 0) + 1;
  return {
    profile: { ...profile, activeSession: { ...session, errorStreak, slots: { ...session.slots, [session.index]: next } } },
    correct,
    errorTag: tag,
    duplicate: false,
  };
}

export function isIndependentSlot(slot: Slot, st: SlotState): boolean {
  return st.hintsBeforeFirstCheck === 0 && slot.phase !== 'worked' && slot.phase !== 'guided';
}

/**
 * Finish the current question: record one attempt, award nectar once (atomically in the
 * same state object) and move on. Also inserts adaptive follow-ups.
 */
export function finishCurrent(profile: Profile, today: DateStr, now: number, opts: { skipped?: boolean } = {}): { profile: Profile; attempt: Attempt | null; nectarAwarded: number } {
  const session = profile.activeSession;
  if (!session || session.finished) return { profile, attempt: null, nectarAwarded: 0 };
  const idx = session.index;
  const st = session.slots[idx] ?? newSlotState();
  if (st.done) return { profile, attempt: null, nectarAwarded: 0 };
  const s = session.plan[idx];
  const t = getTemplate(s.templateId);
  const skipped = !!opts.skipped && !st.solved;
  const attempt: Attempt = {
    id: `${session.id}#${idx}`,
    sessionId: session.id,
    slot: idx,
    date: today,
    ts: now,
    templateId: s.templateId,
    seed: s.seed,
    category: t.category,
    stage: t.stage,
    subskill: s.subskill,
    format: s.format,
    mode: session.mode,
    purpose: s.purpose,
    phase: s.phase,
    independent: !skipped && st.checks > 0 && isIndependentSlot(s, st),
    firstCorrect: st.firstResult === true,
    finalCorrect: st.solved,
    retries: Math.max(0, st.checks - 1),
    hints: st.hints,
    sawSolution: st.sawSolution,
    skipped,
    activeMs: Math.round(st.activeMs),
    interruptions: st.interruptions,
    errorTag: (st.firstErrorTag as ErrorTag | undefined) ?? (skipped ? 'no-answer' : undefined),
    firstResponse: st.firstResponse,
    unannounced: !!s.unannounced,
  };
  // Worked examples are demonstrations: they are not attempts.
  const record = s.phase !== 'worked';
  const key = `${session.id}#${idx}`;
  const award = st.solved && !profile.awarded.includes(key) ? NECTAR_PER_QUESTION : 0;

  let plan = session.plan;
  const rng = createRng(hashString(`${session.id}:${idx}:adapt`));
  const insert = (slot: Slot | null) => {
    if (slot) plan = [...plan.slice(0, idx + 1), slot, ...plan.slice(idx + 1)];
  };
  const liveSession = { ...session, plan };
  if (!skipped && st.checks > 0 && record) {
    if (session.mode === 'assessment') insert(assessmentFollowUp(rng, liveSession, s, attempt.firstCorrect));
    else if ((session.errorStreak[s.subskill] ?? 0) === 2) insert(prerequisiteSlot(rng, s.subskill, profile));
    else if (!attempt.firstCorrect && session.mode !== 'fluency' && session.mode !== 'worksheet') insert(errorFollowUp(rng, liveSession, s));
  }

  const attempts = record ? [...profile.attempts, attempt] : profile.attempts;
  const evidence = evaluateAll(attempts, profile.settings.mastery);
  const reviews = record ? updateReviews(profile.reviews, [attempt], evidence, today, profile.settings) : profile.reviews;
  const screened: CategoryId[] = session.mode === 'assessment' || s.purpose === 'assess'
    ? [...new Set([...profile.screened, SUBSKILL_BY_ID[s.subskill].category])]
    : profile.screened;

  const nextIndex = idx + 1;
  const finished = nextIndex >= plan.length;
  const nextSession: ActiveSession = {
    ...session,
    plan,
    index: finished ? idx : nextIndex,
    finished,
    slots: { ...session.slots, [idx]: { ...st, done: true, skipped }, ...(finished ? {} : { [nextIndex]: session.slots[nextIndex] ?? newSlotState() }) },
  };
  return {
    profile: {
      ...profile,
      attempts,
      reviews,
      screened,
      nectar: profile.nectar + award,
      awarded: award ? [...profile.awarded, key] : profile.awarded,
      activeSession: nextSession,
    },
    attempt: record ? attempt : null,
    nectarAwarded: award,
  };
}

/** End the session (finished or stopped early — no penalty). Session bonus is awarded once, only when finished. */
export function endSession(profile: Profile, today: DateStr, now: number): { profile: Profile; record: SessionRecord | null } {
  const session = profile.activeSession;
  if (!session) return { profile, record: null };
  const atts = profile.attempts.filter((a) => a.sessionId === session.id);
  const bonusKey = `${session.id}#session`;
  const bonus = session.finished && atts.length > 0 && !profile.awarded.includes(bonusKey) ? NECTAR_PER_SESSION : 0;
  const questionNectar = profile.awarded.filter((k) => k.startsWith(`${session.id}#`) && k !== bonusKey).length;
  const record: SessionRecord = {
    id: session.id,
    mode: session.mode,
    date: today,
    startedAt: session.startedAt,
    endedAt: now,
    questions: atts.length,
    independentCorrect: atts.filter((a) => a.independent && a.firstCorrect).length,
    supportedCompleted: atts.filter((a) => a.finalCorrect && !(a.independent && a.firstCorrect)).length,
    nectar: questionNectar + bonus,
    categories: [...new Set(atts.map((a) => a.category))],
    completed: session.finished,
  };
  return {
    profile: {
      ...profile,
      nectar: profile.nectar + bonus,
      awarded: bonus ? [...profile.awarded, bonusKey] : profile.awarded,
      sessions: [...profile.sessions.filter((r) => r.id !== session.id), record],
      activeSession: null,
    },
    record,
  };
}
