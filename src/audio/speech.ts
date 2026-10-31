import { inShell, onShell, onVoicesChange as onShellVoices, send, voices as shellVoices } from '../app/shell';

/**
 * Narration. Inside the Android app the device's own text-to-speech speaks through the shell
 * bridge (WebView has no speechSynthesis); in a browser the Web Speech API is used. Either way
 * no audio files or network services are involved. If no voice exists for the chosen language
 * (often the case for Tamil), narration is reported as unavailable and the visible text is used.
 * Speaking start/end is reported through onSpeakingChange, which ducks the music and holds the
 * active-time timer.
 */
type Listener = (speaking: boolean) => void;
const listeners = new Set<Listener>();
let speaking = false;

function setSpeaking(v: boolean) {
  if (v === speaking) return;
  speaking = v;
  listeners.forEach((l) => l(v));
}

export function onSpeakingChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const isSpeaking = () => speaking;

/** For other narration sources (recorded clips in voice.ts) so ducking and timers stay in step. */
export function reportSpeaking(v: boolean): void {
  setSpeaking(v);
}

/** Extra things stopSpeaking() must silence (recorded clips register here). */
const stoppers = new Set<() => void>();
export function onStop(fn: () => void): () => void {
  stoppers.add(fn);
  return () => { stoppers.delete(fn); };
}

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function voiceFor(lang: 'en' | 'ta'): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  const prefix = lang === 'ta' ? 'ta' : 'en';
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix + '-in')) ?? voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null;
}

/** The device's text-to-speech (through the Android shell) has an offline voice for `lang`. */
function nativeVoice(lang: 'en' | 'ta'): boolean {
  return inShell() && !!shellVoices()?.[lang];
}

export function narrationAvailable(lang: 'en' | 'ta'): boolean {
  return nativeVoice(lang) || !!voiceFor(lang);
}

/** Voices load asynchronously (the shell's hello reply, or the browser's voiceschanged). */
export function whenVoicesReady(cb: () => void): void {
  if (inShell()) {
    if (shellVoices()) { cb(); return; }
    const off = onShellVoices(() => { off(); cb(); });
    return;
  }
  const s = synth();
  if (!s) return;
  if (s.getVoices().length) cb();
  else s.addEventListener?.('voiceschanged', cb, { once: true });
}

/** Called whenever the available voices change, so screens can re-check narrationAvailable(). */
export function onVoicesChange(cb: () => void): () => void {
  const offShell = onShellVoices(() => cb());
  const s = synth();
  s?.addEventListener?.('voiceschanged', cb);
  return () => { offShell(); s?.removeEventListener?.('voiceschanged', cb); };
}

// ---------- native backend ----------
let nativeSeq = 0;
/** id of the utterance whose events still count; older ids are ignored */
let currentId: string | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let wired = false;

function clearWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

function wireNative() {
  if (wired) return;
  wired = true;
  onShell('speech', (m) => {
    if (!currentId || m.id !== currentId) return;
    if (m.state === 'start') setSpeaking(true);
    else if (m.state === 'end' || m.state === 'error') {
      currentId = null;
      clearWatchdog();
      setSpeaking(false);
    }
  });
  // native stops speech when the app goes to the background; never leave the music ducked
  onShell('lifecycle', (m) => {
    if (m.state === 'pause') { currentId = null; clearWatchdog(); setSpeaking(false); }
  });
}

function speakNative(text: string, lang: 'en' | 'ta'): boolean {
  wireNative();
  const id = `u${++nativeSeq}`;
  currentId = id;
  clearWatchdog();
  // if an end event is ever lost, release ducking and the timer after a generous estimate
  watchdog = setTimeout(() => {
    if (currentId === id) { currentId = null; setSpeaking(false); }
  }, Math.min(60_000, 4000 + text.length * 150));
  send('speak', { id, text: text.slice(0, 600), lang, rate: 0.9 });
  return true;
}

export function speak(text: string, lang: 'en' | 'ta'): boolean {
  if (nativeVoice(lang)) return speakNative(text, lang);
  const s = synth();
  const voice = voiceFor(lang);
  if (!s || !voice) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  u.onstart = () => setSpeaking(true);
  u.onend = () => setSpeaking(false);
  u.onerror = () => setSpeaking(false);
  s.speak(u);
  return true;
}

export function stopSpeaking(): void {
  stoppers.forEach((f) => f());
  if (inShell()) {
    currentId = null;
    clearWatchdog();
    send('stopSpeaking');
  }
  synth()?.cancel();
  setSpeaking(false);
}
