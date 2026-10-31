import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { THEMES, WORLD_PALETTE } from '../activities/journey';
import { spriteUrl } from '../assets/manifest';
import type { FlightQuestion, FlightWorld, GateVisual } from '../flight/types';
import type { Lang } from '../i18n/i18n';
import { billboard, cloud, disposeScene, emojiSprite, hive, island, lights, makeRenderer, skyDome, tree } from './kit';
import { gateCanvas, visualAspect, type DrawOpts } from './gateArt';

/**
 * Bee Flight in 3D: Buzzy (the painted bee billboard, wearing the current hat) flies down a
 * three-lane path in the world's colours, toward rows of three answer gates whose badges are
 * drawn from data (gateArt). The world moves past a still bee (a treadmill), at one gentle,
 * constant pace that slows further as a gate row comes close — never faster for streaks.
 *
 * The screen owns the game: this view only reports when the bee reaches a row (`onGate`) and
 * when it reaches the friend at the finish (`onArrive`). One requestAnimationFrame loop runs
 * while something moves; it stops while paused, while a sheet is open, and while the page is
 * hidden. Everything is disposed on unmount.
 */

/** Lane centres, left to right on screen (lane 0 = choices[0]). */
export const LANE_X = [-2.6, 0, 2.6] as const;
/** How far ahead a new gate row appears. */
export const GATE_GAP = 26;
/** Gentle cruising pace (units / s) and the slower reading pace right before a row. */
export const CRUISE_SPEED = 3;
export const NEAR_SPEED = 1.1;
/** The bee starts slowing this far before a row. */
export const SLOW_FROM = 10;
/** Until the child has steered for a row, Buzzy hovers this far before it (no hidden timer). */
export const HOLD_AT = 1.5;
/** The friend waits this far ahead once the last gate is behind. */
const FRIEND_AT = 16;
const FRIEND_STOP = 2.6;
const PATH_TILE = 4;
const DECOR_SPAN = 110;

/**
 * Forward speed for the distance to the next gate row (null = no row ahead). Constant cruise,
 * easing down to the reading pace near a row; it never depends on streaks or time taken.
 */
export function flightSpeed(dist: number | null): number {
  if (dist === null || dist >= SLOW_FROM) return CRUISE_SPEED;
  if (dist <= 0) return NEAR_SPEED;
  const k = dist / SLOW_FROM;
  return NEAR_SPEED + (CRUISE_SPEED - NEAR_SPEED) * k * k;
}

/**
 * Forward speed with the hover rule: a child who has not yet steered, tapped a lane or pressed
 * Enter for this row is never carried through it — Buzzy waits at the row as long as needed.
 */
export function rowSpeed(dist: number | null, touched: boolean): number {
  if (!touched && dist !== null && dist <= HOLD_AT) return 0;
  return flightSpeed(dist);
}

/**
 * Badge height (world units) for a gate visual: pictures with detail (groups, clocks) are drawn
 * bigger. Day names sit on a 2:1 sign, 1.2 tall × 2.4 wide, on top of the arch, still clear of the next lane.
 */
export function badgeScale(v: GateVisual): number {
  if (v.kind === 'day') return 1.2;
  return v.kind === 'group' || v.kind === 'clock' ? 2.5 : 1.9;
}

/** The lane whose centre is nearest to x (the gate the bee actually flies through). */
export function laneAt(x: number): number {
  let best = 0;
  LANE_X.forEach((lx, i) => { if (Math.abs(x - lx) < Math.abs(x - LANE_X[best])) best = i; });
  return best;
}

