import { arr, SOLUTION, fieldStyle } from '../sceneTypes';
import { activeSkin, bobDelay, type SkinnedSceneProps } from './skins';
import { gridDims } from '../../engine/layout';
import { Sprite } from '../../components/art';
import { useT } from '../../i18n/useT';
import { markFx } from '../../components/math-models';
import { sfx } from '../../audio/sfx';

/**
 * C01 counting. Tap an object to mark it counted (tap again to unmark). Each object has a
 * unique id, so it can never be counted twice. Objects never move while counting.
 * Bubble Pop skin: each object floats in a soap bubble that bobs a few pixels on the spot
 * (still under reduced motion); marking pops it into a sparkle, unmarking re-bubbles it.
 */
export function CountScene({ q, work, setWork, interactive, reveal, bw, skin }: SkinnedSceneProps) {
  const t = useT();
  if (q.scene.type !== 'count') return null;
  const s = q.scene;
  const marked = arr<string>(work.marked);
  const toggle = (id: string, el?: Element) => {
    if (!interactive) return;
    const adding = !marked.includes(id);
    setWork({ ...work, marked: adding ? [...marked, id] : marked.filter((m) => m !== id) });
    // counting feedback (presentation only): the object hops and a rising note plays for "n"
    if (adding) {
      markFx(el, marked.length + 1);
      if (!bw && activeSkin(skin, q)?.family === 'bubbles') sfx.bubble();
    }
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

  const bubbles = !bw && activeSkin(skin, q)?.family === 'bubbles';
  const n = s.objects.length;
  const dims = gridDims(n, s.layout);
  const fs = fieldStyle(dims.cols, dims.rows);
  return (
    <div className={`scene count-field ${bw ? 'bw' : ''} ${s.container ? 'with-basket' : ''} ${bubbles ? 'skin-bubbles' : ''}`} data-skin={bubbles ? 'bubbles' : undefined}>
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
            onClick={(e) => toggle(o.id, e.currentTarget)}
            disabled={!interactive}
            aria-pressed={on}
            aria-label={bubbles ? t('skin.bubbleN', { n: i + 1 }) : t('ui.objectN', { n: i + 1 })}
            data-testid={`obj-${o.id}`}
          >
            {bubbles ? (
              <span className={`bubble ${on ? 'popped' : ''}`} style={{ animationDelay: bobDelay(i) }} aria-hidden>
                <Sprite id={o.kind} size="100%" decorative />
                {on && <span className="sparkle" />}
              </span>
            ) : <Sprite id={o.kind} size="100%" decorative />}
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
