import { describe, it, expect } from 'vitest';
import { newProfile, validateImport, exportPayload, emptyState, migrate } from '../../src/persistence/schema';
import { startSession, checkCurrent, finishCurrent, useHint, endSession, showSolution } from '../../src/learning/session';
import { evaluateSkill, evaluateAll } from '../../src/learning/mastery';
import { planLesson, planAssessment, planDaily, chooseDailyMix } from '../../src/learning/planner';
import { dueReviews, applyReviewResult, scheduleNew } from '../../src/learning/review';
import { observe } from '../../src/learning/diagnosis';
import { buildReport } from '../../src/report/parentReport';
import { createMock, scoreMock, genericConfig, officialConfig } from '../../src/mock/mockEngine';
import { generateQuestion } from '../../src/engine/registry';
import { createRng } from '../../src/engine/rng';
import { addDays } from '../../src/learning/dates';
import { ActiveTimer } from '../../src/learning/activeTime';
import type { Profile, Slot, Attempt } from '../../src/learning/types';
import type { AnswerSpec, Response } from '../../src/engine/types';
import { DEFAULT_SETTINGS } from '../../src/learning/types';

const T0 = '2026-09-01';

function right(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'number': return { kind: 'number', value: a.value };
    case 'choice': return { kind: 'choice', value: a.value };
    case 'order': return { kind: 'order', value: [...a.value] };
    case 'fields': return { kind: 'fields', values: Object.fromEntries(a.fields.map((f) => [f.id, f.value])) };
    case 'time': return { kind: 'time', h: a.h, m: a.m };
  }
}
function wrong(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'number': return { kind: 'number', value: a.value + 1 };
    case 'choice': return { kind: 'choice', value: a.options.find((o) => o.id !== a.value)!.id };
    case 'order': return { kind: 'order', value: [...a.value].reverse() };
    case 'fields': return { kind: 'fields', values: Object.fromEntries(a.fields.map((f) => [f.id, f.value + 1])) };
    case 'time': return { kind: 'time', h: (a.h % 12) + 1, m: a.m };
  }
}

function slots(templateId: string, subskill: string, n: number, seed0: number, extra: Partial<Slot> = {}): Slot[] {
  return Array.from({ length: n }, (_, i) => ({ templateId, seed: seed0 + i, format: 'interactive' as const, purpose: 'need' as const, subskill, ...extra }));
}

/** Play a whole session: `plan` answers (true = right first time). */
function play(p: Profile, id: string, plan: Slot[], answers: (boolean | 'hint')[], date: string, mode: 'practice' | 'assessment' | 'lesson' | 'review' = 'practice'): Profile {
  p = startSession(p, id, mode, plan, Date.parse(date));
  let k = 0;
  while (p.activeSession && !p.activeSession.finished) {
    const s = p.activeSession.plan[p.activeSession.index];
    const q = generateQuestion(s.templateId, s.seed, s.format);
    const a = answers[Math.min(k++, answers.length - 1)];
    if (a === 'hint') p = useHint(p);
    if (a === false) p = checkCurrent(p, wrong(q.answer), 3000, 0).profile;
    p = checkCurrent(p, right(q.answer), 3000, 0).profile;
    p = finishCurrent(p, date, Date.parse(date) + k * 1000).profile;
  }
  return endSession(p, date, Date.parse(date) + 99999).profile;
}

const base = () => newProfile('p1', 'bee', 'Ari', 'en', T0);

