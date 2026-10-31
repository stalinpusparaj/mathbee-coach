import type { FlightStats, Profile } from '../learning/types';
import { isValidDateStr } from '../learning/dates';
import { GATES_PER_RUN, type FlightRunResult, type FlightWorld } from './types';

/**
 * Bee Flight rewards. Flights are play, not assessment: they never write Attempts. Each gate
 * solved pays +1 nectar (first try or with help — never less for needing help), at most
 * FLIGHT_DAILY_CAP per day. Paid gates are recorded in `profile.awarded` as
 * `flight:${date}#${n}=${gateId}` (n = 1…16), so the daily count is the number of keys with
 * the prefix `flight:${date}#` and the same gate is never paid twice.
 */

export const FLIGHT_DAILY_CAP = 16;
export const NECTAR_PER_GATE = 1;

const WORLDS: FlightWorld[] = ['meadow', 'river', 'orchard', 'ice', 'trail', 'town', 'garden'];

const dayPrefix = (date: string) => `flight:${date}#`;

/** Flight nectar already paid on `date`. */
export function flightNectarToday(profile: Profile, date: string): number {
  const prefix = dayPrefix(date);
  return profile.awarded.filter((k) => k.startsWith(prefix)).length;
}

/** True while today's flight nectar is below the cap. */
export function canEarnFlightNectar(profile: Profile, date: string): boolean {
  return flightNectarToday(profile, date) < FLIGHT_DAILY_CAP;
}

/** A gate's award key part: the question id (`${world}:${seed}:${index}`) is unique per run. */
const cleanGateId = (id: string) => id.replace(/[#=\s]/g, '').slice(0, 60);

/**
 * Pay the nectar for one gate. `result` is 'first' (flown through first try) or 'helped'
 * (solved after "Let's look with Buzzy") — both pay the same. Idempotent per `gateId` (pass the
 * question id): calling again for the same gate returns the profile unchanged. Over the daily
 * cap, or for an invalid date, nothing is paid (the run itself goes on as normal).
 */
export function awardGate(profile: Profile, date: string, result: 'first' | 'helped', gateId?: string): Profile {
  if (!isValidDateStr(date) || (result !== 'first' && result !== 'helped')) return profile;
  const prefix = dayPrefix(date);
  const today = profile.awarded.filter((k) => k.startsWith(prefix));
  const gid = gateId !== undefined ? cleanGateId(gateId) : '';
  if (gid && today.some((k) => k.endsWith(`=${gid}`))) return profile;
  if (today.length >= FLIGHT_DAILY_CAP) return profile;
  const key = `${prefix}${today.length + 1}${gid ? `=${gid}` : ''}`;
  return { ...profile, nectar: profile.nectar + NECTAR_PER_GATE, awarded: [...profile.awarded, key] };
}

export function emptyFlightStats(): FlightStats {
  return { runs: 0, gates: 0, firstTry: 0, helped: 0, byWorld: Object.fromEntries(WORLDS.map((w) => [w, 0])) as Record<FlightWorld, number> };
}

const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);

/**
 * Add one finished run to `profile.flight`. Numbers are clamped (gates ≤ GATES_PER_RUN,
 * firstTry + helped ≤ gates). With `runId`, recording the same run twice is a no-op.
 * Nectar is not paid here (see awardGate).
 */
export function recordRun(profile: Profile, result: FlightRunResult, runId?: string): Profile {
  if (!WORLDS.includes(result.world)) return profile;
  const prev = profile.flight ?? emptyFlightStats();
  if (runId !== undefined && prev.lastRunId === runId) return profile;
  const gates = int(result.gates, GATES_PER_RUN);
  const firstTry = int(result.firstTry, gates);
  const helped = int(result.helped, gates - firstTry);
  const byWorld = { ...emptyFlightStats().byWorld, ...prev.byWorld };
  byWorld[result.world] = (byWorld[result.world] ?? 0) + 1;
  // a streak is a run of first-try gates, so it can never be longer than the first tries
  const combo = int(result.bestCombo, firstTry);
  const was = prev.best?.[result.world];
  const best = { ...prev.best, [result.world]: { combo: Math.max(was?.combo ?? 0, combo), firstTry: Math.max(was?.firstTry ?? 0, firstTry) } };
  const flight: FlightStats = {
    runs: prev.runs + 1,
    gates: prev.gates + gates,
    firstTry: prev.firstTry + firstTry,
    helped: (prev.helped ?? 0) + helped,
    byWorld,
    best,
    lastWorld: result.world,
    ...(runId !== undefined ? { lastRunId: runId.slice(0, 80) } : {}),
  };
  return { ...profile, flight };
}

/** Flight totals from a save or an import: unknown worlds dropped, counts clamped. */
export function cleanFlightStats(raw: unknown): FlightStats | undefined {
  const f = raw as Partial<FlightStats> | null | undefined;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return undefined;
  const MAX = 10_000_000;
  const gates = int(f.gates, MAX);
  const firstTry = int(f.firstTry, gates);
  const out: FlightStats = {
    runs: int(f.runs, MAX),
    gates,
    firstTry,
    helped: int(f.helped, gates - firstTry),
    byWorld: emptyFlightStats().byWorld,
  };
  if (f.byWorld && typeof f.byWorld === 'object') {
    for (const w of WORLDS) out.byWorld[w] = int((f.byWorld as Record<string, unknown>)[w], MAX);
  }
  if (typeof f.lastRunId === 'string' && f.lastRunId.length <= 80) out.lastRunId = f.lastRunId;
  if (f.best && typeof f.best === 'object' && !Array.isArray(f.best)) {
    const best: NonNullable<FlightStats['best']> = {};
    for (const w of WORLDS) {
      const b = (f.best as Record<string, unknown>)[w] as { combo?: unknown; firstTry?: unknown } | null | undefined;
      if (!b || typeof b !== 'object' || Array.isArray(b)) continue;
      const ft = int(b.firstTry, GATES_PER_RUN);
      best[w] = { combo: int(b.combo, ft), firstTry: ft };
    }
    if (Object.keys(best).length) out.best = best;
  }
  if (typeof f.lastWorld === 'string' && (WORLDS as string[]).includes(f.lastWorld)) out.lastWorld = f.lastWorld;
  return out;
}

export interface FlightWorldSummary {
  /** 0 = never finished; 1 = finished; 2 = 6+ gates first try in one run; 3 = all 8 */
  stars: 0 | 1 | 2 | 3;
  /** longest first-try streak in any finished run of this world */
  bestCombo: number;
  /** finished runs in this world */
  runs: number;
}

/** Stars for a world from its best first-try count in one finished run. */
export function flightStars(bestFirstTry: number, finished: boolean): 0 | 1 | 2 | 3 {
  if (!finished) return 0;
  if (bestFirstTry >= GATES_PER_RUN) return 3;
  if (bestFirstTry >= 6) return 2;
  return 1;
}

/** One flight world at a glance (the garden map card, the parent dashboard). */
export function flightWorldSummary(p: Profile, world: FlightWorld): FlightWorldSummary {
  const f = p.flight;
  if (!f || !WORLDS.includes(world)) return { stars: 0, bestCombo: 0, runs: 0 };
  const runs = f.byWorld?.[world] ?? 0;
  const best = f.best?.[world];
  return { stars: flightStars(best?.firstTry ?? 0, runs > 0 || !!best), bestCombo: best?.combo ?? 0, runs };
}
