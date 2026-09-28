import { Component, Suspense, lazy, type ReactNode } from 'react';

/** three.js is only downloaded when a 3D view is actually shown. */
export const Garden3D = lazy(() => import('./Garden3D'));
export const Journey3D = lazy(() => import('./Journey3D'));

/** If the 3D view fails (lost WebGL context, old GPU), quietly show the flat version instead. */
class Fallback extends Component<{ flat: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('3D view unavailable, using 2D', e); }
  render() { return this.state.failed ? this.props.flat : this.props.children; }
}

export function With3D({ flat, children }: { flat: ReactNode; children: ReactNode }) {
  return (
    <Fallback flat={flat}>
      <Suspense fallback={flat}>{children}</Suspense>
    </Fallback>
  );
}
