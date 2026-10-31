import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Route } from '../../src/app/store';

/** Stub of the Android bridge object; returns what was sent and a way to send native messages. */
type Sent = Record<string, unknown> & { type: string };
function installShell() {
  const sent: Sent[] = [];
  const keyListeners: ((e: unknown) => void)[] = [];
  const stub = {
    onmessage: null as ((e: { data: unknown }) => void) | null,
    postMessage(s: string) { sent.push(JSON.parse(s) as Sent); },
  };
  const deliver = (m: Record<string, unknown>) => stub.onmessage?.({ data: JSON.stringify({ v: 1, ...m }) });
  const g = globalThis as Record<string, unknown>;
  g.window = {
    MathBeeAndroid: stub,
    addEventListener: (t: string, fn: (e: unknown) => void) => { if (t === 'keydown') keyListeners.push(fn); },
    removeEventListener: (t: string, fn: (e: unknown) => void) => { const i = keyListeners.indexOf(fn); if (t === 'keydown' && i >= 0) keyListeners.splice(i, 1); },
    scrollTo() {},
  };
  const doc = { activeElement: null as unknown, documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {} } }, addEventListener() {} };
  g.document = doc;
  const press = (key: string) => {
    const e = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    keyListeners.forEach((l) => l(e));
    return e.defaultPrevented;
  };
  return { sent, deliver, press, doc };
}

const g = globalThis as Record<string, unknown>;
beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  delete g.window;
  delete g.document;
});

async function load() {
  const shell = await import('../../src/app/shell');
  const { store } = await import('../../src/app/store');
  const nav = await import('../../src/app/backNav');
  void shell.initShell();
  return { shell, store, nav };
}

/** One example of every Route; the type below fails to compile when a route name is missing. */
const record = { id: 's', date: '2026-01-01' } as never;
const ALL: { [K in Route['name']]: Extract<Route, { name: K }> } = {
  welcome: { name: 'welcome' },
  'profile-new': { name: 'profile-new' },
  profiles: { name: 'profiles' },
  controls: { name: 'controls' },
  map: { name: 'map' },
  category: { name: 'category', category: 'C01' },
  session: { name: 'session' },
  results: { name: 'results', record, newNectar: 0 },
  restore: { name: 'restore' },
  stickers: { name: 'stickers' },
  'review-due': { name: 'review-due' },
  tests: { name: 'tests' },
  mock: { name: 'mock' },
  'mock-results': { name: 'mock-results', result: record },
  print: { name: 'print', categories: ['C01'], count: 4, seed: 1 },
  parent: { name: 'parent' },
  setup: { name: 'setup' },
  settings: { name: 'settings' },
  intro: { name: 'intro' },
  adventure: { name: 'adventure' },
  'adventure-world': { name: 'adventure-world', world: 'w1' },
  'level-results': { name: 'level-results', levelId: 'w1-01', record, newNectar: 0, prevStars: 0 },
  'session-end': { name: 'session-end' },
  flight: { name: 'flight', world: 'w1' },
};

describe('parentOf', () => {
  it('covers every route: only the roots and the screens with their own sheets have no parent', async () => {
    const { nav } = await load();
    const noParent = Object.values(ALL).filter((r) => nav.parentOf(r) === null).map((r) => r.name).sort();
    expect(noParent).toEqual(['map', 'mock', 'session', 'welcome']);
  });

  it('Bee Flight goes back to its world map, or the garden map for a theme name', async () => {
    const { nav } = await load();
    expect(nav.parentOf({ name: 'flight', world: 'w3' })).toEqual({ name: 'adventure-world', world: 'w3' });
    expect(nav.parentOf({ name: 'flight', world: 'meadow' })).toEqual({ name: 'map' });
    expect(nav.parentOf({ name: 'flight', world: 'nowhere' })).toEqual({ name: 'map' });
  });

  it('every parent chain ends at a root without loops', async () => {
    const { nav } = await load();
    for (const r of Object.values(ALL)) {
      let cur: Route | null = r;
      for (let i = 0; i < 6 && cur; i++) cur = nav.parentOf(cur);
      expect(cur, r.name).toBeNull();
    }
  });

  it('grown-up screens lead back inside the grown-up area', async () => {
    const { nav } = await load();
    expect(nav.parentOf(ALL.settings)).toEqual({ name: 'parent' });
    expect(nav.parentOf(ALL.print)).toEqual({ name: 'tests' });
    expect(nav.parentOf(ALL['adventure-world'])).toEqual({ name: 'adventure' });
    expect(nav.parentOf(ALL['level-results'])).toEqual({ name: 'adventure-world', world: 'w1' });
  });
});

