import type { AppState, Profile } from '../learning/types';
import { DEFAULT_COMPETITION, DEFAULT_SETTINGS } from '../learning/types';
import { isValidDateStr } from '../learning/dates';
import { getTemplate } from '../engine/registry';
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
    screened: [],
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
    settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}), mastery: { ...DEFAULT_SETTINGS.mastery, ...(p.settings?.mastery ?? {}) } },
    competition: { ...DEFAULT_COMPETITION, ...(p.competition ?? {}) },
  };
}

/**
 * Strict validation for imported files. Returns errors; nothing is imported unless empty.
 * Unknown templates or subskills, impossible values and malformed records are rejected.
 */
export function validateImport(data: unknown): { ok: true; state: AppState } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const d = data as { kind?: string; state?: unknown };
  if (!d || typeof d !== 'object' || d.kind !== EXPORT_KIND) return { ok: false, errors: ['This is not a MathBee Coach export file.'] };
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
      if (errors.length > 20) break;
    }
    if (p.reviews && typeof p.reviews === 'object') {
      for (const [k, r] of Object.entries(p.reviews as Record<string, { due?: unknown }>)) {
        if (!SUBSKILL_BY_ID[k] || !isValidDateStr(r?.due)) errors.push(`${where}: invalid review record ${k}.`);
      }
    } else errors.push(`${where}: reviews missing.`);
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
