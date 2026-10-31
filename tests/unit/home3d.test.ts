import { describe, expect, it } from 'vitest';
import {
  BEE_Y, HOME_FPS, ORBIT_R, ORBIT_SWAY, PATH_FAR, PATH_NEAR, PATH_W,
  TALL_MAX_SHIFT, dueFrame, homeBeeScale, homeFraming, homeWorthShowing, homeShift, homeTheme, orbitCamera, pathPoints, pathX, propSpots, ribbon,
} from '../../src/three/Home3D';
import { THEMES } from '../../src/activities/journey';

describe('home scene: world', () => {
  it('uses the current flight world, or the meadow when unknown', () => {
    for (const w of Object.keys(THEMES)) expect(homeTheme(w)).toBe(w);
    expect(homeTheme(undefined)).toBe('meadow');
    expect(homeTheme(null)).toBe('meadow');
    expect(homeTheme('moon')).toBe('meadow');
  });
});

describe('home scene: winding path', () => {
  it('starts right under Buzzy and bends gently', () => {
    expect(pathX(0)).toBeCloseTo(0, 6);
    let maxX = 0;
    let maxSlope = 0;
    for (let z = PATH_NEAR; z >= PATH_FAR; z -= 0.5) {
      maxX = Math.max(maxX, Math.abs(pathX(z)));
      maxSlope = Math.max(maxSlope, Math.abs(pathX(z) - pathX(z - 0.5)) / 0.5);
    }
    expect(maxX).toBeGreaterThan(1); // it does wind
    expect(maxX).toBeLessThan(2.5); // but stays near the middle
    expect(maxSlope).toBeLessThan(0.3); // no sharp turns
  });

  it('samples points from near to far, in order', () => {
    const pts = pathPoints(10, -20, 2);
    expect(pts[0].z).toBe(10);
    expect(pts[pts.length - 1].z).toBe(-20);
    for (let i = 1; i < pts.length; i++) expect(pts[i].z).toBeLessThan(pts[i - 1].z);
    pts.forEach((p) => expect(p.x).toBeCloseTo(pathX(p.z), 9));
  });

  it('builds a ribbon of the right width whose faces point up', () => {
    const pts = pathPoints();
    const { positions, uvs, indices } = ribbon(pts, PATH_W);
    expect(positions.length).toBe(pts.length * 6);
    expect(uvs.length).toBe(pts.length * 4);
    expect(indices.length).toBe((pts.length - 1) * 6);
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay, az, bx, by, bz] = positions.slice(i * 6, i * 6 + 6);
      expect(ay).toBe(0);
      expect(by).toBe(0);
      expect(Math.hypot(bx - ax, bz - az)).toBeCloseTo(PATH_W, 6);
      // centred on the path line
      expect((ax + bx) / 2).toBeCloseTo(pts[i].x, 6);
    }
    // v grows along the path
    for (let i = 1; i < pts.length; i++) expect(uvs[i * 4 + 1]).toBeGreaterThan(uvs[(i - 1) * 4 + 1]);
    // every triangle's normal points up (+y), so it is visible from above
    const v = (k: number) => positions.slice(k * 3, k * 3 + 3);
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [v(indices[t]), v(indices[t + 1]), v(indices[t + 2])];
      const u = [b[0] - a[0], b[2] - a[2]];
      const w = [c[0] - a[0], c[2] - a[2]];
      // y of (b - a) × (c - a) = uz·wx − ux·wz
      expect(u[1] * w[0] - u[0] * w[1]).toBeGreaterThan(0);
    }
  });

  it('keeps flowers and trees off the path, on both sides', () => {
    const flowers = propSpots(60, 8, -70, PATH_W / 2 + 0.5, 1.2, 1);
    const trees = propSpots(20, 6, -80, PATH_W / 2 + 3.5, 6, 2);
    for (const s of [...flowers, ...trees]) {
      expect(Math.abs(s.x - pathX(s.z))).toBeGreaterThan(PATH_W / 2);
      expect(Math.sign(s.x - pathX(s.z))).toBe(s.side);
    }
    expect(flowers.filter((s) => s.side < 0).length).toBe(30);
    // deterministic: the same scene every visit
    expect(propSpots(60, 8, -70, 2, 1.2, 1)).toEqual(propSpots(60, 8, -70, 2, 1.2, 1));
  });
});

