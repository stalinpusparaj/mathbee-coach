/**
 * Narration through the browser's speech synthesis. No audio files or network services.
 * If no voice exists for the chosen language (often the case for Tamil), narration is
 * reported as unavailable and the visible text is used instead.
 */
type Listener = (speaking: boolean) => void;
const listeners = new Set<Listener>();
let speaking = false;

function setSpeaking(v: boolean) {
  speaking = v;
  listeners.forEach((l) => l(v));
}

export function onSpeakingChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const isSpeaking = () => speaking;

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

export function narrationAvailable(lang: 'en' | 'ta'): boolean {
  return !!voiceFor(lang);
}

/** Voices load asynchronously in some browsers. */
export function whenVoicesReady(cb: () => void): void {
  const s = synth();
  if (!s) return;
  if (s.getVoices().length) cb();
  else s.addEventListener?.('voiceschanged', cb, { once: true });
}

export function speak(text: string, lang: 'en' | 'ta'): boolean {
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
  synth()?.cancel();
  setSpeaking(false);
}
