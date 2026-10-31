import { haptic as shellHaptic, inShell, shellInfo, type HapticStyle } from '../app/shell';
import { store } from '../app/store';
import { sfx } from '../audio/sfx';
import { emitParticles, POLLEN } from './particles';

/**
 * The juice kit (docs/BUILD_PLAN.md §5): small, kind bits of feedback that make a tap feel
 * alive. Everything visual uses the Web Animations API on transform and opacity only, so it
 * runs on the compositor; the particle canvas animates with requestAnimationFrame.
 *
 * Reduced motion (html.reduce-motion, or the system setting unless the grown-up chose full
 * motion): every visual effect here is a no-op — no translation, scale, rotation or
 * particles. Haptics are not motion, so they stay, gated only by the in-app setting.
 *
 * A wrong answer gets `softWrong` — a gentle 4° wobble and nothing else: no shake, no red X,
 * no buzzer and never a haptic.
 */

export type Point = { x: number; y: number };
type Target = Element | Point | null | undefined;

export interface JuiceEnv {
  /** in-app haptics setting (Settings.haptics) */
  haptics: boolean;
  /** weak device on flat graphics: skip particles */
  lite: boolean;
}

/** Default environment: the active child's settings plus what the Android shell says. */
const fromProfile = (): JuiceEnv => {
  const s = store.get();
  const p = s.app.profiles.find((x) => x.id === s.app.activeProfileId);
  return {
    haptics: p?.settings.haptics !== false,
    lite: p?.settings.graphics === '2d' && !!shellInfo()?.lowRam,
  };
};
let envFn: () => JuiceEnv = fromProfile;

/** Replace the settings source (tests; null restores the profile). */
export function setJuiceEnv(fn: (() => JuiceEnv) | null): void {
  envFn = fn ?? fromProfile;
}

/** True when motion should be reduced: no transforms, no particles. */
export function prefersReduced(): boolean {
  if (typeof document === 'undefined' || !document.documentElement) return true; // nothing to animate
  const cl = document.documentElement.classList;
  if (cl.contains('reduce-motion')) return true;
  if (cl.contains('full-motion')) return false;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// one running effect per element and kind, so rapid taps restart instead of stacking
const running = new WeakMap<Element, Map<string, Animation>>();

function play(el: Element | null | undefined, kind: string, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || prefersReduced() || typeof (el as HTMLElement).animate !== 'function') return null;
  try {
    let byKind = running.get(el);
    if (!byKind) running.set(el, (byKind = new Map()));
    byKind.get(kind)?.cancel();
    const a = (el as HTMLElement).animate(frames, opts);
    byKind.set(kind, a);
    return a;
  } catch {
    return null;
  }
}

/** Squash on tap: 0.92 → 1.05 → 1 over 180 ms. */
export function squash(el: Element | null | undefined): Animation | null {
  return play(el, 'squash', [
    { transform: 'scale(1)' },
    { transform: 'scale(0.92)', offset: 0.35 },
    { transform: 'scale(1.05)', offset: 0.7 },
    { transform: 'scale(1)' },
  ], { duration: 180, easing: 'ease-out' });
}

/** A counter (nectar, progress) bumps when something lands in it. */
export function bump(el: Element | null | undefined): Animation | null {
  return play(el, 'bump', [
    { transform: 'scale(1)' },
    { transform: 'scale(1.22)', offset: 0.4 },
    { transform: 'scale(1)' },
  ], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
}

/** The answer card stretches happily on a correct answer. */
export function stretch(el: Element | null | undefined): Animation | null {
  return play(el, 'stretch', [
    { transform: 'scale(1, 1)' },
    { transform: 'scale(1.06, 0.94)', offset: 0.3 },
    { transform: 'scale(0.98, 1.03)', offset: 0.65 },
    { transform: 'scale(1, 1)' },
  ], { duration: 320, easing: 'ease-out' });
}

/** Wrong answer: a gentle 4° wobble, twice, over 300 ms. Never a shake. */
export function wobble(el: Element | null | undefined): Animation | null {
  return play(el, 'wobble', [
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(4deg)' },
    { transform: 'rotate(-4deg)' },
    { transform: 'rotate(4deg)' },
    { transform: 'rotate(-4deg)' },
    { transform: 'rotate(0deg)' },
  ], { duration: 300, easing: 'ease-in-out' });
}

/** A counted object hops 6 px; it also glows briefly (the glow stays under reduced motion). */
export function hop(el: Element | null | undefined): Animation | null {
  glow(el);
  return play(el, 'hop', [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-6px)', offset: 0.45 },
    { transform: 'translateY(0)' },
  ], { duration: 220, easing: 'ease-out' });
}

