import type { AdventureLevelProgress, AdventureProgress, AppState, Profile, Settings, WorldId } from '../learning/types';
import { DEFAULT_COMPETITION, DEFAULT_SETTINGS } from '../learning/types';
import { LEVEL_BY_ID, WORLD_BY_ID } from '../adventure/levels';
import { emptyAdventure } from '../adventure/progress';
import { isValidDateStr } from '../learning/dates';
import { getTemplate } from '../engine/registry';
import { cleanFlightStats } from '../flight/rewards';
import { SUBSKILL_BY_ID } from '../curriculum/curriculum';

export const SCHEMA_VERSION = 1;
export const EXPORT_KIND = 'mathbee-coach-export';

export function emptyState(): AppState {
  return { schemaVersion: SCHEMA_VERSION, profiles: [], activeProfileId: null, music: true };
}

export function newProfile(id: string, avatar: string, nickname: string, language: 'en' | 'ta', today: string): Profile {
  return {
    id,
    avatar,
    nickname: nickname.slice(0, 20),
    grade: 1,
    language,
    createdAt: today,
    familiarised: false,
    settings: structuredClone(DEFAULT_SETTINGS),
    competition: { ...DEFAULT_COMPETITION },
    attempts: [],
    reviews: {},
    sessions: [],
    nectar: 0,
    awarded: [],
    garden: [],
    stickersSeen: [],
    levelSeen: 0,
    treasures: [],
    beeHat: null,
    screened: [],
    adventure: emptyAdventure(),
    activeSession: null,
    activeMock: null,
    mockHistory: [],
  };
}

/** Migrate older schema versions forward. Version 1 is the first release. */
export function migrate(raw: unknown): AppState {
  const r = raw as Partial<AppState>;
  if (!r || typeof r !== 'object') throw new Error('not an object');
  const v = typeof r.schemaVersion === 'number' ? r.schemaVersion : 0;
  if (v > SCHEMA_VERSION) throw new Error(`data is from a newer version (${v})`);
  // v0 → v1: nothing existed before v1; accept a bare profiles array shape.
  const state: AppState = { schemaVersion: SCHEMA_VERSION, profiles: Array.isArray(r.profiles) ? r.profiles : [], activeProfileId: r.activeProfileId ?? null, music: r.music !== false };
  state.profiles = state.profiles.map(fillDefaults);
  if (state.activeProfileId && !state.profiles.some((p) => p.id === state.activeProfileId)) state.activeProfileId = null;
  return state;
}

function fillDefaults(p: Profile): Profile {
  return {
    ...newProfile(p.id, p.avatar, p.nickname ?? '', p.language ?? 'en', p.createdAt ?? '2026-01-01'),
    ...p,
    settings: cleanSettings({ ...DEFAULT_SETTINGS, ...(p.settings ?? {}), mastery: { ...DEFAULT_SETTINGS.mastery, ...(p.settings?.mastery ?? {}) } }),
    competition: { ...DEFAULT_COMPETITION, ...(p.competition ?? {}) },
    // fun extras: keep only well-formed entries (imports are untrusted)
    treasures: Array.isArray(p.treasures)
      ? p.treasures.filter((t) => t && isValidDateStr(t.date) && typeof t.id === 'string' && t.id.length <= 8).slice(0, 5000)
      : [],
    beeHat: typeof p.beeHat === 'string' && p.beeHat.length <= 8 ? p.beeHat : null,
    adventure: cleanAdventure(p.adventure),
    // Bee Flight totals stay optional: absent until the first finished flight
    flight: cleanFlightStats(p.flight),
  };
}

const DAILY_LIMITS: Settings['dailyLimitMin'][] = [0, 15, 20, 30];

/** New settings fields are checked like any untrusted input: unknown values fall back to defaults. */
function cleanSettings(s: Settings): Settings {
  return {
    ...s,
    adventureOpenAll: typeof s.adventureOpenAll === 'boolean' ? s.adventureOpenAll : DEFAULT_SETTINGS.adventureOpenAll,
    dailyLimitMin: DAILY_LIMITS.includes(s.dailyLimitMin) ? s.dailyLimitMin : DEFAULT_SETTINGS.dailyLimitMin,
    haptics: typeof s.haptics === 'boolean' ? s.haptics : DEFAULT_SETTINGS.haptics,
  };
}

const count = (v: unknown, max = 1_000_000) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);

/**
 * Adventure progress from a save or an import. Unknown level ids (a level renamed or removed
 * in a later version) are dropped silently so old backups stay importable; stars are clamped
 * to 0–3 and counts to non-negative integers.
 */
