import type { SceneProps } from '../sceneTypes';
import { arr, SOLUTION } from '../sceneTypes';
import { ShapeSvg, shapePoints } from '../../components/art';
import { useT } from '../../i18n/useT';

/** C06: exact SVG geometry. Sides and corners are tappable; compose fills unit squares. */
export function ShapesScene({ q, work, setWork, response, setResponse, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'shapes') return null;
  const s = q.scene;
  const fill = bw ? '#fff' : '#bde6f5';

  if (s.mode === 'compose') {
    const sh = s.shapes[0];
    const filled = arr<number>(work.filled);
    const cells = sh.w * sh.h;
    const toggle = (i: number) => interactive && setWork({ ...work, filled: filled.includes(i) ? filled.filter((x) => x !== i) : [...filled, i] });
    return (
      <div className={`scene shapes compose ${bw ? 'bw' : ''}`}>
        <div className="compose-grid" style={{ gridTemplateColumns: `repeat(${sh.w}, 56px)` }} role="group" aria-label={t('ui.fillShape')}>
          {Array.from({ length: cells }, (_, i) => {
            const on = filled.includes(i) || reveal >= SOLUTION;
            return (
              <button key={i} type="button" className={`compose-cell ${on ? 'on' : ''}`} onClick={() => toggle(i)} disabled={!interactive} aria-pressed={on} aria-label={t('ui.square')} data-testid={`cell-${i}`}>
                {on && reveal >= 2 ? filled.indexOf(i) + 1 || i + 1 : ''}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (s.mode === 'sides' || s.mode === 'corners') {
    const sh = s.shapes[0];
    const sides = arr<number>(work.sides);
    const corners = arr<number>(work.corners);
    const n = shapePoints(sh.shape, sh.w, sh.h).length;
    const solved = reveal >= SOLUTION;
    const marked = { sides: solved ? Array.from({ length: n }, (_, i) => i) : sides, corners: solved ? Array.from({ length: n }, (_, i) => i) : corners };
    return (
      <div className={`scene shapes single ${bw ? 'bw' : ''}`}>
        <ShapeSvg
          shape={sh.shape} rotation={sh.rotation} w={sh.w} h={sh.h} size={220} fill={fill} label={t(`shape.${sh.shape}`)}
          marked={marked}
          onSide={interactive && s.mode === 'sides' ? (i) => setWork({ ...work, sides: sides.includes(i) ? sides.filter((x) => x !== i) : [...sides, i] }) : undefined}
          onCorner={interactive && s.mode === 'corners' ? (i) => setWork({ ...work, corners: corners.includes(i) ? corners.filter((x) => x !== i) : [...corners, i] }) : undefined}
        />
        {interactive && sh.shape !== 'circle' && <p className="scene-note small">{t(s.mode === 'sides' ? 'ui.tapSides' : 'ui.tapCorners')}</p>}
        {interactive && sh.shape === 'circle' && <p className="scene-note small">{t('ui.circleLook')}</p>}
      </div>
    );
  }

  if (s.mode === 'pick') {
    const chosen = response?.kind === 'choice' ? response.value : null;
    return (
      <div className={`scene shapes row ${bw ? 'bw' : ''}`}>
        {s.shapes.map((sh) => {
          const on = chosen === sh.id || (reveal >= SOLUTION && q.answer.kind === 'choice' && q.answer.value === sh.id);
          return (
            <button key={sh.id} type="button" className={`shape-btn ${on ? 'on' : ''}`} onClick={() => interactive && setResponse({ kind: 'choice', value: sh.id })} disabled={!interactive}
              aria-label={t('ui.shapeN', { n: sh.id.slice(1) })} data-testid={`shape-${sh.id}`}>
              <ShapeSvg shape={sh.shape} rotation={sh.rotation} w={sh.w} h={sh.h} size={110} fill={fill} />
            </button>
          );
        })}
      </div>
    );
  }

  const sh = s.shapes[0];
  return (
    <div className={`scene shapes single ${bw ? 'bw' : ''}`}>
      <ShapeSvg shape={sh.shape} rotation={sh.rotation} w={sh.w} h={sh.h} size={200} fill={fill} outline={s.mode === 'outline'} label={s.mode === 'outline' ? t('ui.outline') : t('ui.theShape')} />
    </div>
  );
}
