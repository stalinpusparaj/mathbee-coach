import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hasKey } from '../../src/i18n/i18n';

const PACK_DIR = 'src/i18n/packs';
type Pack = { EN?: Record<string, string>; TA?: Record<string, string> };

async function packs(): Promise<[string, Pack][]> {
  const out: [string, Pack][] = [];
  for (const f of readdirSync(PACK_DIR).filter((f) => f.endsWith('.ts'))) out.push([f, (await import(/* @vite-ignore */ `../../src/i18n/packs/${f}`)) as Pack]);
  return out;
}

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !p.includes(`${join('src', 'i18n')}`)) files.push(p);
  });
  walk('src');
  return files;
}

/** Literal keys passed to t(...) / translate(...) / bilingual(...) anywhere in the app source. */
function literalKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const call = /\b(?:t|translate|bilingual|tr)\(\s*'([A-Za-z][\w-]*(?:\.[\w-]+)+)'/g;
  for (const f of sourceFiles()) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(call)) if (!keys.has(m[1])) keys.set(m[1], f);
  }
  return keys;
}

describe('string packs (src/i18n/packs)', () => {
  it('every pack key exists in both English and Tamil, with no Tamil-only keys', async () => {
    const problems: string[] = [];
    for (const [file, mod] of await packs()) {
      const en = Object.keys(mod.EN ?? {});
      const ta = new Set(Object.keys(mod.TA ?? {}));
      expect(en.length, file).toBeGreaterThan(0);
      for (const k of en) if (!ta.has(k) && !hasKey(k, 'ta')) problems.push(`${file}: ${k} has no Tamil`);
      for (const k of ta) if (!(k in (mod.EN ?? {})) && !hasKey(k, 'en')) problems.push(`${file}: ${k} is Tamil-only`);
      for (const [k, v] of Object.entries(mod.EN ?? {})) if (!v.trim()) problems.push(`${file}: ${k} is empty`);
    }
    expect(problems).toEqual([]);
  });

  it('pack placeholders match between English and Tamil', async () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)(?:\|ord)?\}/g)].map((m) => m[1]).sort().filter((v, i, a) => a.indexOf(v) === i);
    const problems: string[] = [];
    for (const [file, mod] of await packs()) {
      for (const [k, en] of Object.entries(mod.EN ?? {})) {
        const ta = mod.TA?.[k];
        if (ta === undefined) continue;
        const a = names(en);
        const b = names(ta);
        // Tamil may drop a placeholder (word order), but must never invent one English does not provide
        if (b.some((n) => !a.includes(n))) problems.push(`${file}: ${k} (${a.join(',')} vs ${b.join(',')})`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every literal t() key used in the app exists in English, and in Tamil wherever a child or a pack uses it', async () => {
    const packKeys = new Set((await packs()).flatMap(([, m]) => Object.keys(m.EN ?? {})));
    // the grown-up report and test screens are English-first (Tamil falls back to English there)
    const grownUp = (f: string) => /(ParentScreens|TestScreens)\.tsx$/.test(f);
    const missing: string[] = [];
    const keys = literalKeys();
    expect(keys.size).toBeGreaterThan(300);
    for (const [k, f] of keys) {
      if (!hasKey(k, 'en')) missing.push(`${k} (en, ${f})`);
      else if ((packKeys.has(k) || !grownUp(f)) && !hasKey(k, 'ta')) missing.push(`${k} (ta, ${f})`);
    }
    expect(missing).toEqual([]);
  });
});