export interface Flight3DProps {
  theme: FlightWorld;
  hat?: string | null;
  /** lane the child steered to (0–2) */
  lane: number;
  /** the question whose gate row is ahead; a new id brings a new row */
  question: FlightQuestion | null;
  /** false while the intro, a sheet or the pause sheet is open: everything holds still */
  running: boolean;
  /** all gates done: fly on to the friend */
  finished: boolean;
  /** first-try streak; 2+ leaves a sparkle trail (never changes the speed) */
  combo: number;
  /** changes on each correct gate: a sparkle burst around the bee */
  burst: number;
  /** changes whenever the child steers or taps a lane: lets Buzzy fly on through a held row */
  nudge?: number;
  lang: Lang;
  label: string;
  onGate: (lane: number) => void;
  onArrive: () => void;
  /** the scene is up and drawing (true) or gone (false): the screen shows 3D-only controls only then */
  onLive?: (live: boolean) => void;
  /** Buzzy is hovering at a row, waiting for the child to choose (true), or flying on (false) */
  onHold?: (held: boolean) => void;
}

interface Row { id: string; group: THREE.Group; cleared: boolean; badges: { tex: THREE.CanvasTexture; canvas: HTMLCanvasElement; draw: () => void }[] }
interface Particle { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number }
interface Api {
  setQuestion: (q: FlightQuestion | null) => void;
  setLane: (lane: number) => void;
  setRunning: (on: boolean) => void;
  finish: (on: boolean) => void;
  burst: () => void;
  setCombo: (n: number) => void;
  touch: () => void;
}

const flat = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color, flatShading: true });

/** The path: a soft light track with dashed lane lines, as a repeating canvas texture. */
function pathTexture(base: string, edge: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 128);
  // pebbles
  ctx.fillStyle = 'rgba(61, 43, 31, 0.08)';
  [[30, 20], [200, 40], [120, 90], [60, 100], [230, 110], [160, 15]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // edges
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 10, 128);
  ctx.fillRect(246, 0, 10, 128);
  // dashed lane lines between the three lanes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const x of [256 / 3, (256 * 2) / 3]) ctx.fillRect(x - 3, 16, 6, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function flower(color: number): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 5), flat(0x4f9a41));
  stem.position.y = 0.3;
  g.add(stem);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), flat(color));
  head.position.y = 0.65;
  head.scale.set(1, 0.6, 1);
  g.add(head);
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), flat(0xf7bf35));
  eye.position.y = 0.74;
  g.add(eye);
  return g;
}

function snowyTree(scale: number): THREE.Group {
  const g = new THREE.Group();
  [[1, 1.0], [0.75, 1.7], [0.5, 2.3]].forEach(([r, y]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, 1.1, 7), flat(0xe8f6ff));
    c.position.y = y;
    g.add(c);
  });
  g.scale.setScalar(scale);
  return g;
}

function cottage(hue: number): THREE.Group {
  const g = new THREE.Group();
  const walls = [0xf3d9b1, 0xe9c7a0, 0xf6e7c8];
  const roofs = [0xb5562a, 0xc79f6b, 0x8a5a2b];
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), flat(walls[hue % 3]));
  body.position.y = 0.6;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 4), flat(roofs[hue % 3]));
  roof.position.y = 1.65;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return g;
}

