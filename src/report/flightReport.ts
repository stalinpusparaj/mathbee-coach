import type { Profile } from '../learning/types';
import type { FlightWorld } from '../flight/types';
import { GATES_PER_RUN } from '../flight/types';
import { flightWorldSummary } from '../flight/rewards';

/** The seven flight worlds in adventure order. */
export const FLIGHT_WORLD_ORDER: FlightWorld[] = ['meadow', 'river', 'orchard', 'ice', 'trail', 'town', 'garden'];

export interface FlightWorldRow {
  world: FlightWorld;
  /** finished flights in this world */
  runs: number;
  /** gates flown in finished flights (every finished flight has GATES_PER_RUN gates) */
  gates: number;
  /** most first-try gates in one finished flight; null when not recorded (unflown, or flown before it was saved) */
  bestFirstTry: number | null;
  /** bestFirstTry / GATES_PER_RUN (0…1), null when unknown */
  share: number | null;
  stars: 0 | 1 | 2 | 3;
}

export interface FlightInsights {
  runs: number;
  gates: number;
  firstTry: number;
  /** firstTry / gates over all flights, rounded percent; null before any gate */
  firstTryPct: number | null;
  rows: FlightWorldRow[];
  /** world to suggest flying together next: the flown world with the lowest best first-try share (below a perfect flight) */
  weakest: FlightWorld | null;
}

/**
 * Bee Flight for the grown-ups' dashboard. Only counts and first-try shares: speed is never
 * measured. Flights write no Attempts, so this reads `profile.flight` alone.
 */
export function flightInsights(p: Profile): FlightInsights {
  const f = p.flight;
  const rows: FlightWorldRow[] = FLIGHT_WORLD_ORDER.map((world) => {
    const s = flightWorldSummary(p, world);
    const best = f?.best?.[world];
    const bestFirstTry = best ? Math.min(GATES_PER_RUN, best.firstTry) : null;
    return {
      world,
      runs: s.runs,
      gates: s.runs * GATES_PER_RUN,
      bestFirstTry,
      share: bestFirstTry === null ? null : bestFirstTry / GATES_PER_RUN,
      stars: s.stars,
    };
  });
  const runs = f?.runs ?? 0;
  const gates = f?.gates ?? 0;
  const firstTry = Math.min(gates, f?.firstTry ?? 0);
  return { runs, gates, firstTry, firstTryPct: gates ? Math.round((100 * firstTry) / gates) : null, rows, weakest: weakestWorld(rows) };
}

/**
 * Lowest best first-try share among flown worlds with a recorded best; a tie goes to the world
 * flown less (it has had less practice), then to the earlier world. Null when every recorded
 * world already had a perfect flight, or nothing is recorded.
 */
export function weakestWorld(rows: FlightWorldRow[]): FlightWorld | null {
  let pick: FlightWorldRow | null = null;
  for (const r of rows) {
    if (r.share === null || r.share >= 1) continue;
    if (!pick || r.share < pick.share! || (r.share === pick.share && r.runs < pick.runs)) pick = r;
  }
  return pick?.world ?? null;
}
