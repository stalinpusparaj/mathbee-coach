import { useCallback, useEffect, useRef, useState } from 'react';
import { store } from '../app/store';
import { pushOverlay } from '../app/backNav';
import { t as translate, type Lang } from '../i18n/i18n';
import { useLang, useT } from '../i18n/useT';

/**
 * Parent gate (CONTRACT). <ParentGate> asks an adult-only question; onPass opens the grown-up
 * area. <ParentEntry> is the child-safe entry button (testid "parent-hold") that leads to it.
 *
 * The question is a 2-digit × 1-digit multiplication with a 3-digit answer, typed on a keypad.
 * A 6-year-old cannot work it out, and random tapping almost never hits it (about 1 in 900 per
 * try). After 3 wrong answers the gate rests for 30 seconds. The instruction is shown in English
 * and Tamil together, so either grown-up can read it whatever the child's language is.
 */

export const GATE_TRIES = 3;
export const GATE_COOLOFF_MS = 30_000;
/** Longest answer the keypad accepts (answers are 3 digits; one extra digit is allowed). */
export const GATE_MAX_DIGITS = 4;

export interface GateTask { a: number; b: number; answer: number }
export interface GateState { task: GateTask; triesLeft: number; coolUntil: number }
export type GateResult = 'pass' | 'wrong' | 'cooloff' | 'resting';

/**
 * Every task a (12–49, not a multiple of ten) × b (3–9) with a 3-digit answer, grouped by answer.
 * The answer is chosen first, uniformly among the 138 possible answers, so even always typing the
 * most common answer passes at most 1 time in 138 (rather than favouring answers like 168 that
 * several tasks share).
 */
const BY_ANSWER: GateTask[][] = (() => {
  const m = new Map<number, GateTask[]>();
  for (let a = 12; a <= 49; a++) {
    if (a % 10 === 0) continue;
    for (let b = 3; b <= 9; b++) if (a * b >= 100) m.set(a * b, [...(m.get(a * b) ?? []), { a, b, answer: a * b }]);
  }
  return [...m.values()];
})();
export const GATE_ANSWER_COUNT = BY_ANSWER.length;

const pickOne = <T,>(rand: () => number, xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))];

/** A random adult task (see BY_ANSWER). */
export function makeGateTask(rand: () => number = Math.random): GateTask {
  return pickOne(rand, pickOne(rand, BY_ANSWER));
}

/** Wrong answers are remembered this long after the last one (then the grown-up gets 3 fresh tries). */
export const GATE_TRIES_MEMORY_MS = 5 * 60_000;
const GATE_MEMORY_KEY = 'mathbee.gate';

/**
 * Tries left and the cool-off survive closing and reopening the gate, and restarting the app
 * (kept in localStorage when it is available), so a child cannot reset them by tapping back.
 */
interface GateMemory { triesLeft: number; wrongAt: number; coolUntil: number }
const FRESH: GateMemory = { triesLeft: GATE_TRIES, wrongAt: 0, coolUntil: 0 };

const storage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage);