export default function Flight3D(props: Flight3DProps) {
  const { theme, hat = null, lane, question, running, finished, combo, burst, nudge = 0, lang, label } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<Api | null>(null);
  const cb = useRef({ onGate: props.onGate, onArrive: props.onArrive, onLive: props.onLive, onHold: props.onHold });
  cb.current = { onGate: props.onGate, onArrive: props.onArrive, onLive: props.onLive, onHold: props.onHold };
  const langRef = useRef(lang);
  langRef.current = lang;
  // a lost WebGL context is thrown during render so With3D's boundary swaps in the 2D flight
  const [lost, setLost] = useState(false);
  if (lost) throw new Error('WebGL context lost');

  useEffect(() => {
    const el = wrap.current!;
    const th = THEMES[theme];
    const pal = WORLD_PALETTE[theme];
    const renderer = makeRenderer(canvas.current!, () => setLost(true));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(th.sky[1], 28, 95);
    scene.add(skyDome(th.sky[0], th.sky[1], 320));
    lights(scene);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 700);
    scene.add(camera);

    let raf = 0;
    let alive = true;
    const ready = () => kick();

    // ---- painted backdrop: the world's painting on a far plane that travels with the camera ----
    const artUrl = spriteUrl(`world_${theme}`);
    let backdrop: THREE.Mesh | null = null;
    let artAspect = 16 / 9;
    if (artUrl) {
      // inside the sky dome, so the painting covers it; hidden until the image has loaded
      const mat = new THREE.MeshBasicMaterial({ fog: false });
      backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      backdrop.visible = false;
      camera.add(backdrop);
      new THREE.TextureLoader().load(artUrl, (tex) => {
        if (!alive) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image as { width?: number; height?: number };
        if (img?.width && img?.height) artAspect = img.width / img.height;
        mat.map = tex;
        mat.needsUpdate = true;
        if (backdrop) backdrop.visible = true;
        fitBackdrop();
        ready();
      });
    } else {
      // no painting bundled: soft far hills in the world's colours
      const hillMat = flat(th.far);
      for (let i = 0; i < 9; i++) {
        const r = 10 + (i % 3) * 4;
        const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
        hill.position.set(-60 + i * 15, -2, -95 - (i % 2) * 10);
        scene.add(hill);
      }
    }

    // ---- ground, path and the world's props ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), flat(th.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, -80);
    scene.add(ground);
    const pathBase = `#${new THREE.Color(th.ground).lerp(new THREE.Color('#fff1c9'), 0.62).getHexString()}`;
    const pathTex = pathTexture(pathBase, pal.accent);
    const PATH_LEN = 170;
    pathTex.repeat.set(1, PATH_LEN / PATH_TILE);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(8.2, PATH_LEN), new THREE.MeshLambertMaterial({ map: pathTex }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0, 12 - PATH_LEN / 2);
    scene.add(path);

    const decor: THREE.Object3D[] = [];
    const place = (o: THREE.Object3D, x: number, z: number) => { o.position.set(x, 0, z); scene.add(o); decor.push(o); };
    const FLOWER_COLORS = [0xe86a92, 0xffffff, 0xf7bf35, 0xb48ae6, 0xed8c70];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (6.5 + ((i * 37) % 8));
      const z = 8 - (i * DECOR_SPAN) / 16;
      const prop = theme === 'ice' ? snowyTree(0.8 + (i % 3) * 0.2)
        : theme === 'town' && i % 3 === 0 ? cottage(i)
        : tree(0.9 + (i % 3) * 0.25, i);
      prop.rotation.y = i * 1.3;
      place(prop, x, z);
    }
    if (theme !== 'ice') {
      for (let i = 0; i < 28; i++) {
        const side = i % 2 ? 1 : -1;
        place(flower(FLOWER_COLORS[i % FLOWER_COLORS.length]), side * (4.7 + ((i * 13) % 10) / 10), 8 - (i * DECOR_SPAN) / 28);
      }
    } else {
      for (let i = 0; i < 18; i++) {
        const side = i % 2 ? 1 : -1;
        const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + (i % 3) * 0.12, 0), flat(0xcfeeff));
        ice.position.y = 0.2;
        const g = new THREE.Group();
        g.add(ice);
        place(g, side * (4.8 + ((i * 7) % 10) / 10), 8 - (i * DECOR_SPAN) / 18);
      }
    }
    for (let i = 0; i < 5; i++) {
      const c = cloud();
      c.position.set(-18 + i * 9, 9 + (i % 2) * 2, -40 - i * 9);
      c.scale.setScalar(0.9);
      scene.add(c);
    }

    // ---- Buzzy ----
    const bee = billboard('bee', 1.25, ready);
    if (hat) {
      const h = emojiSprite(hat, 0.62);
      h.position.set(-0.1, 1.18, 0.05);
      bee.add(h);
    }
    scene.add(bee);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshBasicMaterial({ color: 0x3d2b1f, transparent: true, opacity: 0.18, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    scene.add(shadow);
    const beeSprite = () => bee.children.find((c) => (c as THREE.Sprite).isSprite) as THREE.Sprite | undefined;

    // ---- gates ----
    const postGeo = new THREE.CylinderGeometry(0.11, 0.14, 2.8, 8);
    const archGeo = new THREE.TorusGeometry(1.02, 0.12, 8, 20, Math.PI);
    const knobGeo = new THREE.IcosahedronGeometry(0.2, 0);
    const postMat = flat(pal.accent);
    const archMat = flat(0xf7bf35);
    let rows: Row[] = [];

    const buildRow = (q: FlightQuestion): Row => {
      const group = new THREE.Group();
      const badges: Row['badges'] = [];
      q.choices.forEach((choice, i) => {
        const gate = new THREE.Group();
        gate.position.x = LANE_X[i];
        for (const sx of [-1.02, 1.02]) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(sx, 1.4, 0);
          gate.add(post);
          const knob = new THREE.Mesh(knobGeo, archMat);
          knob.position.set(sx, 2.86, 0);
          gate.add(knob);
        }
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.y = 2.8;
        gate.add(arch);
        const opts = (): DrawOpts => ({ lang: langRef.current, badge: true, accent: pal.accent });
        const c = gateCanvas(choice.visual, opts(), 256);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const draw = () => {
          const ctx = c.getContext('2d');
          if (!ctx) return;
          // redraw in place (fonts arrived, or the language changed)
          const fresh = gateCanvas(choice.visual, opts(), 256);
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(fresh, 0, 0);
          tex.needsUpdate = true;
        };
        badges.push({ tex, canvas: c, draw });
        const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        const size = badgeScale(choice.visual);
        badge.scale.set(size * visualAspect(choice.visual), size, 1);
        // day signs sit just above the arch top (y ≈ 3.9: wider than the posts, clear of them); round badges
        // grow upwards from the same centre line inside the arch
        badge.position.set(0, choice.visual.kind === 'day' ? 4.0 + size / 2 : 2.1 + (size - 1.9) / 2, 0);
        gate.add(badge);
        group.add(gate);
      });
      group.position.z = -GATE_GAP;
      scene.add(group);
      return { id: q.id, group, cleared: false, badges };
    };
    const dropRow = (r: Row) => {
      scene.remove(r.group);
      // posts and arches share geometry/materials with the other rows: free only the badges
      r.group.traverse((o) => {
        const s = o as THREE.Sprite;
        if (s.isSprite) { s.material.map?.dispose(); s.material.dispose(); }
      });
    };
    // the gate badges use Baloo / Nunito: redraw them once the web fonts are in
    document.fonts?.ready?.then(() => {
      if (!alive) return;
      rows.forEach((r) => r.badges.forEach((b) => b.draw()));
      ready();
    }).catch(() => undefined);

    // ---- the friend at the finish ----
    let friend: THREE.Group | null = null;
    let arrived = false;
    const spawnFriend = () => {
      if (friend) return;
      friend = new THREE.Group();
      const isl = island(th.mid, 1.9);
      isl.position.y = -0.1;
      isl.scale.set(1, 0.4, 1);
      friend.add(isl);
      const who = th.goal === 'svg:hive' ? hive() : billboard(th.goal, 2.3, ready);
      friend.add(who);
      if (th.goal === 'svg:hive') {
        const crown = emojiSprite('👑', 0.9);
        crown.position.set(0, 2.6, 0);
        friend.add(crown);
      }
      const flag = emojiSprite('🏁', 0.9);
      flag.position.set(1.6, 2.2, 0);
      friend.add(flag);
      friend.position.set(0, 0, -FRIEND_AT);
      scene.add(friend);
    };
    /** A new run ("Fly again"): the friend leaves and Buzzy is back at the start of the path. */
    const resetFinish = () => {
      arrived = false;
      if (!friend) return;
      scene.remove(friend);
      friend.traverse((o) => {
        const s = o as THREE.Sprite;
        if (s.isSprite) { s.material.map?.dispose(); s.material.dispose(); }
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); }
      });
      friend = null;
    };

    // ---- sparkles ----
    const sparkleSeed = emojiSprite('✨', 1);
    const sparkleMap = sparkleSeed.material.map!;
    sparkleSeed.material.dispose();
    const particles: Particle[] = [];
    const spawnSparkle = (pos: THREE.Vector3, v: THREE.Vector3, life: number, size: number) => {
      if (particles.length >= 40) {
        const old = particles.shift()!;
        scene.remove(old.s);
        old.s.material.dispose();
      }
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleMap, transparent: true, depthWrite: false }));
      s.position.copy(pos);
      s.scale.setScalar(size);
      scene.add(s);
      particles.push({ s, v, life, max: life });
    };
    const burstAt = (pos: THREE.Vector3) => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        spawnSparkle(pos.clone().add(new THREE.Vector3(0, 0.7, 0)), new THREE.Vector3(Math.cos(a) * 2.4, 1.2 + Math.sin(a) * 2, 0.6), 0.8, 0.42);
      }
    };

    // ---- state ----
    let targetLane = 1;
    let touched = false;
    let held = false;
    let isRunning = false;
    let isFinished = false;
    let comboN = 0;
    let trailT = 0;
    let time = 0;
    bee.position.set(LANE_X[1], 0.45, 0);

    const fitBackdrop = () => {
      if (!backdrop) return;
      const D = 160;
      const h = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const w = h * camera.aspect;
      const pw = Math.max(w, h * artAspect) * 1.02;
      const ph = pw / artAspect;
      backdrop.scale.set(pw, ph, 1);
      // keep the painting's top at the top of the view; the path covers its lower part
      backdrop.position.set(0, h / 2 - ph / 2, -D);
    };
    const aimCamera = () => {
      const x = bee.position.x;
      // follow Buzzy only a little, so all three gates (and their signs) stay in view on a phone
      camera.position.set(x * 0.1, 3.1, 6.6);
      camera.lookAt(x * 0.08, 1.1, -9);
    };
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep all three lanes in view whatever the shape (portrait phones get a wider view)
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(27)) / camera.aspect);
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(half * 2), 44, 82);
      camera.updateProjectionMatrix();
      fitBackdrop();
      aimCamera();
      kick();
    };

    const nextRowDist = (): number | null => {
      const ahead = rows.filter((r) => !r.cleared);
      return ahead.length ? -ahead[0].group.position.z : null;
    };
    const moving = () => isRunning || particles.length > 0 || rows.some((r) => r.cleared) || Math.abs(bee.position.x - LANE_X[targetLane]) > 0.01;

    let last = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!alive || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      time += dt;

      // steering: ease toward the lane, leaning into the turn
      const tx = isFinished ? 0 : LANE_X[targetLane];
      const prevX = bee.position.x;
      bee.position.x += (tx - bee.position.x) * Math.min(1, dt * 7);
      const vx = dt > 0 ? (bee.position.x - prevX) / dt : 0;
      const sp = beeSprite();
      if (sp) sp.material.rotation = THREE.MathUtils.clamp(-vx * 0.06, -0.3, 0.3);

      if (isRunning) {
        bee.position.y = 0.45 + Math.sin(time * 5) * 0.1;
        let dz = 0;
        if (isFinished && friend) {
          const left = -friend.position.z - FRIEND_STOP;
          dz = Math.max(0, Math.min(left, flightSpeed(left + 2) * dt));
          if (left <= 0.001 && !arrived) {
            arrived = true;
            isRunning = false;
            cb.current.onArrive();
          }
        } else {
          dz = rowSpeed(nextRowDist(), touched) * dt;
        }
        const holdNow = !isFinished && dz === 0 && nextRowDist() !== null;
        if (holdNow !== held) { held = holdNow; cb.current.onHold?.(held); }
        if (dz > 0) {
          rows.forEach((r) => { r.group.position.z += dz; });
          if (friend) friend.position.z += dz;
          decor.forEach((o) => {
            o.position.z += dz;
            if (o.position.z > 12) o.position.z -= DECOR_SPAN;
          });
          pathTex.offset.y = (pathTex.offset.y + dz / PATH_TILE) % 1;
        }
        // reaching a row: the gate the bee is in is the child's choice
        for (const r of rows) {
          if (!r.cleared && r.group.position.z >= 0) {
            r.cleared = true;
            cb.current.onGate(laneAt(bee.position.x));
          }
        }
        // a first-try streak leaves a little sparkle trail (no speed change)
        if (comboN >= 2) {
          trailT += dt;
          if (trailT > 0.16) {
            trailT = 0;
            spawnSparkle(bee.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, 0.5)), new THREE.Vector3(0, 0.2, 2.2), 0.7, 0.26);
          }
        }
      }
      // a row Buzzy has flown through sinks softly into the path, so it never blocks the view
      rows = rows.filter((r) => {
        if (!r.cleared) return true;
        r.group.position.y -= dt * 5;
        if (r.group.position.y < -3.5 || r.group.position.z > 9) { dropRow(r); return false; }
        return true;
      });
      shadow.position.x = bee.position.x;
      shadow.position.z = bee.position.z;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.s.position.addScaledVector(p.v, dt);
        p.v.y -= dt * 1.5;
        p.s.material.opacity = Math.max(0, p.life / p.max);
        if (p.life <= 0) {
          scene.remove(p.s);
          p.s.material.dispose();
          particles.splice(i, 1);
        }
      }
      aimCamera();
      renderer.render(scene, camera);
      if (moving()) kick();
      else last = 0;
    };
    function release() {
      if (held) { held = false; cb.current.onHold?.(false); }
      last = 0;
      kick();
    }
    function kick() {
      if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame);
    }
    const onVis = () => { last = 0; if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);

    api.current = {
      setQuestion(q) {
        // an unanswered row (skipped with Enter or the 2D buttons) gives way to the new one
        rows = rows.filter((r) => {
          if (r.cleared || (q && r.id === q.id)) return true;
          dropRow(r);
          return false;
        });
        if (q && !rows.some((r) => r.id === q.id)) {
          rows.push(buildRow(q));
          touched = false;
        }
        kick();
      },
      setLane(l) {
        const next = Math.max(0, Math.min(2, Math.round(l)));
        if (next !== targetLane) touched = true;
        targetLane = next;
        release();
      },
      touch() {
        touched = true;
        release();
      },
      setRunning(on) {
        isRunning = on && !arrived;
        last = 0;
        kick();
      },
      finish(on) {
        isFinished = on;
        if (on) spawnFriend();
        else resetFinish();
        kick();
      },
      burst() {
        burstAt(bee.position);
        kick();
      },
      setCombo(n) { comboN = n; },
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    cb.current.onLive?.(true);

    return () => {
      alive = false;
      api.current = null;
      if (held) cb.current.onHold?.(false);
      cb.current.onLive?.(false);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      rows.forEach(dropRow);
      particles.forEach((p) => p.s.material.dispose());
      sparkleMap.dispose();
      [postGeo, archGeo, knobGeo, postMat, archMat].forEach((x) => x.dispose());
      (backdrop?.material as THREE.MeshBasicMaterial | undefined)?.map?.dispose();
      disposeScene(scene);
      renderer.dispose();
    };
    // the scene is rebuilt only for a new world or hat; everything else updates it in place
  }, [theme, hat]);

  useEffect(() => { api.current?.setLane(lane); }, [lane, theme, hat]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setQuestion(question); }, [question?.id, theme, hat]);
  useEffect(() => { api.current?.finish(finished); }, [finished, theme, hat]);
  useEffect(() => { api.current?.setRunning(running); }, [running, theme, hat]);
  useEffect(() => { api.current?.setCombo(combo); }, [combo, theme, hat]);
  useEffect(() => { if (burst) api.current?.burst(); }, [burst]);
  useEffect(() => { if (nudge) api.current?.touch(); }, [nudge]);

  return (
    <div className="flight3d" ref={wrap} role="img" aria-label={label} data-testid="flight-stage" data-3d="1">
      <canvas ref={canvas} className="flight3d-canvas" aria-hidden />
    </div>
  );
}
