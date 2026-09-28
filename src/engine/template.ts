import type { Rng } from './rng';
import type {
  AnswerSpec, CategoryId, ChoiceOption, ErrorTag, Format, Msg, QuestionInstance, Response, Scene, Stage, Visual,
} from './types';
import { msg } from './types';

export interface Generated {
  prompt: Msg;
  plain?: Msg;
  scene: Scene;
  answer: AnswerSpec;
  hints: Msg[];
  explain: Msg;
  narration?: Msg;
  /** plain format still needs a (black-and-white) picture, e.g. counting */
  plainPicture?: boolean;
}

export type Source = 'observed' | 'prerequisite' | 'extension';

export interface TemplateDef {
  id: string;
  category: CategoryId;
  stage: Stage;
  subskill: string;
  source: Source;
  /** short description for the parent area and coverage matrix */
  title: string;
  /** worksheet question numbers this template reflects, if any */
  worksheetRefs?: string[];
  formats?: Format[];
  generate(rng: Rng): Generated;
  /** tentative error tag for a wrong response (never a diagnosis) */
  diagnose?(q: QuestionInstance, r: Response): ErrorTag | null;
}

export const num = (n: number): Msg => msg('num', { n });
export const items = (n: number, item: string): Msg => msg('nItems', { n, item: msg(n === 1 ? `item1.${item}` : `items.${item}`) });

export function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

/** Choice answer with distinct, non-negative numeric options that include the correct one exactly once. */
export function numberChoice(rng: Rng, correct: number, candidates: number[], count = 4): AnswerSpec {
  const pool = uniqueNumbers(candidates.filter((c) => c !== correct && c >= 0 && Number.isInteger(c)));
  const distractors = rng.shuffle(pool).slice(0, count - 1);
  for (let d = 1; distractors.length < count - 1; d++) {
    for (const c of [correct + d, correct - d]) {
      if (c >= 0 && !distractors.includes(c) && distractors.length < count - 1) distractors.push(c);
    }
  }
  const values = rng.shuffle([correct, ...distractors]);
  return {
    kind: 'choice',
    options: values.map((v) => ({ id: `n${v}`, label: num(v) })),
    value: `n${correct}`,
  };
}

export function near(correct: number, spread = 2): number[] {
  const out: number[] = [];
  for (let d = 1; d <= spread; d++) out.push(correct - d, correct + d);
  return out.filter((v) => v >= 0);
}

export function choice(options: ChoiceOption[], value: string, rng?: Rng): AnswerSpec {
  return { kind: 'choice', options: rng ? rng.shuffle(options) : options, value };
}

export const opt = (id: string, label: Msg, visual?: Visual): ChoiceOption => (visual ? { id, label, visual } : { id, label });

/** common numeric diagnosis */
export function diagnoseNumber(expected: number, r: Response): ErrorTag | null {
  const got = responseNumber(r);
  if (got === null) return 'no-answer';
  if (got === expected) return null;
  if (Math.abs(got - expected) === 1) return 'off-by-one';
  return 'other';
}

export function responseNumber(r: Response): number | null {
  if (r.kind === 'number') return r.value;
  if (r.kind === 'choice' && r.value && /^n-?\d+$/.test(r.value)) return Number(r.value.slice(1));
  return null;
}

export function expectedNumber(a: AnswerSpec): number | null {
  if (a.kind === 'number') return a.value;
  if (a.kind === 'choice' && /^n-?\d+$/.test(a.value)) return Number(a.value.slice(1));
  return null;
}
