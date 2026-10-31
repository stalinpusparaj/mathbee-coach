import { Component, Suspense, lazy, type ReactNode } from 'react';
import { markWebglLost } from './support';

/** three.js is only downloaded when a 3D view is actually shown. */
export const Garden3D = lazy(() => import('./Garden3D'));
export const Journey3D = lazy(() => import('./Journey3D'));
export const Flight3D = lazy(() => import('./Flight3D'));

/**
 * If the 3D view fails (lost WebGL context, old GPU), quietly show the flat version instead,
 * and keep using flat views for the rest of this run.
 */
class Fallback extends Component<{ flat: ReactNode; children: ReactNode; onFail?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { markWebglLost(); this.props.onFail?.(); console.warn('3D view unavailable, using 2D', e); }
  render() { return this.state.failed ? this.props.flat : this.props.children; }
}

/** `onFail` tells the screen the flat view has taken over for good (its 3D-only controls should go). */
export function With3D({ flat, children, onFail }: { flat: ReactNode; children: ReactNode; onFail?: () => void }) {
  return (
    <Fallback flat={flat} onFail={onFail}>
      <Suspense fallback={flat}>{children}</Suspense>
    </Fallback>
  );
}