/** A dropped object settles with a small bounce. */
export function settle(el: Element | null | undefined): Animation | null {
  return play(el, 'settle', [
    { transform: 'translateY(-6px) scale(1.04)' },
    { transform: 'translateY(2px) scale(0.98)', offset: 0.55 },
    { transform: 'translateY(0) scale(1)' },
  ], { duration: 240, easing: 'ease-out' });
}

/** A short highlight ring (a class, not motion, so it also shows under reduced motion). */
export function glow(el: Element | null | undefined, ms = 450): void {
  if (!el?.classList) return;
  el.classList.add('fx-glow');
  setTimeout(() => el.classList.remove('fx-glow'), ms);
}

function centre(t: Target): Point | null {
  if (!t) return null;
  if ('x' in t && 'y' in t && typeof (t as Point).x === 'number') return t as Point;
  const r = (t as Element).getBoundingClientRect?.();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/**
 * Pollen burst from a screen point: 8–12 particles for 600 ms on the pooled canvas, never
 * more than 40 alive. Skipped under reduced motion and on weak devices using flat graphics.
 * Returns how many particles were spawned.
 */
export function burst(x: number, y: number, opts: { count?: number; palette?: string[] } = {}): number {
  if (prefersReduced() || envFn().lite) return 0;
  const count = Math.max(1, Math.min(12, Math.round(opts.count ?? 10)));
  return emitParticles(x, y, count, opts.palette ?? POLLEN);
}

/** Point on the quadratic curve from a to b that rises above both. */
function arcPoint(a: Point, b: Point, t: number): Point {
  const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.max(90, Math.abs(a.x - b.x) * 0.35) };
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/**
 * A nectar drop flies in an arc from a tap point (or element) to a counter in 700 ms, then
 * the counter bumps. Resolves when it has landed (at once under reduced motion).
 */
export function arc(from: Target, to: Element | null | undefined, sprite = '🍯'): Promise<void> {
  const a = centre(from);
  const b = centre(to);
  if (!a || !b || prefersReduced() || typeof document === 'undefined' || !document.body) return Promise.resolve();
  const drop = document.createElement('span');
  drop.className = 'fx-drop';
  drop.setAttribute('aria-hidden', 'true');
  drop.textContent = sprite;
  drop.style.left = `${a.x}px`;
  drop.style.top = `${a.y}px`;
  document.body.appendChild(drop);
  const frames: Keyframe[] = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const p = arcPoint(a, b, i / N);
    const s = i === 0 ? 0.6 : i === N ? 0.7 : 1 + 0.2 * Math.sin((i / N) * Math.PI);
    frames.push({ transform: `translate(${p.x - a.x}px, ${p.y - a.y}px) translate(-50%, -50%) scale(${s.toFixed(2)})`, opacity: i === N ? 0.4 : 1 });
  }
  return new Promise<void>((resolve) => {
    const land = () => {
      drop.remove();
      bump(to);
      resolve();
    };
    if (typeof drop.animate !== 'function') return land();
    try {
      const anim = drop.animate(frames, { duration: 700, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
      anim.onfinish = land;
      anim.oncancel = land;
    } catch {
      land();
    }
  });
}

/**
 * Level complete: a soft circle of light opens from the origin (500 ms) and fades away.
 * Resolves when done (at once under reduced motion).
 */
export function bloomWipe(origin: Target): Promise<void> {
  const p = centre(origin);
  if (!p || prefersReduced() || typeof document === 'undefined' || !document.body) return Promise.resolve();
  const veil = document.createElement('div');
  veil.className = 'fx-bloom';
  veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  const at = `at ${Math.round(p.x)}px ${Math.round(p.y)}px`;
  return new Promise<void>((resolve) => {
    const done = () => {
      veil.remove();
      resolve();
    };
    if (typeof veil.animate !== 'function') return done();
    try {
      const open = veil.animate([{ clipPath: `circle(0px ${at})`, opacity: 1 }, { clipPath: `circle(150vmax ${at})`, opacity: 1 }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
      open.onfinish = () => {
        const fade = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
        fade.onfinish = done;
        fade.oncancel = done;
      };
      open.oncancel = done;
    } catch {
      done();
    }
  });
}

/**
 * Hit-stop: a tiny freeze (default 80 ms) before the payoff — running animations pause via
 * `html.fx-hitstop`. Resolves after the pause (at once under reduced motion).
 */
export function hitStop(ms = 80): Promise<void> {
  if (prefersReduced() || ms <= 0) return Promise.resolve();
  const cl = document.documentElement.classList;
  cl.add('fx-hitstop');
  return new Promise((resolve) => setTimeout(() => {
    cl.remove('fx-hitstop');
    resolve();
  }, ms));
}

// ---------- haptics ----------
const VIBRATE: Record<HapticStyle, number | number[]> = { tap: 8, success: 18, celebrate: [16, 70, 16] };
const VIBRATE_GAP_MS = 150;
let lastVibrate = -Infinity;

/**
 * A gentle vibration through the Android shell, or `navigator.vibrate` where a browser has
 * it. Off when the in-app setting is off (the shell also respects the system setting).
 * Not affected by reduced motion. Never call this for a wrong answer.
 * Returns true when a haptic was requested.
 */
export function haptic(style: HapticStyle): boolean {
  if (!envFn().haptics) return false;
  if (inShell()) {
    shellHaptic(style);
    return true;
  }
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }) : null;
  if (!nav || typeof nav.vibrate !== 'function') return false;
  const now = Date.now();
  if (now - lastVibrate < VIBRATE_GAP_MS) return false;
  lastVibrate = now;
  try {
    return nav.vibrate(VIBRATE[style]) !== false;
  } catch {
    return false;
  }
}

/** Test helper: forget the vibration rate limit. */
export function __resetJuiceForTests(): void {
  lastVibrate = -Infinity;
  envFn = fromProfile;
}

// ---------- moments ----------
/**
 * The correct-answer sequence (§5): an 80 ms hit-stop, then a success haptic, the answer
 * card stretches, pollen bursts from the tap point and a nectar drop arcs to the counter,
 * which bumps when it lands (a combo milestone uses the 'celebrate' haptic instead). Under
 * reduced motion only the haptic remains.
 */
export async function celebrateCorrect({ card, from, counter, haptic: style = 'success' }: {
  card?: Element | null; from?: Target; counter?: Element | null; haptic?: Exclude<HapticStyle, 'tap'>;
}): Promise<void> {
  await hitStop(80);
  haptic(style);
  stretch(card);
  const p = centre(from) ?? centre(card);
  if (p) burst(p.x, p.y);
  if (counter) await arc(p ?? card, counter);
}

/** A wrong answer: only the gentle wobble. No shake, no red, no buzzer, no haptic. */
export function softWrong(el: Element | null | undefined): void {
  wobble(el);
}

/** Child controls that get tap juice (scene objects have their own counting feedback). */
const TAP_TARGETS = '.btn, .key, .choice, .field, .icon-btn, .jl-story, .hat-btn, [data-juice]';

/**
 * Tap feedback for child buttons inside `root`: squash, a soft tick pitched by the button's
 * `data-pitch` (or its position among its siblings) and a tap haptic. Buttons marked
 * `data-juice="quiet"` (e.g. the check button, whose answer brings its own feedback) only
 * squash. Returns a cleanup function.
 */
export function installTapJuice(root: HTMLElement | null): () => void {
  if (!root) return () => undefined;
  const onDown = (e: Event) => {
    const btn = (e.target as Element | null)?.closest?.(TAP_TARGETS) as HTMLElement | null;
    if (!btn || !root.contains(btn) || (btn as HTMLButtonElement).disabled) return;
    squash(btn);
    if (btn.dataset.juice === 'quiet') return;
    const pitch = Number(btn.dataset.pitch ?? (btn.parentElement ? Array.prototype.indexOf.call(btn.parentElement.children, btn) : 0));
    sfx.tap(Number.isFinite(pitch) ? pitch : 0);
    haptic('tap');
  };
  root.addEventListener('pointerdown', onDown);
  return () => root.removeEventListener('pointerdown', onDown);
}
