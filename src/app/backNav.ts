import { store, type Route } from './store';

/**
 * Back navigation (CONTRACT). Android's back gesture, Escape and on-screen back buttons all go
 * through goBack(): first the newest open overlay closes (LIFO), otherwise the route's parent.
 * SCAFFOLD: overlay stack and parentOf are real; WP2 wires it to the shell and keyboard.
 */
const overlays: (() => void)[] = [];

/** Register an open overlay (pause sheet, gate, modal, intro). Returns an unregister function. */
export function pushOverlay(close: () => void): () => void {
  overlays.push(close);
  return () => {
    const i = overlays.lastIndexOf(close);
    if (i >= 0) overlays.splice(i, 1);
  };
}

/** Where "back" leads from each route; null = the root (map/welcome) → the shell asks to exit. */
export function parentOf(route: Route): Route | null {
  switch (route.name) {
    case 'welcome': return null;
    case 'profiles': case 'profile-new': return { name: 'welcome' };
    case 'intro': case 'controls': return { name: 'map' };
    case 'map': return null;
    case 'category': case 'restore': case 'stickers': case 'review-due': case 'adventure': case 'parent': return { name: 'map' };
    case 'adventure-world': return { name: 'adventure' };
    case 'level-results': return { name: 'adventure' };
    case 'session': return null; // handled by the session's pause sheet (an overlay)
    case 'results': case 'session-end': return { name: 'map' };
    case 'tests': case 'setup': case 'settings': return { name: 'parent' };
    case 'mock': return null; // mock test handles its own leave confirmation
    case 'mock-results': case 'print': return { name: 'tests' };
  }
}

/** Returns true when handled in-app; false means "at the root" (the shell may show the bye sheet). */
export function goBack(): boolean {
  const top = overlays[overlays.length - 1];
  if (top) { top(); return true; }
  const parent = parentOf(store.get().route);
  if (parent) { store.setRoute(parent); return true; }
  return false;
}

export function canGoBack(): boolean {
  return overlays.length > 0 || parentOf(store.get().route) !== null;
}

/** Wire hardware/gesture back (shell) and keyboard. SCAFFOLD STUB — WP2 implements. */
export function initBackNav(): void {}
