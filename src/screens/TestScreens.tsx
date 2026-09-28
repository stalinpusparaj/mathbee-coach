import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useProfile } from '../app/store';
import { launch, startMock, submitMock } from '../app/actions';
import { useT, useLang } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { CATEGORIES } from '../curriculum/curriculum';
import type { CategoryId, Response } from '../engine/types';
import { generateQuestion } from '../engine/registry';
import { createRng } from '../engine/rng';
import { genericConfig, officialConfig, MOCK_SUBSKILLS, paperFriendly } from '../mock/mockEngine';
import { templatesForSubskill } from '../engine/registry';
import { emptyResponse, isComplete } from '../engine/check';
import { SceneView, needsPictureInPlain } from '../activities/SceneView';
import { SOLUTION } from '../activities/sceneTypes';
import { AnswerPanel } from '../components/AnswerPanel';
import { BackButton, Modal } from '../components/ui';
import { ActiveTimer } from '../learning/activeTime';
import { IS_ARTIFACT } from '../app/platform';
import type { MockResult } from '../learning/types';

function CategoryPicker({ value, onChange }: { value: CategoryId[]; onChange: (v: CategoryId[]) => void }) {
  const t = useT();
  return (
    <div className="cat-picker">
      {CATEGORIES.map((c) => (
        <label key={c.id} className="check">
          <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
          {t(`cat.${c.id}`)}
        </label>
      ))}
      <div className="row">
        <button type="button" className="btn tiny secondary" onClick={() => onChange(CATEGORIES.map((c) => c.id))}>{t('ui.all')}</button>
        <button type="button" className="btn tiny secondary" onClick={() => onChange([])}>{t('ui.none')}</button>
      </div>
    </div>
  );
}

