import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetJuiceForTests, arc, bloomWipe, bump, burst, celebrateCorrect, haptic, hitStop, hop, prefersReduced,
  setJuiceEnv, settle, softWrong, squash, stretch, wobble,
} from '../../src/fx/juice';
import { MAX_PARTICLES, PARTICLE_MS, ParticlePool, __resetParticlesForTests, particleCount } from '../../src/fx/particles';
import { __resetShellForTests } from '../../src/app/shell';

/**
 * The unit tests run in node, so this is a tiny DOM stand-in: just enough document, window,
 * elements (with a recording `animate`) and canvas for the juice kit.
 */
type Anim = { frames: Keyframe[]; opts: KeyframeAnimationOptions; cancel: () => void; onfinish: null | (() => void); oncancel: null | (() => void) };
const g = globalThis as Record<string, unknown>;

function classSet(initial: string[] = []) {
  const s = new Set(initial);
  return { contains: (c: string) => s.has(c), add: (c: string) => void s.add(c), remove: (c: string) => void s.delete(c), set: s };
}

function installDom(opts: { classes?: string[]; systemReduce?: boolean; shell?: boolean; vibrate?: boolean } = {}) {
  const animations: Anim[] = [];
  const appended: unknown[] = [];
  const sent: Record<string, unknown>[] = [];
  const vibrations: unknown[] = [];
  const ctx2d = new Proxy({}, { get: () => () => undefined, set: () => true });
  const makeEl = (tag = 'div') => {
    const el: Record<string, unknown> = {
      tagName: tag.toUpperCase(), style: {}, dataset: {}, classList: classSet(), isConnected: true, textContent: '', className: '',
      setAttribute() {}, addEventListener() {}, remove() { el.isConnected = false; },
      getBoundingClientRect: () => ({ left: 100, top: 300, width: 40, height: 40 }),
      getContext: () => ctx2d,
      animate: vi.fn((frames: Keyframe[], o: KeyframeAnimationOptions) => {
        const a: Anim = { frames, opts: o, cancel: vi.fn(), onfinish: null, oncancel: null };
        animations.push(a);
        return a;
      }),
    };
    return el;
  };
  const html = { classList: classSet(opts.classes ?? []) };
  g.document = { documentElement: html, body: { appendChild: (n: unknown) => appended.push(n) }, createElement: makeEl };
  g.window = {
    matchMedia: (q: string) => ({ matches: !!opts.systemReduce && q.includes('reduce') }),
    innerWidth: 400, innerHeight: 800, devicePixelRatio: 2, addEventListener() {},
    ...(opts.shell ? { MathBeeAndroid: { postMessage: (m: string) => sent.push(JSON.parse(m)) } } : {}),
  };
  g.requestAnimationFrame = () => 1;
  if (opts.vibrate) vi.stubGlobal('navigator', { vibrate: (p: unknown) => { vibrations.push(p); return true; } });
  return { animations, appended, sent, vibrations, html, el: () => makeEl() as unknown as HTMLElement };
}

beforeEach(() => {
  __resetJuiceForTests();
  __resetParticlesForTests();
  __resetShellForTests();
  setJuiceEnv(() => ({ haptics: true, lite: false }));
});
afterEach(() => {
  delete g.document;
  delete g.window;
  delete g.requestAnimationFrame;
  vi.unstubAllGlobals();
});

describe('juice kit: reduced motion', () => {
  it('html.reduce-motion turns every visual effect into a no-op', async () => {
    const dom = installDom({ classes: ['reduce-motion'] });
    const el = dom.el();
    expect(prefersReduced()).toBe(true);
    for (const fx of [squash, bump, stretch, wobble, hop, settle]) expect(fx(el)).toBeNull();
    softWrong(el);
    expect(el.animate).not.toHaveBeenCalled();
    expect(burst(10, 10, { count: 12 })).toBe(0);
    expect(particleCount()).toBe(0);
    await arc(el, dom.el());
    await bloomWipe(el);
    await hitStop(80);
    expect(dom.appended).toEqual([]); // no drop, no veil, no particle canvas
    expect(dom.html.classList.contains('fx-hitstop')).toBe(false);
    expect(dom.animations).toEqual([]);
  });

  it('the system setting reduces motion too, unless the grown-up chose full motion', () => {
    installDom({ systemReduce: true });
    expect(prefersReduced()).toBe(true);
    installDom({ systemReduce: true, classes: ['full-motion'] });
    expect(prefersReduced()).toBe(false);
  });

  it('without a DOM nothing animates', () => {
    expect(prefersReduced()).toBe(true);
    expect(burst(0, 0)).toBe(0);
  });

  it('haptics stay on under reduced motion (they are not motion)', async () => {
    const dom = installDom({ classes: ['reduce-motion'], shell: true });
    await celebrateCorrect({ card: dom.el(), from: { x: 1, y: 1 }, counter: dom.el() });
    expect(dom.sent.filter((m) => m.type === 'haptic')).toEqual([expect.objectContaining({ style: 'success' })]);
    expect(dom.animations).toEqual([]);
  });
});

