import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES, generateQuestion } from '../../src/engine/registry';
import { t, keysOf, hasKey } from '../../src/i18n/i18n';
import type { Msg, QuestionInstance } from '../../src/engine/types';
import { SUBSKILLS, CATEGORIES, GARDEN_ITEMS } from '../../src/curriculum/curriculum';

function msgsOf(q: QuestionInstance): Msg[] {
  const out: Msg[] = [q.prompt, q.explain, ...q.hints];
  if (q.plain) out.push(q.plain);
  if (q.narration) out.push(q.narration);
  const a = q.answer;
  if (a.kind === 'choice') a.options.forEach((o) => out.push(o.label));
  if (a.kind === 'order') a.items.forEach((o) => out.push(o.label));
  if (a.kind === 'fields') a.fields.forEach((f) => out.push(f.label));
  return out;
}

describe('localisation', () => {
  it('every generated message resolves fully in English (no missing keys or placeholders)', () => {
    const missing = new Set<string>();
    for (const tpl of TEMPLATES) {
      for (let s = 1; s <= 40; s++) {
        const q = generateQuestion(tpl.id, s * 101);
        for (const m of msgsOf(q)) {
          keysOf(m).forEach((k) => { if (!hasKey(k, 'en')) missing.add(k); });
          const text = t(m, 'en');
          expect(text, `${tpl.id} ${m.k}`).not.toMatch(/\{\w+[^}]*\}/);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('Tamil covers all question content keys', () => {
    const missing = new Set<string>();
    for (const tpl of TEMPLATES) {
      for (let s = 1; s <= 15; s++) {
        for (const m of msgsOf(generateQuestion(tpl.id, s * 97))) keysOf(m).forEach((k) => { if (!hasKey(k, 'ta')) missing.add(k); });
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('every static UI key used in the source exists in English', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !p.includes('/i18n/')) files.push(p); });
    walk('src');
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/'((?:ui|p|s|fb|next)\.[A-Za-z0-9.]+)'/g)) if (!hasKey(m[1], 'en')) missing.add(m[1]);
    }
    const dynamic = [
      ...SUBSKILLS.flatMap((s) => [`sub.${s.id}`, `subChild.${s.id}`]),
      ...CATEGORIES.flatMap((c) => [`cat.${c.id}`, `catGoal.${c.id}`, c.topicKey]),
      ...GARDEN_ITEMS.map((g) => `garden.${g.id}`),
      ...['not-assessed', 'more-evidence', 'learning-supported', 'practising-independently', 'retained', 'applying'].map((s) => `state.${s}`),
      ...['explore', 'practise', 'apply'].flatMap((s) => [`stage.${s}`, `stageDesc.${s}`]),
      ...['indexeddb', 'localstorage', 'memory'].map((s) => `s.storage.${s}`),
      ...['not-assessed', 'needs-evidence', 'learning', 'secure'].map((s) => `p.cov.${s}`),
    ];
    dynamic.forEach((k) => { if (!hasKey(k, 'en')) missing.add(k); });
    expect([...missing]).toEqual([]);
  });

  it('child-facing Tamil UI covers category, stage and feedback text', () => {
    const keys = [...CATEGORIES.map((c) => `cat.${c.id}`), ...SUBSKILLS.map((s) => `subChild.${s.id}`), 'fb.tag.other', 'ui.check', 'ui.hint'];
    expect(keys.filter((k) => !hasKey(k, 'ta'))).toEqual([]);
  });

  it('plural choice and ordinals', () => {
    expect(t({ k: 'story.birds.arrive', p: { a: 1, b: 1 } }, 'en')).toContain('There is 1 bird on a branch. 1 more arrives.');
    expect(t({ k: 'c13.pocketMoney', p: { d: 22, month: { k: 'month.7' }, y: 2025 } }, 'en')).toContain('22nd');
  });
});
