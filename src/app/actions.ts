import { store, newId } from './store';
import { createRng, freshSeed } from '../engine/rng';
import type { CategoryId, Mode, Stage } from '../engine/types';
import type { Profile, Slot, MockConfig } from '../learning/types';
import { todayStr } from '../learning/dates';
import { planAssessment, planCategoryPractice, planDaily, planFluency, planLesson, planPractice, planReview, planWorksheet, questionCount } from '../learning/planner';
import { endSession, startSession } from '../learning/session';
import { createMock, scoreMock } from '../mock/mockEngine';
import { GARDEN_ITEMS } from '../curriculum/curriculum';
import { newProfile } from '../persistence/schema';

function active(): Profile | null {
  const s = store.get();
  return s.app.profiles.find((p) => p.id === s.app.activeProfileId) ?? null;
}

export function createProfile(avatar: string, nickname: string, language: 'en' | 'ta') {
  const id = newId('p');
  const p = newProfile(id, avatar, nickname.trim(), language, todayStr());
  const app = store.get().app;
  store.setApp({ ...app, profiles: [...app.profiles, p], activeProfileId: id });
  store.setRoute({ name: 'controls' });
}

export function selectProfile(id: string) {
  const app = store.get().app;
  store.setApp({ ...app, activeProfileId: id });
  const p = app.profiles.find((x) => x.id === id);
  store.setRoute(p?.activeSession ? { name: 'session' } : p?.activeMock && !p.activeMock.submitted ? { name: 'mock' } : { name: 'map' });
}

export interface LaunchOpts { category?: CategoryId; stage?: Stage; subskill?: string; categories?: CategoryId[] }

/** Build a plan for a mode and start it. Returns false if there is nothing to do (e.g. no reviews due). */
export function launch(mode: Mode, opts: LaunchOpts = {}): boolean {
  const p = active();
  if (!p) return false;
  const rng = createRng(freshSeed());
  const today = todayStr();
  const n = questionCount(p.settings.sessionMinutes);
  let plan: Slot[] = [];
  switch (mode) {
    case 'assessment': plan = planAssessment(rng, p); break;
    case 'lesson': plan = opts.subskill ? planLesson(rng, opts.subskill) : []; break;
    case 'practice':
      plan = opts.subskill ? planPractice(rng, opts.subskill, Math.min(n, 6)) : opts.category && opts.stage ? planCategoryPractice(rng, p, opts.category, opts.stage, Math.min(n, 6)) : [];
      break;
    case 'daily': plan = planDaily(rng, p, today); break;
    case 'review': plan = planReview(rng, p, today, n); break;
    case 'fluency': plan = opts.subskill ? planFluency(rng, opts.subskill) : []; break;
    case 'worksheet': plan = planWorksheet(rng, p, opts.categories ?? [], Math.min(n, 8)); break;
    default: plan = [];
  }
  if (!plan.length) return false;
  store.setLastLaunch({ mode, category: opts.category, stage: opts.stage, subskill: opts.subskill });
  store.updateProfile((pr) => startSession(pr, newId('s'), mode, plan, Date.now(), { category: opts.category, subskill: opts.subskill }));
  store.setRoute({ name: 'session' });
  return true;
}

/** Finish or stop the running session (stopping early has no penalty). */
export function closeSession() {
  const p = active();
  if (!p?.activeSession) return;
  const { profile, record } = endSession(p, todayStr(), Date.now());
  store.updateProfile(() => profile);
  if (record) store.setRoute({ name: 'results', record, newNectar: record.nectar });
  else store.setRoute({ name: 'map' });
}

export function restoreItem(id: string) {
  const item = GARDEN_ITEMS.find((g) => g.id === id);
  store.updateProfile((p) => {
    if (!item || p.garden.includes(id) || p.nectar < item.cost) return p;
    return { ...p, nectar: p.nectar - item.cost, garden: [...p.garden, id] };
  });
}

export function markFamiliarised() {
  store.updateProfile((p) => ({ ...p, familiarised: true }));
}

export function startMock(config: MockConfig) {
  const m = createMock(createRng(freshSeed()), newId('m'), config, Date.now());
  store.updateProfile((p) => ({ ...p, activeMock: m }));
  store.setRoute({ name: 'mock' });
}

export function submitMock() {
  const p = active();
  const m = p?.activeMock;
  if (!p || !m || m.submitted) return;
  const { result, attempts } = scoreMock(m, todayStr());
  store.updateProfile((pr) => ({
    ...pr,
    activeMock: null,
    mockHistory: [...pr.mockHistory.filter((r) => r.id !== result.id), result],
    attempts: [...pr.attempts.filter((a) => a.sessionId !== m.id), ...attempts],
  }));
  store.setRoute({ name: 'mock-results', result });
}
