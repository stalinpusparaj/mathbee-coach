import type { SceneProps } from '../sceneTypes';
import { arr, SOLUTION, fieldStyle } from '../sceneTypes';
import { gridDims } from '../../engine/layout';
import { Sprite } from '../../components/art';
import { useT } from '../../i18n/useT';
import { useState } from 'react';

/**
 * C07: tap one flower, then another, to tie them into a pair (tap a tied flower to untie).
 * Pairs are numbered as bunches, so "number of pairs" and "number of flowers" stay distinct.
 */
export function PairsScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  const [first, setFirst] = useState<string | null>(null);
  const [msgKey, setMsgKey] = useState<string | null>(null);
  if (q.scene.type !== 'pairs') return null;
  const s = q.scene;
  const pairs = arr<[string, string]>(work.pairs);
  const solved = reveal >= SOLUTION;
  // worked solution: pair flowers of the same kind, in reading order
  const solutionPairs = (): [string, string][] => {
    const out: [string, string][] = [];
    const byKind = new Map<string, string[]>();
    s.flowers.forEach((f) => byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f.id]));
    const order = s.flowers.map((f) => f.id);
    for (const ids of byKind.values()) for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
    return out.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  };
  const shown: [string, string][] = solved ? solutionPairs() : pairs;
  const pairOf = (id: string) => shown.findIndex((p) => p.includes(id));
  const kindOf = (id: string) => s.flowers.find((f) => f.id === id)?.kind;
  const mustMatch = new Set(s.flowers.map((f) => f.kind)).size > 1;

  const tap = (id: string) => {
    if (!interactive) return;
    setMsgKey(null);
    const pi = pairOf(id);
    if (pi >= 0) {
      setWork({ ...work, pairs: pairs.filter((_, i) => i !== pi) });
      return;
    }
    if (!first) return setFirst(id);
    if (first === id) return setFirst(null);
    if (mustMatch && kindOf(first) !== kindOf(id)) {
      setMsgKey('ui.pairMustMatch');
      return setFirst(null);
    }
    setWork({ ...work, pairs: [...pairs, [first, id]] });
    setFirst(null);
  };

  if (!s.flowers.length && s.orderPairs) {
    return (
      <div className={`scene pairs order-card ${bw ? 'bw' : ''}`}>
        <Sprite id="paper_cone" size={60} decorative />
        <p className="order-text">{t('ui.orderPairs', { p: s.orderPairs })}</p>
        {reveal >= 2 && (
          <div className="bunches">
            {Array.from({ length: s.orderPairs }, (_, i) => (
              <span key={i} className="bunch"><Sprite id="rose" size={30} decorative /><Sprite id="rose" size={30} decorative /><span className="tag">{i + 1}</span></span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const fs = fieldStyle(gridDims(s.flowers.length, s.flowers.length <= 10 ? 'row' : 'grid').cols, gridDims(s.flowers.length, s.flowers.length <= 10 ? 'row' : 'grid').rows);
  const colors = ['#F7BF35', '#ED8C70', '#8fd19e', '#9ec9f5', '#d5a6f0', '#f5a3c7', '#c9b27c', '#7fd6d0', '#f0d27a', '#b7c4f7'];
  return (
    <div className={`scene pairs ${bw ? 'bw' : ''}`}>
      {s.orderPairs !== undefined && <p className="scene-note">{t('ui.orderPairs', { p: s.orderPairs })}</p>}
      <div className="field-area" style={fs.area}>
      <div className="field-inner">
        {s.flowers.map((f) => {
          const pi = pairOf(f.id);
          return (
            <button key={f.id} type="button" className={`obj flower ${first === f.id ? 'selected' : ''} ${pi >= 0 ? 'paired' : ''}`}
              style={{ left: `${f.x}%`, top: `${f.y}%`, ...fs.obj, ...(pi >= 0 ? { background: colors[pi % colors.length] } : {}) }}
              onClick={() => tap(f.id)} disabled={!interactive} aria-pressed={first === f.id}
              aria-label={pi >= 0 ? t('ui.flowerInPair', { p: pi + 1 }) : t(`item1.${f.kind}`)} data-testid={`flower-${f.id}`}>
              <Sprite id={f.kind} size="100%" decorative />
              {pi >= 0 && <span className="badge num">{pi + 1}</span>}
            </button>
          );
        })}
      </div>
      </div>
      {msgKey && <p className="scene-note small" role="status">{t(msgKey)}</p>}
      {interactive && pairs.length > 0 && (
        <div className="scene-tools">
          <span className="pair-counter" aria-live="polite">{reveal >= 2 ? t('ui.bunchesMade', { n: pairs.length }) : ''}</span>
          <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, pairs: pairs.slice(0, -1) })}>{t('ui.undo')}</button>
        </div>
      )}
    </div>
  );
}
