import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { THEMES, type JourneyTheme } from '../activities/journey';
import type { StepMark } from '../components/JourneyTrack';
import { islandPositions } from './layout3d';
import { billboard, cloud, disposeScene, emojiSprite, hive, island, lights, makeRenderer, skyDome, tree } from './kit';

export interface Journey3DProps {
  theme: JourneyTheme;
  at: number;
  total: number;
  marks: StepMark[];
  finished?: boolean;
  label: string;
}

interface Api { place: (at: number, finished: boolean) => void; rewards: (marks: StepMark[]) => void }

const HOP_MS = 900;

/**
 * The session journey in 3D: floating islands lead to the friend at the end, and the bee hops
 * one island per finished question with the camera following. Frames are drawn only while
 * something moves, so the scene is completely still while the child is thinking.
 */
export default function Journey3D({ theme, at, total, marks, finished = false, label }: Journey3DProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<Api | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const th = THEMES[theme];
    const renderer = makeRenderer(canvas.current!);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(th.sky[1], 16, 50);
    scene.add(skyDome(th.sky[0], th.sky[1], 120));
    lights(scene);

    const pts = islandPositions(total);
    const last = pts[pts.length - 1];

    // islands float in open sky; soft distant hills sit low on the horizon for depth
    const hillMat = new THREE.MeshLambertMaterial({ color: th.far, flatShading: true });
    for (let x = -10, i = 0; x < last.x + 18; x += 6.5, i++) {
      const r = 5 + (i % 3) * 1.5;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      hill.position.set(x, -6 - (i % 2), -22 - (i % 3) * 3);
      scene.add(hill);
    }
    for (let i = 0; i < Math.ceil(last.x / 9) + 3; i++) {
      const c = cloud();
      c.position.set(-4 + i * 9, 5 + (i % 2) * 1.4, -12);
      c.scale.setScalar(0.7);
      scene.add(c);
    }

    // islands with the world's platform art on top, and the friend waiting on the last one
    let dirty = true;
    const ready = () => { dirty = true; kick(); };
    pts.forEach((p, k) => {
      const goal = k === pts.length - 1;
      const isl = island(th.mid, goal ? 1.9 : 1.3);
      isl.position.set(p.x, p.y, p.z);
      scene.add(isl);
      if (!goal && k % 2 === 1) {
        const tr = tree(0.45, k);
        tr.position.set(p.x - 0.7, p.y, p.z - 0.6);
        scene.add(tr);
      }
      if (!goal) {
        const deco = billboard(th.platform, 0.9, ready);
        deco.position.set(p.x + 0.55, p.y, p.z - 0.35);
        scene.add(deco);
      }
    });
    if (th.goal === 'svg:hive') {
      const h = hive();
      h.position.set(last.x + 0.4, last.y, last.z);
      scene.add(h);
    } else {
      const f = billboard(th.goal, 2.1, ready);
      f.position.set(last.x + 0.4, last.y, last.z);
      scene.add(f);
    }
    const flag = emojiSprite('🏁', 0.9);
    flag.position.set(last.x + 1.4, last.y + 2.2, last.z);
    scene.add(flag);

    const rewardGroup = new THREE.Group();
    scene.add(rewardGroup);

    const bee = billboard('bee', 1.5, ready);
    scene.add(bee);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 300);
    const beeSpot = (k: number, fin: boolean) => {
      const p = pts[Math.min(k, pts.length - 1)];
      return new THREE.Vector3(p.x - (fin ? 1.2 : 0), p.y, p.z + (fin ? 0.4 : 0));
    };
    const aimCamera = (x: number) => {
      const aspect = (el.clientWidth || 1) / (el.clientHeight || 1);
      // show about five islands whatever the strip's shape, with the bee left of centre
      const viewW = Math.min(26, Math.max(13, aspect * 4.2));
      const dist = THREE.MathUtils.clamp(viewW / aspect / 2 / Math.tan(THREE.MathUtils.degToRad(19)), 6.5, 13);
      const lead = viewW * 0.22;
      camera.position.set(x + lead, 1.5 + dist * 0.14, dist);
      camera.lookAt(x + lead, 0.75, 0);
    };

    let from = beeSpot(at, finished);
    let to = from.clone();
    let hopStart = -1;
    bee.position.copy(from);
    aimCamera(from.x);

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      aimCamera(bee.position.x);
      dirty = true;
      kick();
    };

    let raf = 0;
    let alive = true;
    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      if (hopStart >= 0) {
        const k = Math.min(1, (now - hopStart) / HOP_MS);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        bee.position.lerpVectors(from, to, e);
        bee.position.y += Math.sin(Math.PI * k) * 1.5;
        aimCamera(bee.position.x);
        dirty = true;
        if (k >= 1) { hopStart = -1; from = to.clone(); }
      }
      if (dirty) { renderer.render(scene, camera); dirty = false; }
      if (hopStart >= 0) kick();
    };
    function kick() { if (!raf && alive) raf = requestAnimationFrame(frame); }

    api.current = {
      place(k, fin) {
        const target = beeSpot(k, fin);
        if (target.distanceTo(to) < 0.01) return;
        from = bee.position.clone();
        to = target;
        hopStart = performance.now();
        kick();
      },
      rewards(ms) {
        rewardGroup.children.slice().forEach((c) => { disposeScene(c); rewardGroup.remove(c); });
        ms.forEach((m, k) => {
          if (!m?.done || m.skipped || k >= pts.length - 1) return;
          const s = emojiSprite(m.own ? '🍯' : '🌼', 0.75);
          s.position.set(pts[k].x - 0.55, pts[k].y + 0.45, pts[k].z + 0.3);
          rewardGroup.add(s);
        });
        dirty = true;
        kick();
      },
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    return () => {
      alive = false;
      api.current = null;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      disposeScene(scene);
      renderer.dispose();
    };
    // the scene is rebuilt only for a new world or length; hops and rewards update it in place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, total]);

  useEffect(() => { api.current?.place(at, finished); }, [at, finished, theme, total]);
  const markKey = marks.map((m) => (m?.done ? (m.skipped ? 's' : m.own ? 'o' : 'h') : '-')).join('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.rewards(marks); }, [markKey, theme, total]);

  return (
    <div className={`journey journey3d theme-${theme}`} ref={wrap} role="img" aria-label={label} data-testid="journey" data-3d="1" data-at={at}>
      <canvas ref={canvas} className="journey3d-canvas" aria-hidden />
    </div>
  );
}
