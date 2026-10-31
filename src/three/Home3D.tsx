import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { THEMES, WORLD_PALETTE, type JourneyTheme } from '../activities/journey';
import { spriteUrl } from '../assets/manifest';
import { billboard, cloud, disposeScene, emojiSprite, lights, makeRenderer, skyDome, tree } from './kit';
import { renderBudget } from './support';

/**
 * The live home scene behind the Welcome card (port of the prototype's home view: init3D,
 * createMeadowPath, createDecorativeMeadowProps, createBuzzyCharacter and the idle camera of
 * animate()). Buzzy — the painted bee billboard (its own two painted wings), wearing the current
 * hat — hovers with a gentle tilt over a gently winding flower path in the colours and painted backdrop of the child's
 * current flight world, while the camera slowly sways around.
 *
 * Purely decorative: nothing here is tappable. One requestAnimationFrame loop at most ~30 frames
 * a second, stopped while the page is hidden or the scene is scrolled out of view. A lost WebGL
 * context throws during render so With3D swaps in the painted picture. Disposed on unmount.
 */

/** Idle frame cap. */
export const HOME_FPS = 30;
/** Width of the flower path. */
export const PATH_W = 3.4;
/** The path runs from just behind the bee to far ahead (toward -z). */
export const PATH_NEAR = 14;
export const PATH_FAR = -130;
/** Buzzy's resting height over the path. */
export const BEE_Y = 1.4;
const BEE_H = 1.6;
/** Camera distance from Buzzy and the widest sway either side of the path (radians). */
export const ORBIT_R = 7.4;
export const ORBIT_SWAY = 0.55;

/** A known flight world, or the meadow. */
export function homeTheme(world: string | null | undefined): JourneyTheme {
  return world && world in THEMES ? (world as JourneyTheme) : 'meadow';
}

/** Centre line of the winding path: x for a given z (0 under Buzzy, gentle bends ahead). */
export function pathX(z: number): number {
  return 1.8 * Math.sin(z * 0.075) + 0.5 * Math.sin(z * 0.19);
}

/** Points along the path centre, from `near` to `far` (toward -z), every `step` units. */
export function pathPoints(near = PATH_NEAR, far = PATH_FAR, step = 2): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const n = Math.max(1, Math.round((near - far) / step));
  for (let i = 0; i <= n; i++) {
    const z = near + ((far - near) * i) / n;
    out.push({ x: pathX(z), z });
  }
  return out;
}

/**
 * A flat ribbon along the points: two vertices per point, offset sideways (perpendicular to the
 * path direction) by half the width. `v` runs along the path in path widths, for a repeating texture.
 */
export function ribbon(points: { x: number; z: number }[], width = PATH_W): { positions: number[]; uvs: number[]; indices: number[] } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let len = 0;
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    // left-hand normal of the direction (dx, dz) on the ground plane
    const nx = -dz;
    const nz = dx;
    if (i > 0) len += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    positions.push(p.x - (nx * width) / 2, 0, p.z - (nz * width) / 2, p.x + (nx * width) / 2, 0, p.z + (nz * width) / 2);
    uvs.push(0, len / width, 1, len / width);
    if (i > 0) {
      const k = (i - 1) * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); // counter-clockwise from above: faces up
    }
  });
  return { positions, uvs, indices };
}

/**
 * Where props stand: flowers in two rows hugging the path edges, trees further out. Deterministic
 * (no randomness), so every visit looks the same and tests can check nothing sits on the path.
 */
export function propSpots(count: number, near: number, far: number, minOff: number, spread: number, seed = 1): { x: number; z: number; side: -1 | 1; i: number }[] {
  const out: { x: number; z: number; side: -1 | 1; i: number }[] = [];
  for (let i = 0; i < count; i++) {
    const side: -1 | 1 = i % 2 ? 1 : -1;
    const h = Math.abs(Math.sin((i + 1) * 12.9898 * seed) * 43758.5453) % 1;
    const z = near + ((far - near) * (i + h * 0.6)) / count;
    out.push({ x: pathX(z) + side * (minOff + h * spread), z, side, i });
  }
  return out;
}

/** Idle camera at time t (seconds): a slow sway around Buzzy, looking down the path. */
export function orbitCamera(t: number): { pos: [number, number, number]; look: [number, number, number] } {
  const a = ORBIT_SWAY * Math.sin(t * 0.1);
  const y = 3.5 + 0.3 * Math.sin(t * 0.17);
  return {
    pos: [Math.sin(a) * ORBIT_R, y, Math.cos(a) * ORBIT_R],
    look: [pathX(-4) * 0.5, 1.2, -4],
  };
}

