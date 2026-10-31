import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Profile, SessionRecord, WorldId } from '../learning/types';
import { store, useProfile } from '../app/store';
import { launch, launchLevel } from '../app/actions';
import { pushOverlay } from '../app/backNav';
import { useLang, useT } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { speak, stopSpeaking } from '../audio/speech';
import { sfx } from '../audio/sfx';
import { bloomWipe, haptic } from '../fx/juice';
import { Sprite } from '../components/art';
import { spriteUrl } from '../assets/manifest';
import { BackButton } from '../components/ui';
import { HatBee } from '../components/Fun';
import { Blooms, Bud, WorldPath, prefersReducedMotion, type BudState, type WorldPathNode } from '../components/WorldPath';
import { worldVars } from '../activities/journey';
import { LEVEL_BY_ID, WORLD_BY_ID, isSideBranch, levelSubskills, levelsOf, type LevelDef, type WorldDef } from '../adventure/levels';
import {
  isLevelUnlocked, isLevelVisible, mapDecorations, markFriendCelebrated, nextLevelId, petalsFor, starsFor, starsOf,
  worldStatus, worldSummaries,
} from '../adventure/progress';
import { evaluateAll, isSecure, type SkillEvidence } from '../learning/mastery';
import { currentHat } from '../learning/fun';
import { displayName } from '../learning/gamification';

/**
 * Adventure Mode screens: the world cards, one world's winding map with its level intro
 * card, and the level results with the friend's party cutscene. Stars are always shown as
 * 1–3 blooms; nothing here is timed, nothing is lost, and there is no "perfect" trophy.
 */

type Ev = Record<string, SkillEvidence>;

function useEvidence(profile: Profile | null): Ev {
  return useMemo(() => (profile ? evaluateAll(profile.attempts, profile.settings.mastery) : {}), [profile?.attempts, profile?.settings.mastery]);
}

/** World colours, plus the painted world backdrop when that art is bundled (falls back to colour only). */
const worldStyle = (w: WorldDef) => {
  const art = spriteUrl(`world_${w.theme}`);
  return { ...worldVars(w.theme), ...(art ? { '--world-art': `url(${art})` } : {}) } as CSSProperties;
};

/** The friend of a world (the Queen Bee wears her crown; the bonus world has Buzzy). */
function FriendArt({ world, size, grey }: { world: WorldDef; size: number; grey?: boolean }) {
  const art = world.friend === 'svg:hive' ? <HatBee hat="👑" size={size} />
    : world.friend ? <Sprite id={world.friend} size={size} decorative /> : <HatBee hat="🍯" size={size} />;
  return <span className={`adv-friend ${grey ? 'grey' : ''}`} aria-hidden>{art}</span>;
}

function friendName(t: ReturnType<typeof useT>, world: WorldId): string {
  return t(`advui.friend.${world}`);
}

const isParty = (l: LevelDef) => l.kind === 'friend' || l.kind === 'finale';

/** Register an overlay with back navigation once (back / Escape calls the latest `close`). */
function useOverlay(close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => pushOverlay(() => ref.current()), []);
}

/** Overlays render on <body>, so a screen's entrance animation (a transform) cannot trap them. */
function Layer({ children }: { children: ReactNode }) {
  return typeof document === 'undefined' ? <>{children}</> : createPortal(children, document.body);
}

/** Read a line aloud when narration is on (the text always stays on screen). */
function useNarration(text: string | null, on: boolean) {
  const lang = useLang();
  useEffect(() => {
    if (on && text) speak(text, lang);
  }, [text, lang, on]);
  useEffect(() => () => stopSpeaking(), []);
}

/**
 * A gentle line for a tap that cannot open anything (a closed bud or world): read aloud when
 * narration is on and shown as a toast at the bottom of the screen, so it is seen and heard
 * wherever the child tapped (a line above a long map can be scrolled out of view).
 */
function useGentleNote(narration: boolean) {
  const lang = useLang();
  const [note, setNote] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 4500);
    return () => window.clearTimeout(id);
  }, [note]);
  const show = (text: string) => {
    setNote((n) => ({ text, key: (n?.key ?? 0) + 1 }));
    if (narration) speak(text, lang);
  };
  const view = (
    <Layer>
      <p className="adv-toast" role="status" aria-live="polite" data-testid="adv-note">
        {note && <span key={note.key}>{note.text}</span>}
      </p>
    </Layer>
  );
  return { show, hide: () => setNote(null), view };
}

