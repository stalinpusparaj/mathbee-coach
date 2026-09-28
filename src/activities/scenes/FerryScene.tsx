import type { SceneProps } from '../sceneTypes';
import { arr, SOLUTION } from '../sceneTypes';
import { Sprite } from '../../components/art';
import { useDragOrTap } from '../../components/dnd';
import { useT } from '../../i18n/useT';

/** C02: move animals from the dock onto the ferry (drag, or tap animal then tap ferry). */
export function FerryScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  const onBoard = arr<string>(work.onBoard);
  const dnd = useDragOrTap((obj, zone) => {
    if (zone === 'ferry' && !onBoard.includes(obj)) setWork({ ...work, onBoard: [...onBoard, obj] });
    if (zone === 'dock' && onBoard.includes(obj)) setWork({ ...work, onBoard: onBoard.filter((o) => o !== obj) });
  }, interactive);
  if (q.scene.type !== 'ferry') return null;
  const s = q.scene;

  if (s.grouped || s.subtotals) {
    return (
      <div className={`scene ferry-summary ${bw ? 'bw' : ''}`}>
        {s.grouped?.map((g) => (
          <div key={g.type} className="ferry-group">
            {Array.from({ length: g.boats }, (_, b) => (
              <div key={b} className="mini-boat" aria-label={t('ui.boatOfTen', { item: t(`items.${g.type}`) })}>
                <span className="mini-grid">{Array.from({ length: 10 }, (_, i) => <Sprite key={i} id={g.type} size="100%" decorative />)}</span>
                {reveal >= 1 && <span className="tag">10</span>}
              </div>
            ))}
            {g.loose > 0 && (
              <div className="loose">
                {Array.from({ length: g.loose }, (_, i) => <Sprite key={i} id={g.type} size={40} decorative />)}
              </div>
            )}
          </div>
        ))}
        {s.subtotals && (
          <ul className="subtotal-list">
            {s.subtotals.map((st) => (
              <li key={st.type}>
                <Sprite id={st.type} size={44} decorative />
                <strong>{st.count >= 0 ? st.count : '?'}</strong> <span>{t(`items.${st.type}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const showCounts = reveal >= 2 || reveal >= SOLUTION;
  const dock = s.animals.filter((a) => !onBoard.includes(a.id) && reveal < SOLUTION);
  const boarded = reveal >= SOLUTION ? s.animals : s.animals.filter((a) => onBoard.includes(a.id));
  const counts = s.types.map((ty) => ({ ty, n: s.animals.filter((a) => a.kind === ty).length }));
  return (
    <div className={`scene ferry ${bw ? 'bw' : ''}`}>
      <button type="button" className="zone dock" {...dnd.zoneProps('dock')} aria-label={t('ui.dock')} disabled={!interactive}>
        <span className="zone-label">{t('ui.dock')}</span>
      </button>
      <div className="dock-animals" role="group" aria-label={t('ui.dock')}>
        {(interactive ? dock : reveal >= SOLUTION ? [] : s.animals).map((a) => (
          <button key={a.id} type="button" className={`animal ${dnd.selected === a.id ? 'selected' : ''}`} {...dnd.objProps(a.id)} disabled={!interactive}
            aria-label={t(`item1.${a.kind}`)} data-testid={`animal-${a.id}`}>
            <Sprite id={a.kind} size="100%" decorative />
          </button>
        ))}
      </div>
      {(interactive || reveal >= SOLUTION) && (
        <button type="button" className="zone ferry-boat" {...dnd.zoneProps('ferry')} aria-label={t('ui.ferry')} data-testid="zone-ferry" disabled={!interactive && reveal < SOLUTION}>
          <Sprite id="boat" size="100%" className="boat-bg" decorative />
          <span className="aboard">
            {boarded.map((a) => (
              <span key={a.id} className="aboard-animal" onClick={(e) => { if (interactive) { e.stopPropagation(); setWork({ ...work, onBoard: onBoard.filter((o) => o !== a.id) }); } }}>
                <Sprite id={a.kind} size="100%" decorative />
              </span>
            ))}
          </span>
        </button>
      )}
      {showCounts && (
        <p className="scene-note">{counts.map((c) => `${c.n} ${t(c.n === 1 ? `item1.${c.ty}` : `items.${c.ty}`)}`).join(' + ')}</p>
      )}
      {interactive && dnd.selected && <p className="scene-note small">{t('ui.nowTapFerry')}</p>}
      {interactive && onBoard.length > 0 && (
        <div className="scene-tools">
          <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, onBoard: onBoard.slice(0, -1) })}>{t('ui.undo')}</button>
          <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, onBoard: [] })}>{t('ui.reset')}</button>
        </div>
      )}
    </div>
  );
}
