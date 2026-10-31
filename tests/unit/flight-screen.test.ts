import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Flight2D, FlightScreen, LANES, SWIPE_PX, backRouteFor, flightTheme, flyThrough, laneFromPoint, laneWordsOk, lookPick, runStart, steer, swipeDir,
} from '../../src/screens/FlightScreen';
import { CRUISE_SPEED, HOLD_AT, LANE_X, NEAR_SPEED, SLOW_FROM, badgeScale, flightSpeed, laneAt, rowSpeed } from '../../src/three/Flight3D';
import { badgeRows, clockAngles, drawGateVisual, groupRows, visualText } from '../../src/three/gateArt';
import { correctLane, flightQuestion } from '../../src/flight/questions';
import { GATES_PER_RUN, type GateVisual } from '../../src/flight/types';
import { store } from '../../src/app/store';
import { newProfile } from '../../src/persistence/schema';

describe('lane steering helpers', () => {
  it('steer stays on the three-lane path', () => {
    expect(steer(1, -1)).toBe(0);
    expect(steer(0, -1)).toBe(0);
    expect(steer(1, 1)).toBe(2);
    expect(steer(2, 1)).toBe(2);
  });

  it('a tap picks the lane under the finger', () => {
    expect(laneFromPoint(10, 300)).toBe(0);
    expect(laneFromPoint(150, 300)).toBe(1);
    expect(laneFromPoint(299, 300)).toBe(2);
    expect(laneFromPoint(300, 300)).toBe(2);
    expect(laneFromPoint(-5, 300)).toBe(0);
    expect(laneFromPoint(50, 0)).toBe(1);
  });

  it('only a clearly horizontal swipe steers', () => {
    expect(swipeDir(-SWIPE_PX, 0)).toBe(-1);
    expect(swipeDir(SWIPE_PX + 10, 5)).toBe(1);
    expect(swipeDir(SWIPE_PX - 1, 0)).toBe(0);
    expect(swipeDir(60, 80)).toBe(0); // mostly vertical: a scroll, not a steer
  });
});

describe('world and back route', () => {
  it('maps adventure worlds and theme names to a flight world', () => {
    expect(flightTheme('w1')).toBe('meadow');
    expect(flightTheme('w6')).toBe('town');
    expect(flightTheme('w7')).toBe('garden');
    expect(flightTheme('bonus')).toBe('garden');
    expect(flightTheme('river')).toBe('river');
    expect(flightTheme('nowhere')).toBe('garden');
  });

  it('goes back to the world map, or the garden map for an unknown world', () => {
    expect(backRouteFor('w3')).toEqual({ name: 'adventure-world', world: 'w3' });
    expect(backRouteFor('meadow')).toEqual({ name: 'map' });
  });
});

describe('run state', () => {
  const q = flightQuestion('meadow', 42, 0);
  const right = correctLane(q);
  const other = [0, 1, 2].find((i) => i !== right)!;
  const third = [0, 1, 2].find((i) => i !== right && i !== other)!;

  it('the right gate pays first-try nectar and flies on', () => {
    const out = flyThrough(runStart(42, 'fly'), q, right);
    expect(out.paid).toBe('first');
    expect(out.state).toMatchObject({ phase: 'fly', index: 1, firstTry: 1, combo: 1, lane: right });
  });

  it('a different gate opens "Let\'s look" (no payment, streak quietly reset)', () => {
    const s = { ...runStart(42, 'fly'), combo: 3 };
    const out = flyThrough(s, q, other);
    expect(out.paid).toBeNull();
    expect(out.state.phase).toBe('look');
    expect(out.state.index).toBe(0);
    expect(out.state.combo).toBe(0);
    expect(out.state.tried).toEqual([q.choices[other].id]);
  });

  it('in the sheet, other picks are set aside until the right one is chosen', () => {
    let s = flyThrough(runStart(42, 'fly'), q, other).state;
    const miss = lookPick(s, q, third);
    expect(miss.paid).toBeNull();
    expect(miss.state.phase).toBe('look');
    expect(miss.state.tried).toHaveLength(2);
    s = miss.state;
    const hit = lookPick(s, q, right);
    expect(hit.paid).toBe('helped');
    expect(hit.state).toMatchObject({ phase: 'fly', index: 1, helped: 1, firstTry: 0, tried: [] });
  });

  it('ignores gates while not flying (intro, sheet, results)', () => {
    expect(flyThrough(runStart(1), q, right).paid).toBeNull();
    expect(lookPick(runStart(1, 'fly'), q, right).paid).toBeNull();
  });

  it('a whole run ends at the friend after exactly 8 gates', () => {
    let s = runStart(7, 'fly');
    let firsts = 0;
    for (let i = 0; i < GATES_PER_RUN; i++) {
      const qi = flightQuestion('garden', 7, s.index);
      const out = flyThrough(s, qi, correctLane(qi));
      if (out.paid) firsts++;
      s = out.state;
    }
    expect(firsts).toBe(GATES_PER_RUN);
    expect(s.phase).toBe('finish');
    expect(s.firstTry).toBe(GATES_PER_RUN);
    expect(s.index).toBe(GATES_PER_RUN - 1);
  });
});