describe('overlays and goBack', () => {
  it('closes overlays last-in-first-out before changing route', async () => {
    const { nav, store } = await load();
    store.setRoute({ name: 'stickers' });
    const closed: string[] = [];
    let offA = () => undefined as void;
    let offB = () => undefined as void;
    offA = nav.pushOverlay(() => { closed.push('a'); offA(); });
    offB = nav.pushOverlay(() => { closed.push('b'); offB(); });
    expect(nav.canGoBack()).toBe(true);
    expect(nav.goBack()).toBe(true);
    expect(nav.goBack()).toBe(true);
    expect(closed).toEqual(['b', 'a']);
    expect(store.get().route.name).toBe('stickers');
    expect(nav.goBack()).toBe(true);
    expect(store.get().route.name).toBe('map');
    expect(nav.goBack()).toBe(false);
  });

  it('unregistering an overlay that is not on top removes only that one', async () => {
    const { nav, store } = await load();
    store.setRoute({ name: 'map' });
    const closed: string[] = [];
    const offA = nav.pushOverlay(() => closed.push('a'));
    nav.pushOverlay(() => closed.push('b'));
    offA();
    nav.goBack();
    expect(closed).toEqual(['b']);
  });
});

describe('initBackNav with the shell', () => {
  it('reports route and canGoBack on every change, without repeats', async () => {
    const { sent } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    store.setRoute({ name: 'map' });
    store.setRoute({ name: 'stickers' });
    store.setRoute({ name: 'stickers' });
    const off = nav.pushOverlay(() => undefined);
    store.setRoute({ name: 'map' });
    off();
    const routes = sent.filter((m) => m.type === 'route').map((m) => `${m.name}:${m.canGoBack}`);
    expect(routes).toEqual(['welcome:false', 'map:false', 'stickers:true', 'map:true', 'map:false']);
  });

  it('a back message closes the top overlay, then goes to the parent route', async () => {
    const { deliver } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    store.setRoute({ name: 'settings' });
    const close = vi.fn();
    const off = nav.pushOverlay(() => { close(); off(); });
    deliver({ type: 'back' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(store.get().route.name).toBe('settings');
    deliver({ type: 'back' });
    expect(store.get().route.name).toBe('parent');
  });

  it('at the map root, back shows the bye sheet through the root handler (and keeps back enabled)', async () => {
    const { deliver, sent } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    store.setRoute({ name: 'map' });
    const bye = vi.fn();
    const offRoot = nav.onRootBack(bye);
    expect(sent.filter((m) => m.type === 'route').at(-1)).toMatchObject({ name: 'map', canGoBack: true });
    deliver({ type: 'back' });
    expect(bye).toHaveBeenCalledTimes(1);
    nav.exitApp();
    expect(sent.at(-1)).toMatchObject({ type: 'exitApp' });
    offRoot();
    expect(sent.filter((m) => m.type === 'route').at(-1)).toMatchObject({ name: 'map', canGoBack: false });
  });

  it('the root handler never runs outside the roots', async () => {
    const { deliver } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    const bye = vi.fn();
    nav.onRootBack(bye);
    store.setRoute({ name: 'session' });
    deliver({ type: 'back' });
    expect(bye).not.toHaveBeenCalled();
    expect(store.get().route.name).toBe('session');
  });

  it('back stays in-app during a session or mock test, so the system never closes the app there', async () => {
    const { sent } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    store.setRoute({ name: 'session' });
    expect(sent.filter((m) => m.type === 'route').at(-1)).toMatchObject({ name: 'session', canGoBack: true });
    store.setRoute({ name: 'mock' });
    expect(sent.filter((m) => m.type === 'route').at(-1)).toMatchObject({ name: 'mock', canGoBack: true });
  });

  it('keeps the screen awake only in sessions and mock tests', async () => {
    const { sent } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    store.setRoute({ name: 'map' });
    store.setRoute({ name: 'session' });
    store.setRoute({ name: 'results', record, newNectar: 0 });
    store.setRoute({ name: 'mock' });
    store.setRoute({ name: 'mock-results', result: record });
    // the first report states "off" explicitly, then only changes are sent
    expect(sent.filter((m) => m.type === 'keepAwake').map((m) => m.on)).toEqual([false, true, false, true, false]);
  });

  it('Escape goes back unless a text field has focus', async () => {
    const { press, doc } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    store.setRoute({ name: 'stickers' });
    doc.activeElement = { tagName: 'INPUT' };
    expect(press('Escape')).toBe(false);
    expect(store.get().route.name).toBe('stickers');
    doc.activeElement = { tagName: 'BUTTON' };
    expect(press('Enter')).toBe(false);
    expect(press('Escape')).toBe(true);
    expect(store.get().route.name).toBe('map');
  });

  it('initBackNav is idempotent', async () => {
    const { deliver } = installShell();
    const { nav, store } = await load();
    nav.initBackNav();
    nav.initBackNav();
    store.setRoute({ name: 'adventure-world', world: 'w1' });
    deliver({ type: 'back' });
    expect(store.get().route.name).toBe('adventure');
  });
});
