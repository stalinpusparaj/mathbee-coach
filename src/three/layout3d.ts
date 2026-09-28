import type { CategoryId } from '../engine/types';
import { CATEGORIES } from '../curriculum/curriculum';

/**
 * Pure layout for the 3D garden (no three.js here, so it is unit-testable).
 * World units: the garden is a disc of radius GARDEN_R centred on the origin; y is up.
 */
export const GARDEN_R = 30;
export const POND = { x: 0, z: 2, r: 4.2 };

export interface Landmark { id: CategoryId; x: number; z: number; }

/**
 * The 14 places sit on a gentle figure-of-eight-ish oval so they read left-to-right,
 * front-to-back from the default camera, with the pond in the middle.
 */
export function landmarkPositions(): Landmark[] {
  const n = CATEGORIES.length;
  return CATEGORIES.map((c, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rx = 18.5 + 1.2 * Math.sin(i * 1.7);
    const rz = 13 + 0.8 * Math.cos(i * 1.3);
    return { id: c.id, x: round(Math.cos(a) * rx), z: round(Math.sin(a) * rz) };
  });
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Rolling hills that flatten near landmarks, the pond and the path, so nothing floats or sinks. */
export function terrainHeight(x: number, z: number, flatSpots: { x: number; z: number; r: number }[] = []): number {
  const d = Math.hypot(x, z);
  if (d > GARDEN_R) return -0.6;
  let h = 0.55 * Math.sin(x * 0.23) * Math.cos(z * 0.19) + 0.35 * Math.sin((x + z) * 0.11) + 0.25 * Math.cos(x * 0.07 - z * 0.13);
  // raise the rim a little so the garden feels enclosed
  h += Math.max(0, d - GARDEN_R * 0.75) * 0.12;
  for (const s of flatSpots) {
    const k = Math.hypot(x - s.x, z - s.z) / s.r;
    if (k < 1) h *= k * k;
  }
  const pk = Math.hypot(x - POND.x, z - POND.z) / (POND.r + 1.5);
  if (pk < 1) h = Math.min(h, -0.15 * (1 - pk));
  return round(h);
}

export function flatSpots(): { x: number; z: number; r: number }[] {
  return landmarkPositions().map((l) => ({ x: l.x, z: l.z, r: 3.2 }));
}

/** Deterministic tree positions (seeded), kept away from landmarks, the pond and the rim. */
export function treePositions(count = 46, seed = 7): { x: number; z: number; s: number }[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const marks = landmarkPositions();
  const out: { x: number; z: number; s: number }[] = [];
  for (let tries = 0; out.length < count && tries < 2000; tries++) {
    const r = Math.sqrt(rand()) * (GARDEN_R - 2);
    const ang = rand() * Math.PI * 2;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2) continue;
    if (marks.some((m) => Math.hypot(x - m.x, z - m.z) < 4.2)) continue;
    if (out.some((o) => Math.hypot(x - o.x, z - o.z) < 2.4)) continue;
    // keep the front-centre view open toward the pond
    if (z > 6 && Math.abs(x) < 6) continue;
    out.push({ x: round(x), z: round(z), s: round(0.8 + rand() * 0.7) });
  }
  return out;
}

/** Island positions for the 3D bee journey: a gently rising line toward the goal. */
export function islandPositions(n: number): { x: number; y: number; z: number }[] {
  const count = Math.max(1, n);
  const WAVE = [0, 0.8, 0.2, 1.1, 0.4, 1.3, 0.6, 1.0];
  return Array.from({ length: count + 1 }, (_, k) => ({
    x: k * 4.2,
    y: k === count ? 1.2 : WAVE[k % WAVE.length],
    z: k % 2 === 0 ? 0 : -0.9,
  }));
}