describe('3D flight pace (no speed pressure)', () => {
  it('cruises gently and only ever slows near a gate row', () => {
    expect(flightSpeed(null)).toBe(CRUISE_SPEED);
    expect(flightSpeed(SLOW_FROM + 5)).toBe(CRUISE_SPEED);
    expect(flightSpeed(0)).toBe(NEAR_SPEED);
    let prev = flightSpeed(SLOW_FROM);
    for (let d = SLOW_FROM; d >= 0; d -= 0.5) {
      const v = flightSpeed(d);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      expect(v).toBeGreaterThanOrEqual(NEAR_SPEED);
      expect(v).toBeLessThanOrEqual(CRUISE_SPEED);
      prev = v;
    }
  });

  it('the gate flown through is the nearest lane', () => {
    expect(LANE_X).toHaveLength(LANES);
    expect(laneAt(LANE_X[0])).toBe(0);
    expect(laneAt(0.3)).toBe(1);
    expect(laneAt(LANE_X[2] - 0.5)).toBe(2);
    expect(laneAt(-99)).toBe(0);
  });
});

describe('gate art', () => {
  it('groups are laid out in rows of five, like a ten frame', () => {
    expect(groupRows(0)).toEqual([]);
    expect(groupRows(3)).toEqual([3]);
    expect(groupRows(5)).toEqual([5]);
    expect(groupRows(7)).toEqual([5, 2]);
    expect(groupRows(10)).toEqual([5, 5]);
    expect(groupRows(12).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it('clock hands come from the time (hour hand halfway at half past)', () => {
    expect(clockAngles(3, 0)).toEqual({ hour: Math.PI / 2, minute: 0 });
    const half = clockAngles(3, 30);
    expect(half.minute).toBeCloseTo(Math.PI);
    expect(half.hour).toBeCloseTo((3.5 / 12) * Math.PI * 2);
    expect(clockAngles(12, 0).hour).toBe(0);
  });

  it('draws every kind of visual without errors', () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop: () => undefined });
        return (..._args: unknown[]) => { calls.push(prop); };
      },
      set(target, prop: string, v) { target[prop] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const visuals: GateVisual[] = [
      { kind: 'number', n: 17 }, { kind: 'emoji', e: '🍎' }, { kind: 'clock', h: 9, m: 30 }, { kind: 'day', day: 3 }, { kind: 'group', e: '🐝', n: 8 },
      ...(['triangle', 'square', 'rectangle', 'circle', 'pentagon', 'hexagon', 'cube', 'sphere', 'cone', 'cylinder'] as const).map((shape) => ({ kind: 'shape' as const, shape })),
    ];
    for (const v of visuals) {
      expect(() => drawGateVisual(ctx, v, 256, { lang: 'en', badge: true, accent: '#e86a92' })).not.toThrow();
      expect(() => drawGateVisual(ctx, v, 256, { lang: 'ta' })).not.toThrow();
    }
    expect(calls).toContain('ellipse'); // solids draw their curved faces
    expect(calls).toContain('fillText');
  });

  it('describes visuals in words for screen readers', () => {
    expect(visualText({ kind: 'clock', h: 3, m: 30 }, 'en')).toMatch(/3/);
    expect(visualText({ kind: 'day', day: 1 }, 'en')).toBe('Monday');
    expect(visualText({ kind: 'number', n: 7 }, 'en')).toBe('7');
  });
});