export function TestsScreen() {
  const t = useT();
  const profile = useProfile();
  const [cats, setCats] = useState<CategoryId[]>(['C01', 'C08', 'C09', 'C10']);
  const [count, setCount] = useState(10);
  const [testCount, setTestCount] = useState(15);
  const [confirmOfficial, setConfirmOfficial] = useState(false);
  if (!profile) return null;
  const official = officialConfig(profile.competition, CATEGORIES.map((c) => c.id));
  return (
    <div className="screen tests">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} /><h1>{t('ui.worksheetsTests')}</h1><span /></header>

      <section className="card">
        <h2>{t('ui.worksheetPractice')}</h2>
        <p className="small">{t('ui.worksheetLead')}</p>
        <CategoryPicker value={cats} onChange={setCats} />
        <label className="field-row"><span>{t('ui.questions')}</span>
          <input type="number" min={4} max={30} value={count} onChange={(e) => setCount(Math.max(4, Math.min(30, Number(e.target.value) || 10)))} />
        </label>
        <div className="row wrap">
          <button type="button" className="btn primary" disabled={!cats.length} onClick={() => launch('worksheet', { categories: cats })} data-testid="worksheet-onscreen">{t('ui.onScreen')}</button>
          <button type="button" className="btn secondary" disabled={!cats.length} onClick={() => store.setRoute({ name: 'print', categories: cats, count, seed: Date.now() % 2147483647 })} data-testid="worksheet-print">{t('ui.printable')}</button>
        </div>
      </section>

      <section className="card">
        <h2>{t('ui.genericTest')}</h2>
        <p className="small">{t('ui.genericTestLead')}</p>
        <label className="field-row"><span>{t('ui.questions')}</span>
          <input type="number" min={5} max={50} value={testCount} onChange={(e) => setTestCount(Math.max(5, Math.min(50, Number(e.target.value) || 15)))} />
        </label>
        <ul className="small settings-list">
          <li>{t('ui.settingNoHints')}</li>
          <li>{t('ui.settingNoTimer')}</li>
          <li>{t('ui.settingFreeNav')}</li>
          <li>{t('ui.settingAllTopics')}</li>
        </ul>
        <button type="button" className="btn primary" onClick={() => startMock(genericConfig(CATEGORIES.map((c) => c.id), testCount))} data-testid="start-generic">{t('ui.startTest')}</button>
      </section>

      <section className="card">
        <h2>{t('ui.officialMock')}</h2>
        {official ? (
          <>
            <p className="small">{t('ui.officialLead', { name: profile.competition.name || '—', n: official.questionCount, min: official.durationMin ?? '—' })}</p>
            <button type="button" className="btn primary" onClick={() => setConfirmOfficial(true)} data-testid="start-official">{t('ui.startTest')}</button>
          </>
        ) : (
          <p className="small muted">{t('ui.officialLocked')}</p>
        )}
      </section>

      {profile.mockHistory.length > 0 && (
        <section className="card">
          <h2>{t('ui.testHistory')}</h2>
          <ul className="sub-list">
            {[...profile.mockHistory].reverse().slice(0, 8).map((m) => (
              <li key={m.id}><button type="button" className="link" onClick={() => store.setRoute({ name: 'mock-results', result: m })}>{m.date} · {t(m.kind === 'official' ? 'ui.officialShort' : 'ui.genericShort')} · {m.correct}/{m.total}</button></li>
            ))}
          </ul>
        </section>
      )}
      {confirmOfficial && official && (
        <Modal title={t('ui.officialMock')} onClose={() => setConfirmOfficial(false)}>
          <p>{t('ui.officialDisclaimer')}</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => startMock(official)}>{t('ui.startTest')}</button>
            <button type="button" className="btn secondary" onClick={() => setConfirmOfficial(false)}>{t('ui.cancel')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Mock / generic test: no hints, no correctness feedback, answers saved on every change. */
export function MockScreen() {
  const t = useT();
  const lang = useLang();
  const profile = useProfile();
  const m = profile?.activeMock;
  const [confirm, setConfirm] = useState(false);
  const timer = useRef(new ActiveTimer());
  const [, force] = useState(0);
  useEffect(() => {
    timer.current.start();
    const vis = () => (document.hidden ? timer.current.hold('hidden') : timer.current.release('hidden'));
    document.addEventListener('visibilitychange', vis);
    const iv = window.setInterval(() => {
      force((x) => x + 1);
      // persist elapsed active time periodically so a refresh keeps the clock honest
      store.updateProfile((p) => (p.activeMock ? { ...p, activeMock: { ...p.activeMock, activeMs: p.activeMock.activeMs + timer.current.stop() } } : p));
      timer.current = new ActiveTimer();
      timer.current.start();
    }, 5000);
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(iv); };
  }, []);
  const q = useMemo(() => (m ? m.questions[m.current] : null), [m?.current, m?.id]);
  const inst = useMemo(() => (q ? generateQuestion(q.templateId, q.seed, q.format) : null), [q]);
  if (!profile || !m || !inst) return <div className="screen center"><p>{t('ui.noTest')}</p><button className="btn" onClick={() => store.setRoute({ name: 'map' })}>{t('ui.back')}</button></div>;

  const elapsedMin = Math.floor((m.activeMs + timer.current.elapsed()) / 60000);
  const limit = m.config.durationMin;
  const timeUp = limit !== null && elapsedMin >= limit;
  const resp: Response = m.answers[m.current] ?? emptyResponse(inst.answer);
  const setResp = (r: Response) => store.updateProfile((p) => (p.activeMock ? { ...p, activeMock: { ...p.activeMock, answers: { ...p.activeMock.answers, [p.activeMock.current]: r } } } : p));
  const go = (i: number) => store.updateProfile((p) => (p.activeMock ? { ...p, activeMock: { ...p.activeMock, current: Math.max(0, Math.min(p.activeMock.questions.length - 1, i)) } } : p));
  const answered = Object.entries(m.answers).filter(([i, r]) => {
    const qq = m.questions[Number(i)];
    return qq && isComplete(generateQuestion(qq.templateId, qq.seed, qq.format).answer, r);
  }).length;
  const free = m.config.navigation === 'free';
  return (
    <div className="screen mock" data-testid="mock">
      <header className="topbar">
        <span className="chip">{t(m.config.kind === 'official' ? 'ui.officialShort' : 'ui.genericShort')}</span>
        <span>{t('ui.questionOf', { n: m.current + 1, total: m.questions.length })}</span>
        <span className={timeUp ? 'warn' : ''}>{limit !== null ? t('ui.minutesLeft', { n: Math.max(0, limit - elapsedMin) }) : t('ui.noTimeLimit')}</span>
      </header>
      <section className="prompt-box"><h1 className="prompt">{translate(inst.plain ?? inst.prompt, lang)}</h1></section>
      <main className="play">
        {needsPictureInPlain(inst) && <SceneView q={inst} work={{}} setWork={() => undefined} response={resp} setResponse={setResp} interactive={false} reveal={0} bw />}
      </main>
      <footer className="controls">
        {!timeUp && <AnswerPanel answer={inst.answer} response={resp} onChange={setResp} />}
        <div className="action-row">
          {free && <button type="button" className="btn secondary" onClick={() => go(m.current - 1)} disabled={m.current === 0}>{t('ui.previous')}</button>}
          {m.current < m.questions.length - 1 && <button type="button" className="btn primary" onClick={() => go(m.current + 1)} data-testid="mock-next">{t('ui.next')}</button>}
          <button type="button" className="btn secondary" onClick={() => setConfirm(true)} data-testid="mock-submit">{t('ui.submitTest')}</button>
        </div>
        {free && (
          <ol className="qnav" aria-label={t('ui.questionList')}>
            {m.questions.map((_, i) => (
              <li key={i}><button type="button" className={`${i === m.current ? 'now' : ''} ${m.answers[i] ? 'answered' : ''}`} onClick={() => go(i)} aria-label={t('ui.questionOf', { n: i + 1, total: m.questions.length })}>{i + 1}</button></li>
            ))}
          </ol>
        )}
      </footer>
      {confirm && (
        <Modal title={t('ui.submitTest')} onClose={() => setConfirm(false)}>
          <p>{t('ui.submitConfirm', { n: answered, total: m.questions.length })}</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => { setConfirm(false); submitMock(); }} data-testid="confirm-submit">{t('ui.yesSubmit')}</button>
            <button type="button" className="btn secondary" onClick={() => setConfirm(false)}>{t('ui.keepWorking')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function MockResultsScreen({ result }: { result: MockResult }) {
  const t = useT();
  const lang = useLang();
  const wrong = result.items.filter((i) => !i.correct);
  return (
    <div className="screen mock-results" data-testid="mock-results">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'tests' })} label={t('ui.back')} /><h1>{t('ui.testResults')}</h1><span /></header>
      <p className="lead">{t('ui.testScore', { c: result.correct, n: result.total, marks: result.marks, max: result.maxMarks })}</p>
      <p className="small muted">{t(result.kind === 'official' ? 'ui.officialNote' : 'ui.genericNote')}</p>
      <h2>{t('ui.explanations')}</h2>
      <ol className="explain-list">
        {result.items.map((it, i) => {
          const q = generateQuestion(it.templateId, it.seed, it.format);
          return (
            <li key={i} className={it.correct ? 'ok' : 'no'}>
              <p><strong>{it.correct ? '✔' : it.answered ? '✗' : '—'}</strong> {translate(q.plain ?? q.prompt, lang)}</p>
              {!it.correct && <p className="small">{translate(q.explain, lang)}</p>}
            </li>
          );
        })}
      </ol>
      {wrong.length > 0 && (
        <section className="card">
          <h2>{t('ui.followUpLessons')}</h2>
          <div className="row wrap">
            {[...new Set(wrong.map((w) => generateQuestion(w.templateId, w.seed).subskill))].slice(0, 4).map((sub) => (
              <button key={sub} type="button" className="btn secondary" onClick={() => launch('lesson', { subskill: sub })}>{t('ui.learnSkill', { skill: t(`subChild.${sub}`) })}</button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Printable practice sheet + separate answer/explanation page, from the same question model. */
export function PrintScreen({ categories, count, seed }: { categories: CategoryId[]; count: number; seed: number }) {
  const t = useT();
  const lang = useLang();
  const qs = useMemo(() => {
    const rng = createRng(seed);
    const subs = MOCK_SUBSKILLS.filter((s) => categories.includes(s.slice(0, 3) as CategoryId));
    return Array.from({ length: count }, (_, i) => {
      const sub = subs[i % subs.length];
      const tpl = rng.pick(templatesForSubskill(sub).filter((x) => paperFriendly(x.id)));
      return generateQuestion(tpl.id, rng.int(1, 2 ** 31 - 1), 'plain');
    });
  }, [categories, count, seed]);
  return (
    <div className="screen print">
      <header className="topbar no-print">
        <BackButton onClick={() => store.setRoute({ name: 'tests' })} label={t('ui.back')} />
        <h1>{t('ui.printable')}</h1>
        {IS_ARTIFACT ? <span /> : <button type="button" className="btn primary" onClick={() => window.print()} data-testid="print-btn">🖨 {t('ui.print')}</button>}
      </header>
      <article className="sheet">
        <h1>{t('ui.sheetTitle')}</h1>
        <p className="small">{t('ui.sheetName')} ____________ &nbsp; {t('ui.sheetDate')} ____________</p>
        <ol className="sheet-qs">
          {qs.map((q, i) => (
            <li key={i}>
              <p>{translate(q.plain ?? q.prompt, lang)}</p>
              {needsPictureInPlain(q) && <div className="sheet-pic"><SceneView q={q} work={{}} setWork={() => undefined} setResponse={() => undefined} interactive={false} reveal={0} bw /></div>}
              {q.answer.kind === 'choice' && (
                <p className="sheet-options">{q.answer.options.map((o, k) => `${'abcd'[k]}) ${translate(o.label, lang)}`).join('    ')}</p>
              )}
              {q.answer.kind === 'fields' && <p className="sheet-options">{q.answer.fields.map((f) => `${translate(f.label, lang)}: ____`).join('    ')}</p>}
              {q.answer.kind !== 'choice' && q.answer.kind !== 'fields' && <p className="answer-line">{t('ui.answer')}: ______________</p>}
            </li>
          ))}
        </ol>
      </article>
      <article className="sheet answers page-break">
        <h1>{t('ui.answersPage')}</h1>
        <ol>
          {qs.map((q, i) => (
            <li key={i}>
              <strong>{answerText(q, lang)}</strong> — {translate(q.explain, lang)}
              {q.scene.type === 'count' && <div className="sheet-pic small-pic"><SceneView q={q} work={{}} setWork={() => undefined} setResponse={() => undefined} interactive={false} reveal={SOLUTION} bw /></div>}
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}

function answerText(q: ReturnType<typeof generateQuestion>, lang: 'en' | 'ta'): string {
  const a = q.answer;
  switch (a.kind) {
    case 'number': return String(a.value);
    case 'choice': return translate(a.options.find((o) => o.id === a.value)!.label, lang);
    case 'order': return a.value.map((id) => translate(a.items.find((i) => i.id === id)!.label, lang)).join(', ');
    case 'fields': return a.fields.map((f) => `${translate(f.label, lang)} ${f.value}`).join(', ');
    case 'time': return `${a.h}:${String(a.m).padStart(2, '0')}`;
  }
}
