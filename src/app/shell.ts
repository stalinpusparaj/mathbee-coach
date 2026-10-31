import { flushAll } from '../persistence/storage';

/**
 * Web side of the Android shell bridge (docs/BUILD_PLAN.md §3.5 and §A3 items 17–21).
 * The shell is detected at runtime (window.MathBeeAndroid / window.__MATHBEE_SHELL__), so the
 * same bundle runs in a browser, in tests with a stub, and inside the Kotlin app. Outside the
 * shell every function is a safe no-op and requests resolve 'unavailable'.
 *
 * Wire format: one JSON string per message, `{ v: 1, type, ...payload }`, both directions.
 * The native object comes from `WebViewCompat.addWebMessageListener` and offers
 * `postMessage(string)` plus `onmessage` / `addEventListener('message', e => e.data)`.
 */
export interface ShellInfo { platform: 'android'; versionName: string; versionCode: number; sdk: number; lowRam: boolean; animScale: number }
export type HapticStyle = 'tap' | 'success' | 'celebrate';
export type RequestStatus = 'saved' | 'shared' | 'printed' | 'cancelled' | 'error' | 'unavailable';
export interface Insets { top: number; right: number; bottom: number; left: number }
export interface Voices { en: boolean; ta: boolean }
export type LifecycleState = 'pause' | 'resume' | 'duck' | 'unduck';
type Msg = Record<string, unknown>;

interface Port {
  postMessage(m: string): void;
  onmessage?: ((e: { data: unknown }) => void) | null;
  addEventListener?: (type: 'message', fn: (e: { data: unknown }) => void) => void;
}

export const PROTOCOL_VERSION = 1;
/** initShell() gives up waiting for the native `shell` reply after this long. */
export const HELLO_TIMEOUT_MS = 1500;
/** Files travel in pieces this big (characters), up to MAX_FILE_CHARS in total. */
export const FILE_CHUNK_CHARS = 512 * 1024;
export const MAX_FILE_CHARS = 20 * 1024 * 1024;
const HAPTIC_GAP_MS = 150;
/** a parent may take a while in the system save/share/print dialogs */
const REQUEST_TIMEOUT_MS = 10 * 60_000;
/** native waits at most 300 ms for `flushed`; answer a little before that whatever happens */
const FLUSH_REPLY_MS = 250;

function port(): Port | null {
  if (typeof window === 'undefined') return null;
  const p = (window as unknown as { MathBeeAndroid?: Port }).MathBeeAndroid;
  return p && typeof p.postMessage === 'function' ? p : null;
}

export function inShell(): boolean {
  return port() !== null;
}
export function shellInfo(): ShellInfo | null {
  const injected = (typeof window !== 'undefined' && (window as unknown as { __MATHBEE_SHELL__?: ShellInfo }).__MATHBEE_SHELL__) || null;
  if (!injected && !replyInfo) return null;
  return { ...(injected ?? {}), ...(replyInfo ?? {}) } as ShellInfo;
}

// ---------- subscribers ----------
const subs = new Map<string, Set<(payload: Msg) => void>>();

/** Subscribe to a native→web message type ('back' | 'lifecycle' | 'insets' | 'voices' | 'speech' | ...). */
export function onShell(type: string, fn: (payload: Msg) => void): () => void {
  let set = subs.get(type);
  if (!set) subs.set(type, (set = new Set()));
  set.add(fn);
  return () => { set.delete(fn); };
}

/** Fire-and-forget message to native. */
export function send(type: string, payload: Record<string, unknown> = {}): void {
  const p = port();
  if (!p) return;
  try {
    p.postMessage(JSON.stringify({ ...payload, v: PROTOCOL_VERSION, type }));
  } catch { /* the shell is going away; nothing useful to do */ }
}

