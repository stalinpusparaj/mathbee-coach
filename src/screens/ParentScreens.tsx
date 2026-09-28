import { useMemo, useRef, useState } from 'react';
import { store, useProfile, useStore } from '../app/store';
import { launch } from '../app/actions';
import { useT } from '../i18n/useT';
import { TRANSLATION_STATUS } from '../i18n/i18n';
import { buildReport } from '../report/parentReport';
import { todayStr } from '../learning/dates';
import { SUBSKILLS } from '../curriculum/curriculum';
import { STATE_RANK } from '../learning/mastery';
import type { Competition, Settings } from '../learning/types';
import { exportPayload, validateImport } from '../persistence/schema';
import { BackButton, Modal } from '../components/ui';
import { narrationAvailable } from '../audio/speech';
import { AVATARS } from './WelcomeScreens';
import { Sprite } from '../components/art';
import { IS_ARTIFACT, saveTextFile } from '../app/platform';
import { music } from '../audio/music';

const pct = (c: number, n: number) => (n ? `${c}/${n} (${Math.round((100 * c) / n)}%)` : '—');

export function ParentDashboard() {
  const t = useT();
  const profile = useProfile();
  const report = useMemo(() => (profile ? buildReport(profile, todayStr()) : null), [profile]);
  if (!profile || !report) return null;
  const evidenced = SUBSKILLS.length - report.totals['not-assessed'];
  const go = (a: (typeof report.nextActions)[number]['action']) => {
    if (a.kind === 'lesson' || a.kind === 'practice') launch(a.kind, { subskill: a.subskill });
    else if (a.kind === 'review') launch('review');
    else if (a.kind === 'assessment') launch('assessment');
    else if (a.kind === 'fluency') launch('fluency', { subskill: a.subskill });
    else if (a.kind === 'worksheet') store.setRoute({ name: 'tests' });
  };
  return (
    <div className="screen parent" data-testid="parent">
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} />
        <h1>{t('p.title', { name: profile.nickname || t('ui.friend') })}</h1>
        <span />
      </header>
      <nav className="row wrap">
        <button type="button" className="btn small secondary" onClick={() => store.setRoute({ name: 'setup' })} data-testid="to-setup">{t('p.setup')}</button>
        <button type="button" className="btn small secondary" onClick={() => store.setRoute({ name: 'settings' })} data-testid="to-settings">{t('p.settings')}</button>
        {!IS_ARTIFACT && <button type="button" className="btn small secondary" onClick={() => window.print()}>{t('ui.print')}</button>}
      </nav>

      <section className="card disclosure">
        <h2>{t('p.scope')}</h2>
        <p>{t('p.scopeText', { attempts: report.attemptsTotal, evidenced, total: SUBSKILLS.length, notAssessed: report.totals['not-assessed'] })}</p>
        <p className="small muted">{t('p.noReadiness')}</p>
      </section>

      <section className="card">
        <h2>{t('p.nextActions')}</h2>
        <ol className="next-actions">
          {report.nextActions.map((a) => (
            <li key={a.key}><span>{t(a.msg)}</span> <button type="button" className="btn tiny" onClick={() => go(a.action)}>{t('p.start')}</button></li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>{t('p.statements')}</h2>
        {report.statements.length === 0 ? <p className="muted">{t('p.noEvidence')}</p> : (
          <ul className="statements" data-testid="statements">
            {report.statements.filter((s) => s.kind === 'can').map((s) => <li key={`c${s.subskill}`} className="can">✔ {t('p.can', { skill: t(`sub.${s.subskill}`) })}</li>)}
            {report.statements.filter((s) => s.kind === 'support').map((s) => <li key={`s${s.subskill}`} className="support">● {t('p.support', { skill: t(`sub.${s.subskill}`) })}</li>)}
            {report.statements.filter((s) => s.kind === 'assess').map((s) => <li key={`a${s.subskill}`} className="assess">○ {t('p.assess', { topic: t(`cat.${s.subskill.slice(0, 3)}`) })}</li>)}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t('p.coverage')}</h2>
        <table className="data">
          <thead><tr><th>{t('p.ref')}</th><th>{t('p.worksheetItem')}</th><th>{t('p.status')}</th></tr></thead>
          <tbody>
            {report.coverage.map((c) => (
              <tr key={c.ref}><td>{c.ref}</td><td>{c.description}{c.readable === 'partial' && <em className="muted"> ({t('p.partlyReadable')})</em>}</td><td className={`status ${c.status}`}>{t(`p.cov.${c.status}`)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>{t('p.byTopic')}</h2>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>{t('p.topic')}</th><th>{t('p.independent')}</th><th>{t('p.assisted')}</th><th>{t('p.plainFormat')}</th><th>{t('p.skills')}</th></tr></thead>
            <tbody>
              {report.categories.map((r) => (
                <tr key={r.category}>
                  <td>{t(`cat.${r.category}`)}</td>
                  <td>{pct(r.independent.correct, r.independent.total)}</td>
                  <td>{r.assisted.total ? `${r.assisted.completed}/${r.assisted.total}` : '—'}</td>
                  <td>{pct(r.plain.correct, r.plain.total)}</td>
                  <td className="small">{(Object.entries(r.states) as [keyof typeof r.states, number][]).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${t(`state.${s}`)}`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">{t('p.independentNote')}</p>
      </section>

      <section className="card">
        <h2>{t('p.errors')}</h2>
        <p className="small muted">{t('p.errorsNote')}</p>
        {report.observations.length === 0 ? <p className="muted">{t('p.noErrors')}</p> : (
          <ul className="observations">
            {report.observations.slice(0, 10).map((o) => (
              <li key={`${o.subskill}${o.tag}`}>
                <strong>{t(`sub.${o.subskill}`)}</strong>: {t(`tag.${o.tag}`)} — {t(`kind.${o.kind}`)}
                <span className="small muted"> · {t('p.seenTimes', { n: o.occurrences })} · {t('p.followUps', { c: o.followUps.correct, n: o.followUps.total })} · {t(`conf.${o.confidence}`)} · {o.evidence.map((e) => e.date).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t('p.retention')}</h2>
        {report.retention.length === 0 ? <p className="muted">{t('p.noRetention')}</p> : (
          <ul>{report.retention.map((r) => <li key={r.subskill}>{t(`sub.${r.subskill}`)}: {r.checks.map((c) => `${c.date} ${c.pass ? '✔' : '✗'}`).join(', ')}</li>)}</ul>
        )}
        {report.dueReviews.length > 0 && <p className="small">{t('p.reviewsDue', { n: report.dueReviews.length })}</p>}
      </section>

      <section className="card">
        <h2>{t('p.formats')}</h2>
        <p>{t('p.formatsText', { plain: pct(report.plainOverall.correct, report.plainOverall.total), inter: pct(report.interactiveOverall.correct, report.interactiveOverall.total) })}</p>
      </section>

      <section className="card">
        <h2>{t('p.speed')}</h2>
        <p className="small muted">{t('p.speedNote')}</p>
        {report.speed.length === 0 ? <p className="muted">{t('p.noSpeed')}</p> : (
          <table className="data"><thead><tr><th>{t('p.skill')}</th><th>{t('p.earlier')}</th><th>{t('p.recent')}</th><th>n</th></tr></thead>
            <tbody>{report.speed.map((s) => <tr key={s.subskill}><td>{t(`sub.${s.subskill}`)}</td><td>{(s.earlierMs / 1000).toFixed(1)} s</td><td>{(s.recentMs / 1000).toFixed(1)} s</td><td>{s.n}</td></tr>)}</tbody>
          </table>
        )}
        <FluencyOffers />
      </section>

      <section className="card">
        <h2>{t('p.history')}</h2>
        <ul className="history">
          {[...profile.sessions].reverse().slice(0, 12).map((s) => (
            <li key={s.id}>{s.date} · {t(`mode.${s.mode}`)} · {t('p.historyRow', { q: s.questions, ind: s.independentCorrect, sup: s.supportedCompleted })}{s.completed ? '' : ` · ${t('p.stoppedEarly')}`}</li>
          ))}
          {[...profile.mockHistory].reverse().slice(0, 6).map((m) => <li key={m.id}>{m.date} · {t(m.kind === 'official' ? 'ui.officialShort' : 'ui.genericShort')} · {m.correct}/{m.total}</li>)}
          {profile.sessions.length + profile.mockHistory.length === 0 && <li className="muted">{t('p.noHistory')}</li>}
        </ul>
      </section>

      <details className="card">
        <summary>{t('p.skillDetail')}</summary>
        <table className="data">
          <thead><tr><th>{t('p.skill')}</th><th>{t('p.state')}</th><th>{t('p.latest')}</th><th>{t('p.missing')}</th></tr></thead>
          <tbody>
            {SUBSKILLS.map((s) => {
              const e = report.evidence[s.id];
              return (
                <tr key={s.id}>
                  <td>{t(`sub.${s.id}`)}{s.source === 'extension' && <em className="muted"> ({t('ui.extension')})</em>}</td>
                  <td>{t(`state.${e.state}`)}</td>
                  <td>{e.window.length ? `${e.windowCorrect}/${e.window.length}` : '—'}</td>
                  <td className="small">{e.state === 'not-assessed' ? '' : e.missing.map((m) => t(`miss.${m}`)).join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="small muted">{t('p.masteryNote', { c: profile.settings.mastery.correct, w: profile.settings.mastery.window })}</p>
      </details>
    </div>
  );
}

function FluencyOffers() {
  const t = useT();
  const profile = useProfile();
  const report = useMemo(() => (profile ? buildReport(profile, todayStr()) : null), [profile]);
  if (!report) return null;
  const ready = SUBSKILLS.filter((s) => STATE_RANK[report.evidence[s.id].state] >= STATE_RANK['practising-independently'] && report.evidence[s.id].meetsAccuracy);
  if (!ready.length) return <p className="small muted">{t('p.fluencyLocked')}</p>;
  return (
    <div className="row wrap">
      <span className="small">{t('p.fluencyReady')}</span>
      {ready.slice(0, 4).map((s) => <button key={s.id} type="button" className="btn tiny secondary" onClick={() => launch('fluency', { subskill: s.id })}>{t(`sub.${s.id}`)}</button>)}
    </div>
  );
}

export function ParentSetup() {
  const t = useT();
  const profile = useProfile();
  const [c, setC] = useState<Competition | null>(profile?.competition ?? null);
  if (!profile || !c) return null;
  const save = () => {
    store.updateProfile((p) => ({ ...p, competition: c }));
    store.setRoute({ name: 'parent' });
  };
  const numOrNull = (v: string) => (v === '' ? null : Math.max(1, Math.min(300, Math.round(Number(v)) || 1)));
  return (
    <div className="screen setup">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'parent' })} label={t('ui.back')} /><h1>{t('p.setup')}</h1><span /></header>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field-row"><span>{t('p.compName')}</span><input value={c.name} maxLength={60} onChange={(e) => setC({ ...c, name: e.target.value })} data-testid="comp-name" /></label>
        <label className="field-row"><span>{t('p.compDate')}</span><input type="date" value={c.date} onChange={(e) => setC({ ...c, date: e.target.value })} /></label>
        <label className="field-row"><span>{t('p.examLang')}</span>
          <select value={c.examLanguage} onChange={(e) => setC({ ...c, examLanguage: e.target.value as Competition['examLanguage'] })}>
            <option value="">{t('p.notSure')}</option><option value="en">English</option><option value="ta">தமிழ்</option>
          </select>
        </label>
        <fieldset>
          <legend>{t('p.rules')}</legend>
          <p className="small muted">{t('p.rulesNote')}</p>
          <label className="field-row"><span>{t('p.duration')}</span><input type="number" min={1} value={c.durationMin ?? ''} onChange={(e) => setC({ ...c, durationMin: numOrNull(e.target.value) })} /></label>
          <label className="field-row"><span>{t('p.qCount')}</span><input type="number" min={1} value={c.questionCount ?? ''} onChange={(e) => setC({ ...c, questionCount: numOrNull(e.target.value) })} data-testid="comp-count" /></label>
          <label className="field-row"><span>{t('p.marks')}</span><input type="number" min={1} value={c.marksPerQuestion ?? ''} onChange={(e) => setC({ ...c, marksPerQuestion: numOrNull(e.target.value) })} /></label>
          <label className="field-row"><span>{t('p.scoring')}</span><input value={c.scoring} maxLength={120} onChange={(e) => setC({ ...c, scoring: e.target.value })} /></label>
          <label className="field-row"><span>{t('p.navigation')}</span>
            <select value={c.navigation} onChange={(e) => setC({ ...c, navigation: e.target.value as Competition['navigation'] })}>
              <option value="free">{t('p.navFree')}</option><option value="forward">{t('p.navForward')}</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={c.rulesConfirmed} onChange={(e) => setC({ ...c, rulesConfirmed: e.target.checked })} data-testid="rules-confirmed" /> {t('p.confirmRules')}</label>
        </fieldset>
        <button type="submit" className="btn primary" data-testid="save-setup">{t('p.save')}</button>
      </form>
    </div>
  );
}

export function SettingsScreen() {
  const t = useT();
  const profile = useProfile();
  const storage = useStore((s) => s.storage);
  const storageError = useStore((s) => s.storageError);
  const musicOn = useStore((s) => s.app.music !== false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [confirmReset, setConfirmReset] = useState<'profile' | 'all' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;
  const s = profile.settings;
  const set = (patch: Partial<Settings>) => store.updateProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const [exportText, setExportText] = useState<string | null>(null);
  const exportData = async () => {
    const json = JSON.stringify(exportPayload(store.get().app, new Date().toISOString()), null, 1);
    const res = await saveTextFile(`mathbee-coach-${todayStr()}.json`, json);
    // no save surface available: show the data to copy instead
    setExportText(res === 'unavailable' ? json : null);
  };
  const copyExport = async () => {
    try { await navigator.clipboard.writeText(exportText ?? ''); } catch { (document.getElementById('export-text') as HTMLTextAreaElement | null)?.select(); }
  };
  const importData = async (f: File) => {
    try {
      if (f.size > 20_000_000) throw new Error('too large');
      const res = validateImport(JSON.parse(await f.text()));
      if (res.ok) {
        store.setApp(res.state);
        setImportMsg({ ok: true, lines: [t('s.importOk')] });
      } else setImportMsg({ ok: false, lines: res.errors });
    } catch {
      setImportMsg({ ok: false, lines: [t('s.importBad')] });
    }
  };
  const resetProfile = () => {
    const app = store.get().app;
    store.setApp({ ...app, profiles: app.profiles.filter((p) => p.id !== profile.id), activeProfileId: null });
    store.setRoute({ name: 'welcome' });
  };
  return (
    <div className="screen settings">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'parent' })} label={t('ui.back')} /><h1>{t('p.settings')}</h1><span /></header>
      <section className="card form">
        <h2>{t('s.child')}</h2>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button key={a} type="button" className={`avatar ${profile.avatar === a ? 'on' : ''}`} onClick={() => store.updateProfile((p) => ({ ...p, avatar: a }))} aria-pressed={profile.avatar === a} aria-label={a}>
              <Sprite id={a} size={48} decorative />
            </button>
          ))}
        </div>
        <label className="field-row"><span>{t('ui.nickname')}</span><input value={profile.nickname} maxLength={20} onChange={(e) => store.updateProfile((p) => ({ ...p, nickname: e.target.value.slice(0, 20) }))} /></label>
        <label className="field-row"><span>{t('ui.language')}</span>
          <select value={profile.language} onChange={(e) => store.updateProfile((p) => ({ ...p, language: e.target.value as 'en' | 'ta' }))} data-testid="language">
            <option value="en">English</option><option value="ta">தமிழ்</option>
          </select>
        </label>
        <p className="small muted">{t('s.tamilStatus', { status: TRANSLATION_STATUS.ta, voice: narrationAvailable('ta') ? t('s.yes') : t('s.no') })}</p>
      </section>
      <section className="card form">
        <h2>{t('s.play')}</h2>
        <label className="check"><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> {t('s.sound')}</label>
        <label className="check"><input type="checkbox" checked={musicOn} onChange={(e) => { store.setMusic(e.target.checked); if (e.target.checked) music.start(); else music.stop(); }} data-testid="music-setting" /> {t('s.music')}</label>
        <label className="check"><input type="checkbox" checked={s.narration} onChange={(e) => set({ narration: e.target.checked })} /> {t('s.narration')}</label>
        <label className="field-row"><span>{t('s.motion')}</span>
          <select value={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.value as Settings['reducedMotion'] })}>
            <option value="system">{t('s.motionSystem')}</option><option value="on">{t('s.motionReduce')}</option><option value="off">{t('s.motionFull')}</option>
          </select>
        </label>
        <label className="field-row"><span>{t('s.graphics')}</span>
          <select value={s.graphics ?? 'auto'} onChange={(e) => set({ graphics: e.target.value as Settings['graphics'] })} data-testid="graphics-setting">
            <option value="auto">{t('s.graphicsAuto')}</option><option value="3d">{t('s.graphics3d')}</option><option value="2d">{t('s.graphics2d')}</option>
          </select>
        </label>
        <label className="field-row"><span>{t('s.minutes')}</span><input type="number" min={3} max={30} value={s.sessionMinutes} onChange={(e) => set({ sessionMinutes: Math.max(3, Math.min(30, Number(e.target.value) || 10)) })} data-testid="minutes" /></label>
      </section>
      <section className="card form">
        <h2>{t('s.learning')}</h2>
        <p className="small muted">{t('s.heuristicNote')}</p>
        <label className="field-row"><span>{t('s.masteryCorrect')}</span><input type="number" min={1} max={20} value={s.mastery.correct} onChange={(e) => set({ mastery: { ...s.mastery, correct: Math.max(1, Math.min(s.mastery.window, Number(e.target.value) || 8)) } })} /></label>
        <label className="field-row"><span>{t('s.masteryWindow')}</span><input type="number" min={3} max={20} value={s.mastery.window} onChange={(e) => set({ mastery: { ...s.mastery, window: Math.max(3, Math.min(20, Number(e.target.value) || 10)) } })} /></label>
        <label className="field-row"><span>{t('s.intervals')}</span>
          <input value={s.reviewIntervals.join(', ')} onChange={(e) => {
            const v = e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 60);
            if (v.length) set({ reviewIntervals: v });
          }} />
        </label>
        <label className="check"><input type="checkbox" checked={s.unlockRegrouping} onChange={(e) => set({ unlockRegrouping: e.target.checked })} /> {t('s.regroup')}</label>
        <label className="check"><input type="checkbox" checked={s.showExtensions} onChange={(e) => set({ showExtensions: e.target.checked })} /> {t('s.extensions')}</label>
      </section>
      <section className="card form">
        <h2>{t('s.data')}</h2>
        <p className="small">{t(`s.storage.${storage}`)}{storageError ? ` (${storageError})` : ''}</p>
        <p className="small muted">{t('s.privacy')}</p>
        <div className="row wrap">
          <button type="button" className="btn secondary" onClick={exportData} data-testid="export">{t('s.export')}</button>
          <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()} data-testid="import">{t('s.import')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} data-testid="import-file" />
        </div>
        {exportText !== null && (
          <div className="notice ok">
            <p>{t('s.exportCopy')}</p>
            <textarea id="export-text" readOnly value={exportText} rows={5} style={{ width: '100%' }} />
            <button type="button" className="btn small" onClick={copyExport}>{t('s.copy')}</button>
          </div>
        )}
        {importMsg && <div className={`notice ${importMsg.ok ? 'ok' : 'bad'}`} role="status" data-testid="import-msg">{importMsg.lines.map((l, i) => <p key={i}>{l}</p>)}</div>}
        <div className="row wrap">
          <button type="button" className="btn danger" onClick={() => setConfirmReset('profile')} data-testid="reset-profile">{t('s.resetProfile')}</button>
          <button type="button" className="btn danger" onClick={() => setConfirmReset('all')} data-testid="reset-all">{t('s.resetAll')}</button>
        </div>
      </section>
      <section className="card"><p className="small muted">{t('s.about')}</p></section>
      {confirmReset && (
        <Modal title={t('s.confirmTitle')} onClose={() => setConfirmReset(null)}>
          <p>{t(confirmReset === 'all' ? 's.confirmAll' : 's.confirmProfile')}</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setConfirmReset(null)} data-testid="reset-cancel">{t('ui.cancel')}</button>
            <button type="button" className="btn danger" onClick={() => { const k = confirmReset; setConfirmReset(null); if (k === 'all') void store.resetAll(); else resetProfile(); }} data-testid="reset-confirm">{t('s.yesReset')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