/** Briefly wiggle the bud the child should play first (a highlight only under reduced motion). */
function nudge(id: string | null) {
  if (!id || typeof document === 'undefined') return;
  const el = document.querySelector<HTMLElement>(`[data-testid="level-${id}"]`);
  if (!el) return;
  el.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  el.classList.remove('adv-nudge');
  void el.offsetWidth; // restart the animation on a second tap
  el.classList.add('adv-nudge');
  window.setTimeout(() => el.classList.remove('adv-nudge'), 1600);
}

// =====================================================================================
// Worlds
// =====================================================================================

export function AdventureWorldsScreen() {
  const t = useT();
  const profile = useProfile();
  const ev = useEvidence(profile);
  const note = useGentleNote(!!profile?.settings.narration);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => () => stopSpeaking(), []);
  if (!profile) return null;
  const summaries = worldSummaries(profile, ev).filter((s) => s.world !== 'bonus' || s.open);
  const decorations = mapDecorations(profile);
  return (
    <div className="screen adventure-worlds" data-testid="adventure">
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} />
        <h1>{t('advui.title')}</h1>
        <div className="nectar" aria-label={t('ui.nectarCount', { n: profile.nectar })}>🍯 {profile.nectar}</div>
      </header>
      {decorations > 0 && (
        <p className="adv-decor" role="img" aria-label={t('advui.decorations')}>
          {Array.from({ length: Math.min(decorations, 8) }, (_, i) => <span key={i} aria-hidden>{['🌷', '🌻', '🦋', '🍄'][i % 4]}</span>)}
        </p>
      )}
      <ul className="world-cards" aria-label={t('advui.worlds')}>
        {summaries.map((s) => {
          const w = WORLD_BY_ID[s.world];
          const name = t(w.nameKey);
          const state = !s.open ? t('advui.closedWorld') : s.current ? t('advui.current') : s.knowsPath ? t('advui.knowsPath') : t('advui.bloomsCollected', { n: s.stars });
          return (
            <li key={s.world}>
              <button type="button" className={`world-card ${s.open ? '' : 'closed'} ${s.current ? 'current' : ''}`} data-world={w.theme} style={worldStyle(w)}
                onClick={() => (s.open ? store.setRoute({ name: 'adventure-world', world: s.world }) : note.show(t('advui.closedWorld')))}
                aria-disabled={!s.open || undefined}
                aria-label={t('advui.worldCard', { name, state })} data-testid={`adv-world-${s.world}`}>
                <span className="wc-hills" aria-hidden />
                <span className="wc-num">{s.world === 'bonus' ? t('advui.bonus') : t('advui.worldN', { n: w.n })}</span>
                <FriendArt world={w} size={76} grey={!s.friendMet && s.world !== 'bonus'} />
                <span className="wc-body">
                  <strong className="wc-name">{name}</strong>
                  {s.open ? (
                    <>
                      <span className="wc-blooms"><span aria-hidden>✿</span> {t('advui.bloomsCollected', { n: s.stars })}</span>
                      <span className="wc-bar" aria-hidden><span style={{ width: `${s.total ? (100 * s.done) / s.total : 0}%` }} /></span>
                      <small>{t('advui.levelsDone', { n: s.done, total: s.total })}</small>
                    </>
                  ) : (
                    <span className="wc-closed"><Bud state="locked" n={w.n} /> <small>{t('advui.closedWorld')}</small></span>
                  )}
                  {s.knowsPath && <small className="wc-knows">🐝 {t('advui.knowsPath')}</small>}
                </span>
                {s.current && <span className="wc-here">{t('advui.current')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {note.view}
    </div>
  );
}

// =====================================================================================
// World map
// =====================================================================================

/** The level whose landing the bee has already flown to (the flight plays once per result). */
let flownTo: string | null = null;

function budState(l: LevelDef, p: Profile, ev: Ev): BudState {
  return starsOf(p, l.id) >= 1 ? 'done' : isLevelUnlocked(l, p, ev) ? 'open' : 'locked';
}

export function WorldMapScreen({ world }: { world: string }) {
  const t = useT();
  const profile = useProfile();
  const ev = useEvidence(profile);
  const def = WORLD_BY_ID[world as WorldId] as WorldDef | undefined;
  const [listView, setListView] = useState(false);
  const [introId, setIntroId] = useState<string | null>(null);
  const note = useGentleNote(!!profile?.settings.narration);

  const last = profile?.adventure?.lastLevelId ?? null;
  const next = profile ? nextLevelId(profile, ev, last ?? undefined) : null;
  const levels = profile && def ? levelsOf(def.id).filter((l) => isLevelVisible(l, profile, ev)) : [];
  const inWorld = (id: string | null) => !!id && levels.some((l) => l.id === id);
  const current = inWorld(next) ? next : levels.find((l) => profile && budState(l, profile, ev) === 'open' && !isSideBranch(l, profile.settings))?.id ?? null;
  const beeAt = current ?? (inWorld(last) ? last : levels[0]?.id ?? null);
  const [beeFrom] = useState(() => (inWorld(last) && last !== beeAt && flownTo !== beeAt ? last : null));
  useEffect(() => { flownTo = beeAt; }, [beeAt]);

  // bring the current bud into view
  useEffect(() => {
    if (!current || listView) return;
    document.querySelector(`[data-testid="level-${current}"]`)?.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [current, listView]);

  if (!profile) return null;
  if (!def) {
    return (
      <div className="screen" data-testid="world-map">
        <button type="button" className="btn primary big" onClick={() => store.setRoute({ name: 'adventure' })} data-testid="to-worlds">{t('advui.toWorlds')}</button>
      </div>
    );
  }
  const name = t(def.nameKey);
  const friend = friendName(t, def.id);
  const status = worldStatus(def.id, profile, ev);
  const hasSide = levels.some((l) => isSideBranch(l, profile.settings));

  const nodes: WorldPathNode[] = levels.map((l) => {
    const state = budState(l, profile, ev);
    const stars = starsOf(profile, l.id);
    const title = t(l.titleKey);
    const stateText = state === 'locked' ? t('advui.state.locked') : state === 'open' ? t('advui.state.open') : stars === 1 ? t('advui.state.done1') : t('advui.state.done', { n: stars });
    const big = isParty(l);
    return {
      id: l.id, n: l.n, title, state, stars, current: l.id === current,
      side: isSideBranch(l, profile.settings), big,
      label: t('advui.levelLabel', { n: l.n, title: big ? `${title} (${t('advui.friendHouse', { friend })})` : title, state: stateText }),
      art: big ? (
        <span className={`friend-house ${state}`}>
          <span className="fh-roof" />
          <span className="fh-wall"><FriendArt world={def} size={58} grey={state === 'locked'} /></span>
          {state !== 'locked' && <span className="fh-num">{l.n}</span>}
        </span>
      ) : undefined,
    };
  });

  const open = (id: string) => {
    const l = LEVEL_BY_ID[id];
    if (!l) return;
    if (budState(l, profile, ev) === 'locked') {
      note.show(t('advui.budClosed'));
      nudge(current);
      return;
    }
    note.hide();
    setIntroId(id);
  };

  return (
    <div className="screen world-map" data-testid="world-map" data-world={def.theme} style={worldStyle(def)}>
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'adventure' })} label={t('ui.back')} />
        <h1>{name}</h1>
        <button type="button" className="btn small secondary" onClick={() => setListView((v) => !v)} aria-pressed={listView} data-testid="list-toggle">
          {listView ? t('advui.mapView') : t('advui.listView')}
        </button>
      </header>
      <button type="button" className="btn primary flight-entry" onClick={() => store.setRoute({ name: 'flight', world: def.id })} data-testid={`flight-${def.id}`}>
        <span className="fe-title">🐝 {t('flight.title')}</span>
        <span className="fe-hint">{t('flightui.enterHint')}</span>
      </button>
      {status.knowsPath && <p className="adv-note knows">🐝 {t('advui.knowsPath')}</p>}
      {hasSide && <p className="adv-note small">{t('advui.extraNote')}</p>}

      {listView ? (
        <ol className="level-list" aria-label={t('advui.map', { name })}>
          {nodes.map((n) => (
            <li key={n.id} className={`${n.state} ${n.side ? 'side' : ''} ${n.current ? 'current' : ''}`}>
              <button type="button" className="level-row" onClick={() => open(n.id)} aria-label={n.label} aria-disabled={n.state === 'locked' || undefined} data-testid={`level-${n.id}`}>
                <span className="lr-bud" aria-hidden>{n.big ? <FriendArt world={def} size={48} grey={n.state === 'locked'} /> : <Bud state={n.state} n={n.n} />}</span>
                <span className="lr-title">{n.title}{n.side && <small className="chip ext">{t('advui.extra')}</small>}</span>
                {n.state !== 'locked' && <Blooms n={n.stars} />}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <WorldPath nodes={nodes} onOpen={open} beeAt={beeAt} beeFrom={beeFrom} hat={currentHat(profile)} label={t('advui.map', { name })} />
      )}

      {introId && LEVEL_BY_ID[introId] && (
        <LevelIntroCard level={LEVEL_BY_ID[introId]} profile={profile} onClose={() => setIntroId(null)} />
      )}
      {note.view}
    </div>
  );
}

/** The friend's line for a level (the world's first level and its party use the friend's own words). */
function introLine(t: ReturnType<typeof useT>, level: LevelDef, name: string): string {
  const friend = friendName(t, level.world);
  if (level.world !== 'bonus' && level.n === 1) return t(`adv.friend.${level.world}.intro`, { name });
  if (isParty(level)) return t('advui.line.party', { name });
  const kind = level.kind === 'mini' ? 'mini' : level.kind === 'memory' ? 'memory' : level.kind === 'bonus' ? 'bonus' : 'core';
  return t(`advui.line.${kind}`, { name, friend });
}

/** Overlay before a level: the friend's narrated line, blooms so far and a big "Let's go". */
export function LevelIntroCard({ level, profile, onClose }: { level: LevelDef; profile: Profile; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const world = WORLD_BY_ID[level.world];
  const name = displayName(profile.nickname);
  const line = introLine(t, level, name);
  const stars = starsOf(profile, level.id);
  const go = useRef<HTMLButtonElement>(null);
  useNarration(line, profile.settings.narration);
  useOverlay(onClose);
  useEffect(() => { go.current?.focus(); }, []);

  const start = () => {
    stopSpeaking();
    if (!launchLevel(level.id)) onClose();
  };
  return (
    <Layer>
    <div className="modal-backdrop adv-intro-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adv-intro" role="dialog" aria-modal="true" aria-label={t(level.titleKey)} data-world={world.theme} style={worldStyle(world)} data-testid="level-intro">
        <div className="ai-friend">
          <FriendArt world={world} size={84} />
          <p className="ai-line">{line}</p>
          <button type="button" className="icon-btn ai-hear" onClick={() => speak(line, lang)} aria-label={t('advui.hear')} data-testid="level-hear">🔊</button>
        </div>
        <h2>{t(level.titleKey)}</h2>
        <p className="ai-meta">
          {stars > 0 ? <><span>{t('advui.bloomsSoFar')}</span> <Blooms n={stars} label={t('advui.bloomsLabel', { n: stars })} /></> : <span>{t('advui.noBloomsYet')}</span>}
          <span className="ai-q">{t('advui.questions', { n: level.questions })}</span>
        </p>
        <button type="button" ref={go} className="btn primary big ai-go" onClick={start} data-testid="level-go">{t('advui.letsGo')} 🐝</button>
        <button type="button" className="btn small secondary" onClick={onClose} data-testid="level-close">{t('advui.notNow')}</button>
      </div>
    </div>
    </Layer>
  );
}

// =====================================================================================
// Level results
// =====================================================================================

export function LevelResultsScreen({ levelId, record, newNectar, prevStars }: { levelId: string; record: SessionRecord; newNectar: number; prevStars: number }) {
  const t = useT();
  const lang = useLang();
  const profile = useProfile();
  const ev = useEvidence(profile);
  const level = LEVEL_BY_ID[levelId] as LevelDef | undefined;
  const celebrated = profile?.adventure?.friendsCelebrated ?? [];
  // the friend's party plays once per world (marked when it ends or is skipped)
  const [cutscene, setCutscene] = useState(() => !!level && isParty(level) && level.world !== 'bonus' && !celebrated.includes(level.world));
  const best = profile ? starsOf(profile, levelId) : 0;
  const { petals, max } = profile ? petalsFor(profile.attempts, record.id) : { petals: 0, max: 0 };
  const runStars = max > 0 ? starsFor(petals, max) : 1;
  const newBloom = best > prevStars;
  // earned petals fill in quickly (at most ~0.85 s in all), then the blooms pop with their chimes
  const petalStep = petals > 0 ? Math.min(140, Math.round(850 / petals)) : 0;
  const bloomStartMs = petals * petalStep;
  // one composed line, read aloud once the party (if any) is over
  const resultLine = level
    ? [translate('advui.finished', lang), translate(runStars === 1 ? 'advui.bloomsSay1' : 'advui.bloomsSay', lang, { n: runStars }), newBloom ? translate('advui.newBloom', lang) : '']
      .filter(Boolean).join(' ')
    : null;
  useNarration(cutscene ? null : resultLine, !!profile?.settings.narration);
  // level complete: a bloom wipe from the blooms, one celebrate haptic, and one chime per bloom
  // as it pops (the same delays as the CSS; at once under reduced motion, where nothing animates)
  const bloomRef = useRef<HTMLElement>(null);
  const chimes = useRef({ n: runStars, startMs: bloomStartMs });
  useEffect(() => {
    void bloomWipe(bloomRef.current);
    haptic('celebrate');
    const { n, startMs } = chimes.current;
    const base = prefersReducedMotion() ? 0 : startMs + 200;
    const ids = Array.from({ length: n }, (_, i) => window.setTimeout(() => sfx.star(i), base + 250 * i));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  if (!profile || !level) {
    return (
      <div className="screen level-results" data-testid="level-results" data-level={levelId}>
        <button type="button" className="btn primary big" onClick={() => store.setRoute({ name: 'adventure' })} data-testid="to-world">{t('advui.toWorlds')}</button>
      </div>
    );
  }
  const world = WORLD_BY_ID[level.world];
  const next = nextLevelId(profile, ev, levelId);
  const learnSub = best === 1 ? levelSubskills(level, profile.settings).find((s) => !isSecure(ev[s])) : undefined;
  const petalDelay = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

  const endCutscene = () => {
    store.updateProfile((p) => markFriendCelebrated(p, level.world));
    setCutscene(false);
  };
  const goNext = () => {
    if (next && launchLevel(next)) return;
    // the daily limit may have shown the calm session end instead; otherwise open the map
    if (store.get().route.name === 'level-results') store.setRoute({ name: 'adventure-world', world: next ? LEVEL_BY_ID[next].world : level.world });
  };

  return (
    <div className="screen level-results" data-testid="level-results" data-level={levelId} data-world={world.theme} style={worldStyle(world)}>
      <header className="lr-head">
        <FriendArt world={world} size={64} />
        <div>
          <p className="small">{t(world.nameKey)}</p>
          <h1>{t(level.titleKey)}</h1>
          <p className="lr-done">{t('advui.finished')}</p>
        </div>
      </header>

      {petals > 0 && (
        <section className="petal-meter" aria-label={t('advui.petalsCount', { n: petals })} style={{ ['--step' as string]: `${petalStep}ms` } as CSSProperties}>
          <h2 className="small">{t('advui.petals')}</h2>
          {/* only the petals the child earned: no empty slots, nothing reads as missed */}
          <div className="petals" aria-hidden>
            {Array.from({ length: petals }, (_, i) => <span key={i} className="petal on" style={petalDelay(i)} />)}
          </div>
        </section>
      )}

      <section ref={bloomRef} className="bloom-pop" role="status" aria-label={t('advui.bloomsLabel', { n: runStars })} data-testid="run-blooms" data-blooms={runStars}
        style={{ ['--start-ms' as string]: `${bloomStartMs}ms` } as CSSProperties}>
        <p className="lr-bloomed">{t('advui.bloomsNow')}</p>
        <div className="big-blooms" aria-hidden>
          {Array.from({ length: runStars }, (_, i) => <span key={i} className="big-bloom on" style={petalDelay(i)}>✿</span>)}
        </div>
        {best > runStars && <p className="small">{t('advui.bestKept', { n: best })}</p>}
        {newBloom && <p className="lr-new" data-testid="new-bloom">🌼 {t('advui.newBloom')}</p>}
        <button type="button" className="icon-btn lr-hear" onClick={() => resultLine && speak(resultLine, lang)} aria-label={t('advui.hear')} data-testid="results-hear">🔊</button>
      </section>

      {newNectar > 0 && (
        <p className="lr-nectar" data-testid="level-nectar"><span className="nectar">🍯 {t('advui.nectar', { n: newNectar })}</span></p>
      )}

      {!next && <p className="adv-note">{t('advui.allDone')}</p>}

      <footer className="lr-actions">
        {next && <button type="button" className="btn primary big" onClick={goNext} data-testid="next-level">{t('advui.nextLevel')} 🐝</button>}
        <button type="button" className="btn secondary big" onClick={() => store.setRoute({ name: 'adventure-world', world: level.world })} data-testid="to-world">{t('advui.worldMap')}</button>
        {learnSub && <button type="button" className="btn secondary" onClick={() => launch('lesson', { subskill: learnSub })} data-testid="learn-with-bee">{t('advui.learnWithBee')}</button>}
      </footer>

      {cutscene && <FriendCutscene world={world} profile={profile} onDone={endCutscene} />}
    </div>
  );
}

// =====================================================================================
// Friend cutscene (3 panels from existing sprites; tap to go on, skippable, no timers)
// =====================================================================================

const PANEL_ART: Record<'thanks' | 'bloom' | 'party', string[]> = {
  thanks: ['bee'],
  bloom: ['daisy', 'tulip', 'rose', 'flower_potted', 'watering_can_flowers'],
  party: ['bunting', 'bee', 'gift'],
};

export function FriendCutscene({ world, profile, onDone }: { world: WorldDef; profile: Profile; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const name = displayName(profile.nickname);
  const friend = friendName(t, world.id);
  const [i, setI] = useState(0);
  const panels = [
    { id: 'thanks' as const, text: t(`adv.friend.${world.id}.thanks`, { name }) },
    { id: 'bloom' as const, text: t('advui.cut.bloom', { world: t(world.nameKey) }) },
    { id: 'party' as const, text: t('advui.cut.party', { friend, name }) },
  ];
  const panel = panels[i];
  const last = i === panels.length - 1;
  useNarration(panel.text, profile.settings.narration);
  useOverlay(onDone);
  // the friend's party: a fanfare in the world's key and one celebrate haptic
  useEffect(() => {
    sfx.fanfare();
    haptic('celebrate');
  }, []);

  return (
    <Layer>
    <div className="adv-cutscene" role="dialog" aria-modal="true" aria-label={t('advui.cut.title')} data-testid="cutscene" data-world={world.theme} style={worldStyle(world)}>
      <header className="topbar">
        <span />
        <h2>{t('advui.cut.title')}</h2>
        <button type="button" className="btn small secondary" onClick={onDone} data-testid="cutscene-skip">{t('advui.cut.skip')}</button>
      </header>
      <section className={`cut-panel cut-${panel.id}`} key={panel.id} aria-roledescription="slide" aria-label={t('advui.cut.panel', { n: i + 1, total: panels.length })}>
        <div className="cut-art" aria-hidden>
          {panel.id !== 'bloom' && <span className="cut-friend"><FriendArt world={world} size={110} /></span>}
          {PANEL_ART[panel.id].map((id, k) => (
            <span key={id} className="cut-sprite" style={{ ['--k' as string]: k } as CSSProperties}>
              {id === 'bee' ? <HatBee hat={currentHat(profile)} size={72} /> : <Sprite id={id} size={64} decorative />}
            </span>
          ))}
        </div>
        <p className="cut-text" aria-live="polite">{panel.text}</p>
        {last && (
          <p className="cut-together small"><strong>{t('advui.cut.grownUp')}:</strong> {t(`adv.friend.${world.id}.together`)}</p>
        )}
      </section>
      <div className="intro-dots" aria-hidden>{panels.map((p, k) => <span key={p.id} className={k === i ? 'on' : ''} />)}</div>
      <footer className="cut-controls">
        <button type="button" className="icon-btn" onClick={() => speak(panel.text, lang)} aria-label={t('advui.hear')}>🔊</button>
        <button type="button" className="btn primary big" onClick={() => (last ? onDone() : setI(i + 1))} data-testid={last ? 'cutscene-done' : 'cutscene-next'}>
          {t(last ? 'advui.cut.done' : 'advui.cut.next')}
        </button>
      </footer>
    </div>
    </Layer>
  );
}
