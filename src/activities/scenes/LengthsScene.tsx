import type { SceneProps } from '../sceneTypes';
import { num, SOLUTION } from '../sceneTypes';
import { useT } from '../../i18n/useT';

const MAX_UNITS = 11;

/**
 * C05: planks all start at one shared line and are drawn with one fixed unit size, so
 * comparisons are fair. Unit blocks are placed end to end — no gaps, no overlaps.
 */
export function LengthsScene({ q, work, setWork, response, setResponse, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'lengths') return null;
  const s = q.scene;
  const unitPct = 100 / MAX_UNITS;
  const pick = (id: string) => {
    if (!interactive) return;
    if (q.answer.kind === 'choice') setResponse({ kind: 'choice', value: id });
    else if (q.answer.kind === 'order') {
      const cur = response?.kind === 'order' ? response.value : [];
      if (!cur.includes(id)) setResponse({ kind: 'order', value: [...cur, id] });
    }
  };
  const chosen = response?.kind === 'choice' ? [response.value] : response?.kind === 'order' ? response.value : [];
  const solutionIds = reveal >= SOLUTION ? (q.answer.kind === 'choice' ? [q.answer.value] : q.answer.kind === 'order' ? q.answer.value : []) : [];

  // bridge-building tasks
  if (s.gap !== undefined) {
    const placedStart = s.placed ?? 0;
    const added = num(work.added);
    const total = reveal >= SOLUTION ? s.gap : Math.min(s.gap, placedStart + added);
    const setAdded = (v: number) => setWork({ ...work, added: Math.max(0, Math.min(s.gap! - placedStart, v)) });
    return (
      <div className={`scene bridge ${bw ? 'bw' : ''}`}>
        <div className="river">
          <div className="bank left" aria-hidden />
          <div className="gap" style={{ width: `${s.gap * unitPct}%` }} aria-label={t('ui.gapBlocks', { n: s.gap })}>
            {Array.from({ length: s.gap }, (_, i) => (
              <span key={i} className={`slot ${i < total ? (i < placedStart ? 'block given' : 'block') : ''}`} style={{ width: `${100 / s.gap!}%` }}>
                {reveal >= 2 && i >= total && <span className="slot-num">{i + 1}</span>}
              </span>
            ))}
          </div>
          <div className="bank right" aria-hidden />
        </div>
        {interactive && (
          <div className="scene-tools center">
            <button type="button" className="btn small" onClick={() => setAdded(added + 1)} disabled={total >= s.gap} data-testid="add-block">{t('ui.addBlock')}</button>
            <button type="button" className="btn small secondary" onClick={() => setAdded(added - 1)} disabled={added <= 0}>{t('ui.removeBlock')}</button>
          </div>
        )}
        {interactive && total >= s.gap && <p className="scene-note small">{t('ui.bridgeFits')}</p>}
      </div>
    );
  }

  const blocks = num(work.blocks);
  const measuring = s.unitBlocks && s.planks.length === 1 && q.answer.kind === 'number';
  return (
    <div className={`scene lengths ${bw ? 'bw' : ''}`}>
      <div className="start-line" aria-hidden />
      {s.planks.map((p) => {
        const on = chosen.includes(p.id) || solutionIds.includes(p.id);
        const orderPos = response?.kind === 'order' ? response.value.indexOf(p.id) : -1;
        return (
          <div key={p.id} className="plank-row">
            <button type="button" className={`plank ${s.arrows ? 'arrow' : ''} ${on ? 'on' : ''}`} style={{ width: `${p.units * unitPct}%` }} onClick={() => pick(p.id)} disabled={!interactive || q.answer.kind === 'number'}
              aria-label={t('ui.plankLabel', { id: p.id })} data-testid={`plank-${p.id}`}>
              <span className="item-label">{p.id}</span>
              {orderPos >= 0 && <span className="badge num">{orderPos + 1}</span>}
            </button>
            {s.unitBlocks && (
              <div className="unit-row" style={{ width: `${(measuring ? Math.max(blocks, reveal >= SOLUTION ? p.units : 0) : p.units) * unitPct}%` }} aria-hidden>
                {Array.from({ length: measuring ? Math.max(blocks, reveal >= SOLUTION ? p.units : 0) : p.units }, (_, i) => (
                  <span key={i} className="unit-block" style={{ width: `${100 / (measuring ? Math.max(blocks, reveal >= SOLUTION ? p.units : 0) : p.units)}%` }}>
                    {reveal >= 2 && i + 1 === (measuring ? Math.max(blocks, reveal >= SOLUTION ? p.units : 0) : p.units) ? i + 1 : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {measuring && interactive && (
        <div className="scene-tools center">
          <button type="button" className="btn small" onClick={() => setWork({ ...work, blocks: Math.min(MAX_UNITS, blocks + 1) })} data-testid="add-block">{t('ui.addBlock')}</button>
          <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, blocks: Math.max(0, blocks - 1) })} disabled={blocks <= 0}>{t('ui.removeBlock')}</button>
        </div>
      )}
    </div>
  );
}
