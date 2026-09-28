import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { store, useProfile } from '../app/store';
import { closeSession } from '../app/actions';
import { generateQuestion } from '../engine/registry';
import { isComplete, emptyResponse } from '../engine/check';
import type { ErrorTag, Response } from '../engine/types';
import { checkCurrent, finishCurrent, setWork, showSolution, useHint as recordHint } from '../learning/session';
import { ActiveTimer } from '../learning/activeTime';
import { todayStr } from '../learning/dates';
import { SceneView, needsPictureInPlain } from '../activities/SceneView';
import { SOLUTION } from '../activities/sceneTypes';
import { AnswerPanel } from '../components/AnswerPanel';
import { useT, useLang } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { speak, stopSpeaking, onSpeakingChange, narrationAvailable } from '../audio/speech';
import { sfx } from '../audio/sfx';
import { Sprite } from '../components/art';
import { pickSprite, spriteUrl } from '../assets/manifest';
import { Modal } from '../components/ui';
import { Celebration } from '../components/Celebration';
import { displayName, pickCheer } from '../learning/gamification';
import { JourneyTrack } from '../components/JourneyTrack';
import { themeFor } from '../activities/journey';
import { getTemplate } from '../engine/registry';

type Feedback = { kind: 'correct' } | { kind: 'wrong'; tag: ErrorTag | null } | null;

