/**
 * Background music composed in code with the Web Audio API — no audio files, works
 * offline, no licensing. A cheerful music-box tune (C major, 100 BPM) with soft bass, a warm
 * chord pad and a light shaker; two 8-bar sections (~38 s) loop.
 *
 * Browsers only allow audio after a user gesture, so `start()` is called from one.
 * Levels: 'home' (map/menus), 'play' (quieter during questions), 'silent' (mock tests);
 * narration ducks it further.
 */

export type MusicScene = 'home' | 'play' | 'silent';

const BPM = 100;
const STEP = 60 / BPM / 2; // eighth notes
const _ = null;

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

  get isPlaying() {
    return this.playing;
  }

  /** For automated checks: audio engine state and current master volume. */
  debugState() {
    return { playing: this.playing, context: this.ctx?.state ?? 'none', level: this.master?.gain.value ?? 0, scene: this.scene };
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
    const target = this.scene === 'silent' ? 0 : this.ducked ? Math.min(DUCKED, LEVEL[this.scene]) : LEVEL[this.scene];
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, seconds / 3);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    while (this.nextTime < ctx.currentTime + 0.3) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    const note = MELODY[bar][beat];
    const chord = CHORDS[bar];
    if (note !== null) this.musicBox(hz(note), t);
    if (beat === 0 || beat === 4) this.bass(hz(chord[0] - 12), t, beat === 0 ? 0.22 : 0.16);
    if (beat === 0) chord.forEach((n) => this.pad(hz(n), t, STEP * 8));
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

  private pad(freq: number, t: number, length: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.4);
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
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')) {
  (window as unknown as { __mathbeeMusic?: MusicPlayer }).__mathbeeMusic = music;
}

/** Exposed for tests: the song data. */
export const SONG = { MELODY, CHORDS, BPM };
