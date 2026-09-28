import type { CategoryId, Response } from '../engine/types';
import type { Rng } from '../engine/rng';
import { SUBSKILLS } from '../curriculum/curriculum';
import { templatesForSubskill, generateQuestion } from '../engine/registry';
import { checkAnswer } from '../engine/check';
import type { Attempt, Competition, MockConfig, MockResult, MockState } from '../learning/types';

/** Templates that work on paper (setting clock hands needs the interactive clock). */
export function paperFriendly(templateId: string): boolean {
  return !['c12-e-set', 'c12-p-set', 'c12-a-setfive'].includes(templateId);
}

/** Subskills drawn directly from the worksheets (not extensions) — what a mock samples. */
export const MOCK_SUBSKILLS = SUBSKILLS.filter((s) => s.source === 'observed').map((s) => s.id);

export function genericConfig(categories: CategoryId[], questionCount = 15): MockConfig {
  return { kind: 'generic', questionCount, durationMin: null, navigation: 'free', categories, marksPerQuestion: 1 };
}

/** Official-format mock is only offered once the parent has confirmed the rules. */
export function officialConfig(c: Competition, categories: CategoryId[]): MockConfig | null {
  if (!c.rulesConfirmed || !c.questionCount) return null;
  return {
    kind: 'official',
    questionCount: c.questionCount,
    durationMin: c.durationMin,
    navigation: c.navigation,
    categories,
    marksPerQuestion: c.marksPerQuestion ?? 1,
  };
}

export function createMock(rng: Rng, id: string, config: MockConfig, now: number): MockState {
  const subs = MOCK_SUBSKILLS.filter((s) => config.categories.includes(s.slice(0, 3) as CategoryId));
  const pool = subs.length ? subs : MOCK_SUBSKILLS;
  const order = rng.shuffle(pool);
  const questions = Array.from({ length: config.questionCount }, (_, i) => {
    const sub = order[i % order.length];
    const t = rng.pick(templatesForSubskill(sub).filter((x) => paperFriendly(x.id)));
    return { templateId: t.id, seed: rng.int(1, 2 ** 31 - 1), format: 'plain' as const };
  });
  return { id, config, questions, answers: {}, current: 0, startedAt: now, activeMs: 0, submitted: false };
}

export function scoreMock(m: MockState, date: string): { result: MockResult; attempts: Attempt[] } {
  const items = m.questions.map((q, i) => {
    const inst = generateQuestion(q.templateId, q.seed, q.format);
    const r: Response | undefined = m.answers[i];
    const correct = !!r && checkAnswer(inst.answer, r);
    return { inst, r, correct, answered: !!r };
  });
  const byCategory: MockResult['byCategory'] = {};
  items.forEach(({ inst, correct }) => {
    const b = (byCategory[inst.category] ??= { total: 0, correct: 0 });
    b.total++;
    if (correct) b.correct++;
  });
  const correct = items.filter((i) => i.correct).length;
  const result: MockResult = {
    id: m.id,
    kind: m.config.kind,
    date,
    total: items.length,
    correct,
    marks: correct * m.config.marksPerQuestion,
    maxMarks: items.length * m.config.marksPerQuestion,
    activeMs: m.activeMs,
    byCategory,
    items: items.map(({ inst, correct: c, answered }) => ({ templateId: inst.templateId, seed: inst.seed, format: inst.format, correct: c, answered })),
  };
  const now = Date.now();
  const attempts: Attempt[] = items.map(({ inst, r, correct: c, answered }, i) => ({
    id: `${m.id}#${i}`,
    sessionId: m.id,
    slot: i,
    date,
    ts: now + i,
    templateId: inst.templateId,
    seed: inst.seed,
    category: inst.category,
    stage: inst.stage,
    subskill: inst.subskill,
    format: inst.format,
    mode: 'mock',
    purpose: 'mock',
    independent: true,
    firstCorrect: c,
    finalCorrect: c,
    retries: 0,
    hints: 0,
    sawSolution: false,
    skipped: !answered,
    activeMs: 0,
    interruptions: 0,
    firstResponse: c ? undefined : r,
    unannounced: true,
  }));
  return { result, attempts };
}
