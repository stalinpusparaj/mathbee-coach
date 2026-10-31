import type { Msg } from '../engine/types';
import { t, type Lang } from '../i18n/i18n';
import { onStop, reportSpeaking, speak, stopSpeaking } from './speech';

/**
 * Recorded voice lines. Fixed lines (cheers, stage intros, hints, numbers) can have a recorded
 * clip at `public/voice/<lang>/<key>.ogg`, where <key> is the line's i18n key; everything else,
 * and every line without a clip, is spoken by text-to-speech. A clip is listed in VOICE_CLIPS
 * only after a native speaker has reviewed it, so a missing or unreviewed file is never fetched.
 *
 * 1.0 ships the lookup with an empty list: text-to-speech is the voice for this release.
 */
export const VOICE_CLIPS: Record<Lang, readonly string[]> = {
  en: [],
  ta: [],
};

let clips: Record<Lang, Set<string>> = { en: new Set(VOICE_CLIPS.en), ta: new Set(VOICE_CLIPS.ta) };

/** URL of the recorded clip for an i18n key, or null when the line has none (or has parameters). */
export function clipUrl(key: string, lang: Lang, params?: Msg['p']): string | null {
  if (params && Object.keys(params).length) return null; // clips are fixed lines only
  if (!clips[lang].has(key) || !/^[A-Za-z0-9._-]{1,120}$/.test(key)) return null;
  return `${import.meta.env.BASE_URL}voice/${lang}/${key}.ogg`;
}

let playing: HTMLAudioElement | null = null;
onStop(() => {
  if (!playing) return;
  const a = playing;
  playing = null;
  a.pause();
});

/**
 * Say a line by its i18n key: the recorded clip when one exists, otherwise text-to-speech of
 * the translated text. Returns false when neither can speak (the caller shows the text).
 */
export function say(key: string, lang: Lang, params?: Msg['p']): boolean {
  const url = clipUrl(key, lang, params);
  const text = t(key, lang, params);
  if (!url || typeof Audio === 'undefined') return speak(text, lang);
  stopSpeaking();
  const a = new Audio(url);
  playing = a;
  const finish = () => {
    if (playing !== a) return;
    playing = null;
    reportSpeaking(false);
  };
  a.onplay = () => { if (playing === a) reportSpeaking(true); };
  a.onended = finish;
  // a clip that fails to load falls back to text-to-speech for this line
  a.onerror = () => {
    if (playing !== a) return;
    finish();
    speak(text, lang);
  };
  void a.play().catch(() => a.onerror?.(new Event('error')));
  return true;
}

/** Test hook: replace the clip list. */
export function __setClipsForTests(next: Record<Lang, readonly string[]>): void {
  clips = { en: new Set(next.en), ta: new Set(next.ta) };
}
