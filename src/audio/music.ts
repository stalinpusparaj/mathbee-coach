/**
 * Background music composed in code with the Web Audio API — no audio files, works
 * offline, no licensing. A cheerful music-box tune (C major, 100 BPM) with soft bass, a warm
 * chord pad and a light shaker; two 8-bar sections (~38 s) loop.
 *
 * Browsers only allow audio after a user gesture, so `start()` is called from one.
 * Levels: 'home' (map/menus), 'play' (quieter during questions), 'silent' (mock tests);
 * narration ducks it further.
 *
 * Each story world plays the same tune in its own key and tempo (`setWorld`). A buzz combo
 * lifts the tune a semitone and adds a soft pad for a fixed number of bars (`combo`) — the
 * lift always ends on its own, never because of a wrong answer. `rest` fades everything out
 * gently for the natural end of a play session.
 */
import type { JourneyTheme } from '../activities/journey';
import { E2E_HOOKS } from '../app/platform';

export type MusicScene = 'home' | 'play' | 'silent';

const BPM = 100;
const _ = null;

/** Key (semitones from the written C major) and tempo of each world's variation. */
export const WORLD_MUSIC: Record<JourneyTheme, { key: string; shift: number; bpm: number }> = {
  meadow: { key: 'C', shift: 0, bpm: 96 },
  river: { key: 'D', shift: 2, bpm: 92 },
  orchard: { key: 'F', shift: -7, bpm: 100 },
  ice: { key: 'A', shift: -3, bpm: 88 },
  trail: { key: 'G', shift: -5, bpm: 104 },
  town: { key: 'Bb', shift: -2, bpm: 96 },
  garden: { key: 'C', shift: 0, bpm: 100 },
};
/** Outside a world (map, menus) the tune plays as written. */
const HOME_MUSIC = { shift: 0, bpm: BPM };
/** A combo lift lasts this many bars (8 eighth-notes each) and then ends by itself. */
export const COMBO_BARS = 8;
/** The extra pad stem joins from this combo size. */
export const COMBO_PAD_FROM = 5;
/** `rest()` fades the music out over this many seconds. */
export const REST_FADE_S = 3;

/** Eighth-note length in seconds for a tempo. */
export const stepSeconds = (bpm: number) => 60 / bpm / 2;

// MIDI note numbers; one array of 8 eighth-notes per bar
const MELODY: (number | null)[][] = [
  // A section
  [76, _, 79, _, 81, 79, 76, _],
  [74, _, 79, _, 71, _, 74, _],
  [72, _, 76, _, 81, _, 79, 76],
  [77, _, 81, _, 79, _, _, _],
  [76, 79, 84, _, 81, _, 79, _],
  [74, _, 71, _, 74, 79, _, _],
  [81, _, 79, _, 77, _, 76, 74],
  [72, _, 76, _, 72, _, _, _],
  // B section
  [81, _, 84, _, 81, _, 79, _],
  [83, _, 86, _, 83, _, 79, _],
  [79, _, 76, _, 72, _, 76, _],
  [81, _, _, 79, 81, _, 84, _],
  [84, _, 81, _, 77, _, 81, _],
  [79, _, 74, _, 79, _, 83, _],
  [84, _, 79, _, 76, _, 79, _],
  [84, _, _, _, _, _, _, _],
];
const C = [60, 64, 67], G = [55, 59, 62], AM = [57, 60, 64], F = [53, 57, 60];
const CHORDS = [C, G, AM, F, C, G, F, C, F, G, C, AM, F, G, C, C];
const TOTAL_STEPS = MELODY.length * 8;

