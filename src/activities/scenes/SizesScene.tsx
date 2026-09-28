import type { SceneProps } from '../sceneTypes';
import { SOLUTION } from '../sceneTypes';
import { Sprite } from '../../components/art';
import { useT } from '../../i18n/useT';

const UNIT = 22; // px per measuring square

/**
 * C04: same-shaped objects (scaled copies of one sprite, or exact SVG pots for measured
 * tasks) standing on one shared baseline. Tapping an object chooses it or adds it to the order.
 */
export function SizesScene({ q, response, setResponse, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'sizes') return null;
  const s = q.scene;
  const pick = (id: string) => {
    if (!interactive) return;
    if (q.answer.kind === 'choice') {
      if (q.answer.options.some((o) => o.id === id)) setResponse({ kind: 'choice', value: id });
    } else if (q.answer.kind === 'order') {
      const cur = response?.kind === 'order' ? response.value : [];
      if (!cur.includes(id)) setResponse({ kind: 'order', value: [...cur, id] });
    }
  };
  const chosen = response?.kind === 'choice' ? [response.value] : response?.kind === 'order' ? response.value : [];
  const solutionIds = reveal >= SOLUTION ? (q.answer.kind === 'choice' ? [q.answer.value] : q.answer.kind === 'order' ? q.answer.value : []) : [];

  if (s.measured && s.constraint) {
    // One exact SVG: every pot stands on the same ground line; squares and shelf share one scale.
    const c = s.constraint;
    const dims = s.items.map((it) => ({
      it,
      w: c.kind === 'min-width' ? it.size : Math.round(it.size * 0.8 + 1),
      h: c.kind === 'max-height' ? it.size : Math.round(it.size * 0.8 + 1),
    }));
    const gapU = 1;
    const totalW = dims.reduce((a, d) => a + d.w, 0) + gapU * (dims.length + 1);
    const maxH = Math.max(...dims.map((d) => d.h), c.kind === 'max-height' ? c.value + 1 : 0) + 1;
    const ground = maxH * UNIT;
    let x = gapU * UNIT;
    return (
      <div className={`scene sizes measured ${bw ? 'bw' : ''}`}>
        {c.kind === 'min-width' && (
          <div className="plant-width" aria-label={t('ui.plantWidth', { n: c.value })}>
            <Sprite id="seedling" size={56} decorative />
            <svg width={c.value * UNIT + 2} height={UNIT + 4} aria-hidden>
              {Array.from({ length: c.value }, (_, i) => <rect key={i} x={1 + i * UNIT} y="2" width={UNIT} height={UNIT} fill="#c8e6c9" stroke="#3d2b1f" />)}
            </svg>
            <span>{c.value}</span>
          </div>
        )}
        <svg viewBox={`0 0 ${totalW * UNIT} ${ground + 30}`} className="measured-svg" role="group" aria-label={t('ui.chooseAnswer')}>
          {c.kind === 'max-height' && (
            <g aria-label={t('ui.shelfHeight', { n: c.value })}>
              <rect x="0" y={ground - c.value * UNIT - 6} width={totalW * UNIT} height="6" fill="#8b6b3d" />
              <text x="4" y={ground - c.value * UNIT - 10} fontSize="13" fontWeight="800" fill="#3d2b1f">{t('ui.shelf')} ({c.value})</text>
            </g>
          )}
          <line x1="0" y1={ground} x2={totalW * UNIT} y2={ground} stroke="#8b6b3d" strokeWidth="4" />
          {dims.map(({ it, w, h }) => {
            const x0 = x;
            x += (w + gapU) * UNIT;
            const on = chosen.includes(it.id) || solutionIds.includes(it.id);
            const top = ground - h * UNIT;
            const inset = Math.min(UNIT * 0.4, (w * UNIT) / 6);
            return (
              <g key={it.id} role="button" tabIndex={interactive ? 0 : -1} aria-pressed={on} aria-label={t('ui.potLabel', { id: it.id, w, h })}
                onClick={() => pick(it.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(it.id); } }}
                style={{ cursor: interactive ? 'pointer' : 'default' }} data-testid={`item-${it.id}`} className={`pot-g ${on ? 'on' : ''}`}>
                <rect x={x0 - 4} y={top - 4} width={w * UNIT + 8} height={h * UNIT + 28} fill={on ? '#fff4cf' : 'transparent'} rx="8" stroke={on ? '#b7830d' : 'none'} strokeWidth="3" />
                <path d={`M${x0} ${top} H${x0 + w * UNIT} L${x0 + w * UNIT - inset} ${ground} H${x0 + inset} Z`} fill={bw ? '#fff' : '#d9774b'} stroke="#3d2b1f" strokeWidth="2" />
                {c.kind === 'min-width' && Array.from({ length: w - 1 }, (_, i) => <line key={i} x1={x0 + (i + 1) * UNIT} y1={top} x2={x0 + (i + 1) * UNIT} y2={top + 8} stroke="#3d2b1f" />)}
                {c.kind === 'max-height' && Array.from({ length: h - 1 }, (_, i) => <line key={i} x1={x0} y1={top + (i + 1) * UNIT} x2={x0 + 8} y2={top + (i + 1) * UNIT} stroke="#3d2b1f" />)}
                <text x={x0 + (w * UNIT) / 2} y={ground + 20} textAnchor="middle" fontWeight="900" fontSize="16" fill="#3d2b1f">{it.id}</text>
                {reveal >= 2 && <text x={x0 + (w * UNIT) / 2} y={top + 18} textAnchor="middle" fontWeight="900" fontSize="14" fill="#fff">{c.kind === 'min-width' ? w : h}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const base = 150;
  return (
    <div className={`scene sizes ${bw ? 'bw' : ''}`}>
      <div className="baseline-row">
        {s.items.map((it) => {
          const on = chosen.includes(it.id) || solutionIds.includes(it.id);
          const px = Math.round(base * it.size);
          const orderPos = response?.kind === 'order' ? response.value.indexOf(it.id) : -1;
          return (
            <button key={it.id} type="button" className={`size-item ${on ? 'on' : ''}`} onClick={() => pick(it.id)} disabled={!interactive} aria-label={t('ui.itemLabel', { id: it.id })} data-testid={`item-${it.id}`}>
              {s.sprite === 'circle' ? (
                <svg width={px} height={px} aria-hidden><circle cx={px / 2} cy={px / 2} r={px / 2 - 2} fill="#fff" stroke="#3d2b1f" strokeWidth="3" /></svg>
              ) : (
                <Sprite id={s.sprite} size={px} decorative />
              )}
              <span className="item-label">{it.id}</span>
              {orderPos >= 0 && <span className="badge num">{orderPos + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="ground" aria-hidden />
    </div>
  );
}
