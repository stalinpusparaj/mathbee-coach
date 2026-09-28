import { describe, expect, it } from 'vitest';
import { GARDEN_R, POND, flatSpots, islandPositions, landmarkPositions, terrainHeight, treePositions } from '../../src/three/layout3d';
import { CATEGORIES } from '../../src/curriculum/curriculum';

describe('3D garden layout', () => {
  it('places every category once, inside the garden and clear of the pond', () => {
    const marks = landmarkPositions();
    expect(marks.map((m) => m.id)).toEqual(CATEGORIES.map((c) => c.id));
    for (const m of marks) {
      expect(Math.hypot(m.x, m.z)).toBeLessThan(GARDEN_R - 4);
      expect(Math.hypot(m.x - POND.x, m.z - POND.z)).toBeGreaterThan(POND.r + 3);
    }
  });

  it('keeps landmarks far enough apart to tap', () => {
    const marks = landmarkPositions();
    for (let i = 0; i < marks.length; i++)
      for (let j = i + 1; j < marks.length; j++)
        expect(Math.hypot(marks[i].x - marks[j].x, marks[i].z - marks[j].z)).toBeGreaterThan(5);
  });

  it('flattens the ground under each landmark and dips at the pond', () => {
    const spots = flatSpots();
    for (const m of landmarkPositions()) expect(Math.abs(terrainHeight(m.x, m.z, spots))).toBeLessThan(0.01);
    expect(terrainHeight(POND.x, POND.z, spots)).toBeLessThanOrEqual(0);
    expect(terrainHeight(GARDEN_R + 5, 0, spots)).toBe(-0.6);
  });

  it('grows trees deterministically without blocking places or the pond', () => {
    const a = treePositions();
    expect(a).toEqual(treePositions());
    expect(a.length).toBeGreaterThan(30);
    const marks = landmarkPositions();
    for (const t of a) {
      expect(Math.hypot(t.x - POND.x, t.z - POND.z)).toBeGreaterThan(POND.r + 2);
      for (const m of marks) expect(Math.hypot(t.x - m.x, t.z - m.z)).toBeGreaterThan(4.2);
    }
  });

  it('builds one island per question plus the goal, moving forward', () => {
    for (const n of [1, 6, 12]) {
      const pts = islandPositions(n);
      expect(pts).toHaveLength(n + 1);
      for (let k = 1; k < pts.length; k++) expect(pts[k].x).toBeGreaterThan(pts[k - 1].x);
    }
    expect(islandPositions(0)).toHaveLength(2);
  });
});
