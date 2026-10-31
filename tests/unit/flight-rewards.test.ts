import { describe, it, expect } from 'vitest';
import { FLIGHT_DAILY_CAP, awardGate, canEarnFlightNectar, cleanFlightStats, emptyFlightStats, flightNectarToday, flightStars, flightWorldSummary, recordRun } from '../../src/flight/rewards';
import { flightRun } from '../../src/flight/questions';
import { exportPayload, emptyState, migrate, newProfile, validateImport } from '../../src/persistence/schema';
import type { Profile } from '../../src/learning/types';

const D = '2026-10-31';
const base = (): Profile => newProfile('p', 'bee', 'Ari', 'en', D);

describe('flight nectar', () => {
  it('pays +1 for a first-try gate and +1 for a helped gate', () => {
    let p = base();
    p = awardGate(p, D, 'first', 'meadow:1:0');
    expect(p.nectar).toBe(1);
    p = awardGate(p, D, 'helped', 'meadow:1:1');
    expect(p.nectar).toBe(2);
    expect(p.awarded).toEqual([`flight:${D}#1=meadow:1:0`, `flight:${D}#2=meadow:1:1`]);
    expect(p.attempts).toEqual([]); // flights are play, not assessment
  });

  it('is idempotent per gate', () => {
    let p = base();
    const q = flightRun('town', 42)[3];
    p = awardGate(p, D, 'first', q.id);
    const again = awardGate(p, D, 'first', q.id);
    expect(again).toBe(p);
    expect(awardGate(p, D, 'helped', q.id)).toBe(p);
    expect(flightNectarToday(p, D)).toBe(1);
  });

  it(`stops at ${FLIGHT_DAILY_CAP} a day and starts again the next day`, () => {
    let p = base();
    for (let run = 0; run < 4; run++) for (const q of flightRun('garden', run)) p = awardGate(p, D, run % 2 ? 'helped' : 'first', q.id);
    expect(p.nectar).toBe(FLIGHT_DAILY_CAP);
    expect(flightNectarToday(p, D)).toBe(FLIGHT_DAILY_CAP);
    expect(canEarnFlightNectar(p, D)).toBe(false);
    expect(awardGate(p, D, 'first', 'x:1:1')).toBe(p);
    expect(awardGate(p, D, 'first')).toBe(p);
    const next = awardGate(p, '2026-11-01', 'first', 'x:1:1');
    expect(next.nectar).toBe(FLIGHT_DAILY_CAP + 1);
    expect(flightNectarToday(next, '2026-11-01')).toBe(1);
    expect(canEarnFlightNectar(next, '2026-11-01')).toBe(true);
  });

  it('keys follow flight:${date}#n with n counting up', () => {
    let p = base();
    for (let i = 0; i < 20; i++) p = awardGate(p, D, 'first', `meadow:9:${i}`);
    const keys = p.awarded.filter((k) => k.startsWith(`flight:${D}#`));
    expect(keys).toHaveLength(FLIGHT_DAILY_CAP);
    keys.forEach((k, i) => expect(k.startsWith(`flight:${D}#${i + 1}`)).toBe(true));
  });

  it('other awarded keys do not count toward the cap', () => {
    const p = { ...base(), awarded: ['s1#0', 's1#1', 'adv:w1-01:star1', `flight:2026-10-30#1=a:1:1`] };
    expect(flightNectarToday(p, D)).toBe(0);
    expect(awardGate(p, D, 'first', 'a:1:1').nectar).toBe(1); // yesterday's key for the same id does not block today
  });

  it('ignores invalid dates and results, and never mutates the input', () => {
    const p = base();
    const frozen = JSON.stringify(p);
    expect(awardGate(p, 'not-a-date', 'first', 'a')).toBe(p);
    expect(awardGate(p, D, 'nope' as never, 'a')).toBe(p);
    awardGate(p, D, 'first', 'a');
    expect(JSON.stringify(p)).toBe(frozen);
  });

  it('gate ids cannot forge another day or another gate', () => {
    let p = base();
    p = awardGate(p, D, 'first', 'a#=b c');
    expect(p.awarded[0]).toBe(`flight:${D}#1=abc`);
  });
});