describe('juice kit: effects', () => {
  it('squash is 0.92 → 1.05 → 1 over 180 ms, on transform only', () => {
    const dom = installDom();
    squash(dom.el());
    const [a] = dom.animations;
    expect(a.opts.duration).toBe(180);
    expect(a.frames.map((f) => f.transform)).toEqual(['scale(1)', 'scale(0.92)', 'scale(1.05)', 'scale(1)']);
    expect(a.frames.every((f) => Object.keys(f).every((k) => k === 'transform' || k === 'offset'))).toBe(true);
  });

  it('a wrong answer is a gentle 4° wobble over 300 ms — no shake, no haptic', () => {
    const dom = installDom({ shell: true, vibrate: true });
    softWrong(dom.el());
    const [a] = dom.animations;
    expect(a.opts.duration).toBe(300);
    const angles = a.frames.map((f) => Number(/rotate\((-?\d+)deg\)/.exec(String(f.transform))?.[1]));
    expect(Math.max(...angles.map(Math.abs))).toBe(4);
    expect(a.frames.some((f) => /translate/.test(String(f.transform)))).toBe(false);
    expect(dom.sent).toEqual([]);
    expect(dom.vibrations).toEqual([]);
  });

  it('rapid taps restart an effect instead of stacking it', () => {
    const dom = installDom();
    const el = dom.el();
    squash(el);
    squash(el);
    expect(dom.animations).toHaveLength(2);
    expect(dom.animations[0].cancel).toHaveBeenCalled();
  });

  it('the nectar drop arcs above both ends, lands, is removed and bumps the counter', async () => {
    const dom = installDom();
    const counter = dom.el();
    const landed = arc({ x: 200, y: 500 }, counter);
    const flight = dom.animations[0];
    expect(flight.opts.duration).toBe(700);
    const ys = flight.frames.map((f) => Number(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(String(f.transform))?.[2]));
    expect(Math.min(...ys)).toBeLessThan(-180); // rises above the counter (which is 180 px higher)
    flight.onfinish?.();
    await landed;
    expect((dom.appended[0] as { isConnected: boolean }).isConnected).toBe(false);
    expect(counter.animate).toHaveBeenCalledTimes(1); // the bump
  });

  it('hit-stop pauses for its length and then lets go', async () => {
    vi.useFakeTimers();
    const dom = installDom();
    const done = hitStop(80);
    expect(dom.html.classList.contains('fx-hitstop')).toBe(true);
    vi.advanceTimersByTime(80);
    await done;
    expect(dom.html.classList.contains('fx-hitstop')).toBe(false);
    vi.useRealTimers();
  });
});

describe('juice kit: particles', () => {
  it('never more than 40 particles are alive', () => {
    installDom();
    for (let i = 0; i < 10; i++) burst(50, 50, { count: 12 });
    expect(particleCount()).toBe(MAX_PARTICLES);
  });

  it('a burst is 8–12 particles (asked-for counts are clamped)', () => {
    installDom();
    expect(burst(50, 50)).toBe(10);
    expect(burst(50, 50, { count: 99 })).toBe(12);
  });

  it('the pool reuses particles and empties after 600 ms', () => {
    const pool = new ParticlePool();
    expect(pool.spawn(0, 0, 100)).toBe(MAX_PARTICLES);
    expect(pool.spawn(0, 0, 5)).toBe(0);
    pool.step(PARTICLE_MS / 2);
    expect(pool.alive).toBe(MAX_PARTICLES);
    pool.step(PARTICLE_MS);
    expect(pool.alive).toBe(0);
    expect(pool.spawn(0, 0, 8)).toBe(8);
    expect(pool.items).toHaveLength(MAX_PARTICLES);
  });

  it('weak phones on flat graphics get no particles', () => {
    installDom();
    setJuiceEnv(() => ({ haptics: true, lite: true }));
    expect(burst(10, 10)).toBe(0);
  });
});

describe('juice kit: haptics', () => {
  it('goes through the Android shell when the in-app setting is on', () => {
    const dom = installDom({ shell: true });
    expect(haptic('tap')).toBe(true);
    expect(dom.sent).toEqual([expect.objectContaining({ type: 'haptic', style: 'tap' })]);
  });

  it('sends nothing when the in-app haptics setting is off', () => {
    const dom = installDom({ shell: true, vibrate: true });
    setJuiceEnv(() => ({ haptics: false, lite: false }));
    expect(haptic('success')).toBe(false);
    expect(haptic('celebrate')).toBe(false);
    expect(dom.sent).toEqual([]);
    expect(dom.vibrations).toEqual([]);
  });

  it('in a browser uses navigator.vibrate only where it exists', () => {
    const dom = installDom({ vibrate: true });
    expect(haptic('tap')).toBe(true);
    expect(dom.vibrations).toHaveLength(1);
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', {});
    __resetJuiceForTests();
    setJuiceEnv(() => ({ haptics: true, lite: false }));
    expect(haptic('tap')).toBe(false);
  });

  it('the correct-answer sequence sends one success haptic (celebrate on a combo milestone)', async () => {
    vi.useFakeTimers();
    const dom = installDom({ shell: true });
    const run = celebrateCorrect({ card: dom.el(), from: { x: 5, y: 5 }, haptic: 'celebrate' });
    await vi.advanceTimersByTimeAsync(100);
    await run;
    expect(dom.sent.filter((m) => m.type === 'haptic')).toEqual([expect.objectContaining({ style: 'celebrate' })]);
    expect(dom.animations.some((a) => a.opts.duration === 320)).toBe(true); // the card stretched
    expect(particleCount()).toBeGreaterThanOrEqual(8); // pollen from the tap point
    vi.useRealTimers();
  });
});
