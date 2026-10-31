import { store, type Route } from './store';
import { inShell, keepAwake, onShell, send } from './shell';
import { LEVEL_BY_ID, WORLD_BY_ID } from '../adventure/levels';

/**
 * Back navigation. Android's back gesture, Escape and on-screen back buttons all go through
 * goBack(): first the newest open overlay closes (LIFO), otherwise the route's parent.
 * At a root (map, welcome) the app's root handler shows the "Bye-bye" sheet, whose confirm
 * sends `exitApp`; without a root handler the shell is told it cannot go back, so Android
 * handles the gesture itself.
 */
const overlays: (() => void)[] = [];

/** Register an open overlay (pause sheet, gate, modal, intro). Returns an unregister function. */
export function pushOverlay(close: () => void): () => void {
  overlays.push(close);
  report();
  return () => {
    const i = overlays.lastIndexOf(close);
    if (i >= 0) overlays.splice(i, 1);
    report();
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
    case 'level-results': {
      // back from a level's blooms returns to that level's world map, like the "World map" button
      const world = LEVEL_BY_ID[route.levelId]?.world;
      return world ? { name: 'adventure-world', world } : { name: 'adventure' };
    }
    case 'session': return null; // handled by the session's pause sheet (an overlay)
    case 'results': case 'session-end': return { name: 'map' };
    case 'tests': case 'setup': case 'settings': return { name: 'parent' };
    case 'mock': return null; // MockScreen registers an overlay: back opens its submit / keep-working sheet
    case 'mock-results': case 'print': return { name: 'tests' };
    // during a run the flight screen registers its pause sheet as an overlay, so back opens it first
    case 'flight': return route.world in WORLD_BY_ID ? { name: 'adventure-world', world: route.world } : { name: 'map' };
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

// ---------- root ("Bye-bye") handler ----------
let rootHandler: (() => void) | null = null;

/**
 * Register what back does at a root screen (the app shows its "Bye-bye" sheet as an overlay and
 * sends `exitApp` on confirm). Only one handler is active; returns an unregister function.
 */
export function onRootBack(fn: () => void): () => void {
  rootHandler = fn;
  report();
  return () => {
    if (rootHandler === fn) rootHandler = null;
    report();
  };
}

/** Ask the Android app to close (only after the child confirmed on the Bye-bye sheet). */
export function exitApp(): void {
  send('exitApp');
}

/** Screens where back means "leave the app" (session and mock handle back with their own sheets). */
const ROOT_ROUTES: Route['name'][] = ['welcome', 'map'];
const atRoot = () => overlays.length === 0 && ROOT_ROUTES.includes(store.get().route.name);

/** One back press from the shell or the keyboard. Returns true when something happened. */
export function backPressed(): boolean {
  if (goBack()) return true;
  if (rootHandler && atRoot() && inShell()) { rootHandler(); return true; }
  return false;
}

// ---------- reporting to the shell ----------
/** Routes that keep the screen on while shown (a child is answering questions); back stays in-app there. */
const AWAKE_ROUTES: Route['name'][] = ['session', 'mock'];
let lastReport = '';

/**
 * Tell native where we are and whether back is handled in-app. At a root with a registered
 * root handler, back stays enabled so the Bye-bye sheet can show instead of an instant exit.
 */
function report() {
  if (!inShell()) return;
  const route = store.get().route;
  // in a session or mock test back must never close the app: the screen's own sheet handles it
  const can = canGoBack() || AWAKE_ROUTES.includes(route.name) || (rootHandler !== null && atRoot());
  const key = `${route.name}|${can}`;
  if (key === lastReport) return;
  lastReport = key;
  send('route', { name: route.name, canGoBack: can });
}

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable === true;
}

let wired: (() => void) | null = null;

/** Wire hardware/gesture back (shell), Escape, route reports and keep-awake. Safe to call twice. */
export function initBackNav(): () => void {
  if (wired) return wired;
  const offBack = onShell('back', () => { backPressed(); });
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || isTyping(document.activeElement)) return;
    if (backPressed()) e.preventDefault();
  };
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
  let lastRoute = '';
  const onStore = () => {
    const name = store.get().route.name;
    if (name !== lastRoute) {
      lastRoute = name;
      keepAwake(AWAKE_ROUTES.includes(name));
    }
    report();
  };
  const offStore = store.subscribe(onStore);
  // the native `shell` reply means the bridge is up: (re)send the current state
  const offShell = onShell('shell', () => { lastReport = ''; report(); });
  onStore();
  wired = () => {
    offBack();
    offStore();
    offShell();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    wired = null;
    lastReport = '';
  };
  return wired;
}