describe('flight totals', () => {
  it('records runs, gates, first tries, helped gates and runs per world', () => {
    let p = base();
    expect(p.flight).toBeUndefined();
    p = recordRun(p, { world: 'meadow', date: D, gates: 8, firstTry: 6, helped: 2 });
    p = recordRun(p, { world: 'town', date: D, gates: 8, firstTry: 8, helped: 0 });
    p = recordRun(p, { world: 'meadow', date: D, gates: 8, firstTry: 5, helped: 3 });
    expect(p.flight).toMatchObject({ runs: 3, gates: 24, firstTry: 19, helped: 5 });
    expect(p.flight!.byWorld.meadow).toBe(2);
    expect(p.flight!.byWorld.town).toBe(1);
    expect(p.flight!.byWorld.ice).toBe(0);
    expect(p.nectar).toBe(0); // nectar is paid per gate, not per run
    expect(p.attempts).toEqual([]);
  });

  it('is idempotent per run id', () => {
    let p = base();
    p = recordRun(p, { world: 'river', date: D, gates: 8, firstTry: 4, helped: 4 }, 'run-1');
    expect(recordRun(p, { world: 'river', date: D, gates: 8, firstTry: 4, helped: 4 }, 'run-1')).toBe(p);
    p = recordRun(p, { world: 'river', date: D, gates: 8, firstTry: 4, helped: 4 }, 'run-2');
    expect(p.flight!.runs).toBe(2);
  });

  it('clamps impossible numbers and ignores unknown worlds', () => {
    let p = base();
    p = recordRun(p, { world: 'ice', date: D, gates: 99, firstTry: 50, helped: -3 });
    expect(p.flight).toMatchObject({ runs: 1, gates: 8, firstTry: 8, helped: 0 });
    p = recordRun(p, { world: 'ice', date: D, gates: 8, firstTry: 3, helped: 9 });
    expect(p.flight).toMatchObject({ gates: 16, firstTry: 11, helped: 5 });
    expect(recordRun(p, { world: 'moon' as never, date: D, gates: 8, firstTry: 8, helped: 0 })).toBe(p);
    expect(recordRun(p, { world: 'ice', date: D, gates: NaN, firstTry: NaN, helped: NaN }).flight).toMatchObject({ runs: 3, gates: 16 });
  });
});

describe('flight totals in saves and imports', () => {
  it('cleanFlightStats keeps good data and repairs bad data', () => {
    expect(cleanFlightStats(undefined)).toBeUndefined();
    expect(cleanFlightStats(null)).toBeUndefined();
    expect(cleanFlightStats([1, 2])).toBeUndefined();
    expect(cleanFlightStats({})).toEqual(emptyFlightStats());
    const c = cleanFlightStats({ runs: 3.7, gates: 10, firstTry: 50, helped: 7, byWorld: { meadow: 2, moon: 5, town: -1 }, lastRunId: 'r1' })!;
    expect(c).toEqual({ runs: 3, gates: 10, firstTry: 10, helped: 0, byWorld: { ...emptyFlightStats().byWorld, meadow: 2 }, lastRunId: 'r1' });
    expect(cleanFlightStats({ runs: 'x', lastRunId: 'y'.repeat(200) })).toEqual(emptyFlightStats());
  });

  it('old saves without flight totals load unchanged; saved totals survive a round trip', () => {
    const p = base();
    const loaded = migrate({ schemaVersion: 1, profiles: [p], activeProfileId: 'p' }).profiles[0];
    expect(loaded.flight).toBeUndefined();
    const flown = recordRun(awardGate(p, D, 'first', 'meadow:1:0'), { world: 'meadow', date: D, gates: 8, firstTry: 7, helped: 1 }, 'r1');
    const again = migrate(JSON.parse(JSON.stringify({ schemaVersion: 1, profiles: [flown], activeProfileId: 'p' }))).profiles[0];
    expect(again.flight).toEqual(flown.flight);
    expect(again.nectar).toBe(1);
    expect(again.awarded).toContain(`flight:${D}#1=meadow:1:0`);
  });

  it('imports sanitise flight totals and reject a malformed one', () => {
    const p = { ...base(), flight: { runs: -5, gates: 'lots', firstTry: 2, helped: 1, byWorld: { garden: 1e12 } } };
    const st = { ...emptyState(), profiles: [p], activeProfileId: 'p' };
    const ok = validateImport(JSON.parse(JSON.stringify(exportPayload(st as never, D))));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const f = ok.state.profiles[0].flight!;
      expect(f.runs).toBe(0);
      expect(f.gates).toBe(0);
      expect(f.firstTry).toBe(0);
      expect(f.byWorld.garden).toBe(10_000_000);
    }
    const bad = validateImport(JSON.parse(JSON.stringify(exportPayload({ ...st, profiles: [{ ...p, flight: [1] }] } as never, D))));
    expect(bad.ok).toBe(false);
  });
});