describe('mastery evidence', () => {
  it('untested skills are "not assessed", never weak', () => {
    const ev = evaluateAll([], DEFAULT_SETTINGS.mastery);
    expect(Object.values(ev).every((e) => e.state === 'not-assessed')).toBe(true);
    const r = buildReport(base(), T0);
    expect(r.statements.filter((s) => s.kind === 'support')).toHaveLength(0);
    expect(r.observations).toHaveLength(0);
  });

  it('supported completion (hints / worked solution) cannot create independent mastery', () => {
    let p = base();
    for (let d = 0; d < 4; d++) {
      p = play(p, `s${d}`, [...slots('c01-p-rows', 'C01.to20', 6, d * 100), ...slots('c01-p-scatter', 'C01.to20', 6, d * 100 + 50)], ['hint'], addDays(T0, d * 3));
    }
    const e = evaluateSkill('C01.to20', p.attempts, p.settings.mastery);
    expect(e.attempts).toBe(48);
    expect(e.independentAttempts).toBe(0);
    expect(e.state).toBe('learning-supported');
  });

  it('a correct retry after an error is supported completion, not independent success', () => {
    let p = base();
    p = play(p, 's1', slots('c01-p-rows', 'C01.to20', 4, 1), [false], T0);
    const e = evaluateSkill('C01.to20', p.attempts, p.settings.mastery);
    expect(e.independentCorrect).toBe(0);
    expect(p.attempts.every((a) => a.finalCorrect && !a.firstCorrect)).toBe(true);
  });

  it('mastery needs accuracy + two sessions + two templates + a later-day retention check; transfer needs a new format', () => {
    let p = base();
    const mix = (seed: number) => [...slots('c01-p-rows', 'C01.to20', 5, seed), ...slots('c01-p-scatter', 'C01.to20', 5, seed + 50)];
    p = play(p, 'a', mix(1), [true], T0);
    let e = evaluateSkill('C01.to20', p.attempts, p.settings.mastery);
    expect(e.meetsAccuracy).toBe(true);
    expect(e.state).toBe('practising-independently'); // one session, same day
    p = play(p, 'b', mix(500), [true], T0);
    e = evaluateSkill('C01.to20', p.attempts, p.settings.mastery);
    expect(e.state).toBe('practising-independently'); // no later-day retention yet
    p = play(p, 'c', slots('c01-p-rows', 'C01.to20', 2, 900), [true], addDays(T0, 2));
    e = evaluateSkill('C01.to20', p.attempts, p.settings.mastery);
    expect(e.state).toBe('retained');
    expect(e.missing).toContain('transfer');
    p = play(p, 'd', slots('c01-p-rows', 'C01.to20', 1, 950, { format: 'plain' }), [true], addDays(T0, 3));
    e = evaluateSkill('C01.to20', p.attempts, p.settings.mastery);
    expect(e.state).toBe('applying');
  });

  it('worked examples are demonstrations, not attempts', () => {
    const plan = planLesson(createRng(1), 'C07.countPairs');
    expect(plan.map((s) => s.phase)).toEqual(['worked', 'guided', 'faded', 'independent', 'transfer']);
    expect(plan[4].format).toBe('plain');
    expect(new Set(plan.slice(3).map((s) => s.templateId)).size).toBe(2);
    let p = base();
    p = play(p, 'L', plan, [true], T0, 'lesson');
    expect(p.attempts.some((a) => a.phase === 'worked')).toBe(false);
    const guided = p.attempts.find((a) => a.phase === 'guided')!;
    expect(guided.independent).toBe(false);
  });
});

describe('rewards', () => {
  it('duplicate checks and repeated finishes cannot duplicate nectar', () => {
    let p = base();
    const plan = slots('c08-e-baskets', 'C08.to5', 2, 7);
    p = startSession(p, 'r', 'practice', plan, 0);
    const q = generateQuestion(plan[0].templateId, plan[0].seed);
    p = checkCurrent(p, right(q.answer), 1000, 0).profile;
    const dup = checkCurrent(p, right(q.answer), 1000, 0);
    expect(dup.duplicate).toBe(true);
    const f1 = finishCurrent(p, T0, 1);
    expect(f1.nectarAwarded).toBe(1);
    // re-finishing an already finished slot (e.g. after a refresh) does nothing
    const stale = { ...f1.profile, activeSession: { ...f1.profile.activeSession!, index: 0 } };
    const f2 = finishCurrent(stale, T0, 2);
    expect(f2.nectarAwarded).toBe(0);
    expect(f2.profile.nectar).toBe(1);
    // session bonus only once, and not for stopping early with no work
    const e1 = endSession(f1.profile, T0, 3);
    expect(e1.profile.nectar).toBe(1); // not finished → no bonus
    const done = play(base(), 'full', plan, [true], T0);
    expect(done.nectar).toBe(3);
    expect(endSession(done, T0, 5).profile.nectar).toBe(3);
  });
  it('skipping earns no nectar and is recorded without penalty', () => {
    let p = startSession(base(), 'sk', 'practice', slots('c08-e-baskets', 'C08.to5', 1, 3), 0);
    p = finishCurrent(p, T0, 1, { skipped: true }).profile;
    expect(p.nectar).toBe(0);
    expect(p.attempts[0].skipped).toBe(true);
  });
});

