import type { SceneProps } from '../sceneTypes';
import { rec, SOLUTION, fieldStyle } from '../sceneTypes';
import { gridDims } from '../../engine/layout';
import { Bird } from '../../components/art';
import { useDragOrTap } from '../../components/dnd';
import { useT } from '../../i18n/useT';

/**
 * C03: sort birds into habitats (drag, or tap bird then tap habitat) and count.
 * The target bird is always shown next to its name, so bird vocabulary does not
 * masquerade as a counting difficulty.
 */
export function BirdScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  const placed = rec<string>(work.placed);
  const dnd = useDragOrTap((obj, zone) => {
    const next = { ...placed };
    if (zone === 'field') delete next[obj];
    else next[obj] = zone;
    setWork({ ...work, placed: next });
  }, interactive);
  if (q.scene.type !== 'birds') return null;
  const s = q.scene;
  if (!s.birds.length) return null; // vocabulary question: the choices carry the pictures

  const solved = reveal >= SOLUTION;
  const fs = fieldStyle(gridDims(s.birds.length, 'scatter').cols, gridDims(s.birds.length, 'scatter').rows);
  const where = (id: string, kind: string) => (solved && s.habitats.includes(kind as never) ? kind : placed[id]);
  const inField = s.birds.filter((b) => !where(b.id, b.kind));
  return (
    <div className={`scene birds ${bw ? 'bw' : ''}`}>
      {s.target && s.target.length <= 2 && (
        <div className="target-card" aria-label={t('ui.lookFor')}>
          {s.target.map((sp) => (
            <span key={sp} className="target"><Bird species={sp} size="44px" /> {t(`bird.${sp}`)}</span>
          ))}
        </div>
      )}
      <div className="zone bird-field" {...dnd.zoneProps('field')} role="group" aria-label={t('ui.birdField')} style={fs.area}>
        <div className="field-inner">
        {(interactive || solved ? inField : s.birds).map((b) => {
          const { style: dragStyle, ...op } = dnd.objProps(b.id);
          return (
          <span
            key={b.id}
            role="button"
            tabIndex={interactive ? 0 : -1}
            className={`bird-token ${dnd.selected === b.id ? 'selected' : ''} ${reveal >= 1 && s.target?.includes(b.kind as never) && !solved ? 'glow' : ''}`}
            {...op}
            style={{ left: `${b.x}%`, top: `${b.y}%`, ...fs.obj, ...(dragStyle ? { transform: `translate(-50%, -50%) ${dragStyle.transform}`, zIndex: 20 } : {}) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dnd.setSelected(dnd.selected === b.id ? null : b.id); } }}
            aria-label={t(`bird.${b.kind}`)}
            data-testid={`bird-${b.id}`}
          >
            <Bird species={b.kind as never} size="100%" />
          </span>
          );
        })}
        </div>
      </div>
      {(interactive || solved) && (
        <div className="habitats">
          {s.habitats.map((h) => {
            const here = s.birds.filter((b) => where(b.id, b.kind) === h);
            return (
              <button key={h} type="button" className="zone habitat" {...dnd.zoneProps(h)} disabled={!interactive && !solved} data-testid={`habitat-${h}`}
                aria-label={t('ui.homeFor', { birds: t(`birds.${h}`) })}>
                <span className="habitat-head"><Bird species={h} size="30px" /> {t(`birds.${h}`)}</span>
                <span className="habitat-birds">
                  {here.map((b) => <span key={b.id} className="mini-bird"><Bird species={b.kind as never} size="100%" /></span>)}
                </span>
                {(reveal >= 3 || solved) && <span className="tag">{here.length}</span>}
              </button>
            );
          })}
        </div>
      )}
      {interactive && dnd.selected && <p className="scene-note small">{t('ui.nowTapHome')}</p>}
      {interactive && Object.keys(placed).length > 0 && (
        <div className="scene-tools">
          <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, placed: {} })}>{t('ui.reset')}</button>
        </div>
      )}
    </div>
  );
}