/** A rectangle in view pixels (the Welcome card, measured relative to the scene). */
export interface ViewRect { left: number; top: number; right: number; bottom: number }

/** Buzzy draws a little below the view centre (the camera looks past it, down the path). */
const BEE_DROP = 0.07;
const MAX_SHIFT = 0.45;
/**
 * On tall phones (height ≥ 1.9 × width) the view moves up less, so the horizon and the painted
 * backdrop stay on screen instead of leaving an empty magnified close-up of the path.
 */
export const TALL_RATIO = 1.9;
export const TALL_MAX_SHIFT = 0.25;

/**
 * How far to shift the picture (fractions of the view size; +dx moves the scene left, +dy up) so
 * Buzzy hovers in the biggest free space beside or above the Welcome card instead of behind it.
 * Without a card: wide screens move the scene left, others move it up.
 */
export function homeFraming(w: number, h: number, card?: ViewRect | null): { dx: number; dy: number; room: number; tx: number; ty: number } {
  const clamp = (v: number) => Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, v));
  const tall = h >= TALL_RATIO * w;
  // only the upward shift is capped on tall phones (it is what slides the horizon off the top)
  const clampY = (v: number) => (tall ? Math.max(-MAX_SHIFT, Math.min(TALL_MAX_SHIFT, v)) : clamp(v));
  let px = 0.5 * w;
  let py = 0.5 * h;
  let room = Math.min(w, h);
  if (card && card.right > card.left && card.bottom > card.top) {
    const spaces = [
      { size: Math.min(card.left, h), x: card.left / 2, y: h / 2, pref: 1 }, // left of the card
      { size: Math.min(w - card.right, h), x: (card.right + w) / 2, y: h / 2, pref: 1 }, // right of it
      { size: Math.min(card.top, w), x: w / 2, y: card.top / 2, pref: 1 }, // above it
      // below it: only when clearly roomier, as Buzzy then sits low over the near path; on tall phones
      // at an equal footing, so he fills the empty foreground instead of the view sliding off the horizon
      { size: Math.min(h - card.bottom, w), x: w / 2, y: (card.bottom + h) / 2, pref: tall ? 1 : 0.85 },
    ];
    // on a tie the earlier space wins (beside, then above)
    const best = spaces.reduce((a, b) => (b.size * b.pref > a.size * a.pref ? b : a));
    px = best.x;
    py = best.y;
    room = Math.max(0, best.size);
  } else if (w / h >= 1.25) {
    px = 0.23 * w;
  } else {
    py = 0.22 * h;
  }
  return { dx: clamp(0.5 - px / w), dy: clampY(0.5 + BEE_DROP - py / h), room, tx: px / w, ty: py / h };
}

/**
 * The view shift that puts Buzzy, measured at (bx, by) (fractions of the unshifted view), on the
 * target (tx, ty) that `homeFraming` chose. Same limits as homeFraming.
 */
export function homeShift(f: { tx: number; ty: number }, bx: number, by: number, tall = false): { dx: number; dy: number } {
  const clamp = (v: number, up = MAX_SHIFT) => Math.max(-MAX_SHIFT, Math.min(up, v));
  return { dx: clamp(bx - f.tx), dy: clamp(by - f.ty, tall ? TALL_MAX_SHIFT : MAX_SHIFT) };
}

/** Buzzy's height as a share of the view height at full size (measured on a portrait phone). */
const BEE_SHARE = 0.2;

/**
 * Buzzy's size (1 = full) so he fits the free space `room` (px) in a view `h` px tall: smaller on
 * tall phones where the card leaves only a strip, never so small he is lost.
 */
export function homeBeeScale(room: number, h: number): number {
  if (!(h > 0)) return 1;
  return Math.max(0.45, Math.min(1, (0.8 * room) / h / BEE_SHARE));
}

/**
 * Whether the free space beside the card is worth a live scene: at least 90 px and more than the
 * point where Buzzy would shrink to his smallest size. When not (a small phone with a saved player:
 * the card fills the screen), the painted picture shows and the loop does not run at all.
 */
export function homeWorthShowing(room: number, h: number): boolean {
  return room >= Math.max(90, (0.45 * BEE_SHARE * h) / 0.8);
}

/** Whether enough time has passed since the last drawn frame to draw again under the cap. */
export function dueFrame(now: number, last: number, fps = HOME_FPS): boolean {
  return now - last >= 1000 / fps - 2;
}

const flat = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color, flatShading: true });