describe('adaptation', () => {
  it('assessment covers only a few topics per session and follows up adaptively', () => {
    const plan = planAssessment(createRng(2), base());
    expect(plan.length).toBe(4);
    let p = startSession(base(), 'as', 'assessment', plan, 0);
    const s0 = p.activeSession!.plan[0];
    const q = generateQuestion(s0.templateId, s0.seed);
    p = checkCurrent(p, wrong(q.answer), 1000, 0).profile;
    p = finishCurrent(p, T0, 1).profile;
    const next = p.activeSession!.plan[1];
    expect(next.purpose).toBe('follow-up');
    expect(next.subskill).toBe(s0.subskill);
    expect(next.templateId).not.toBe(s0.templateId);
  });
  it('two consecutive first-attempt errors offer a prerequisite / simpler check, without erasing progress', () => {
    let p = base();
    p = play(p, 'x', slots('c07-p-count', 'C07.countPairs', 3, 5), [false], T0);
    const purposes = p.sessions[0] && p.attempts.map((a) => a.subskill);
    expect(purposes).toContain('C07.makePairs');
    expect(p.nectar).toBeGreaterThan(0);
  });
  it('daily mix prioritises assessment when evidence is incomplete', () => {
    const mix = chooseDailyMix(base(), T0, 8);
    expect(mix.assess.length).toBeGreaterThan(0);
    const plan = planDaily(createRng(9), base(), T0);
    expect(plan.length).toBe(8);
    expect(plan.every((s) => s.unannounced)).toBe(true);
  });
});

describe('review scheduling', () => {
  it('reviews use 1,3,7,14-day intervals and missed days just stay due', () => {
    let r = scheduleNew(T0, [1, 3, 7, 14]);
    expect(r.due).toBe(addDays(T0, 1));
    expect(dueReviews({ x: r }, addDays(T0, 10))).toEqual(['x']); // overdue, still due, no penalty
    r = applyReviewResult(r, addDays(T0, 10), true, [1, 3, 7, 14]);
    expect(r.due).toBe(addDays(T0, 13));
    r = applyReviewResult(r, addDays(T0, 13), false, [1, 3, 7, 14]);
    expect(r.stage).toBe(0);
    expect(r.due).toBe(addDays(T0, 14));
  });
  it('review schedule survives a save/refresh round trip', () => {
    let p = base();
    p = play(p, 'a', slots('c01-p-rows', 'C01.to20', 6, 1), [true], T0);
    expect(Object.keys(p.reviews)).toContain('C01.to20');
    const state = { ...emptyState(), profiles: [p], activeProfileId: p.id };
    const restored = migrate(JSON.parse(JSON.stringify(state)));
    expect(restored.profiles[0].reviews).toEqual(p.reviews);
    expect(dueReviews(restored.profiles[0].reviews, addDays(T0, 1))).toContain('C01.to20');
  });
});

describe('observations', () => {
  it('one error is a single observation, not a weakness', () => {
    let p = base();
    p = play(p, 'o', slots('c07-p-count', 'C07.countPairs', 1, 11), [false, true], T0);
    const obs = observe(p.attempts);
    expect(obs.every((o) => o.confidence !== 'recurring')).toBe(true);
    expect(buildReport(p, T0).nextActions.some((a) => a.key.startsWith('lesson:'))).toBe(false);
  });
});

