import type { Msg } from '../engine/types';
import { EN_CONTENT } from './en-content';
import { EN_UI } from './en-ui';
import { TA_CONTENT } from './ta-content';
import { TA_UI } from './ta-ui';

export type Lang = 'en' | 'ta';

const TABLES: Record<Lang, Record<string, string>> = {
  en: { ...EN_CONTENT, ...EN_UI },
  ta: { ...TA_CONTENT, ...TA_UI },
};

const JOIN: Record<Lang, { sep: string; last: string }> = {
  en: { sep: ', ', last: ' and ' },
  ta: { sep: ', ', last: ', ' },
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function hasKey(key: string, lang: Lang): boolean {
  return key in TABLES[lang];
}

/** Resolve a message. Missing Tamil text falls back to English (never to a raw key). */
export function t(m: Msg | string, lang: Lang, params?: Msg['p']): string {
  const msg: Msg = typeof m === 'string' ? { k: m, p: params } : m;
  if (msg.k === 'join') {
    const parts = Object.keys(msg.p ?? {})
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .map((k) => resolveParam(msg.p![k], lang));
    if (parts.length <= 1) return parts.join('');
    const j = JOIN[lang];
    return parts.slice(0, -1).join(j.sep) + j.last + parts[parts.length - 1];
  }
  const template = TABLES[lang][msg.k] ?? TABLES.en[msg.k];
  if (template === undefined) {
    if (import.meta.env?.DEV) console.warn('missing i18n key', msg.k);
    return msg.k;
  }
  // plural choice: {n?one text|other text}
  const chosen = template.replace(/\{(\w+)\?([^|}]*)\|([^}]*)\}/g, (_, name: string, one: string, other: string) => (msg.p?.[name] === 1 ? one : other));
  return chosen.replace(/\{(\w+)(\|ord)?\}/g, (_, name: string, pipe?: string) => {
    const v = msg.p?.[name];
    if (v === undefined) return `{${name}}`;
    if (pipe === '|ord' && typeof v === 'number') return lang === 'en' ? ordinal(v) : String(v);
    return resolveParam(v, lang);
  });
}

function resolveParam(v: string | number | Msg, lang: Lang): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return t(v, lang);
}

/** Collect every key a message uses (for tests). */
export function keysOf(m: Msg, out: string[] = []): string[] {
  if (m.k !== 'join') out.push(m.k);
  for (const v of Object.values(m.p ?? {})) if (typeof v === 'object') keysOf(v, out);
  return out;
}

export const TRANSLATION_STATUS = {
  en: 'complete',
  ta: 'draft — written by the developer, not yet reviewed by a native Tamil-speaking teacher',
};