export function cleanAdventure(raw: unknown): AdventureProgress {
  const a = raw as Partial<AdventureProgress> | null | undefined;
  if (!a || typeof a !== 'object') return emptyAdventure();
  const levels: Record<string, AdventureLevelProgress> = {};
  if (a.levels && typeof a.levels === 'object') {
    for (const [id, l] of Object.entries(a.levels as Record<string, Partial<AdventureLevelProgress>>)) {
      if (!LEVEL_BY_ID[id] || !l || typeof l !== 'object') continue;
      const maxPetals = count(l.maxPetals, 64);
      levels[id] = {
        stars: Math.min(3, count(l.stars)) as AdventureLevelProgress['stars'],
        bestPetals: Math.min(count(l.bestPetals, 64), maxPetals),
        maxPetals,
        plays: count(l.plays),
        firstClearedOn: isValidDateStr(l.firstClearedOn) ? l.firstClearedOn : null,
        lastPlayedOn: isValidDateStr(l.lastPlayedOn) ? l.lastPlayedOn : null,
        ...(typeof l.lastSessionId === 'string' && l.lastSessionId.length <= 80 ? { lastSessionId: l.lastSessionId } : {}),
      };
    }
  }
  const friends = Array.isArray(a.friendsCelebrated) ? a.friendsCelebrated.filter((w): w is WorldId => typeof w === 'string' && w in WORLD_BY_ID) : [];
  return {
    version: 1,
    levels,
    friendsCelebrated: [...new Set(friends)],
    lastLevelId: typeof a.lastLevelId === 'string' && LEVEL_BY_ID[a.lastLevelId] ? a.lastLevelId : null,
  };
}

/**
 * Strict validation for imported files. Returns errors; nothing is imported unless empty.
 * Unknown templates or subskills, impossible values and malformed records are rejected.
 */
export function validateImport(data: unknown): { ok: true; state: AppState } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const d = data as { kind?: string; state?: unknown };
  if (!d || typeof d !== 'object' || d.kind !== EXPORT_KIND) return { ok: false, errors: ['This is not a Number Garden backup file.'] };
  const st = d.state as Partial<AppState>;
  if (!st || typeof st !== 'object') return { ok: false, errors: ['Missing state.'] };
  if (typeof st.schemaVersion !== 'number' || st.schemaVersion > SCHEMA_VERSION || st.schemaVersion < 1) errors.push('Unsupported schema version.');
  if (!Array.isArray(st.profiles)) errors.push('Profiles must be a list.');
  const profiles = Array.isArray(st.profiles) ? st.profiles : [];
  if (profiles.length > 20) errors.push('Too many profiles.');
  const ids = new Set<string>();
  profiles.forEach((p, i) => {
    const where = `Profile ${i + 1}`;
    if (!p || typeof p !== 'object') { errors.push(`${where}: not an object.`); return; }
    if (typeof p.id !== 'string' || !p.id) errors.push(`${where}: missing id.`);
    if (ids.has(p.id)) errors.push(`${where}: duplicate id.`);
    ids.add(p.id);
    if (typeof p.nickname !== 'string' || p.nickname.length > 20) errors.push(`${where}: invalid nickname.`);
    if (p.language !== 'en' && p.language !== 'ta') errors.push(`${where}: invalid language.`);
    if (typeof p.nectar !== 'number' || p.nectar < 0 || !Number.isInteger(p.nectar)) errors.push(`${where}: invalid nectar.`);
    if (!Array.isArray(p.attempts)) { errors.push(`${where}: attempts must be a list.`); return; }
    if (p.attempts.length > 100000) errors.push(`${where}: too many attempts.`);
    for (const [j, a] of p.attempts.entries()) {
      const bad = (msg: string) => errors.push(`${where}, attempt ${j + 1}: ${msg}`);
      if (!a || typeof a !== 'object') { bad('not an object'); break; }
      try { getTemplate(a.templateId); } catch { bad(`unknown template ${String(a.templateId)}`); break; }
      if (!SUBSKILL_BY_ID[a.subskill]) { bad(`unknown subskill ${String(a.subskill)}`); break; }
      if (!isValidDateStr(a.date)) { bad('invalid date'); break; }
      if (typeof a.firstCorrect !== 'boolean' || typeof a.independent !== 'boolean') { bad('invalid correctness flags'); break; }
      if (typeof a.activeMs !== 'number' || a.activeMs < 0) { bad('invalid time'); break; }
      if (a.levelId !== undefined && (typeof a.levelId !== 'string' || a.levelId.length > 40)) { bad('invalid level id'); break; }
      if (a.countsAsEvidence !== undefined && a.countsAsEvidence !== false) { bad('invalid evidence flag'); break; }
      if (errors.length > 20) break;
    }
    if (p.reviews && typeof p.reviews === 'object') {
      for (const [k, r] of Object.entries(p.reviews as Record<string, { due?: unknown }>)) {
        if (!SUBSKILL_BY_ID[k] || !isValidDateStr(r?.due)) errors.push(`${where}: invalid review record ${k}.`);
      }
    } else errors.push(`${where}: reviews missing.`);
    if (p.adventure !== undefined && (p.adventure === null || typeof p.adventure !== 'object' || Array.isArray(p.adventure))) errors.push(`${where}: invalid adventure progress.`);
    if (p.flight !== undefined && (p.flight === null || typeof p.flight !== 'object' || Array.isArray(p.flight))) errors.push(`${where}: invalid flight totals.`);
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 25) };
  try {
    return { ok: true, state: migrate(st) };
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
}

export function exportPayload(state: AppState, exportedAt: string) {
  return { kind: EXPORT_KIND, exportedAt, state };
}
