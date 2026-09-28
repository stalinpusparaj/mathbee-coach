import * as THREE from 'three';
import { spriteUrl } from '../assets/manifest';

/** Shared 3D building blocks: renderer, sky, low-poly props and billboards made from the 2D art. */

export function makeRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

/** Big inverted sphere with a vertical colour gradient. */
export function skyDome(top: string, bottom: string, radius = 400): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const cTop = new THREE.Color(top);
  const cBot = new THREE.Color(bottom);
  const colors: number[] = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) / radius + 0.15) / 1.15, 0, 1);
    const c = cBot.clone().lerp(cTop, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

export function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff7e0, 0x6f9a55, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.35);
  sun.position.set(18, 30, 14);
  scene.add(sun);
}

// ---------- billboards from the existing sprites ----------
const loader = new THREE.TextureLoader();
interface TexEntry { tex: THREE.Texture; loaded: boolean; waiters: (() => void)[] }
const texCache = new Map<string, TexEntry>();
const sharedTextures = new Set<THREE.Texture>();

/** Shared, cached texture for a sprite; `onReady` runs once the image has loaded. */
function texture(id: string, onReady?: () => void): THREE.Texture | null {
  const url = spriteUrl(id);
  if (!url) return null;
  let e = texCache.get(url);
  if (!e) {
    const entry: TexEntry = { tex: null as unknown as THREE.Texture, loaded: false, waiters: [] };
    entry.tex = loader.load(url, () => {
      entry.loaded = true;
      entry.waiters.splice(0).forEach((f) => f());
    });
    entry.tex.colorSpace = THREE.SRGBColorSpace;
    entry.tex.anisotropy = 4;
    sharedTextures.add(entry.tex);
    texCache.set(url, entry);
    e = entry;
  }
  if (onReady) {
    if (e.loaded) queueMicrotask(onReady);
    else e.waiters.push(onReady);
  }
  return e.tex;
}

/** A camera-facing cut-out of a sprite, standing with its bottom at y = 0 of the returned group. */
export function billboard(id: string, height: number, onReady?: () => void): THREE.Group {
  const g = new THREE.Group();
  let sprite: THREE.Sprite | null = null;
  const tex = texture(id, () => {
    const img = tex?.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 1;
    // very wide art (planks, boats) is fitted into a box so it doesn't dwarf its neighbours
    const h = aspect > 1.4 ? (height * 1.4) / aspect : height;
    sprite?.scale.set(h * aspect, h, 1);
    onReady?.();
  });
  if (!tex) return g;
  sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.12 }));
  sprite.center.set(0.5, 0);
  sprite.scale.set(height, height, 1);
  g.add(sprite);
  return g;
}

/** Emoji / short text drawn to a canvas texture (rewards on the journey). */
export function emojiSprite(text: string, size: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

// ---------- low-poly props ----------
const flat = (color: number | string) => new THREE.MeshLambertMaterial({ color, flatShading: true });

export function tree(scale = 1, hue = 0): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 6), flat(0x8a5a2b));
  trunk.position.y = 0.7;
  g.add(trunk);
  const greens = [0x5fa84a, 0x74b95a, 0x4f9a41, 0x86c25f];
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), flat(greens[hue % greens.length]));
  top.position.y = 2.05;
  top.scale.set(1.15, 1, 1.15);
  g.add(top);
  const top2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), flat(greens[(hue + 1) % greens.length]));
  top2.position.set(0.25, 2.75, 0.1);
  g.add(top2);
  if (hue % 3 === 0) {
    // a few fruit trees
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), flat(0xd9412b));
      const a = (i / 5) * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.95, 1.9 + (i % 2) * 0.35, Math.sin(a) * 0.95);
      g.add(f);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

export function cloud(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.95 });
  [[0, 0, 0, 1.6], [1.5, -0.2, 0.2, 1.2], [-1.4, -0.25, 0.1, 1.1], [0.6, 0.6, -0.2, 1.0]].forEach(([x, y, z, r]) => {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
    s.position.set(x, y, z);
    g.add(s);
  });
  return g;
}

/** Floating grass island (journey). */
export function island(top: string, radius = 1.35): THREE.Group {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.95, 0.35, 10), flat(top));
  grass.position.y = -0.17;
  g.add(grass);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.92, radius * 1.3, 8), flat(0x9c7a55));
  rock.rotation.x = Math.PI;
  rock.position.y = -0.35 - radius * 0.65;
  g.add(rock);
  for (let i = 0; i < 4; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 4), flat(0x4f9a41));
    const a = i * 1.7;
    tuft.position.set(Math.cos(a) * radius * 0.75, 0.12, Math.sin(a) * radius * 0.75);
    g.add(tuft);
  }
  return g;
}

export function hive(): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xf7c948, 0xf2b533];
  for (let i = 0; i < 4; i++) {
    const r = 0.55 + i * 0.12;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 8, 16), flat(colors[i % 2]));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.5 - i * 0.38;
    g.add(ring);
  }
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), flat(0x5a3a18));
  door.position.set(0, 0.55, 0.98);
  g.add(door);
  return g;
}

export function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    mats.forEach((mat) => {
      const withMap = mat as THREE.Material & { map?: THREE.Texture | null };
      // sprite textures are shared between scenes and stay cached; one-off canvas textures are freed
      if (withMap.map && !sharedTextures.has(withMap.map)) withMap.map.dispose();
      mat.dispose();
    });
  });
}
