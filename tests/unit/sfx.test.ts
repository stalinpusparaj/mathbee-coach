import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetSfxForTests, noteHz, pentatonicMidi, setSfxGate, setSfxWorld, sfx, type SfxName } from '../../src/audio/sfx';
import { WORLD_MUSIC } from '../../src/audio/music';
import { store } from '../../src/app/store';
import { emptyState, newProfile } from '../../src/persistence/schema';

/** A counting stand-in for the Web Audio API: records every node and oscillator pitch. */
class FakeParam {
  value = 0;
  calls: [string, number][] = [];
  setValueAtTime(v: number) { this.calls.push(['set', v]); return this; }
  linearRampToValueAtTime(v: number) { this.calls.push(['lin', v]); return this; }
  exponentialRampToValueAtTime(v: number) { this.calls.push(['exp', v]); return this; }
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect<T>(n: T) { return n; }
  start() {}
  stop() {}
}
class FakeCtx {
  static all: FakeCtx[] = [];
  nodes = 0;
  oscillators: FakeNode[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  constructor() { FakeCtx.all.push(this); }
  private node() { this.nodes++; return new FakeNode(); }
  createOscillator() { const o = this.node(); this.oscillators.push(o); return o; }
  createGain() { return this.node(); }
  createBiquadFilter() { return this.node(); }
  createBufferSource() { return this.node(); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}

const g = globalThis as Record<string, unknown>;
const ALL = Object.keys(sfx) as SfxName[];
const play = (name: SfxName) => (sfx[name] as (n?: number) => void)(1);
const nodes = () => FakeCtx.all.reduce((n, c) => n + c.nodes, 0);

beforeEach(() => {
  FakeCtx.all = [];
  __resetSfxForTests();
  g.window = { AudioContext: FakeCtx };
});
afterEach(() => {
  setSfxGate(null);
  delete g.window;
});

describe('foley kit', () => {
  it('has about twenty sounds, each of which makes sound when sound is on', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(20);
    setSfxGate(() => true);
    for (const name of ALL) {
      const before = nodes();
      play(name);
      expect(nodes(), name).toBeGreaterThan(before);
    }
  });

  it('creates no audio context and no nodes at all when sound is off', () => {
    setSfxGate(() => false);
    ALL.forEach(play);
    expect(FakeCtx.all).toHaveLength(0);
    expect(nodes()).toBe(0);
  });

  it("follows the active child's sound setting by default", () => {
    const p = newProfile('p1', 'bee', 'Ana', 'en', '2026-10-31');
    store.setApp({ ...emptyState(), profiles: [{ ...p, settings: { ...p.settings, sound: false } }], activeProfileId: 'p1' });
    ALL.forEach(play);
    expect(nodes()).toBe(0);
    store.setApp({ ...emptyState(), profiles: [p], activeProfileId: 'p1' });
    sfx.good();
    expect(nodes()).toBeGreaterThan(0);
  });

  it('a wrong answer is a soft low "hmm": one quiet 220 Hz sine, never a buzzer', () => {
    setSfxGate(() => true);
    sfx.hmm();
    const [ctx] = FakeCtx.all;
    expect(ctx.oscillators).toHaveLength(1);
    const o = ctx.oscillators[0];
    expect(o.type).toBe('sine');
    expect(o.frequency.calls[0]).toEqual(['set', 220]);
    expect(Math.max(...o.gain.calls.map((c) => c[1]))).toBeLessThanOrEqual(0.05);
    // the old name plays the same gentle sound
    sfx.tryAgain();
    expect(ctx.oscillators[1].frequency.calls[0]).toEqual(['set', 220]);
  });

  it('melodic sounds are pitched to the world key', () => {
    setSfxGate(() => true);
    const first = () => FakeCtx.all[0].oscillators.at(-3)!.frequency.calls[0][1];
    setSfxWorld('meadow');
    sfx.good();
    const inC = first();
    setSfxWorld('river');
    sfx.good();
    const inD = first();
    expect(inD / inC).toBeCloseTo(Math.pow(2, WORLD_MUSIC.river.shift / 12), 5);
    setSfxWorld(null);
  });

  it('counting climbs the pentatonic scale', () => {
    expect([0, 1, 2, 3, 4, 5].map((d) => pentatonicMidi(60, d))).toEqual([60, 62, 64, 67, 69, 72]);
    expect(noteHz('river', 0) / noteHz('meadow', 0)).toBeCloseTo(Math.pow(2, 2 / 12), 5);
    for (let n = 1; n < 12; n++) expect(noteHz(null, n)).toBeGreaterThan(noteHz(null, n - 1));
  });
});
