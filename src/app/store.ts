import { useSyncExternalStore } from 'react';
import type { AppState, Profile, SessionRecord, MockResult } from '../learning/types';
import type { CategoryId, Mode, Stage } from '../engine/types';
import { Persistence, type StorageMode } from '../persistence/storage';
import { emptyState } from '../persistence/schema';

export type Route =
  | { name: 'welcome' }
  | { name: 'profile-new' }
  | { name: 'profiles' }
  | { name: 'controls' }
  | { name: 'map' }
  | { name: 'category'; category: CategoryId }
  | { name: 'session' }
  | { name: 'results'; record: SessionRecord; newNectar: number }
  | { name: 'restore' }
  | { name: 'stickers' }
  | { name: 'review-due' }
  | { name: 'tests' }
  | { name: 'mock' }
  | { name: 'mock-results'; result: MockResult }
  | { name: 'print'; categories: CategoryId[]; count: number; seed: number }
  | { name: 'parent' }
  | { name: 'setup' }
  | { name: 'settings' };

export interface Store {
  ready: boolean;
  app: AppState;
  route: Route;
  storage: StorageMode;
  storageError: string | null;
  updateReady: boolean;
  /** remembered for "practise this stage" launches */
  lastLaunch?: { mode: Mode; category?: CategoryId; stage?: Stage; subskill?: string };
}

const persistence = new Persistence();
let state: Store = { ready: false, app: emptyState(), route: { name: 'welcome' }, storage: 'memory', storageError: null, updateReady: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async init() {
    const app = await persistence.load();
    state = { ...state, ready: true, app, storage: persistence.mode, storageError: persistence.lastError };
    emit();
  },
  setRoute(route: Route) {
    state = { ...state, route };
    emit();
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 });
  },
  setUpdateReady(v: boolean) {
    state = { ...state, updateReady: v };
    emit();
  },
  /** Replace app state and persist it as one document. */
  setApp(app: AppState) {
    state = { ...state, app };
    emit();
    void persistence.save(app).then(() => {
      if (persistence.mode !== state.storage || persistence.lastError !== state.storageError) {
        state = { ...state, storage: persistence.mode, storageError: persistence.lastError };
        emit();
      }
    });
  },
  updateProfile(fn: (p: Profile) => Profile) {
    const id = state.app.activeProfileId;
    if (!id) return;
    store.setApp({ ...state.app, profiles: state.app.profiles.map((p) => (p.id === id ? fn(p) : p)) });
  },
  /** Toggle background music (called from a tap, so playback may start right away). */
  setMusic(on: boolean) {
    store.setApp({ ...state.app, music: on });
  },
  setLastLaunch(l: Store['lastLaunch']) {
    state = { ...state, lastLaunch: l };
  },
  async resetAll() {
    await persistence.clear();
    state = { ...state, app: emptyState(), route: { name: 'welcome' } };
    emit();
  },
};

export function useStore<T>(sel: (s: Store) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state), () => sel(state));
}

export function useProfile(): Profile | null {
  return useStore((s) => s.app.profiles.find((p) => p.id === s.app.activeProfileId) ?? null);
}

export function newId(prefix: string): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${r}`;
}
