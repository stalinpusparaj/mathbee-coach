import { useProfile } from '../app/store';
import { inShell, shellInfo } from '../app/shell';

/** Checked without importing three.js, so the 3D engine only downloads when it is used. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

let webgl: boolean | null = null;

/** After a lost WebGL context (or any 3D failure) the rest of this run stays in 2D. */
export function markWebglLost(): void {
  webgl = false;
}

/** Low-memory phones (the Android shell says so) or browsers reporting little memory or few cores. */
export function isWeakDevice(): boolean {
  if (shellInfo()?.lowRam) return true;
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return true;
  return typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
}

/** Pixel-ratio cap and antialiasing for the 3D renderer: phones in the app and weak devices draw less. */
export function renderBudget(): { maxDpr: number; antialias: boolean } {
  const weak = isWeakDevice();
  return { maxDpr: weak || inShell() ? 1.5 : 2, antialias: !weak };
}

/**
 * Whether to show the 3D garden and journey. "auto" uses 3D only when the device supports
 * WebGL, is not a low-memory phone, and the child/grown-up has not asked for reduced motion;
 * "2d" always uses the flat versions; "3d" forces 3D when WebGL exists.
 */
export function use3D(): boolean {
  const profile = useProfile();
  const pref = profile?.settings.graphics ?? 'auto';
  if (pref === '2d') return false;
  webgl ??= typeof window !== 'undefined' && webglAvailable();
  if (!webgl) return false;
  if (pref === '3d') return true;
  if (shellInfo()?.lowRam) return false;
  const reduce = profile?.settings.reducedMotion === 'on'
    || (profile?.settings.reducedMotion !== 'off' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return !reduce;
}