describe('parent report', () => {
  it('matches the real recorded attempts', () => {
    let p = base();
    p = play(p, 'm1', slots('c09-p-within20', 'C09.to20', 4, 1), [true, false, true, true], T0);
    const r = buildReport(p, T0);
    const row = r.categories.find((c) => c.category === 'C09')!;
    const indep = p.attempts.filter((a) => a.category === 'C09' && a.independent);
    expect(row.independent.total).toBe(indep.length);
    expect(row.independent.correct).toBe(indep.filter((a) => a.firstCorrect).length);
    expect(r.attemptsTotal).toBe(p.attempts.length);
    expect(r.nextActions.length).toBeGreaterThan(0);
    expect(r.nextActions.length).toBeLessThanOrEqual(3);
  });
});

describe('mock tests', () => {
  it('official mock requires parent-confirmed rules', () => {
    const c = base().competition;
    expect(officialConfig(c, ['C01'])).toBeNull();
    expect(officialConfig({ ...c, rulesConfirmed: true, questionCount: 10, durationMin: 30 }, ['C01'])?.kind).toBe('official');
  });
  it('scores from pure checks and records independent, unassisted attempts', () => {
    const m = createMock(createRng(4), 'mk', genericConfig(['C08', 'C09'], 6), 0);
    expect(m.questions.every((q) => q.format === 'plain')).toBe(true);
    const q0 = generateQuestion(m.questions[0].templateId, m.questions[0].seed, 'plain');
    m.answers[0] = right(q0.answer);
    const { result, attempts } = scoreMock(m, T0);
    expect(result.correct).toBeGreaterThanOrEqual(1);
    expect(result.total).toBe(6);
    expect(attempts.every((a) => a.hints === 0 && a.mode === 'mock')).toBe(true);
    expect(attempts.filter((a) => a.skipped).length).toBe(6 - Object.keys(m.answers).length);
  });
});

describe('import validation', () => {
  it('rejects malformed data and accepts a valid export', () => {
    expect(validateImport({ foo: 1 }).ok).toBe(false);
    const p = play(base(), 'i', slots('c01-e-row', 'C01.to5', 2, 1), [true], T0);
    const good = exportPayload({ ...emptyState(), profiles: [p], activeProfileId: p.id }, T0);
    expect(validateImport(JSON.parse(JSON.stringify(good))).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(good));
    bad.state.profiles[0].attempts[0].templateId = 'nope';
    expect(validateImport(bad).ok).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(good));
    bad2.state.profiles[0].nectar = -5;
    expect(validateImport(bad2).ok).toBe(false);
    const future = JSON.parse(JSON.stringify(good));
    future.state.schemaVersion = 99;
    expect(validateImport(future).ok).toBe(false);
  });
});

describe('active time', () => {
  it('excludes narration, pauses and hidden tabs', () => {
    let t = 0;
    const timer = new ActiveTimer(() => t);
    timer.start();
    t = 1000;
    timer.hold('narration');
    t = 5000;
    timer.release('narration');
    t = 6000;
    timer.hold('hidden');
    t = 60000;
    timer.release('hidden');
    t = 61000;
    expect(timer.stop()).toBe(3000);
    expect(timer.interruptionCount()).toBe(1);
  });
});

describe('show solution', () => {
  it('seeing the worked solution before checking makes the attempt non-independent', () => {
    let p = startSession(base(), 'ss', 'practice', slots('c01-e-row', 'C01.to5', 1, 1), 0);
    p = showSolution(p);
    const s = p.activeSession!.plan[0];
    p = checkCurrent(p, right(generateQuestion(s.templateId, s.seed).answer), 100, 0).profile;
    p = finishCurrent(p, T0, 1).profile;
    const a: Attempt = p.attempts[0];
    expect(a.independent).toBe(false);
  });
});