let seq = 0;
/** Request/response message to native (saveFile, shareFile, print). Resolves 'unavailable' outside the shell. */
export async function request(type: string, payload: Record<string, unknown> = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<RequestStatus> {
  if (!inShell()) return 'unavailable';
  const reqId = `r${++seq}`;
  return new Promise<RequestStatus>((resolve) => {
    const done = (s: RequestStatus) => { off(); clearTimeout(timer); resolve(s); };
    const off = onShell('result', (m) => {
      if (m.reqId === reqId) done(asStatus(m.status));
    });
    const timer = setTimeout(() => done('error'), timeoutMs);
    send(type, { ...payload, reqId });
  });
}

function asStatus(s: unknown): RequestStatus {
  return s === 'saved' || s === 'shared' || s === 'printed' || s === 'cancelled' || s === 'unavailable' ? s : 'error';
}

/**
 * Save (SAF "create document") or share (FileProvider + ACTION_SEND) a text file of up to 20 MB.
 * The text goes over in 512 KB pieces: `begin` (name, type, size, piece count), `chunk`
 * (index, data) …, then `end`; native answers once with `result`.
 */
export async function sendFile(kind: 'saveFile' | 'shareFile', filename: string, mime: string, data: string): Promise<RequestStatus> {
  if (!inShell()) return 'unavailable';
  if (data.length > MAX_FILE_CHARS) return 'error';
  const reqId = `r${++seq}`;
  const chunks = Math.max(1, Math.ceil(data.length / FILE_CHUNK_CHARS));
  return new Promise<RequestStatus>((resolve) => {
    const done = (s: RequestStatus) => { off(); clearTimeout(timer); resolve(s); };
    const off = onShell('result', (m) => {
      if (m.reqId === reqId) done(asStatus(m.status));
    });
    const timer = setTimeout(() => done('error'), REQUEST_TIMEOUT_MS);
    send(kind, { reqId, phase: 'begin', filename, mime, size: data.length, chunks });
    for (let i = 0; i < chunks; i++) send(kind, { reqId, phase: 'chunk', index: i, data: data.slice(i * FILE_CHUNK_CHARS, (i + 1) * FILE_CHUNK_CHARS) });
    send(kind, { reqId, phase: 'end' });
  });
}

/** Opens the system TTS installer (parent area only, behind the gate). */
export function installVoice(lang: 'en' | 'ta'): void {
  send('installVoice', { lang });
}

let lastHaptic = -Infinity;
/** Gentle vibration for taps and successes. Never call this for a wrong answer. */
export function haptic(style: HapticStyle): void {
  if (!inShell()) return;
  const now = Date.now();
  if (now - lastHaptic < HAPTIC_GAP_MS) return;
  lastHaptic = now;
  send('haptic', { style });
}

let awakeWanted = false;
let awakeSent: boolean | null = null;
let paused = false;
function syncAwake() {
  const on = awakeWanted && !paused;
  if (on === awakeSent || !inShell()) return;
  awakeSent = on;
  send('keepAwake', { on });
}
/** Keep the screen on (sessions and tests only). Cleared while the app is in the background. */
export function keepAwake(on: boolean): void {
  awakeWanted = on;
  syncAwake();
}

// ---------- state reported by native ----------
let replyInfo: Partial<ShellInfo> | null = null;
let voiceState: Voices | null = null;
const voiceListeners = new Set<(v: Voices) => void>();

/** Offline voices the native TTS engine has (null until the shell has said). */
export function voices(): Voices | null {
  return voiceState;
}
/** Called whenever the native voice list changes (e.g. a parent installed Tamil voice data). */
export function onVoicesChange(fn: (v: Voices) => void): () => void {
  voiceListeners.add(fn);
  return () => { voiceListeners.delete(fn); };
}
function setVoices(v: unknown) {
  if (!v || typeof v !== 'object') return;
  const o = v as Msg;
  voiceState = { en: o.en === true, ta: o.ta === true };
  voiceListeners.forEach((l) => l(voiceState!));
}

function applyInsets(i: unknown) {
  if (!i || typeof i !== 'object' || typeof document === 'undefined') return;
  const o = i as Msg;
  const s = document.documentElement.style;
  for (const k of ['top', 'right', 'bottom', 'left'] as const) {
    const n = Number(o[k]);
    if (Number.isFinite(n) && n >= 0) s.setProperty(`--shell-inset-${k}`, `${Math.round(n)}px`);
  }
}

/** True while native says the app is in the background. */
export function isPaused(): boolean {
  return paused;
}

async function onLifecycle(state: unknown) {
  if (state === 'pause') {
    paused = true;
    syncAwake();
    // native pauses the WebView timers only after `flushed` (or its own 300 ms limit)
    await Promise.race([flushAll().catch(() => undefined), new Promise((r) => setTimeout(r, FLUSH_REPLY_MS))]);
    send('flushed');
  } else if (state === 'resume') {
    paused = false;
    syncAwake();
  }
}

// ---------- receiving ----------
/** Handle one raw native message (exported for tests). Malformed or foreign messages are ignored. */
export function receive(raw: unknown): void {
  let m: Msg;
  try {
    m = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Msg;
  } catch {
    return;
  }
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
  if (m.v !== undefined && m.v !== PROTOCOL_VERSION) return;
  switch (m.type) {
    case 'shell':
      replyInfo = {
        platform: 'android',
        ...(typeof m.versionName === 'string' ? { versionName: m.versionName } : {}),
        ...(typeof m.versionCode === 'number' ? { versionCode: m.versionCode } : {}),
        ...(typeof m.sdk === 'number' ? { sdk: m.sdk } : {}),
        ...(typeof m.lowRam === 'boolean' ? { lowRam: m.lowRam } : {}),
        ...(typeof m.animScale === 'number' ? { animScale: m.animScale } : {}),
      };
      applyInsets(m.insets);
      setVoices(m.voices);
      break;
    case 'insets': applyInsets(m.insets); break;
    case 'voices': setVoices(m.voices ?? m); break;
  }
  subs.get(m.type)?.forEach((fn) => {
    try { fn(m); } catch (e) { console.warn('shell handler failed', e); }
  });
  // after the subscribers, so whatever they saved on `pause` is part of the flush
  if (m.type === 'lifecycle') void onLifecycle(m.state);
}

let started: Promise<void> | null = null;
/**
 * Connect to the shell: listen for messages, say `hello`, and resolve once the native `shell`
 * reply arrived with the voice list (or after HELLO_TIMEOUT_MS). Resolves at once outside the shell.
 */
export function initShell(): Promise<void> {
  if (started) return started;
  const p = port();
  if (!p) return Promise.resolve();
  if (typeof document !== 'undefined') document.documentElement.classList.add('in-android');
  const listener = (e: { data: unknown }) => receive(e?.data);
  if (typeof p.addEventListener === 'function') p.addEventListener('message', listener);
  else p.onmessage = listener;
  started = new Promise<void>((resolve) => {
    const timer = setTimeout(() => { off(); resolve(); }, HELLO_TIMEOUT_MS);
    const off = onShell('shell', () => { clearTimeout(timer); off(); resolve(); });
    send('hello');
  });
  return started;
}

/** Test helper: forget all module state so each test starts clean. */
export function __resetShellForTests(): void {
  started = null;
  replyInfo = null;
  voiceState = null;
  awakeWanted = false;
  awakeSent = null;
  paused = false;
  lastHaptic = -Infinity;
  subs.clear();
  voiceListeners.clear();
}