function loadMemory(): GateMemory {
  try {
    const raw: unknown = JSON.parse(storage()?.getItem(GATE_MEMORY_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      const { triesLeft, wrongAt, coolUntil } = raw as Record<string, unknown>;
      if (typeof triesLeft === 'number' && typeof wrongAt === 'number' && typeof coolUntil === 'number') {
        return { triesLeft: Math.max(1, Math.min(GATE_TRIES, Math.round(triesLeft))), wrongAt, coolUntil };
      }
    }
  } catch {
    // no storage (private mode, tests): memory only
  }
  return FRESH;
}

let memory: GateMemory = loadMemory();

function remember(m: GateMemory): void {
  memory = m;
  try {
    storage()?.setItem(GATE_MEMORY_KEY, JSON.stringify(m));
  } catch {
    // memory only
  }
}

export function newGateState(rand: () => number = Math.random, now = Date.now()): GateState {
  // never rest longer than one cool-off, even if the clock was moved back
  const coolUntil = memory.coolUntil > now ? Math.min(memory.coolUntil, now + GATE_COOLOFF_MS) : 0;
  const recentWrong = memory.triesLeft < GATE_TRIES && now >= memory.wrongAt && now - memory.wrongAt < GATE_TRIES_MEMORY_MS;
  return { task: makeGateTask(rand), triesLeft: coolUntil === 0 && recentWrong ? memory.triesLeft : GATE_TRIES, coolUntil };
}

export const gateResting = (st: GateState, now: number) => st.coolUntil > now;

/**
 * Check a typed answer. A wrong answer always brings a new question (so guesses cannot narrow
 * it down); the third wrong answer starts the cool-off. Pure apart from remembering tries and cool-off.
 */
export function gateSubmit(st: GateState, typed: number | null, now: number, rand: () => number = Math.random): { st: GateState; result: GateResult } {
  if (gateResting(st, now)) return { st, result: 'resting' };
  if (typed !== null && typed === st.task.answer) {
    remember(FRESH);
    return { st: { ...st, triesLeft: GATE_TRIES }, result: 'pass' };
  }
  const triesLeft = st.triesLeft - 1;
  if (triesLeft <= 0) {
    const coolUntil = now + GATE_COOLOFF_MS;
    remember({ ...FRESH, coolUntil });
    return { st: { task: makeGateTask(rand), triesLeft: GATE_TRIES, coolUntil }, result: 'cooloff' };
  }
  remember({ triesLeft, wrongAt: now, coolUntil: 0 });
  return { st: { ...st, task: makeGateTask(rand), triesLeft }, result: 'wrong' };
}

/** Test hook only: forget remembered tries and cool-off. */
export function resetGateMemory(): void {
  remember(FRESH);
}

/** The same line in both languages, the child's language first. */
export function bilingual(key: string, lang: Lang, params?: Record<string, string | number>): [string, string] {
  const other: Lang = lang === 'ta' ? 'en' : 'ta';
  return [translate(key, lang, params), translate(key, other, params)];
}

/** E2E bypass: the expected answer is exposed only under ?e2e, and never in the Android build. */
function e2eMode(): boolean {
  if (import.meta.env.MODE === 'android' || typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).has('e2e');
}

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function ParentGate({ onPass, onCancel, overlay = false }: { onPass: () => void; onCancel: () => void; overlay?: boolean }) {
  const lang = useLang();
  const t = useT();
  const [st, setSt] = useState<GateState>(() => newGateState());
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<'wrong' | 'cooloff' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  const resting = gateResting(st, now);

  // tick once a second only while resting, so the grown-up sees when to try again
  useEffect(() => {
    if (!resting) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [resting]);
  useEffect(() => {
    if (!resting && note === 'cooloff') setNote(null);
  }, [resting, note]);

  // the gate is the newest thing "back" closes: back from a gated route returns to the garden
  // (not to another gated parent route, which would only show the gate again)
  useEffect(() => pushOverlay(onCancel), [onCancel]);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('.gate-key')?.focus();
  }, []);

  const digit = useCallback((d: number) => setTyped((v) => (v.length >= GATE_MAX_DIGITS ? v : v + d)), []);
  const del = useCallback(() => setTyped((v) => v.slice(0, -1)), []);
  const submit = useCallback(() => {
    const at = Date.now();
    setNow(at);
    const res = gateSubmit(st, typed === '' ? null : Number(typed), at);
    setSt(res.st);
    setTyped('');
    if (res.result === 'pass') onPass();
    else if (res.result === 'wrong') setNote('wrong');
    else if (res.result === 'cooloff') setNote('cooloff');
  }, [st, typed, onPass]);

  // physical keyboards (tablets, desktop browsers): digits, Backspace, Enter, Escape
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^[0-9]$/.test(e.key) && !resting) { e.preventDefault(); digit(Number(e.key)); }
      else if (e.key === 'Backspace') { e.preventDefault(); del(); }
      else if (e.key === 'Enter' && !resting && typed !== '') { e.preventDefault(); submit(); }
      // handled here (and marked handled) so backNav does not close a second thing
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [digit, del, submit, onCancel, resting, typed]);

  const secs = Math.max(1, Math.ceil((st.coolUntil - now) / 1000));
  const [title, titleOther] = bilingual('gate.title', lang);
  const [ask, askOther] = bilingual('gate.ask', lang);
  const [child, childOther] = bilingual('gate.child', lang);
  const wrong = bilingual('gate.wrong', lang);
  const left = bilingual('gate.triesLeft', lang, { n: st.triesLeft });
  const status = resting
    ? bilingual('gate.wait', lang, { s: secs })
    : note === 'wrong'
      ? [`${wrong[0]} ${left[0]}`, `${wrong[1]} ${left[1]}`]
      : null;

  const body = (
    <div
      ref={rootRef}
      className={`parent-gate ${overlay ? 'as-overlay' : 'screen'}`}
      role="dialog"
      aria-modal={overlay || undefined}
      aria-labelledby="gate-title"
      data-testid="parent-gate"
      data-answer={e2eMode() ? String(st.task.answer) : undefined}
    >
      <div className="gate-card">
        <h1 id="gate-title" className="gate-title">
          <span lang={lang}>{title}</span>
          <span className="gate-other" lang={lang === 'ta' ? 'en' : 'ta'}>{titleOther}</span>
        </h1>
        <p className="gate-child small muted">
          <span lang={lang}>{child}</span> <span lang={lang === 'ta' ? 'en' : 'ta'}>{childOther}</span>
        </p>
        <p className="gate-ask">
          <span lang={lang}>{ask}</span>
          <span className="gate-other" lang={lang === 'ta' ? 'en' : 'ta'}>{askOther}</span>
        </p>
        <p className="gate-question" aria-live="polite" data-testid="gate-question">
          <span>{st.task.a} × {st.task.b} =</span>
          <output className="gate-display" aria-label={t('gate.answer')} data-testid="gate-display">{typed || '?'}</output>
        </p>
        <p className={`gate-status ${status ? '' : 'empty'}`} role="status" aria-live="polite" data-testid="gate-status">
          {status && <><span lang={lang}>{status[0]}</span> <span className="gate-other" lang={lang === 'ta' ? 'en' : 'ta'}>{status[1]}</span></>}
        </p>
        <div className="gate-keypad" role="group" aria-label={t('gate.answer')}>
          {KEYS.map((d) => (
            <button key={d} type="button" className="gate-key" onClick={() => digit(d)} disabled={resting} data-testid={`gate-key-${d}`}>{d}</button>
          ))}
          <button type="button" className="gate-key fn" onClick={() => setTyped('')} disabled={resting || !typed} aria-label={t('gate.clear')} data-testid="gate-clear">C</button>
          <button type="button" className="gate-key" onClick={() => digit(0)} disabled={resting} data-testid="gate-key-0">0</button>
          <button type="button" className="gate-key fn" onClick={del} disabled={resting || !typed} aria-label={t('gate.del')} data-testid="gate-del">⌫</button>
        </div>
        <div className="gate-actions">
          <button type="button" className="btn secondary" onClick={onCancel} data-testid="gate-cancel">← {t('gate.cancel')}</button>
          <button type="button" className="btn primary" onClick={submit} disabled={resting || !typed} data-testid="gate-submit">{t('gate.ok')}</button>
        </div>
      </div>
    </div>
  );
  return overlay ? <div className="modal-backdrop gate-backdrop" role="presentation">{body}</div> : body;
}

/**
 * Child-safe entry to the grown-up area: an ordinary button (the gate behind it is the
 * protection). Kept small and quiet so it does not invite play.
 */
export function ParentEntry({ label }: { label?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn small secondary parent-entry"
      onClick={() => store.setRoute({ name: 'parent' })}
      aria-label={t('gate.entryLabel')}
      data-testid="parent-hold"
    >
      <span aria-hidden>👪</span> {label ?? t('gate.entry')}
    </button>
  );
}
