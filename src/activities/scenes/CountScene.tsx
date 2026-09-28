import type { SceneProps } from '../sceneTypes';
import { arr, SOLUTION, fieldStyle } from '../sceneTypes';
import { gridDims } from '../../engine/layout';
import { Sprite } from '../../components/art';
import { useT } from '../../i18n/useT';

/**
 * C01 counting. Tap an object to mark it counted (tap again to unmark). Each object has a
 * unique id, so it can never be counted twice. Objects never move while counting.
 */
export function CountScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'count') return null;
  const s = q.scene;
  const marked = arr<string>(work.marked);
  const toggle = (id: string) => {
    if (!interactive) return;
    setWork({ ...work, marked: marked.includes(id) ? marked.filter((m) => m !== id) : [...marked, id] });
  };
  const showAllNumbers = reveal >= SOLUTION;
  const showMarkNumbers = reveal >= 2 || showAllNumbers;

  if (s.groups) {
    let running = 0;
    return (
      <div className={`scene count-groups ${bw ? 'bw' : ''}`}>
        {s.groups.map((g) => {
          const on = marked.includes(g.id) || showAllNumbers;
          running += g.filled;
          return (
            <button key={g.id} type="button" className={`group-frame size-${g.size} ${on ? 'marked' : ''}`} onClick={() => toggle(g.id)} disabled={!interactive}
              aria-pressed={on} aria-label={t('ui.groupOf', { n: g.filled })} data-testid={`group-${g.id}`}>
              <span className="cells">
                {Array.from({ length: g.size }, (_, i) => (
                  <span key={i} className="cell">{i < g.filled && <Sprite id={s.worksheetIcon ?? 'daisy'} size="100%" decorative />}</span>
                ))}
              </span>
              {(showAllNumbers || (on && reveal >= 2)) && <span className="running">{running}</span>}
              {on && !showAllNumbers && reveal < 2 && <span className="check" aria-hidden>✓</span>}
            </button>
          );
        })}
      </div>
    );
  }

  const n = s.objects.length;
  const dims = gridDims(n, s.layout);
  const fs = fieldStyle(dims.cols, dims.rows);
  return (
    <div className={`scene count-field ${bw ? 'bw' : ''} ${s.container ? 'with-basket' : ''}`}>
      <div className="field-area" style={fs.area}>
      {s.container && <Sprite id="basket" size="min(46%, 240px)" className="basket-bg" decorative />}
      {n === 0 && s.container && reveal >= 2 && <p className="empty-note">{t('ui.emptyBasket')}</p>}
      <div className="field-inner">
      {s.objects.map((o, i) => {
        const on = marked.includes(o.id) || showAllNumbers;
        const idx = showAllNumbers ? i + 1 : marked.indexOf(o.id) + 1;
        return (
          <button
            key={o.id}
            type="button"
            className={`obj ${on ? 'marked' : ''}`}
            style={{ left: `${o.x}%`, top: `${o.y}%`, ...fs.obj }}
            onClick={() => toggle(o.id)}
            disabled={!interactive}
            aria-pressed={on}
            aria-label={t('ui.objectN', { n: i + 1 })}
            data-testid={`obj-${o.id}`}
          >
            <Sprite id={o.kind} size="100%" decorative />
            {on && (showMarkNumbers ? <span className="badge num">{idx}</span> : <span className="badge" aria-hidden>✓</span>)}
          </button>
        );
      })}
      </div>
      </div>
      {interactive && marked.length > 0 && (
        <div className="scene-tools">
          <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, marked: marked.slice(0, -1) })}>{t('ui.undo')}</button>
          <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, marked: [] })}>{t('ui.clearMarks')}</button>
        </div>
      )}
    </div>
  );
}