describe('FlightScreen', () => {
  beforeAll(() => {
    const p = newProfile('p1', 'bee', 'Mickey', 'en', '2026-10-01');
    store.setApp({ ...store.get().app, profiles: [p], activeProfileId: p.id });
  });

  it('opens on the friend\'s intro card in the world, with the flat flight when 3D is unavailable', () => {
    const out = renderToStaticMarkup(createElement(FlightScreen, { world: 'w1' }));
    expect(out).toContain('data-testid="flight"');
    expect(out).toContain('data-world="meadow"');
    expect(out).toContain('data-testid="flight-intro"');
    expect(out).toContain('data-testid="flight-go"');
    expect(out).toContain('data-3d="0"');
    expect(out).toContain('Mickey');
    // the gates wait until Fly! (the question is not shown yet, so neither are its answers)
    expect(out).not.toContain('data-testid="gate-0"');
    expect(out).toContain('data-testid="pause"');
  });

  it('the flat flight shows three big gate buttons, each described for screen readers', () => {
    const q = flightQuestion('meadow', 7, 0);
    const out = renderToStaticMarkup(createElement(Flight2D, {
      q, lane: 1, theme: 'meadow', hat: null, accent: '#f7bf35', enabled: true, onPick: () => undefined, onFocusLane: () => undefined,
    }));
    for (const i of [0, 1, 2]) expect(out).toContain(`data-testid="gate-${i}"`);
    expect(out).toMatch(/aria-label="Fly to gate 1: [^"]+"/);
  });
});

describe('no hidden timer: Buzzy waits at a row until the child chooses', () => {
  it('holds before a row the child has not steered for, and flies on once they have', () => {
    expect(rowSpeed(HOLD_AT, false)).toBe(0);
    expect(rowSpeed(0.2, false)).toBe(0);
    expect(rowSpeed(HOLD_AT + 1, false)).toBeGreaterThan(0);
    expect(rowSpeed(0.2, true)).toBe(flightSpeed(0.2));
    expect(rowSpeed(null, false)).toBe(CRUISE_SPEED);
  });
});

describe('gate badges stay readable on small phones', () => {
  it('groups, clocks and day cards get a bigger badge; lanes are far enough apart for it', () => {
    for (const v of [{ kind: 'group', e: '🐢', n: 5 }, { kind: 'clock', h: 3, m: 30 }, { kind: 'day', day: 5 }] as GateVisual[]) {
      expect(badgeScale(v)).toBeGreaterThan(badgeScale({ kind: 'number', n: 3 }));
      // the drawn disc (90 % of the sprite) never overlaps the next lane's
      expect(badgeScale(v) * 0.9).toBeLessThanOrEqual(LANE_X[1] - LANE_X[0]);
    }
  });

  it('gate groups are at most three across', () => {
    for (let n = 1; n <= 6; n++) {
      const rows = badgeRows(n);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(n);
      expect(Math.max(...rows)).toBeLessThanOrEqual(3);
      expect(rows.length).toBeLessThanOrEqual(2);
    }
    expect(badgeRows(0)).toEqual([]);
    expect(badgeRows(9)).toEqual(groupRows(9));
  });
});

describe('the lane chip never does the looking for the child', () => {
  it('names numbers, days and pattern pieces, but never clocks, groups or shapes', () => {
    expect(laneWordsOk('next', { kind: 'number', n: 7 })).toBe(true);
    expect(laneWordsOk('day', { kind: 'day', day: 5 })).toBe(true);
    expect(laneWordsOk('pattern', { kind: 'emoji', e: '🍎' })).toBe(true);
    expect(laneWordsOk('clock', { kind: 'clock', h: 2, m: 30 })).toBe(false);
    expect(laneWordsOk('compare', { kind: 'group', e: '🐢', n: 7 })).toBe(false);
    expect(laneWordsOk('compare', { kind: 'number', n: 7 })).toBe(false);
    expect(laneWordsOk('shape3d', { kind: 'shape', shape: 'cube' })).toBe(false);
    expect(laneWordsOk('shape2d', { kind: 'number', n: 4 })).toBe(false);
  });
});
