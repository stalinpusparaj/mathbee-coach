import type { CategoryId, Format, QuestionInstance, Stage } from './types';
import type { TemplateDef } from './template';
import { createRng } from './rng';
import { validateQuestion } from './validate';
import { C01 } from './generators/c01';
import { C02 } from './generators/c02';
import { C03 } from './generators/c03';
import { C04 } from './generators/c04';
import { C05 } from './generators/c05';
import { C06 } from './generators/c06';
import { C07 } from './generators/c07';
import { C08 } from './generators/c08';
import { C09 } from './generators/c09';
import { C10 } from './generators/c10';
import { C11 } from './generators/c11';
import { C12 } from './generators/c12';
import { C13 } from './generators/c13';
import { C14 } from './generators/c14';

export const TEMPLATES: TemplateDef[] = [...C01, ...C02, ...C03, ...C04, ...C05, ...C06, ...C07, ...C08, ...C09, ...C10, ...C11, ...C12, ...C13, ...C14];
const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): TemplateDef {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`Unknown template ${id}`);
  return t;
}

export function templatesFor(category: CategoryId, stage?: Stage): TemplateDef[] {
  return TEMPLATES.filter((t) => t.category === category && (!stage || t.stage === stage));
}

export function templatesForSubskill(subskill: string): TemplateDef[] {
  return TEMPLATES.filter((t) => t.subskill === subskill);
}

const MAX_RETRIES = 12;

/**
 * Deterministic: the same (template, seed, format) always yields the same question.
 * Invalid generations are retried with derived seeds a bounded number of times, then a
 * known-good fallback seed is used — generation can never hang.
 */
export function generateQuestion(templateId: string, seed: number, format: Format = 'interactive'): QuestionInstance {
  const t = getTemplate(templateId);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const s = attempt === 0 ? seed : (seed + attempt * 7919) >>> 0;
    const q = build(t, s, format);
    if (q && validateQuestion(q).length === 0) return { ...q, seed };
  }
  const fb = build(t, 1, format);
  if (!fb || validateQuestion(fb).length) throw new Error(`Template ${templateId} has no valid fallback`);
  return { ...fb, seed };
}

function build(t: TemplateDef, seed: number, format: Format): QuestionInstance | null {
  try {
    const g = t.generate(createRng(seed));
    return {
      id: `${t.id}:${seed}:${format}`,
      seed,
      category: t.category,
      stage: t.stage,
      templateId: t.id,
      subskill: t.subskill,
      format,
      extension: t.source === 'extension',
      prompt: g.prompt,
      plain: g.plain,
      scene: g.scene,
      answer: g.answer,
      hints: g.hints,
      explain: g.explain,
      narration: g.narration,
      plainPicture: !!g.plainPicture,
    };
  } catch {
    return null;
  }
}
