import type { JourneyTheme } from '../activities/journey';
import { WORLD_MUSIC } from './music';
import { store } from '../app/store';

/**
 * The foley kit: about twenty tiny sounds synthesised with the Web Audio API (no files,
 * works offline). Melodic sounds are pitched to the current world's key, so a correct-answer
 * arpeggio in the river is in D like the river's music. Started only after a user gesture.
 *
 * Every sound is silent when the child's sound setting is off: the gate is checked before
 * an audio context or a single node is created. Nothing here is harsh — a wrong answer is a
 * soft low "hmm", never a buzzer.
 */
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

/** Default gate: the active child's sound setting (on before a profile exists). */
const profileSound = (): boolean => {
  const s = store.get();
  const p = s.app.profiles.find((x) => x.id === s.app.activeProfileId);
  return p ? p.settings.sound !== false : true;
};
let gate: () => boolean = profileSound;

/** Replace the "is sound on?" check (tests; null restores the profile setting). */
export function setSfxGate(fn: (() => boolean) | null): void {
  gate = fn ?? profileSound;
}

/** Test helper: forget the audio context so a fresh fake can be installed. */
export function __resetSfxForTests(): void {
  ctx = null;
  out = null;
  noise = null;
  root = ROOT_MIDI;
}

function audio(): AudioContext | null {
  if (!gate()) return null;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) {
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

// ---------- pitch: the world key ----------
/** C5: the kit's home note before the world shifts it. */
const ROOT_MIDI = 72;
const PENTATONIC = [0, 2, 4, 7, 9];
let root = ROOT_MIDI;

/** Pitch the melodic sounds to a world's key (null = as written, C). */
export function setSfxWorld(theme: JourneyTheme | null): void {
  root = ROOT_MIDI + (theme ? WORLD_MUSIC[theme].shift : 0);
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Note `degree` of the major pentatonic scale above a root (degree 5 = an octave up). */
export function pentatonicMidi(rootMidi: number, degree: number): number {
  const d = Math.max(0, Math.floor(degree));
  return rootMidi + 12 * Math.floor(d / PENTATONIC.length) + PENTATONIC[d % PENTATONIC.length];
}
/** Frequency of pentatonic degree `degree` in a world's key (exposed for tests). */
export function noteHz(theme: JourneyTheme | null, degree: number): number {
  return hz(pentatonicMidi(ROOT_MIDI + (theme ? WORLD_MUSIC[theme].shift : 0), degree));
}
const scale = (degree: number) => hz(pentatonicMidi(root, degree));
/** Major-triad steps above the root (0, 4, 7, 12 …) in the world key. */
const triad = (i: number) => hz(root + [0, 4, 7][i % 3] + 12 * Math.floor(i / 3));

// ---------- building blocks ----------
function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = 'sine', glideTo?: number) {
  const a = audio();
  if (!a || !out) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Filtered noise: swishes, splashes and page turns. */
function hiss(start: number, dur: number, gain: number, filter: BiquadFilterType, from: number, to = from) {
  const a = audio();
  if (!a || !out) return;
  if (!noise) {
    const len = Math.floor(a.sampleRate * 0.6);
    noise = a.createBuffer(1, len, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + start;
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// ---------- the kit ----------
export const sfx = {
  /** a child button: soft tick, pitched up the scale by the button's index */
  tap: (index = 0) => tone(scale(5 + (index % 8)), 0, 0.07, 0.035, 'triangle'),
  /** quieter tick (stepping through, toggles) */
  tick: () => tone(scale(8), 0, 0.04, 0.025, 'triangle'),
  /** picking up or dropping a draggable object */
  pop: () => tone(scale(4), 0, 0.09, 0.06, 'sine', scale(1)),
  /** a dropped object settling into place */
  drop: () => { tone(scale(0) / 2, 0, 0.12, 0.06, 'sine', scale(0) / 3); tone(scale(5), 0.02, 0.06, 0.02, 'triangle'); },
  /** counting: the n-th marked object sings the n-th note of the scale */
  count: (n: number) => tone(scale(Math.max(0, n - 1) % 12), 0, 0.22, 0.05, 'triangle'),
  /** correct answer: a 3-note arpeggio in the world key */
  good: () => { tone(triad(3), 0, 0.15); tone(triad(4), 0.1, 0.15); tone(triad(5), 0.2, 0.28); },
  /** wrong answer: a soft low "hmm" (sine, 220 Hz, 120 ms) — never a buzzer */
  hmm: () => tone(220, 0, 0.12, 0.04, 'sine', 205),
  /** kept for older callers: same gentle "hmm" */
  tryAgain: () => sfx.hmm(),
  /** a flower blooming: a rising run of chimes */
  bloom: () => { [0, 1, 2, 3, 4].forEach((d, i) => tone(scale(5 + d), i * 0.07, 0.2, 0.05)); },
  /** buzz-combo milestone: a bright sparkle chord */
  sparkle: () => { [0, 1, 2].forEach((i) => tone(triad(3 + i), i * 0.03, 0.5, 0.035)); [7, 8, 9].forEach((d, i) => tone(scale(d), 0.12 + i * 0.06, 0.18, 0.025, 'triangle')); },
  /** level complete: one star chime per star (C-E-G in C) */
  star: (i: number) => tone(triad(3 + Math.max(0, i)), 0, 0.45, 0.06, 'triangle'),
  /** friend party / world complete */
  fanfare: () => {
    [0, 1, 2].forEach((i) => tone(triad(3 + i), i * 0.12, 0.2, 0.05, 'triangle'));
    tone(triad(6), 0.4, 0.6, 0.06, 'triangle');
    tone(triad(3) / 2, 0.4, 0.6, 0.04);
  },
  /** natural session end: a slow, falling lullaby cadence */
  lullaby: () => {
    [4, 3, 2, 1, 0].forEach((d, i) => tone(scale(5 + d), i * 0.32, 0.6, 0.035, 'sine'));
    tone(triad(0), 1.6, 1.4, 0.03);
    tone(triad(1), 1.6, 1.4, 0.02);
  },
  /** route change: a very soft page-flip whoosh */
  whoosh: () => hiss(0, 0.28, 0.025, 'bandpass', 900, 2600),
  /** turning a story page */
  page: () => { hiss(0, 0.08, 0.03, 'highpass', 3000); hiss(0.09, 0.1, 0.02, 'highpass', 2400); },
  /** the bee flying past */
  buzz: () => { tone(scale(0) / 4, 0, 0.35, 0.025, 'sawtooth', scale(1) / 4); tone(scale(0) / 4 + 6, 0, 0.35, 0.015, 'square'); },
  /** water: lily pads, the ferry, the river */
  splash: () => { hiss(0, 0.35, 0.05, 'lowpass', 2400, 300); tone(scale(3), 0.02, 0.12, 0.02, 'sine', scale(6)); },
  /** a nectar drop landing in the counter */
  nectar: () => tone(scale(5), 0, 0.14, 0.05, 'sine', scale(8)),
  /** gift lid popping open */
  giftPop: () => { tone(scale(2), 0, 0.08, 0.06, 'square', scale(7)); tone(triad(5), 0.08, 0.3, 0.04, 'triangle'); },
  /** a bubble popping (Bubble Pop skin) */
  bubble: () => tone(scale(6), 0, 0.08, 0.05, 'sine', scale(10)),
  /** hopping from pad to pad */
  hop: () => tone(scale(2), 0, 0.12, 0.04, 'triangle', scale(5)),
  /** a single soft bell (story beats, friend greetings) */
  chime: () => { tone(triad(6), 0, 0.8, 0.035); tone(triad(6) * 2, 0, 0.4, 0.01); },
};

export type SfxName = keyof typeof sfx;