export function SessionScreen() {
  const profile = useProfile();
  const t = useT();
  const lang = useLang();
  const session = profile?.activeSession ?? null;
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [paused, setPaused] = useState(false);
  const [workedStep, setWorkedStep] = useState(0);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<{ seed: number; key: string } | null>(null);
  const lastCheer = useRef<string | null>(null);
  const [flyKey, setFlyKey] = useState<number | null>(null);
  const endCelebration = useCallback(() => setCelebrate(null), []);
  const timer = useRef(new ActiveTimer());

  const slot = session && !session.finished ? session.plan[session.index] : null;
  const st = session ? session.slots[session.index] : undefined;
  const q = useMemo(() => (slot ? generateQuestion(slot.templateId, slot.seed, slot.format) : null), [slot?.templateId, slot?.seed, slot?.format]);

  // session complete → results
  useEffect(() => {
    if (session?.finished) closeSession();
  }, [session?.finished]);

  // reset per-question UI state and start the active-time clock
  useEffect(() => {
    setFeedback(st?.solved ? { kind: 'correct' } : null);
    setWorkedStep(0);
    setActiveField(null);
    timer.current = new ActiveTimer();
    timer.current.start();
    return () => void timer.current.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id, session?.index]);

  // exclude narration, hidden tabs and pauses from active time
  useEffect(() => onSpeakingChange((on) => (on ? timer.current.hold('narration') : timer.current.release('narration'))), []);
  useEffect(() => {
    const vis = () => (document.hidden ? timer.current.hold('hidden') : timer.current.release('hidden'));
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  useEffect(() => (paused ? timer.current.hold('pause') : timer.current.release('pause')), [paused]);
  useEffect(() => (feedback ? timer.current.hold('feedback') : timer.current.release('feedback')), [feedback]);
  useEffect(() => () => stopSpeaking(), []);

  const phase = slot?.phase;
  const worked = phase === 'worked';
  const guided = phase === 'guided';
  const solved = !!st?.solved;
  const sawSolution = !!st?.sawSolution;
  const hintLevel = worked ? workedStep : Math.max(st?.hints ?? 0, guided ? 1 : 0);
  const reveal = sawSolution || (worked && workedStep > (q?.hints.length ?? 0)) ? SOLUTION : hintLevel;
  const response: Response | undefined = st?.response ?? (q ? emptyResponse(q.answer, q.scene.type === 'clock' && q.scene.mode === 'set' ? { h: q.scene.startH ?? 12, m: q.scene.startM ?? 0 } : undefined) : undefined);
  const complete = !!q && isComplete(q.answer, response) && (q.answer.kind !== 'time' || !!st?.response);
  const wrongCount = (st?.checks ?? 0) - (solved ? 1 : 0);
  const locked = solved || sawSolution || worked || busy;

  const promptText = q ? translate(q.format === 'plain' ? q.plain ?? q.prompt : q.prompt, lang) : '';
  const canNarrate = profile?.settings.narration && narrationAvailable(lang);
  const narrate = useCallback(() => {
    if (!q || !profile?.settings.narration) return;
    speak(translate(q.narration ?? q.prompt, lang), lang);
  }, [q, lang, profile?.settings.narration]);

  // automated browser tests (only with ?e2e in the URL) can read the expected answer
  useEffect(() => {
    if (q && new URLSearchParams(location.search).has('e2e')) (window as unknown as { __mathbeeAnswer?: unknown }).__mathbeeAnswer = { answer: q.answer, scene: q.scene, templateId: q.templateId };
  }, [q]);

  // read the instruction aloud once when a question appears
  useEffect(() => {
    if (q && !st?.done) narrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  const update = (fn: Parameters<typeof store.updateProfile>[0]) => store.updateProfile(fn);
  const onWork = (w: Record<string, unknown>) => update((p) => setWork(p, w));
  const onResponse = (r: Response) => {
    if (feedback?.kind === 'wrong') setFeedback(null);
    update((p) => setWork(p, p.activeSession?.slots[p.activeSession.index]?.work ?? {}, r));
  };

  const check = () => {
    if (!q || !response || !complete || busy || solved) return;
    setBusy(true);
    const p = store.get().app.profiles.find((x) => x.id === profile!.id)!;
    const out = checkCurrent(p, response, timer.current.elapsed(), timer.current.interruptionCount());
    if (!out.duplicate) {
      update(() => out.profile);
      setFeedback(out.correct ? { kind: 'correct' } : { kind: 'wrong', tag: out.errorTag });
      if (out.correct) {
        const name = displayName(profile!.nickname);
        const seed = Date.now() % 100000;
        const key = pickCheer(seed, lastCheer.current, { named: !!name, fixed: (st?.checks ?? 0) > 0 });
        lastCheer.current = key;
        setCelebrate({ seed, key });
        if (profile?.settings.narration) speak(translate({ k: key, p: { name } }, lang), lang);
      }
      if (profile?.settings.sound) (out.correct ? sfx.good : sfx.tryAgain)();
    }
    setBusy(false);
  };

  const next = (skipped = false) => {
    if (busy) return;
    setBusy(true);
    stopSpeaking();
    const p = store.get().app.profiles.find((x) => x.id === profile!.id)!;
    const out = finishCurrent(p, todayStr(), Date.now(), { skipped });
    update(() => out.profile);
    if (out.nectarAwarded) {
      setToast(t('ui.nectarPlus', { n: out.nectarAwarded }));
      setFlyKey(Date.now());
      setTimeout(() => setToast(null), 1600);
      setTimeout(() => setFlyKey(null), 1000);
    }
    setFeedback(null);
    setCelebrate(null);
    setBusy(false);
  };

  const hint = () => {
    if (!q || locked) return;
    if ((st?.hints ?? 0) >= q.hints.length) return;
    update((p) => recordHint(p));
  };

  const showMe = () => update((p) => showSolution(p));

  // keyboard: Enter checks (only when ready) or continues; Escape pauses
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaused(true);
      if (e.key === 'Enter' && !paused) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
        if (solved || sawSolution) next();
        else if (complete && !feedback) check();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!profile || !session || !slot || !q) return <div className="screen center"><p>{t('ui.loading')}</p></div>;

  const showScene = q.format !== 'plain' || needsPictureInPlain(q);
  // work-aware feedback: every object was marked, but the number given differs
  const markedAll = q.scene.type === 'count' && !q.scene.groups && q.scene.objects.length > 0
    && Array.isArray(st?.work.marked) && (st!.work.marked as string[]).length === q.scene.objects.length;
  const wrongKey = feedback?.kind === 'wrong' ? (markedAll ? 'fb.markedAllNumber' : `fb.tag.${feedback.tag ?? 'other'}`) : '';
  // the clock is itself the answer control for 'set the time' questions, in every format
  const interactiveScene = !locked && (q.format === 'interactive' || q.answer.kind === 'time');
  const progress = session.plan.length;
  const shownHints = worked ? q.hints.slice(0, Math.min(workedStep, q.hints.length)) : q.hints.slice(0, hintLevel);

  return (
    <div className={`screen session ${q.format}`} data-testid="session">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setPaused(true)} aria-label={t('ui.pause')} data-testid="pause">❚❚</button>
        <span className="progress-text" aria-label={t('ui.progress', { n: session.index + 1, total: progress })}>{session.index + 1} / {progress}</span>
        <button type="button" className="icon-btn" onClick={narrate} disabled={!canNarrate} aria-label={t('ui.hearAgain')} title={canNarrate ? t('ui.hearAgain') : t('ui.noVoice')} data-testid="hear">🔊</button>
      </header>

      <JourneyTrack
        theme={themeFor(session.plan.map((p) => getTemplate(p.templateId).category))}
        index={session.index}
        total={progress}
        marks={session.plan.map((_, i) => {
          const s = session.slots[i];
          return { done: !!s?.done, own: !!s?.done && s.firstResult === true && s.hintsBeforeFirstCheck === 0, skipped: !!s?.skipped };
        })}
        name={displayName(profile.nickname) || t('ui.friend')}
        onStoryTap={(text) => { if (profile.settings.narration) speak(text, lang); }}
        quiet={(st?.checks ?? 0) > 0}
      />
      <section className="prompt-box" aria-live="polite">
        {!slot.unannounced && spriteUrl(`banner_${q.category}`) && (
          <div className="scene-banner" style={{ backgroundImage: `url(${spriteUrl(`banner_${q.category}`)})` }} aria-hidden />
        )}
        {!slot.unannounced && <span className="chip">{t(`cat.${q.category}`)}</span>}
        {q.extension && <span className="chip ext">{t('ui.extension')}</span>}
        {worked && <span className="chip lesson">{t('ui.watchMe')}</span>}
        {guided && <span className="chip lesson">{t('ui.tryTogether')}</span>}
        {q.format === 'plain' && <span className="chip plain">{t('ui.worksheetStyle')}</span>}
        <h1 className="prompt" data-testid="prompt">{promptText}</h1>
      </section>

      <main className="play">
        {showScene && (
          <SceneView
            q={q}
            work={st?.work ?? {}}
            setWork={onWork}
            response={response}
            setResponse={onResponse}
            interactive={interactiveScene}
            reveal={reveal}
            bw={q.format === 'plain'}
            onFieldFocus={setActiveField}
          />
        )}
        {shownHints.length > 0 && (
          <ul className="hints" aria-live="polite">
            {shownHints.map((h, i) => <li key={i}><Sprite id="bee" size={28} decorative /> {t(h)}</li>)}
          </ul>
        )}
      </main>

      {worked ? (
        <footer className="controls">
          <div className="guide-bubble"><Sprite id={pickSprite('bee_point', 'bee')} size={44} decorative /><p>{workedStep > q.hints.length ? t(q.explain) : t('ui.watchSteps')}</p></div>
          {workedStep <= q.hints.length ? (
            <button type="button" className="btn primary big" onClick={() => setWorkedStep((s) => s + 1)} data-testid="next-step">{t('ui.nextStep')}</button>
          ) : (
            <button type="button" className="btn primary big" onClick={() => next()} data-testid="ready">{t('ui.readyToTry')}</button>
          )}
        </footer>
      ) : (
        <footer className="controls">
          {!solved && !sawSolution && (
            <AnswerPanel answer={q.answer} response={response} onChange={onResponse} disabled={locked} activeField={activeField} onActiveField={setActiveField} />
          )}
          {feedback?.kind === 'correct' || sawSolution ? (
            <div className={`feedback ${sawSolution && !solved ? 'shown' : 'good'}`} role="status" data-testid="feedback">
              <Sprite id={sawSolution && !solved ? pickSprite('bee_point', 'bee') : pickSprite('bee_celebrate', 'bee')} size={52} decorative />
              <div>
                <p className="fb-title">{sawSolution && !solved ? t('ui.hereIsHow') : t(`fb.correct.${(session.index % 4) + 1}`)}</p>
                <p>{t(q.explain)}</p>
              </div>
            </div>
          ) : feedback?.kind === 'wrong' ? (
            <div className="feedback wrong" role="status" data-testid="feedback">
              <Sprite id={pickSprite('bee_think', 'bee')} size={52} decorative />
              <div>
                <p className="fb-title">{t(wrongKey)}</p>
                <p>{t('ui.keepWork')}</p>
              </div>
            </div>
          ) : null}
          <div className="action-row">
            {!solved && !sawSolution && (
              <>
                <button type="button" className="btn secondary" onClick={hint} disabled={locked || (st?.hints ?? 0) >= q.hints.length} data-testid="hint">💡 {t('ui.hint')}</button>
                {wrongCount >= 2 && <button type="button" className="btn secondary" onClick={showMe} data-testid="show-me">{t('ui.showMe')}</button>}
                <button type="button" className="btn primary big" onClick={check} disabled={!complete || busy || feedback?.kind === 'wrong'} data-testid="check">✔ {t('ui.check')}</button>
                {feedback?.kind === 'wrong' && <button type="button" className="btn primary" onClick={() => setFeedback(null)} data-testid="try-again">{t('ui.tryAgain')}</button>}
              </>
            )}
            {(solved || sawSolution) && <button type="button" className="btn primary big" onClick={() => next()} disabled={busy} data-testid="next">{t('ui.next')} ➜</button>}
          </div>
        </footer>
      )}

      {celebrate !== null && <Celebration seed={celebrate.seed} cheerKey={celebrate.key} name={displayName(profile.nickname)} onDone={endCelebration} />}
      {flyKey !== null && <span key={flyKey} className="nectar-fly" aria-hidden>🍯<b>+1</b></span>}
      {toast && <div className="toast" role="status">🍯 {toast}</div>}

      {paused && (
        <Modal title={t('ui.paused')} onClose={() => setPaused(false)}>
          <p>{t('ui.pausedText')}</p>
          <div className="stack">
            <button type="button" className="btn primary big" onClick={() => setPaused(false)} data-testid="resume">{t('ui.keepGoing')}</button>
            {!solved && !sawSolution && !worked && <button type="button" className="btn secondary" onClick={() => { setPaused(false); next(true); }} data-testid="skip">{t('ui.skipQuestion')}</button>}
            <button type="button" className="btn secondary" onClick={() => { setPaused(false); stopSpeaking(); closeSession(); }} data-testid="stop">{t('ui.stopForNow')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
