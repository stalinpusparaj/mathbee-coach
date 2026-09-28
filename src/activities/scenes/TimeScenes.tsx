import type { SceneProps } from '../sceneTypes';
import { num, SOLUTION } from '../sceneTypes';
import { Clock } from '../../components/Clock';
import { Calendar } from '../../components/Calendar';
import { addMinutes, addWeekdays, weekdayOf, WEEKDAY_KEYS, formatTime } from '../../engine/math';
import { useT } from '../../i18n/useT';
import { Sprite } from '../../components/art';

/** C10: stepping stones; tapping a gap stone selects its answer field. */
export function TrailScene({ q, response, interactive, reveal, bw, onFieldFocus }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'trail') return null;
  const s = q.scene;
  const fields = q.answer.kind === 'fields' ? q.answer.fields : null;
  const values = response?.kind === 'fields' ? response.values : {};
  const single = q.answer.kind === 'number' ? (response?.kind === 'number' ? response.value : null) : null;
  let gapIndex = 0;
  return (
    <div className={`scene trail ${bw ? 'bw' : ''}`}>
      <p className="rule-tag" aria-hidden>{s.rule.dir === 'forward' ? '→' : '←'} {s.rule.dir === 'forward' ? '+' : '−'}{s.rule.step}</p>
      <ol className="stones">
        {s.stones.map((v, i) => {
          if (v !== null) return <li key={i} className="stone"><span>{v}</span></li>;
          const k = gapIndex++;
          const fid = fields ? fields[k].id : null;
          const shown = reveal >= SOLUTION ? (fields ? fields[k].value : q.answer.kind === 'number' ? q.answer.value : '') : fields ? values[fid!] ?? '' : single ?? '';
          return (
            <li key={i} className="stone gap">
              <button type="button" onClick={() => fid && onFieldFocus?.(fid)} disabled={!interactive || !fid} aria-label={t('label.gap', { n: k + 1 })} data-testid={`gap-${k}`}>
                {shown === '' ? '?' : shown}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** C11: day cards in order (Monday first); a bee walks one day at a time, wrapping round. */
export function WeekScene({ q, work, setWork, response, setResponse, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'week') return null;
  const s = q.scene;
  if (s.cards && q.answer.kind === 'order') {
    const cur = response?.kind === 'order' ? response.value : [];
    return (
      <div className={`scene week-cards ${bw ? 'bw' : ''}`}>
        <div className="cards">
          {q.answer.items.map((it) => {
            const pos = reveal >= SOLUTION ? q.answer.kind === 'order' && q.answer.value.indexOf(it.id) : cur.indexOf(it.id);
            return (
              <button key={it.id} type="button" className={`day-card ${pos !== -1 && pos !== false ? 'on' : ''}`} disabled={!interactive || cur.includes(it.id)}
                onClick={() => setResponse({ kind: 'order', value: [...cur, it.id] })} data-testid={`card-${it.id}`}>
                {t(it.label)}{pos !== -1 && pos !== false && <span className="badge num">{(pos as number) + 1}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const start = s.start ?? 0;
  const dir = s.direction === 'before' ? -1 : 1;
  const steps = reveal >= SOLUTION ? s.offset ?? 0 : num(work.steps);
  const pos = addWeekdays(start, dir * steps);
  return (
    <div className={`scene week ${bw ? 'bw' : ''}`}>
      <ol className="week-row">
        {WEEKDAY_KEYS.map((k, i) => (
          <li key={k} className={`day ${i === start && s.start !== undefined ? 'start' : ''} ${s.highlight?.includes(i) ? 'hl' : ''} ${i === pos && s.start !== undefined && steps > 0 ? 'bee-here' : ''}`}>
            <span className="day-name">{t(`day.${k}`)}</span>
            {i === pos && s.start !== undefined && <Sprite id="bee" size={30} className="bee-token" decorative />}
          </li>
        ))}
      </ol>
      {interactive && s.start !== undefined && (
        <div className="scene-tools center">
          <button type="button" className="btn small" onClick={() => setWork({ ...work, steps: steps + 1 })} data-testid="walk">{t(dir > 0 ? 'ui.walkForward' : 'ui.walkBack')}</button>
          <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, steps: 0 })} disabled={steps === 0}>{t('ui.reset')}</button>
          <span className="pair-counter">{reveal >= 2 ? t('ui.moves', { n: steps }) : ''}</span>
        </div>
      )}
    </div>
  );
}

/** C12: clocks are drawn from the time; setting uses drag, arrow keys or buttons. */
export function ClockScene({ q, work, setWork, response, setResponse, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'clock') return null;
  const s = q.scene;
  const controls = { hourUp: t('ui.hourUp'), hourDown: t('ui.hourDown'), minUp: t('ui.minUp'), minDown: t('ui.minDown') };
  if (s.mode === 'digital') {
    // only the digital time is shown; the analog clocks are the answer choices
    return (
      <div className={`scene clock-scene ${bw ? 'bw' : ''}`}>
        <p className="digital big-digital" aria-label={t('ui.clockShows', { t: formatTime(s.h, s.m) })}>{formatTime(s.h, s.m)}</p>
      </div>
    );
  }
  if (s.mode === 'set') {
    const cur = reveal >= SOLUTION ? { h: s.h, m: s.m } : response?.kind === 'time' ? response : { h: s.startH ?? 12, m: s.startM ?? 0 };
    return (
      <div className={`scene clock-scene ${bw ? 'bw' : ''}`}>
        <Clock h={cur.h} m={cur.m} size={240} label={t('ui.clockSet')} onChange={interactive ? (h, m) => setResponse({ kind: 'time', h, m }) : undefined} controlsLabel={controls} bw={bw} />
        <p className="digital" aria-live="polite">{formatTime(cur.h, cur.m)}</p>
      </div>
    );
  }
  if (s.elapsed !== undefined && s.startH !== undefined) {
    // show the START time; the child can move a copy of the minute hand forward as a tool
    const moved = reveal >= SOLUTION ? s.elapsed : num(work.moved);
    const now = addMinutes(s.startH, s.startM ?? 0, moved);
    return (
      <div className={`scene clock-scene ${bw ? 'bw' : ''}`}>
        <Clock h={now.h} m={now.m} size={220} label={t('ui.clockShows', { t: formatTime(now.h, now.m) })} bw={bw} />
        {interactive && (
          <div className="scene-tools center">
            <button type="button" className="btn small" onClick={() => setWork({ ...work, moved: moved + 5 })} data-testid="plus5">{t('ui.plus5min')}</button>
            <button type="button" className="btn small secondary" onClick={() => setWork({ ...work, moved: 0 })} disabled={moved === 0}>{t('ui.reset')}</button>
            <span className="pair-counter">{t('ui.minutesMoved', { n: moved })}</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`scene clock-scene ${bw ? 'bw' : ''}`}>
      <Clock h={s.h} m={s.m} size={240} label={t('ui.readClock')} bw={bw} />
      {reveal >= SOLUTION && <p className="digital">{formatTime(s.h, s.m)}</p>}
    </div>
  );
}

/** C13: real Monday-first calendar; tapping a date answers date questions directly. */
export function CalendarScene({ q, response, setResponse, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'calendar') return null;
  const s = q.scene;
  const dateAnswer = q.answer.kind === 'number' && /first|last|find/.test(q.templateId);
  const selected = response?.kind === 'number' ? response.value : null;
  const solutionDate = reveal >= SOLUTION && q.answer.kind === 'number' && dateAnswer ? q.answer.value : null;
  const hlCol = reveal >= 2 && s.marks?.length === 1 ? weekdayOf(s.year, s.month, s.marks[0]) : null;
  const nextM = s.month === 12 ? 1 : s.month + 1;
  const nextY = s.month === 12 ? s.year + 1 : s.year;
  return (
    <div className={`scene calendar-scene ${bw ? 'bw' : ''}`}>
      <Calendar
        year={s.year} month={s.month} marks={s.marks} range={s.range} bw={bw}
        selected={solutionDate ?? selected}
        highlightColumn={hlCol}
        onSelect={interactive && dateAnswer ? (d) => setResponse({ kind: 'number', value: d }) : undefined}
      />
      {s.showNextMonth && <Calendar year={nextY} month={nextM} bw={bw} />}
      {interactive && dateAnswer && <p className="scene-note small">{t('ui.tapDate')}</p>}
    </div>
  );
}

/** C14: hear the story, act it out with objects, then answer. Replaying narration is not a hint. */
export function StoryScene({ q, work, setWork, interactive, reveal, bw }: SceneProps) {
  const t = useT();
  if (q.scene.type !== 'story') return null;
  const s = q.scene;
  const unknownStart = s.unknown === 'start';
  const initial = unknownStart ? 0 : s.start;
  const count = typeof work.count === 'number' ? (work.count as number) : initial;
  const method = work.method as string | undefined;
  const set = (n: number) => setWork({ ...work, count: Math.max(0, Math.min(40, n)) });
  const shown = reveal >= SOLUTION ? (s.steps ? s.start + s.steps[0].change - s.steps[1].change : s.op === '+' ? s.start + s.change : s.start - s.change) : count;
  const sprite = s.item === 'bird' ? 'bluebird' : s.item === 'flower' ? 'daisy' : s.item;
  return (
    <div className={`scene story ${bw ? 'bw' : ''}`}>
      <div className="act-tray" aria-label={t('ui.actTray', { n: shown })}>
        {unknownStart && count === 0 && reveal < SOLUTION && <span className="unknown-group">?</span>}
        {Array.from({ length: shown }, (_, i) => <span key={i} className="story-obj"><Sprite id={sprite} size="100%" decorative /></span>)}
      </div>
      {interactive && (
        <>
          <div className="scene-tools center wrap">
            <button type="button" className="btn small" onClick={() => set(count + 1)} data-testid="story-add">{t('ui.addOneObj')}</button>
            <button type="button" className="btn small" onClick={() => set(count - 1)} disabled={count <= 0} data-testid="story-remove">{t('ui.takeOneObj')}</button>
            <button type="button" className="btn small secondary" onClick={() => set(initial)}>{t('ui.reset')}</button>
          </div>
          <div className="method" role="radiogroup" aria-label={t('ui.chooseMethod')}>
            <span>{t('ui.chooseMethod')}</span>
            {(['join', 'separate'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} className={`choice small ${method === m ? 'on' : ''}`} onClick={() => setWork({ ...work, method: m })}>
                {t(`ui.method.${m}`)}
              </button>
            ))}
          </div>
        </>
      )}
      {reveal >= 2 && <p className="scene-note small">{t('ui.objectsNow', { n: shown })}</p>}
    </div>
  );
}
