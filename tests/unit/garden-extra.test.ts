import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GARDEN_ITEMS, CATEGORIES } from '../../src/curriculum/curriculum';
import { recordRun } from '../../src/flight/rewards';
import { flightInsights, weakestWorld, FLIGHT_WORLD_ORDER, type FlightWorldRow } from '../../src/report/flightReport';
import { GardenMapScreen, currentFlightWorld, withNextFlightWorld } from '../../src/screens/GardenScreens';
import { ParentDashboard } from '../../src/screens/ParentScreens';
import { newProfile } from '../../src/persistence/schema';
import { store } from '../../src/app/store';
import type { Profile } from '../../src/learning/types';
import type { FlightWorld } from '../../src/flight/types';
import { EN, TA } from '../../src/i18n/packs/garden-extra';

const D = '2026-10-31';
const base = (): Profile => newProfile('p', 'bee', 'Ari', 'en', D);
const run = (p: Profile, world: FlightWorld, firstTry: number, bestCombo: number, id: string) =>
  recordRun(p, { world, date: D, gates: 8, firstTry, helped: 8 - firstTry, bestCombo }, id);

describe('garden items: daisy, mushroom and tulip', () => {
  it('are in the shop, priced in this economy, named in English and Tamil', () => {
    const daisy = GARDEN_ITEMS.find((g) => g.id === 'daisy');
    const mush = GARDEN_ITEMS.find((g) => g.id === 'mushroom');
    expect(daisy).toMatchObject({ sprite: 'daisy', cost: 7 });
    expect(mush).toMatchObject({ sprite: 'mushroom', cost: 9 });
    const tulip = GARDEN_ITEMS.find((g) => g.id === 'tulip');
    expect(tulip).toMatchObject({ sprite: 'tulip', cost: 10 });
    const costs = GARDEN_ITEMS.map((g) => g.cost);
    for (const g of [daisy!, mush!, tulip!]) {
      expect(g.cost).toBeGreaterThanOrEqual(Math.min(...costs));
      expect(g.cost).toBeLessThanOrEqual(Math.max(...costs));
      expect(EN[`garden.${g.id}`]).toBeTruthy();
      expect(TA[`garden.${g.id}`]).toBeTruthy();
    }
  });

  it('ids are unique and every map spot stays on the map, clear of other items and the places', () => {
    expect(new Set(GARDEN_ITEMS.map((g) => g.id)).size).toBe(GARDEN_ITEMS.length);
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    for (const id of ['daisy', 'mushroom', 'tulip']) {
      const g = GARDEN_ITEMS.find((x) => x.id === id)!;
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x).toBeLessThanOrEqual(100);
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.y).toBeLessThanOrEqual(100);
      for (const o of GARDEN_ITEMS) if (o.id !== id) expect(dist(g, o), `${id} vs ${o.id}`).toBeGreaterThanOrEqual(10);
      for (const c of CATEGORIES) expect(dist(g, c.map), `${id} vs ${c.id}`).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('garden card: current flight world', () => {
  it('uses the chosen world, else the fallback; unknown values fall back', () => {
    const p = base();
    expect(currentFlightWorld(p, 'meadow')).toBe('meadow');
    expect(currentFlightWorld(p, 'river')).toBe('river');
    const q = withNextFlightWorld(p, 'ice');
    expect(currentFlightWorld(q, 'meadow')).toBe('ice');
    const bad = { ...p, flight: { ...q.flight!, lastWorld: 'moon' as never } };
    expect(currentFlightWorld(bad, 'town')).toBe('town');
  });

  it('choosing a world keeps every flight total and changes nothing else', () => {
    let p = run(base(), 'meadow', 7, 5, 'r1');
    const q = withNextFlightWorld(p, 'trail');
    expect(q.flight).toEqual({ ...p.flight, lastWorld: 'trail' });
    expect(q.nectar).toBe(p.nectar);
    expect(withNextFlightWorld(p, 'moon' as never)).toBe(p);
    // a first choice before any flight starts empty totals
    p = withNextFlightWorld(base(), 'orchard');
    expect(p.flight).toMatchObject({ runs: 0, gates: 0, firstTry: 0, lastWorld: 'orchard' });
  });

  it('renders the card with art, friend, Fly (flight-btn), Change world and My garden', () => {
    const p = run(base(), 'river', 8, 6, 'r2');
    store.setApp({ ...store.get().app, profiles: [{ ...p, familiarised: true }], activeProfileId: p.id });
    const out = renderToStaticMarkup(createElement(GardenMapScreen));
    expect(out).toContain('data-testid="flight-card"');
    expect(out).toContain('data-world="river"');
    expect(out).toContain('data-testid="flight-btn"');
    expect(out).toContain('data-testid="flight-card-world"');
    expect(out).toContain('data-testid="restore"');
    expect(out).toContain('data-stars="3"');
    expect(out).toContain('🔥 6');
    expect(out.match(/data-testid="flight-btn"/g)).toHaveLength(1);
    expect(out.match(/data-testid="restore"/g)).toHaveLength(1);
  });

  it('an unflown world says "new" instead of showing empty stars or a zero streak', () => {
    const p = base();
    store.setApp({ ...store.get().app, profiles: [p], activeProfileId: p.id });
    const out = renderToStaticMarkup(createElement(GardenMapScreen));
    expect(out).toContain('data-world="meadow"');
    expect(out).not.toContain('flight-card-stars');
    expect(out).not.toContain('flight-card-streak');
  });
});

describe('parent Bee Flight insights', () => {
  it('is empty before any flight', () => {
    const f = flightInsights(base());
    expect(f).toMatchObject({ runs: 0, gates: 0, firstTryPct: null, weakest: null });
    expect(f.rows.map((r) => r.world)).toEqual(FLIGHT_WORLD_ORDER);
    expect(f.rows.every((r) => r.share === null && r.runs === 0)).toBe(true);
  });

  it('counts runs and gates per world, best first-try share as a bar, and picks the weakest world', () => {
    let p = base();
    p = run(p, 'meadow', 8, 8, 'a');
    p = run(p, 'river', 4, 2, 'b');
    p = run(p, 'river', 5, 3, 'c');
    p = run(p, 'ice', 6, 4, 'd');
    const f = flightInsights(p);
    expect(f.runs).toBe(4);
    expect(f.gates).toBe(32);
    expect(f.firstTryPct).toBe(Math.round((100 * 23) / 32));
    const river = f.rows.find((r) => r.world === 'river')!;
    expect(river).toMatchObject({ runs: 2, gates: 16, bestFirstTry: 5, share: 5 / 8 });
    expect(f.rows.find((r) => r.world === 'meadow')!.share).toBe(1);
    expect(f.rows.find((r) => r.world === 'town')!).toMatchObject({ runs: 0, share: null });
    expect(f.weakest).toBe('river');
    // no response-time metric anywhere
    expect(JSON.stringify(f)).not.toMatch(/ms|speed|time/i);
  });

  it('weakest: ties go to the world flown less; perfect worlds are never weakest', () => {
    const row = (world: FlightWorldRow['world'], share: number | null, runs: number): FlightWorldRow => ({ world, runs, gates: runs * 8, bestFirstTry: share === null ? null : share * 8, share, stars: 1 });
    expect(weakestWorld([row('meadow', 0.5, 3), row('river', 0.5, 1)])).toBe('river');
    expect(weakestWorld([row('meadow', 1, 3), row('river', null, 2)])).toBeNull();
    expect(weakestWorld([row('meadow', 1, 3), row('ice', 0.875, 1)])).toBe('ice');
  });

  it('every world has a plain-language tip in English and Tamil', () => {
    for (const w of FLIGHT_WORLD_ORDER) {
      expect(EN[`gx.p.tip.${w}`]).toBeTruthy();
      expect(TA[`gx.p.tip.${w}`]).toBeTruthy();
    }
  });

  it('the dashboard shows the Bee Flight section with bars and one tip', () => {
    let p = run(base(), 'orchard', 3, 2, 'x');
    p = run(p, 'meadow', 7, 7, 'y');
    store.setApp({ ...store.get().app, profiles: [p], activeProfileId: p.id });
    const out = renderToStaticMarkup(createElement(ParentDashboard));
    expect(out).toContain('data-testid="parent-flight"');
    expect(out).toContain('data-testid="parent-flight-orchard"');
    expect(out).toContain('width:38%');
    expect(out.match(/data-testid="parent-flight-tip"/g)).toHaveLength(1);
    expect(out).toContain(EN['gx.p.tip.orchard'].slice(0, 20));
  });
});

beforeAll(() => {
  // GardenMapScreen and ParentDashboard read the active profile from the store
  const p = base();
  store.setApp({ ...store.get().app, profiles: [p], activeProfileId: p.id });
});