/** Path texture: soft light track, darker edges in the world's accent, a few pebbles. */
function pathTexture(base: string, edge: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(61, 43, 31, 0.09)';
  [[30, 20], [96, 44], [60, 90], [22, 104], [104, 112], [78, 12]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = edge;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, 0, 7, 128);
  ctx.fillRect(121, 0, 7, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Share of the painted backdrop's height that fades out at the bottom, into the fogged 3D ground. */
export const BACKDROP_FADE = 0.2;

/** Alpha map for the backdrop: opaque, fading to clear over its bottom BACKDROP_FADE (no hard seam). */
function fadeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(1 - BACKDROP_FADE, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

/** The average colour of an image's bottom strip (the painting's ground), for the fog to blend into. */
function bottomColour(img: CanvasImageSource & { width: number; height: number }): THREE.Color | null {
  try {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 4;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, img.height * 0.9, img.width, img.height * 0.1, 0, 0, 16, 4);
    const d = ctx.getImageData(0, 0, 16, 4).data;
    let r = 0; let g = 0; let b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch {
    return null;
  }
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

const artUrlFor = (theme: JourneyTheme) => spriteUrl(`world_${theme}`);

export interface Home3DProps {
  /** the card the scene sits behind: Buzzy is framed beside or above it */
  avoid?: RefObject<HTMLElement | null>;
  /** the child's current flight world (unknown → meadow) */
  world?: string | null;
  /** the bee's hat emoji, or none */
  hat?: string | null;
  label: string;
}

export default function Home3D({ world, hat = null, label, avoid }: Home3DProps) {
  const theme = homeTheme(world);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // a lost WebGL context is thrown during render so With3D shows the painted picture instead
  const [lost, setLost] = useState(false);
  if (lost) throw new Error('WebGL context lost');

  useEffect(() => {
    const el = wrap.current!;
    const th = THEMES[theme];
    const pal = WORLD_PALETTE[theme];
    const lite = !renderBudget().antialias; // weak device: fewer props
    const renderer = makeRenderer(canvas.current!, () => setLost(true));
    const scene = new THREE.Scene();
    // with a painted backdrop the far ground fogs into the painting's ground colour (set when it loads)
    scene.fog = new THREE.Fog(th.sky[1], 30, artUrlFor(theme) ? 95 : 110);
    scene.add(skyDome(th.sky[0], th.sky[1], 320));
    lights(scene);
    const camera = new THREE.PerspectiveCamera(54, 1, 0.3, 700);
    scene.add(camera);
    let alive = true;
    let framing = { dx: 0, dy: 0, room: 0, tx: 0.5, ty: 0.5 };
    let beeScale = 1;
    let raf = 0;
    let visible = true;
    let lastFrame = -Infinity;
    let firstPaint = false; // Buzzy's art is in: fade the scene in
    let shown = false;
    // the card leaves too little room for Buzzy: keep the painted picture and stop drawing
    let cramped = false;

    // ---- painted backdrop of the world, on a far plane that travels with the camera ----
    const artUrl = spriteUrl(`world_${theme}`);
    let backdrop: THREE.Mesh | null = null;
    let artAspect = 16 / 9;
    if (artUrl) {
      // fades out at the bottom into the ground, which fogs to the painting's own ground colour
      const fade = fadeTexture();
      const mat = new THREE.MeshBasicMaterial({ fog: false, transparent: true, alphaMap: fade, depthWrite: false });
      backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      backdrop.visible = false;
      camera.add(backdrop);
      new THREE.TextureLoader().load(artUrl, (tex) => {
        if (!alive) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image as { width?: number; height?: number };
        if (img?.width && img?.height) {
          artAspect = img.width / img.height;
          const ground = bottomColour(tex.image as HTMLImageElement);
          if (ground && scene.fog) (scene.fog as THREE.Fog).color.copy(ground);
        }
        mat.map = tex;
        mat.needsUpdate = true;
        if (backdrop) backdrop.visible = true;
        fitBackdrop();
        kick();
      });
    } else {
      const hillMat = flat(th.far);
      for (let i = 0; i < 9; i++) {
        const r = 10 + (i % 3) * 4;
        const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
        hill.position.set(-60 + i * 15, -2, -95 - (i % 2) * 10);
        scene.add(hill);
      }
    }

    // ---- ground and the winding path ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), flat(th.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, -60);
    scene.add(ground);
    // the town's ground is already pale: its path goes lighter still so the way stays easy to see
    const pathBase = `#${new THREE.Color(th.ground).lerp(new THREE.Color(theme === 'town' ? '#fffaf0' : '#fff1c9'), theme === 'town' ? 0.85 : 0.62).getHexString()}`;
    const pathTex = pathTexture(pathBase, pal.accent);
    const rb = ribbon(pathPoints());
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(rb.positions, 3));
    pathGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rb.uvs, 2));
    pathGeo.setIndex(rb.indices);
    pathGeo.computeVertexNormals();
    const path = new THREE.Mesh(pathGeo, new THREE.MeshLambertMaterial({ map: pathTex }));
    path.position.y = 0.01;
    scene.add(path);

    // ---- flowers (instanced: three draw calls for all of them) or ice crystals ----
    const flowerSpots = propSpots(lite ? 32 : 52, 3, -70, PATH_W / 2 + 0.5, 1.2, 1);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    if (theme !== 'ice') {
      const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 5), flat(0x4f9a41), flowerSpots.length);
      const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.26, 0), flat(0xffffff), flowerSpots.length);
      const eyes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), flat(0xf7bf35), flowerSpots.length);
      const colors = [new THREE.Color(pal.accent), new THREE.Color(0xffffff), new THREE.Color(0xf7bf35), new THREE.Color(0xb48ae6), new THREE.Color(0xed8c70)];
      flowerSpots.forEach((s, i) => {
        const k = 0.85 + (i % 3) * 0.15;
        stems.setMatrixAt(i, m4.compose(new THREE.Vector3(s.x, 0.4 * k, s.z), q, one.clone().setScalar(k)));
        heads.setMatrixAt(i, m4.compose(new THREE.Vector3(s.x, 0.86 * k, s.z), q, new THREE.Vector3(k, 0.6 * k, k)));
        eyes.setMatrixAt(i, m4.compose(new THREE.Vector3(s.x, 0.97 * k, s.z), q, one.clone().setScalar(k)));
        heads.setColorAt(i, colors[i % colors.length]);
      });
      [stems, heads, eyes].forEach((m) => { m.instanceMatrix.needsUpdate = true; scene.add(m); });
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    } else {
      const ice = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.4, 0), flat(0xcfeeff), flowerSpots.length);
      flowerSpots.forEach((s, i) => {
        ice.setMatrixAt(i, m4.compose(new THREE.Vector3(s.x, 0.22, s.z), q, one.clone().setScalar(0.8 + (i % 3) * 0.3)));
      });
      ice.instanceMatrix.needsUpdate = true;
      scene.add(ice);
    }

    // ---- trees (and cottages in the town), further from the path ----
    propSpots(lite ? 12 : 20, -2, -80, PATH_W / 2 + 3.5, 6, 2).forEach((s) => {
      const prop = theme === 'ice' ? snowyTree(0.9 + (s.i % 3) * 0.2)
        : theme === 'town' && s.i % 3 === 0 ? cottage(s.i)
        : tree(1 + (s.i % 3) * 0.25, s.i);
      prop.position.set(s.x, 0, s.z);
      prop.rotation.y = s.i * 1.3;
      scene.add(prop);
    });

    // ---- clouds drifting slowly ----
    // (not over a painted backdrop: the painting has its own sky, and 3D clouds would sit on its hills)
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < (artUrl ? 0 : lite ? 3 : 5); i++) {
      const c = cloud();
      c.position.set(-22 + i * 11, 10 + (i % 2) * 2.5, -30 - i * 10);
      c.scale.setScalar(0.9 + (i % 2) * 0.3);
      scene.add(c);
      clouds.push(c);
    }

    // ---- Buzzy: painted billboard, flapping wings, current hat ----
    const bee = new THREE.Group();
    const body = billboard('bee', BEE_H, () => { firstPaint = true; kick(); });
    const bodySprite = () => body.children.find((c) => (c as THREE.Sprite).isSprite) as THREE.Sprite | undefined;
    const bs = bodySprite();
    if (bs) bs.renderOrder = 2;
    else firstPaint = true; // no bee art bundled: show the scene anyway
    bee.add(body);
    // the bee art already has its two painted wings: no extra wing sprites (they read as a halo)
    if (hat) {
      const h = emojiSprite(hat, 0.79);
      h.position.set(-0.13, BEE_H * 0.944, 0.05);
      h.renderOrder = 3;
      bee.add(h);
    }
    bee.position.set(pathX(0), BEE_Y, 0);
    scene.add(bee);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x3d2b1f, transparent: true, opacity: 0.16, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(pathX(0), 0.03, 0);
    scene.add(shadow);

    const fitBackdrop = () => {
      if (!backdrop) return;
      const D = 160;
      const h = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const w = h * camera.aspect;
      const pw = Math.max(w, h * artAspect) * 1.02;
      const ph = pw / artAspect;
      backdrop.scale.set(pw, ph, 1);
      // the view is shifted by `framing`: keep the painting centred on what is seen, its top at the top
      backdrop.position.set(framing.dx * w, h / 2 - framing.dy * h - ph / 2 + 0.01 * h, -D);
    };
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(27)) / Math.min(1, camera.aspect));
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(half * 2), 50, 80);
      const box = el.getBoundingClientRect();
      const c = avoid?.current?.getBoundingClientRect();
      framing = homeFraming(w, h, c ? { left: c.left - box.left, top: c.top - box.top, right: c.right - box.left, bottom: c.bottom - box.top } : null);
      // where Buzzy's middle really lands with this lens (BEE_DROP is only a guess for a squarish view):
      // correct the shift so he sits in the middle of the free space on any screen shape
      camera.clearViewOffset();
      const cam0 = orbitCamera(0);
      camera.position.set(...cam0.pos);
      camera.lookAt(...cam0.look);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const mid = new THREE.Vector3(bee.position.x, BEE_Y + BEE_H / 2, bee.position.z).project(camera);
      framing = { ...framing, ...homeShift(framing, (mid.x + 1) / 2, (1 - mid.y) / 2, h >= TALL_RATIO * w) };
      // Buzzy's shadow only where it reads as his: hidden when it would land far below him on screen
      const foot = new THREE.Vector3(shadow.position.x, 0, shadow.position.z).project(camera);
      shadow.visible = Math.abs(foot.y - mid.y) / 2 <= 0.15;
      camera.setViewOffset(w, h, framing.dx * w, framing.dy * h, w, h);
      beeScale = homeBeeScale(framing.room, h);
      bee.scale.setScalar(beeScale);
      shadow.scale.setScalar(beeScale);
      camera.updateProjectionMatrix();
      fitBackdrop();
      const wasCramped = cramped;
      cramped = !!avoid?.current && !homeWorthShowing(framing.room, h);
      if (cramped) {
        el.classList.remove('on');
        el.dataset.cramped = '1';
        shown = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        return;
      }
      if (wasCramped) delete el.dataset.cramped;
      kick();
    };

    // ---- one loop, ≤30 fps, only while the page is visible and the scene is on screen ----
    const start = performance.now();
    const frame = (now: number) => {
      raf = 0;
      if (!alive || document.hidden || !visible || cramped) return;
      raf = requestAnimationFrame(frame);
      if (!dueFrame(now, lastFrame)) return;
      lastFrame = now;
      const t = (now - start) / 1000;
      // hover and a gentle sway (prototype home: y = 1.4 + sin(3t)·0.15)
      // a smaller Buzzy keeps the same middle (the billboard grows up from its base)
      bee.position.y = BEE_Y + (1 - beeScale) * BEE_H * 0.5 + Math.sin(t * 3) * 0.15 * beeScale;
      const sp = bodySprite();
      if (sp) sp.material.rotation = Math.sin(t * 2) * 0.08;
      shadow.scale.setScalar(beeScale * (1 - Math.sin(t * 3) * 0.08));
      clouds.forEach((c, i) => {
        c.position.x += 0.012 * (i % 2 ? 1 : 0.7);
        if (c.position.x > 40) c.position.x = -40;
      });
      const cam = orbitCamera(t);
      camera.position.set(...cam.pos);
      camera.lookAt(...cam.look);
      renderer.render(scene, camera);
      if (firstPaint && !shown) { shown = true; el.classList.add('on'); el.dataset.drawCalls = String(renderer.info.render.calls); }
    };
    function kick() {
      if (!raf && alive && !document.hidden && visible && !cramped) raf = requestAnimationFrame(frame);
    }
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);
    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) kick();
      })
      : null;
    io?.observe(el);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    ro?.observe(el);
    if (avoid?.current) ro?.observe(avoid.current);
    resize();

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      (backdrop?.material as THREE.MeshBasicMaterial | undefined)?.map?.dispose();
      (backdrop?.material as THREE.MeshBasicMaterial | undefined)?.alphaMap?.dispose();
      disposeScene(scene);
      renderer.dispose();
    };
    // the scene is rebuilt only for a new world or hat (the card ref is stable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, hat]);

  return (
    <div className="home3d" ref={wrap} role="img" aria-label={label} data-testid="home-3d" data-3d="1" data-world={theme}>
      <canvas ref={canvas} className="home3d-canvas" aria-hidden />
      <div className="home3d-wash" aria-hidden />
    </div>
  );
}