describe('home scene: idle camera', () => {
  it('sways slowly around Buzzy at a steady distance, never behind it', () => {
    for (let t = 0; t < 200; t += 0.7) {
      const { pos, look } = orbitCamera(t);
      const flatDist = Math.hypot(pos[0], pos[2]);
      expect(flatDist).toBeCloseTo(ORBIT_R, 6);
      expect(Math.abs(Math.atan2(pos[0], pos[2]))).toBeLessThanOrEqual(ORBIT_SWAY + 1e-9);
      expect(pos[2]).toBeGreaterThan(0); // in front of the path, looking down it
      expect(pos[1]).toBeGreaterThan(BEE_Y + 1); // above the bee
      expect(look[2]).toBeLessThan(0);
    }
  });

  it('moves gently between frames (no jumps)', () => {
    const step = 1 / HOME_FPS;
    for (let t = 0; t < 120; t += step) {
      const a = orbitCamera(t).pos;
      const b = orbitCamera(t + step).pos;
      expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeLessThan(0.05);
    }
  });

  it('frames Buzzy in the biggest free space around the card, not behind it', () => {
    // where Buzzy lands on screen (fractions), from a framing
    const at = (f: { dx: number; dy: number }) => ({ x: 0.5 - f.dx, y: 0.5 + 0.07 - f.dy });
    // wide tablet / landscape phone: room on the left
    const wide = at(homeFraming(915, 412, { left: 228, top: 20, right: 688, bottom: 392 }));
    expect(wide.x * 915).toBeLessThan(228);
    // squarish window: beside or above the card, never on it
    const sq = at(homeFraming(800, 765, { left: 205, top: 205, right: 595, bottom: 555 }));
    expect(sq.x * 800 < 205 || sq.y * 765 < 205).toBe(true);
    // a wide card on a squarish window: more room above it
    const above = at(homeFraming(800, 765, { left: 120, top: 230, right: 680, bottom: 560 }));
    expect(above.y * 765).toBeLessThan(230);
    expect(above.x).toBeCloseTo(0.5, 6);
    // portrait phone: above the card
    const tall = at(homeFraming(360, 640, { left: 16, top: 130, right: 344, bottom: 520 }));
    expect(tall.y * 640).toBeLessThan(130);
    // tall phone where the card leaves more room below than above: below it, and Buzzy shrinks to fit
    const below = homeFraming(360, 802, { left: 16, top: 78, right: 344, bottom: 703 });
    expect(at(below).y * 802).toBeGreaterThan(703);
    expect(below.room).toBe(99);
    const s = homeBeeScale(below.room, 802);
    expect(s).toBeLessThan(0.6);
    expect(s).toBeGreaterThanOrEqual(0.45);
    // the measured bee position corrects the shift onto the chosen spot
    const fix = homeShift(below, 0.5, 0.6);
    expect(0.6 - fix.dy).toBeCloseTo(below.ty, 6);
    expect(0.5 - fix.dx).toBeCloseTo(below.tx, 6);
    expect(Math.abs(homeShift({ tx: 0, ty: 0 }, 1, 1).dy)).toBeLessThanOrEqual(0.45);
    // plenty of room keeps him full size
    expect(homeBeeScale(205, 765)).toBe(1);
    expect(homeBeeScale(0, 0)).toBe(1);
    // without a card: off-centre by shape
    expect(homeFraming(1600, 900).dx).toBeGreaterThan(0.2);
    expect(homeFraming(360, 640).dy).toBeGreaterThan(0.2);
    // never shifted so far the scene slides out of view
    for (const f of [homeFraming(360, 640, { left: 0, top: 0, right: 360, bottom: 640 }), homeFraming(2000, 400, { left: 1990, top: 0, right: 2000, bottom: 400 })]) {
      expect(Math.abs(f.dx)).toBeLessThanOrEqual(0.45);
      expect(Math.abs(f.dy)).toBeLessThanOrEqual(0.45);
    }
  });
});

describe('home scene: frame cap', () => {
  it('draws at most ~30 frames a second', () => {
    let last = -Infinity;
    let drawn = 0;
    for (let now = 0; now < 1000; now += 1000 / 120) {
      if (dueFrame(now, last)) { drawn++; last = now; }
    }
    expect(drawn).toBeLessThanOrEqual(HOME_FPS + 1);
    expect(drawn).toBeGreaterThanOrEqual(HOME_FPS - 6);
    expect(dueFrame(100, 90)).toBe(false);
    expect(dueFrame(140, 100)).toBe(true);
  });

  it('does not run the scene when the card leaves no room for Buzzy (360×640 with a saved player)', () => {
    // measured: the "Continue as …" card filled 12…637.5 of a 640 px view
    const f = homeFraming(360, 640, { left: 16, top: 12, right: 344, bottom: 637.5 });
    expect(homeWorthShowing(f.room, 640)).toBe(false);
    // a fresh welcome card on the same phone leaves a real space above it
    const roomy = homeFraming(360, 640, { left: 16, top: 130, right: 344, bottom: 520 });
    expect(homeWorthShowing(roomy.room, 640)).toBe(true);
    expect(homeWorthShowing(89, 400)).toBe(false);
  });

  it('keeps the horizon on screen on tall phones (smaller upward shift)', () => {
    for (const card of [{ left: 16, top: 300, right: 396, bottom: 640 }, { left: 16, top: 200, right: 396, bottom: 700 }, null]) {
      const f = homeFraming(412, 915, card);
      expect(f.dy).toBeLessThanOrEqual(TALL_MAX_SHIFT + 1e-9);
    }
    // a squarer phone may still move further
    expect(homeFraming(360, 640).dy).toBeGreaterThan(TALL_MAX_SHIFT);
  });
});
