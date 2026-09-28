import type { SceneProps } from '../sceneTypes';
import { arr, num, SOLUTION } from '../sceneTypes';
import { Sprite } from '../../components/art';
import { TenFrame, BaseTen, NumberLine } from '../../components/math-models';
import { useDragOrTap } from '../../components/dnd';
import { useT } from '../../i18n/useT';

/**
 * C08 addition: objects → grouped representation → equation.
 * Objects: pour two baskets together. Ten-frame: add counters one at a time.
 * Number line: hop forward. Base ten: put tens and ones together, trade 10 ones for a ten.
 */
export function AddScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'add') return null;
  const { a, b, item, representation } = q.scene;
  const solved = reveal >= SOLUTION;
  const eq = <p className="equation" aria-label={`${a} + ${b}`}>{a} + {b} = {solved ? a + b : '?'}</p>;

  if (representation === 'objects') {
    const combined = !!work.combined || solved;
    return (
      <div className={`scene add-objects ${bw ? 'bw' : ''}`}>
        {!combined ? (
          <div className="two-baskets">
            <Group n={a} item={item} />
            <span className="plus" aria-hidden>+</span>
            <Group n={b} item={item} />
          </div>
        ) : (
          <div className="one-basket"><Group n={a + b} item={item} split={a} numbered={reveal >= 2 || solved} /></div>
        )}
        {interactive && !combined && <button type="button" className="btn small" onClick={() => setWork({ ...work, combined: true })} data-testid="pour">{t('ui.pourTogether')}</button>}
        {eq}
      </div>
    );
  }
  if (representation === 'tenframe') {
    const added = solved ? b : num(work.added);
    const first = Math.min(a, 10);
    const inSecond = Math.max(0, a - 10);
    const fill1Red = first;
    const fill1Green = Math.min(10 - fill1Red, added);
    const secondRed = inSecond;
    const secondGreen = added - fill1Green;
    return (
      <div className={`scene add-tenframe ${bw ? 'bw' : ''}`}>
        <div className="frames">
          <TenFrame filled={fill1Red} second={fill1Green} label={t('ui.tenFrame')} />
          <TenFrame filled={secondRed} second={secondGreen} label={t('ui.tenFrame')} />
        </div>
        {interactive && (
          <div className="scene-tools center">
            <button type="button" className="btn small" onClick={() => setWork({ ...work, added: Math.min(b, added + 1) })} disabled={added >= b || a + added >= 20} data-testid="add-one">{t('ui.addOne', { n: b - added })}</button>
            <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, added: Math.max(0, added - 1) })} disabled={added <= 0}>{t('ui.undo')}</button>
          </div>
        )}
        {eq}
      </div>
    );
  }
  if (representation === 'numberline') {
    const hops = solved ? b : num(work.hops);
    const to = Math.max(10, Math.ceil((a + b) / 5) * 5);
    return (
      <div className={`scene add-line ${bw ? 'bw' : ''}`}>
        <NumberLine from={0} to={to} start={a} hops={b} dir={1} showHops={hops} label={t('ui.numberLine')} />
        {interactive && (
          <div className="scene-tools center">
            <button type="button" className="btn small" onClick={() => setWork({ ...work, hops: Math.min(b, hops + 1) })} disabled={hops >= b} data-testid="hop">{t('ui.hopForward')}</button>
            <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, hops: Math.max(0, hops - 1) })} disabled={hops <= 0}>{t('ui.undo')}</button>
          </div>
        )}
        {eq}
      </div>
    );
  }
  // base ten
  const joined = !!work.joined || solved;
  const traded = !!work.traded || solved;
  const onesSum = (a % 10) + (b % 10);
  return (
    <div className={`scene add-baseten ${bw ? 'bw' : ''}`}>
      {!joined ? (
        <div className="two-baskets">
          <div className="bt-col"><BaseTen n={a} /><span className="bt-num">{a}</span></div>
          <span className="plus" aria-hidden>+</span>
          <div className="bt-col"><BaseTen n={b} /><span className="bt-num">{b}</span></div>
        </div>
      ) : (
        <div className="bt-col joined">
          <JoinedBlocks tens={Math.floor(a / 10) + Math.floor(b / 10) + (traded && onesSum >= 10 ? 1 : 0)} ones={traded && onesSum >= 10 ? onesSum - 10 : onesSum} />
          {reveal >= 2 && <span className="bt-num">{t('ui.tensOnes', { t: Math.floor(a / 10) + Math.floor(b / 10) + (traded && onesSum >= 10 ? 1 : 0), o: traded && onesSum >= 10 ? onesSum - 10 : onesSum })}</span>}
        </div>
      )}
      {interactive && (
        <div className="scene-tools center">
          {!joined && <button type="button" className="btn small" onClick={() => setWork({ ...work, joined: true })} data-testid="join">{t('ui.putTogether')}</button>}
          {joined && onesSum >= 10 && !traded && <button type="button" className="btn small" onClick={() => setWork({ ...work, traded: true })} data-testid="trade">{t('ui.tradeTen')}</button>}
        </div>
      )}
      {eq}
    </div>
  );
}