const LEVEL: Record<MusicScene, number> = { home: 0.32, play: 0.14, silent: 0 };
const DUCKED = 0.05;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private playing = false;
  private scene: MusicScene = 'home';
  private ducked = false;
  private resting = false;
  /** key and tempo in use, and the ones waiting for the next bar line */
  private shift = HOME_MUSIC.shift;
  private bpm = HOME_MUSIC.bpm;
  private pending: { shift: number; bpm: number } | null = null;
  private world: JourneyTheme | null = null;
  /** eighth-notes left of a combo lift, and whether its pad stem plays */
  private liftSteps = 0;
  private liftPad = false;

  get isPlaying() {
    return this.playing;
  }

  /** For automated checks: audio engine state, current master volume, world and combo lift. */
  debugState() {
    const kt = this.pending ?? { shift: this.shift, bpm: this.bpm };
    return {
      playing: this.playing, context: this.ctx?.state ?? 'none', level: this.master?.gain.value ?? 0, scene: this.scene,
      world: this.world, shift: kt.shift, bpm: kt.bpm, resting: this.resting,
      comboBarsLeft: Math.ceil(this.liftSteps / 8), comboPad: this.liftSteps > 0 && this.liftPad,
    };
  }

  /** Start (or resume) playback. Call from a user gesture. Safe to call repeatedly. */
  start(): void {
    if (this.playing) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    void ctx.resume().catch(() => undefined);
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.1;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.applyLevel(1.2);
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  /** Fade out and stop. */
  stop(): void {
    if (!this.playing || !this.ctx || !this.master) return;
    this.playing = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    const t = this.timer;
    this.timer = null;
    window.setTimeout(() => { if (t !== null) window.clearInterval(t); }, 600);
  }

  setScene(scene: MusicScene): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.applyLevel(0.6);
  }

  /** Lower the music while narration speaks. */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyLevel(0.25);
  }

  /** Pause audio processing while the page is hidden; pick up again when visible. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend().catch(() => undefined);
    else if (this.playing) void this.ctx.resume().catch(() => undefined);
  }

  /**
   * Play the tune in a world's key and tempo (null = as written, for the map and menus).
   * While playing, the change waits for the next bar line so the melody never jumps mid-phrase.
   */
  setWorld(theme: JourneyTheme | null): void {
    if (theme === this.world) return;
    this.world = theme;
    const next = theme ? WORLD_MUSIC[theme] : HOME_MUSIC;
    if (this.playing) {
      this.pending = { shift: next.shift, bpm: next.bpm };
    } else {
      this.shift = next.shift;
      this.bpm = next.bpm;
      this.pending = null;
    }
  }

  /**
   * A buzz-combo milestone: the tune steps up a semitone for COMBO_BARS bars, with a soft pad
   * stem from COMBO_PAD_FROM in a row. It always runs its full length — a later wrong answer
   * never cuts it short — and a new milestone simply starts the count again.
   */
  combo(n: number): void {
    this.liftSteps = COMBO_BARS * 8;
    this.liftPad = n >= COMBO_PAD_FROM;
  }

  /**
   * Natural session end: fade out over REST_FADE_S seconds and play no new notes until
   * `rest(false)`, which fades back in. Playback state is kept, so nothing needs restarting.
   */
  rest(on: boolean): void {
    if (on === this.resting) return;
    this.resting = on;
    this.liftSteps = 0;
    this.applyLevel(on ? REST_FADE_S : 1.2);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    // gentle low-pass keeps the sound soft for young ears
    const tone = this.ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;
    this.master.connect(tone).connect(this.ctx.destination);
    // short noise buffer for the shaker
    const len = Math.floor(this.ctx.sampleRate * 0.08);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return this.ctx;
  }

  private applyLevel(seconds: number): void {
    if (!this.ctx || !this.master || !this.playing) return;
    const target = this.scene === 'silent' || this.resting ? 0 : this.ducked ? Math.min(DUCKED, LEVEL[this.scene]) : LEVEL[this.scene];
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, seconds / 3);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    while (this.nextTime < ctx.currentTime + 0.3) {
      // a new world's key and tempo start on a bar line
      if (this.pending && this.step % 8 === 0) {
        this.shift = this.pending.shift;
        this.bpm = this.pending.bpm;
        this.pending = null;
      }
      // resting: keep time silently (no new nodes) until the music comes back
      if (!this.resting) this.playStep(this.step, this.nextTime);
      this.nextTime += stepSeconds(this.bpm);
      this.step = (this.step + 1) % TOTAL_STEPS;
      if (this.liftSteps > 0) this.liftSteps--;
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    const lifted = this.liftSteps > 0;
    const shift = this.shift + (lifted ? 1 : 0);
    const note = MELODY[bar][beat];
    const chord = CHORDS[bar];
    const barLength = stepSeconds(this.bpm) * 8;
    if (note !== null) this.musicBox(hz(note + shift), t);
    if (beat === 0 || beat === 4) this.bass(hz(chord[0] - 12 + shift), t, beat === 0 ? 0.22 : 0.16);
    if (beat === 0) chord.forEach((n) => this.pad(hz(n + shift), t, barLength));
    // combo stem: an airy note above the chord, softer in the last lifted bar so it fades out
    if (beat === 0 && lifted && this.liftPad) this.pad(hz(chord[0] + 19 + shift), t, barLength, this.liftSteps <= 8 ? 0.01 : 0.02);
    if (beat % 2 === 1) this.shaker(t, beat === 3 || beat === 7 ? 0.05 : 0.03);
  }

  private voice(type: OscillatorType, freq: number, t: number, peak: number, attack: number, decay: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /** music-box / marimba: triangle body plus a soft octave shimmer */
  private musicBox(freq: number, t: number): void {
    this.voice('triangle', freq, t, 0.28, 0.005, 0.7);
    this.voice('sine', freq * 2, t, 0.06, 0.005, 0.35);
  }

  private bass(freq: number, t: number, peak: number): void {
    this.voice('sine', freq, t, peak, 0.02, 0.5);
  }

  private pad(freq: number, t: number, length: number, peak = 0.035): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  private shaker(t: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.value = peak;
    src.connect(hp).connect(g).connect(this.master!);
    src.start(t);
  }
}

export const music = new MusicPlayer();
if (E2E_HOOKS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')) {
  (window as unknown as { __mathbeeMusic?: MusicPlayer }).__mathbeeMusic = music;
}

/** Exposed for tests: the song data. */
export const SONG = { MELODY, CHORDS, BPM };

/** Lowest and highest melody note (MIDI) a world's variation can reach, combo lift included. */
export function melodyRange(theme: JourneyTheme | null): [number, number] {
  const shift = theme ? WORLD_MUSIC[theme].shift : 0;
  const notes = MELODY.flat().filter((n): n is number => n !== null);
  return [Math.min(...notes) + shift, Math.max(...notes) + shift + 1];
}
