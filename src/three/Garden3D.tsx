import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CategoryId } from '../engine/types';
import { CATEGORIES, GARDEN_ITEMS } from '../curriculum/curriculum';
import { hasSprite } from '../assets/manifest';
import { GARDEN_R, POND, flatSpots, landmarkPositions, terrainHeight, treePositions } from './layout3d';
import { THEMES, type JourneyTheme } from '../activities/journey';
import { billboard, emojiSprite, cloud, disposeScene, lights, makeRenderer, skyDome, tree } from './kit';

export interface Garden3DProps {
  names: Record<CategoryId, string>;
  blooms: Record<CategoryId, number>;
  recommended?: CategoryId;
  owned: string[];
  onOpen: (c: CategoryId) => void;
  label: string;
  hint: string;
  /** friends met on journeys come to live around the pond */
  friends?: JourneyTheme[];
  hat?: string | null;
}

const ICON_3D = (icon: string) => (icon.startsWith('bird:') ? 'owl_keeper' : icon);

/**
 * Explorable 3D garden: low-poly hills, trees, pond and bridge, drifting clouds and a flying bee,
 * with the 14 places as landmarks. Place names are real HTML buttons that follow their landmark,
 * so tapping, keyboard use and screen readers work exactly as on the flat map.
 */
export default function Garden3D({ names, blooms, recommended, owned, onOpen, label, hint, friends = [], hat = null }: Garden3DProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    const el = wrap.current!;
    const renderer = makeRenderer(canvas.current!);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xdff2fb, 60, 150);
    scene.add(skyDome('#9fd8f7', '#fff4d6'));
    lights(scene);

    const flats = flatSpots();
    const h = (x: number, z: number) => terrainHeight(x, z, flats);

    // ground: displaced low-poly plane with height-based greens, plus a far meadow to the horizon
    const size = GARDEN_R * 2 + 10;
    const geo = new THREE.PlaneGeometry(size, size, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors: number[] = [];
    const low = new THREE.Color('#9ad37a');
    const high = new THREE.Color('#5f9e46');
    const rim = new THREE.Color('#86c26a');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = h(x, z);
      pos.setY(i, y);
      const c = Math.hypot(x, z) > GARDEN_R ? rim : low.clone().lerp(high, THREE.MathUtils.clamp((y + 0.4) / 1.6, 0, 1));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    const meadow = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshLambertMaterial({ color: '#a6d98a' }));
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.y = -0.7;
    scene.add(meadow);

    // pond with lily pads and an arched wooden bridge
    const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 40), new THREE.MeshStandardMaterial({ color: '#6fc3e8', roughness: 0.15, metalness: 0.05 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(POND.x, -0.06, POND.z);
    scene.add(pond);
    const shore = new THREE.Mesh(new THREE.RingGeometry(POND.r, POND.r + 0.45, 40), new THREE.MeshLambertMaterial({ color: '#e8d6a8' }));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(POND.x, -0.04, POND.z);
    scene.add(shore);
    for (let i = 0; i < 6; i++) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10, 0.3, Math.PI * 1.8), new THREE.MeshLambertMaterial({ color: '#4f9a41' }));
      pad.rotation.x = -Math.PI / 2;
      const a = i * 1.1;
      pad.position.set(POND.x + Math.cos(a) * 2.6, -0.03, POND.z + Math.sin(a) * 2.3);
      scene.add(pad);
    }
    const wood = new THREE.MeshLambertMaterial({ color: '#b98246', flatShading: true });
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 1.7), wood);
      plank.position.set(POND.x - 5 + t * 10, 0.1 + Math.sin(Math.PI * t) * 0.9, POND.z);
      plank.rotation.z = -Math.cos(Math.PI * t) * 0.28;
      scene.add(plank);
      if (i % 2 === 0) {
        for (const side of [-0.8, 0.8]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), wood);
          post.position.set(plank.position.x, plank.position.y + 0.4, POND.z + side);
          scene.add(post);
        }
      }
    }

    // winding stepping-stone path through every place
    const marks = landmarkPositions();
    const curve = new THREE.CatmullRomCurve3(marks.map((m) => new THREE.Vector3(m.x, 0, m.z)), true, 'centripetal');
    const pts = curve.getSpacedPoints(170);
    const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 8), new THREE.MeshLambertMaterial({ color: '#e8cf98' }), pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach((p, i) => {
      m4.makeTranslation(p.x, h(p.x, p.z) + 0.05, p.z);
      stones.setMatrixAt(i, m4);
    });
    scene.add(stones);

    // trees and flowers
    treePositions().forEach((tp, i) => {
      const tr = tree(tp.s, i);
      tr.position.set(tp.x, h(tp.x, tp.z), tp.z);
      tr.rotation.y = i * 0.7;
      scene.add(tr);
    });
    const flowerColors = ['#f7c948', '#e86a92', '#ffffff', '#ed8c70', '#b48ef0'].map((c) => new THREE.Color(c));
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), 220);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 220; i++) {
      const r = Math.sqrt(rnd()) * (GARDEN_R - 3);
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const inPond = Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.6;
      m4.makeTranslation(x, inPond ? -5 : h(x, z) + 0.14, z);
      flowers.setMatrixAt(i, m4);
      flowers.setColorAt(i, flowerColors[i % flowerColors.length]);
    }
    scene.add(flowers);

    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 7; i++) {
      const c = cloud();
      c.position.set(-60 + i * 20, 15 + (i % 3) * 3, -48 - (i % 2) * 10);
      c.scale.setScalar(1.4 + (i % 3) * 0.4);
      clouds.push(c);
      scene.add(c);
    }

    // landmarks: a stage with the place's art standing on it
    let dirty = true;
    const ready = () => { dirty = true; };
    const pickables: THREE.Object3D[] = [];
    const labelAnchors: { id: CategoryId; v: THREE.Vector3 }[] = [];
    let ring: THREE.Mesh | null = null;
    marks.forEach((m) => {
      const y = h(m.x, m.z);
      const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 0.5, 14), new THREE.MeshLambertMaterial({ color: '#f3dfb5', flatShading: true }));
      stage.position.set(m.x, y + 0.25, m.z);
      stage.userData.cat = m.id;
      scene.add(stage);
      pickables.push(stage);
      const cat = CATEGORIES.find((c) => c.id === m.id)!;
      const art = billboard(ICON_3D(cat.icon), 2.9, ready);
      art.position.set(m.x, y + 0.5, m.z);
      art.traverse((o) => { o.userData.cat = m.id; });
      scene.add(art);
      pickables.push(art);
      // bloom level: small flowers around the stage
      for (let b = 0; b < (blooms[m.id] ?? 0); b++) {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshLambertMaterial({ color: '#ed8c70', flatShading: true }));
        const a = b * 2.1;
        f.position.set(m.x + Math.cos(a) * 1.6, y + 0.62, m.z + Math.sin(a) * 1.6);
        scene.add(f);
      }
      if (m.id === recommended) {
        ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd84d' }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(m.x, y + 0.55, m.z);
        scene.add(ring);
      }
      labelAnchors.push({ id: m.id, v: new THREE.Vector3(m.x, y + 0.2, m.z + 1.9) });
    });

    // restored garden items stand around the garden
    GARDEN_ITEMS.filter((g) => owned.includes(g.id) && hasSprite(g.sprite)).forEach((g) => {
      const x = ((g.x - 50) / 50) * (GARDEN_R - 6);
      const z = ((g.y - 50) / 50) * (GARDEN_R - 10);
      const item = billboard(g.sprite, 1.5, ready);
      item.position.set(x, h(x, z), z);
      scene.add(item);
    });

    const bee = billboard('bee', 1.6, ready);
    if (hat) {
      const h = emojiSprite(hat, 0.8);
      h.position.set(-0.13, 1.55, 0.05);
      bee.add(h);
    }
    scene.add(bee);

    // friends met on journeys stroll around the pond
    const strollers = friends.map((f, i) => {
      const goal = THEMES[f].goal;
      const g = goal === 'svg:hive' ? billboard('bee', 1.5, ready) : billboard(goal, 1.7, ready);
      if (goal === 'svg:hive') {
        const crown = emojiSprite('👑', 0.7);
        crown.position.set(-0.1, 1.45, 0.05);
        g.add(crown);
      }
      scene.add(g);
      return { g, a0: (i / Math.max(1, friends.length)) * Math.PI * 2 + 0.4, r: POND.r + 1.9 + (i % 2) * 0.8 };
    });

    // camera and gentle orbit controls
    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
    camera.position.set(0, 15, 31);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, -0.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 16;
    controls.maxDistance = 58;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.25;
    controls.rotateSpeed = 0.6;
    controls.addEventListener('change', ready);
    controls.addEventListener('start', () => el.classList.add('touched'));
    controls.update();

    // tap a landmark (not a drag) to open it
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
      down = null;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(pickables, true)[0];
      const cat = hit?.object.userData.cat as CategoryId | undefined;
      if (cat) openRef.current(cat);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const resize = () => {
      const w = el.clientWidth;
      const hh = el.clientHeight;
      renderer.setSize(w, hh, false);
      camera.aspect = w / Math.max(1, hh);
      camera.updateProjectionMatrix();
      // narrow (portrait) screens step the camera back so the whole ring of places fits
      const fit = 34 * Math.max(1, 1.3 / camera.aspect);
      const fog = scene.fog as THREE.Fog;
      fog.near = fit + 25;
      fog.far = fit + 120;
      controls.maxDistance = Math.max(58, fit + 12);
      if (!el.classList.contains('touched')) {
        // portrait screens look down a little more steeply so the garden fills the frame
        const dir = camera.aspect < 1.2 ? new THREE.Vector3(0, 1, 1.05).normalize() : new THREE.Vector3(0, 15, 31.5).normalize();
        camera.position.copy(controls.target).addScaledVector(dir, fit);
        controls.update();
      }
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const v = new THREE.Vector3();
    const placeLabels = () => {
      const w = el.clientWidth;
      const hh = el.clientHeight;
      // nearest labels are placed first; ones behind them step upward instead of overlapping
      const items = labelAnchors.map(({ id, v: anchor }) => {
        v.copy(anchor).project(camera);
        return { b: labelRefs.current[id], x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * hh, z: v.z, on: v.z < 1 };
      }).sort((a, b) => a.z - b.z);
      const placed: { l: number; r: number; t: number; btm: number }[] = [];
      items.forEach(({ b, x: ax, y, z, on }) => {
        let x = ax;
        if (!b) return;
        b.style.display = on ? '' : 'none';
        if (!on) return;
        const bw = b.offsetWidth || 90;
        const bh = b.offsetHeight || 30;
        // labels never leave the view, so every place stays tappable at any angle
        x = Math.min(w - bw / 2 - 2, Math.max(bw / 2 + 2, x));
        let top = Math.min(hh - bh - 2, Math.max(2, y - bh * 0.3));
        for (let tries = 0; tries < 4; tries++) {
          const hit = placed.find((p) => x - bw / 2 < p.r && x + bw / 2 > p.l && top < p.btm && top + bh > p.t);
          if (!hit) break;
          top = hit.t - bh - 2;
        }
        placed.push({ l: x - bw / 2, r: x + bw / 2, t: top, btm: top + bh });
        b.style.transform = `translate(${x - bw / 2}px, ${top}px)`;
        b.style.zIndex = String(1000 - Math.round(z * 500));
      });
    };

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();
    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const t = clock.getElapsedTime();
      bee.position.set(Math.sin(t * 0.25) * 15, 6 + Math.sin(t * 1.3) * 0.5, Math.sin(t * 0.5) * 10);
      clouds.forEach((c, i) => { c.position.x += Math.sin(t * 0.05 + i) * 0.004; });
      if (ring) ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      strollers.forEach(({ g, a0, r }, i) => {
        const a = a0 + t * 0.06 * (i % 2 ? -1 : 1);
        const x = POND.x + Math.cos(a) * r;
        const z = POND.z + Math.sin(a) * r * 0.85;
        g.position.set(x, h(x, z) + Math.abs(Math.sin(t * 2.2 + i)) * 0.12, z);
      });
      controls.update();
      renderer.render(scene, camera);
      if (dirty) { placeLabels(); dirty = false; el.dataset.drawCalls = String(renderer.info.render.calls); }
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      disposeScene(scene);
      renderer.dispose();
    };
    // the scene is rebuilt only when what it shows changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended, JSON.stringify(blooms), owned.join(), friends.join(), hat]);

  return (
    <div className="garden3d" ref={wrap} role="group" aria-label={label}>
      <canvas ref={canvas} className="garden3d-canvas" aria-hidden />
      <div className="garden3d-labels">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            ref={(b) => { labelRefs.current[c.id] = b; }}
            type="button"
            className={`loc3d ${recommended === c.id ? 'recommended' : ''}`}
            onClick={() => onOpen(c.id)}
            data-testid={`loc-${c.id}`}
          >
            <span className="loc-name">{names[c.id]}</span>
            <span className="blooms" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={i < (blooms[c.id] ?? 0) ? 'on' : ''}>✿</span>)}</span>
          </button>
        ))}
      </div>
      <p className="garden3d-hint" aria-hidden>{hint}</p>
    </div>
  );
}