function JoinedBlocks({ tens, ones }: { tens: number; ones: number }) {
  return <BaseTen tens={tens} ones={ones} label={`${tens} tens and ${ones} ones`} />;
}

function Group({ n, item, split, numbered }: { n: number; item: string; split?: number; numbered?: boolean }) {
  return (
    <div className="fruit-group">
      <div className="fruit-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(n, 5))}, clamp(34px, 8vw, 46px))` }}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={`fruit ${split !== undefined && i >= split ? 'second' : ''}`}>
            <Sprite id={item} size="100%" decorative />
            {numbered && <span className="badge num">{i + 1}</span>}
          </span>
        ))}
      </div>
      <Sprite id="basket" size={72} className="basket-under" decorative />
    </div>
  );
}

/**
 * C09 subtraction: move penguins from the island onto the boat; the removed group stays
 * visible in the boat. A penguin can only be moved once. Base ten: cross out, break a ten.
 */
export function SubScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  const moved = arr<string>(work.moved);
  const s0 = q.scene.type === 'subtract' ? q.scene : null;
  const dnd = useDragOrTap((obj, zone) => {
    if (!s0) return;
    if (zone === 'boat' && !moved.includes(obj)) setWork({ ...work, moved: [...moved, obj] });
    if (zone === 'island' && moved.includes(obj)) setWork({ ...work, moved: moved.filter((m) => m !== obj) });
  }, interactive);
  if (!s0) return null;
  const { start, remove, representation } = s0;
  const solved = reveal >= SOLUTION;
  const eq = <p className="equation">{start} − {remove} = {solved ? start - remove : '?'}</p>;

  if (representation === 'objects') {
    const ids = Array.from({ length: start }, (_, i) => `p${i + 1}`);
    const inBoat = solved ? ids.slice(start - remove) : moved;
    const onIsland = ids.filter((id) => !inBoat.includes(id));
    return (
      <div className={`scene subtract ${bw ? 'bw' : ''}`}>
        <div className="zone island" {...dnd.zoneProps('island')} role="group" aria-label={t('ui.island')}>
          <Sprite id="ice_floe" size="100%" className="island-bg" decorative />
          <div className="penguins">
            {onIsland.map((id, i) => (
              <button key={id} type="button" className={`penguin-btn ${dnd.selected === id ? 'selected' : ''}`} {...dnd.objProps(id)} disabled={!interactive}
                aria-label={t('ui.penguinN', { n: ids.indexOf(id) + 1 })} data-testid={`penguin-${id}`}>
                <Sprite id="penguin" size="100%" decorative />
                {(reveal >= 2 || solved) && <span className="badge num">{i + 1}</span>}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="zone boat" {...dnd.zoneProps('boat')} disabled={!interactive} aria-label={t('ui.boatWith', { n: inBoat.length })} data-testid="zone-boat">
          <Sprite id="boat" size="100%" className="boat-bg" decorative />
          <span className="aboard">{inBoat.map((id) => <span key={id} className="aboard-animal removed"><Sprite id="penguin_walk" size="100%" decorative /></span>)}</span>
        </button>
        {interactive && dnd.selected && <p className="scene-note small">{t('ui.nowTapBoat')}</p>}
        {interactive && moved.length > 0 && (
          <div className="scene-tools">
            <button type="button" className="btn tiny secondary" onClick={() => setWork({ ...work, moved: moved.slice(0, -1) })}>{t('ui.undo')}</button>
          </div>
        )}
        {eq}
      </div>
    );
  }
  if (representation === 'numberline') {
    const hops = solved ? remove : num(work.hops);
    const to = Math.max(10, Math.ceil(start / 5) * 5);
    return (
      <div className={`scene sub-line ${bw ? 'bw' : ''}`}>
        <NumberLine from={0} to={to} start={start} hops={remove} dir={-1} showHops={hops} label={t('ui.numberLine')} />
        {interactive && (
          <div className="scene-tools center">
            <button type="button" className="btn small" onClick={() => setWork({ ...work, hops: Math.min(remove, hops + 1) })} disabled={hops >= remove} data-testid="hop">{t('ui.hopBack')}</button>
            <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, hops: Math.max(0, hops - 1) })} disabled={hops <= 0}>{t('ui.undo')}</button>
          </div>
        )}
        {eq}
      </div>
    );
  }
  // base ten: cross out tens and ones
  const broken = !!work.broken || (solved && start % 10 < remove % 10);
  const tensAvail = Math.floor(start / 10) - (broken ? 1 : 0);
  const onesAvail = (start % 10) + (broken ? 10 : 0);
  const crossedTens = solved ? Math.floor(remove / 10) : Math.min(num(work.crossedTens), tensAvail);
  const crossedOnes = solved ? remove % 10 : Math.min(num(work.crossedOnes), onesAvail);
  return (
    <div className={`scene sub-baseten ${bw ? 'bw' : ''}`}>
      <div className="bt-col">
        <div className="baseten" role="img" aria-label={t('ui.tensOnes', { t: tensAvail, o: onesAvail })}>
          <div className="tens">
            {Array.from({ length: tensAvail }, (_, i) => (
              <svg key={i} viewBox="0 0 22 110" className={`rod ${i >= tensAvail - crossedTens ? 'crossed' : ''}`} aria-hidden>
                {Array.from({ length: 10 }, (_, k) => <rect key={k} x="1" y={1 + k * 10.8} width="20" height="10.8" fill="#F7BF35" stroke="#3d2b1f" strokeWidth="1.5" />)}
              </svg>
            ))}
          </div>
          <div className="ones wrap">
            {Array.from({ length: onesAvail }, (_, i) => (
              <svg key={i} viewBox="0 0 22 22" className={`unit ${i >= onesAvail - crossedOnes ? 'crossed' : ''}`} aria-hidden>
                <rect x="1" y="1" width="20" height="20" fill="#bde6f5" stroke="#3d2b1f" strokeWidth="1.5" />
              </svg>
            ))}
          </div>
        </div>
      </div>
      {interactive && (
        <div className="scene-tools center wrap">
          <button type="button" className="btn small" onClick={() => setWork({ ...work, crossedTens: Math.min(tensAvail, crossedTens + 1) })} disabled={crossedTens >= tensAvail}>{t('ui.takeTen')}</button>
          <button type="button" className="btn small" onClick={() => setWork({ ...work, crossedOnes: Math.min(onesAvail, crossedOnes + 1) })} disabled={crossedOnes >= onesAvail}>{t('ui.takeOne')}</button>
          {!broken && tensAvail > crossedTens && <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, broken: true })}>{t('ui.breakTen')}</button>}
          <button type="button" className="btn small secondary" onClick={() => setWork({})}>{t('ui.reset')}</button>
        </div>
      )}
      {(reveal >= 2 || interactive) && <p className="scene-note small">{t('ui.takenSoFar', { n: crossedTens * 10 + crossedOnes, target: remove })}</p>}
      {eq}
    </div>
  );
}
