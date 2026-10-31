/**
 * Pollen particles on one pooled <canvas> overlay (aria-hidden, never catches taps).
 *
 * A fixed pool of MAX_PARTICLES objects is allocated once and reused, so a burst never
 * allocates and never grows past the cap: when every particle is alive, new ones are simply
 * not spawned. The canvas only animates (requestAnimationFrame) while something is alive,
 * and clears itself when the last particle fades. Callers (juice.ts) decide whether particles
 * are allowed at all (reduced motion, weak devices).
 */

export const MAX_PARTICLES = 40;
/** Each particle lives this long. */
export const PARTICLE_MS = 600;
/** Default pollen palette: honey, petal pink, leaf green, sky. */
export const POLLEN = ['#F7BF35', '#FFD84D', '#ED8C70', '#E86A92', '#8CCB6A', '#FFF3B0'];

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  size: number;
  color: string;
}

/** The pure part: spawn, step and count particles (no DOM — unit tested directly). */
export class ParticlePool {
  readonly items: Particle[];
  constructor(readonly cap = MAX_PARTICLES) {
    this.items = Array.from({ length: cap }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, size: 0, color: '' }));
  }

  get alive(): number {
    let n = 0;
    for (const p of this.items) if (p.alive) n++;
    return n;
  }

  /** Spawn up to `count` particles at (x, y); returns how many fitted under the cap. */
  spawn(x: number, y: number, count: number, palette: string[] = POLLEN, rand: () => number = Math.random): number {
    let made = 0;
    for (const p of this.items) {
      if (made >= count) break;
      if (p.alive) continue;
      const a = rand() * Math.PI * 2;
      const speed = 0.08 + rand() * 0.16; // px per ms
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed - 0.08; // a little lift: pollen floats up first
      p.age = 0;
      p.size = 3 + rand() * 4;
      p.color = palette[Math.floor(rand() * palette.length) % palette.length] ?? POLLEN[0];
      made++;
    }
    return made;
  }

  /** Advance every live particle by dt milliseconds; returns how many are still alive. */
  step(dt: number): number {
    let n = 0;
    for (const p of this.items) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= PARTICLE_MS) {
        p.alive = false;
        continue;
      }
      p.vy += 0.0004 * dt; // gentle gravity
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      n++;
    }
    return n;
  }

  clear(): void {
    for (const p of this.items) p.alive = false;
  }
}

// ---------- the shared canvas ----------
const pool = new ParticlePool();
let canvas: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let dpr = 1;

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (canvas && canvas.isConnected !== false) return g; // null when the browser has no 2D canvas
  if (typeof document === 'undefined' || !document.body) return null;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  g = canvas.getContext('2d');
  resize();
  if (typeof window !== 'undefined') window.addEventListener?.('resize', resize);
  return g;
}

function resize() {
  if (!canvas || typeof window === 'undefined') return;
  dpr = Math.min(1.5, window.devicePixelRatio || 1); // phones draw less
  canvas.width = Math.round((window.innerWidth || 0) * dpr);
  canvas.height = Math.round((window.innerHeight || 0) * dpr);
}

function frame(now: number) {
  const dt = Math.min(48, last ? now - last : 16); // a hidden tab does not fast-forward
  last = now;
  const alive = pool.step(dt);
  draw();
  raf = alive > 0 ? requestAnimationFrame(frame) : 0;
  if (!raf) last = 0;
}

function draw() {
  if (!g || !canvas) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of pool.items) {
    if (!p.alive) continue;
    g.globalAlpha = Math.max(0, 1 - p.age / PARTICLE_MS);
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size * (1 - p.age / (PARTICLE_MS * 2)), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Throw pollen from a screen point (CSS px). Returns how many particles were spawned. */
export function emitParticles(x: number, y: number, count: number, palette?: string[]): number {
  if (!ensureCanvas()) return 0;
  const made = pool.spawn(x, y, count, palette);
  if (made > 0 && !raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(frame);
  return made;
}

/** Particles alive right now (never more than MAX_PARTICLES). */
export function particleCount(): number {
  return pool.alive;
}

/** Remove every particle at once (e.g. when reduced motion is switched on). */
export function clearParticles(): void {
  pool.clear();
  draw();
}

/** Test helper: drop the canvas and empty the pool. */
export function __resetParticlesForTests(): void {
  pool.clear();
  canvas = null;
  g = null;
  raf = 0;
  last = 0;
}