describe('flight best streak and stars', () => {
  const run = (world: 'meadow' | 'town' | 'ice', firstTry: number, bestCombo: number) => ({ world, date: D, gates: 8, firstTry, helped: 8 - firstTry, bestCombo });

  it('keeps each world\'s best streak and best first-try count at their maxima, and the last world', () => {
    let p = base();
    p = recordRun(p, run('meadow', 5, 3), 'a');
    expect(p.flight!.best).toEqual({ meadow: { combo: 3, firstTry: 5 } });
    expect(p.flight!.lastWorld).toBe('meadow');
    p = recordRun(p, run('meadow', 7, 2), 'b'); // more first tries, shorter streak
    expect(p.flight!.best!.meadow).toEqual({ combo: 3, firstTry: 7 });
    p = recordRun(p, run('meadow', 4, 4), 'c'); // longer streak, fewer first tries
    expect(p.flight!.best!.meadow).toEqual({ combo: 4, firstTry: 7 });
    p = recordRun(p, run('town', 8, 8), 'd');
    expect(p.flight!.best!.town).toEqual({ combo: 8, firstTry: 8 });
    expect(p.flight!.best!.meadow).toEqual({ combo: 4, firstTry: 7 });
    expect(p.flight!.lastWorld).toBe('town');
    // recording the same run again changes nothing
    expect(recordRun(p, run('town', 8, 8), 'd')).toBe(p);
  });

  it('a streak can never be longer than the run\'s first tries; a missing streak counts as 0', () => {
    let p = recordRun(base(), run('ice', 3, 99));
    expect(p.flight!.best!.ice).toEqual({ combo: 3, firstTry: 3 });
    p = recordRun(base(), { world: 'ice', date: D, gates: 8, firstTry: 2, helped: 6 });
    expect(p.flight!.best!.ice).toEqual({ combo: 0, firstTry: 2 });
    p = recordRun(base(), run('ice', 5, -4));
    expect(p.flight!.best!.ice!.combo).toBe(0);
  });

  it('stars: never finished 0, finished 1, 6+ first try 2, all 8 first try 3', () => {
    expect(flightStars(8, false)).toBe(0);
    expect(flightStars(0, true)).toBe(1);
    expect(flightStars(5, true)).toBe(1);
    expect(flightStars(6, true)).toBe(2);
    expect(flightStars(7, true)).toBe(2);
    expect(flightStars(8, true)).toBe(3);
  });

  it('flightWorldSummary gives stars from the best run, the best streak and the runs per world', () => {
    let p = base();
    expect(flightWorldSummary(p, 'meadow')).toEqual({ stars: 0, bestCombo: 0, runs: 0 });
    p = recordRun(p, run('meadow', 0, 0), 'a');
    expect(flightWorldSummary(p, 'meadow')).toEqual({ stars: 1, bestCombo: 0, runs: 1 });
    p = recordRun(p, run('meadow', 6, 4), 'b');
    expect(flightWorldSummary(p, 'meadow')).toEqual({ stars: 2, bestCombo: 4, runs: 2 });
    p = recordRun(p, run('meadow', 3, 1), 'c'); // a weaker run never takes stars away
    expect(flightWorldSummary(p, 'meadow')).toEqual({ stars: 2, bestCombo: 4, runs: 3 });
    p = recordRun(p, run('meadow', 8, 8), 'd');
    expect(flightWorldSummary(p, 'meadow')).toEqual({ stars: 3, bestCombo: 8, runs: 4 });
    expect(flightWorldSummary(p, 'town')).toEqual({ stars: 0, bestCombo: 0, runs: 0 });
    expect(flightWorldSummary(p, 'moon' as never)).toEqual({ stars: 0, bestCombo: 0, runs: 0 });
  });

  it('older saves (totals without best) still give a star for a finished world', () => {
    const p = { ...base(), flight: { ...emptyFlightStats(), runs: 2, gates: 16, firstTry: 9, byWorld: { ...emptyFlightStats().byWorld, river: 2 } } };
    expect(flightWorldSummary(p, 'river')).toEqual({ stars: 1, bestCombo: 0, runs: 2 });
  });

  it('saves and imports keep good bests and repair bad ones', () => {
    const c = cleanFlightStats({
      runs: 3, gates: 24, firstTry: 10, byWorld: { meadow: 3 },
      best: { meadow: { combo: 12, firstTry: 6 }, moon: { combo: 1, firstTry: 1 }, town: 'x', ice: { combo: -1, firstTry: 99 } },
      lastWorld: 'meadow',
    })!;
    expect(c.best).toEqual({ meadow: { combo: 6, firstTry: 6 }, ice: { combo: 0, firstTry: 8 } });
    expect(c.lastWorld).toBe('meadow');
    expect(cleanFlightStats({ best: [1], lastWorld: 'moon' })).toEqual(emptyFlightStats());
    const flown = recordRun(base(), run('town', 7, 5), 'r1');
    const again = migrate(JSON.parse(JSON.stringify({ schemaVersion: 1, profiles: [flown], activeProfileId: 'p' }))).profiles[0];
    expect(again.flight).toEqual(flown.flight);
    expect(flightWorldSummary(again, 'town')).toEqual({ stars: 2, bestCombo: 5, runs: 1 });
  });
});
