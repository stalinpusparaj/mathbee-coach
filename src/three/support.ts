import { useProfile } from '../app/store';

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

/**
 * Whether to show the 3D garden and journey. "auto" uses 3D only when the device supports
 * WebGL and the child/grown-up has not asked for reduced motion; "2d" always uses the flat
 * versions; "3d" forces 3D when WebGL exists.
 */
export function use3D(): boolean {
  const profile = useProfile();
  const pref = profile?.settings.graphics ?? 'auto';
  if (pref === '2d') return false;
  webgl ??= typeof window !== 'undefined' && webglAvailable();
  if (!webgl) return false;
  if (pref === '3d') return true;
  const reduce = profile?.settings.reducedMotion === 'on'
    || (profile?.settings.reducedMotion !== 'off' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return !reduce;
}
