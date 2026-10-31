import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { store, useProfile, type Route } from '../app/store';
import { pushOverlay } from '../app/backNav';
import { keepAwake } from '../app/shell';
import { E2E_HOOKS } from '../app/platform';
import { useLang, useT } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { speak, stopSpeaking, narrationAvailable } from '../audio/speech';
import { sfx, setSfxWorld } from '../audio/sfx';
import { music } from '../audio/music';
import { celebrateCorrect, haptic, installTapJuice, prefersReduced } from '../fx/juice';
import { Modal } from '../components/ui';
import { Sprite } from '../components/art';
import { ComboChip, FriendFace, HatBee } from '../components/Fun';
import { pickSprite, spriteUrl } from '../assets/manifest';
import { worldVars } from '../activities/journey';
import { WORLD_BY_ID, type WorldDef } from '../adventure/levels';
import { COMBO_MILESTONES, currentHat } from '../learning/fun';
import { displayName } from '../learning/gamification';
import { todayStr } from '../learning/dates';
import type { WorldId } from '../learning/types';
import { GATES_PER_RUN, type FlightQuestion, type FlightSkill, type FlightWorld, type GateVisual } from '../flight/types';
import { correctLane, flightQuestion, gateAria, pictureAria, visualKey, visualLabel } from '../flight/questions';
import { awardGate, canEarnFlightNectar, recordRun } from '../flight/rewards';
import { drawGateVisual, visualAspect } from '../three/gateArt';
import { Flight3D, With3D } from '../three/Lazy3D';
import { use3D } from '../three/support';

/**
 * Bee Flight: a short, calm lane-runner (docs/FLIGHT_PLAN.md). Buzzy flies down a world path
 * and steers through one of three answer gates; 8 gates, then the world's friend waits at the
 * finish. A different gate is never "wrong": Buzzy lands softly and "Let's look with Buzzy"
 * shows the picture and help with the three choices as big buttons, until the right one is
 * picked. No timers, no lives, no speed-up — and sound, juice and haptics on correct only.
 *
 * The game state lives here; the 3D view (or the flat 2D one: no WebGL, weak device, reduced
 * motion) only draws it and reports when the bee reaches a row.
 */

// =====================================================================================
// Pure helpers (unit tested)
// =====================================================================================

export const LANES = 3;
/** A horizontal swipe of at least this many px steers one lane. */
export const SWIPE_PX = 40;

const clampLane = (l: number) => Math.max(0, Math.min(LANES - 1, Math.round(l)));

/** One lane left (-1) or right (+1), staying on the path. */
export function steer(lane: number, dir: -1 | 1): number {
  return clampLane(lane + dir);
}

/** The lane under a tap at x within a stage `width` px wide. */
export function laneFromPoint(x: number, width: number): number {
  if (!(width > 0)) return 1;
  return clampLane(Math.floor((Math.max(0, Math.min(width - 0.001, x)) / width) * LANES));
}

/** Swipe direction from a pointer's travel: -1 left, +1 right, 0 = not a swipe (a tap or a scroll). */
export function swipeDir(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? -1 : 1;
}

const FLIGHT_THEMES: FlightWorld[] = ['meadow', 'river', 'orchard', 'ice', 'trail', 'town', 'garden'];

/** The flight world for a route's world: an adventure world id (w1…w7, bonus) or a theme name. */
export function flightTheme(world: string): FlightWorld {
  const def = (WORLD_BY_ID as Record<string, WorldDef | undefined>)[world];
  if (def) return def.theme;
  return (FLIGHT_THEMES as string[]).includes(world) ? (world as FlightWorld) : 'garden';
}

/** Where "Back to the world" (and Stop) leads: that world's map, or the garden map. */
export function backRouteFor(world: string): Route {
  return world in WORLD_BY_ID ? { name: 'adventure-world', world: world as WorldId } : { name: 'map' };
}

export type FlightPhase = 'intro' | 'fly' | 'look' | 'finish' | 'results';

export interface RunState {
  phase: FlightPhase;
  seed: number;
  /** gate being flown to (0 … GATES_PER_RUN - 1) */
  index: number;
  lane: number;
  firstTry: number;
  helped: number;
  /** first-try streak (sparkle trail + combo chip only; never changes the pace) */
  combo: number;
  /** choice ids already looked at in the "Let's look" sheet */
  tried: string[];
}

export function runStart(seed: number, phase: FlightPhase = 'intro'): RunState {
  return { phase, seed, index: 0, lane: 1, firstTry: 0, helped: 0, combo: 0, tried: [] };
}

const advance = (s: RunState): RunState => (s.index + 1 >= GATES_PER_RUN
  ? { ...s, phase: 'finish', tried: [] }
  : { ...s, phase: 'fly', index: s.index + 1, tried: [] });

/**
 * The bee flew through gate `lane`. The right gate pays 'first' and moves on (or to the
 * finish); a different gate opens the "Let's look" sheet. Ignored unless flying.
 */
export function flyThrough(s: RunState, q: FlightQuestion, lane: number): { state: RunState; paid: 'first' | null } {
  if (s.phase !== 'fly') return { state: s, paid: null };
  const l = clampLane(lane);
  const choice = q.choices[l];
  if (choice.correct) return { state: advance({ ...s, lane: l, firstTry: s.firstTry + 1, combo: s.combo + 1 }), paid: 'first' };
  return { state: { ...s, lane: l, phase: 'look', combo: 0, tried: [choice.id] }, paid: null };
}

/** A pick in the "Let's look" sheet: the right one pays 'helped' and flies on; others are simply set aside. */
export function lookPick(s: RunState, q: FlightQuestion, i: number): { state: RunState; paid: 'helped' | null } {
  if (s.phase !== 'look') return { state: s, paid: null };
  const choice = q.choices[clampLane(i)];
  if (choice.correct) return { state: advance({ ...s, lane: clampLane(i), helped: s.helped + 1 }), paid: 'helped' };
  return { state: s.tried.includes(choice.id) ? s : { ...s, tried: [...s.tried, choice.id] }, paid: null };
}

const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

/** Skills whose gates are read by looking (clocks, groups, shapes): their names in words would give the answer away. */
const LOOK_SKILLS: readonly FlightSkill[] = ['compare', 'clock', 'shape2d', 'shape3d'];

/**
 * Whether Buzzy's lane may be said in words (the chip under the steering row, and spoken while
 * steering): only for gates that already show words or numerals (numbers, day cards, pattern
 * emoji), never for clocks, groups or shapes, where the words would do the looking for the child.
 */
export function laneWordsOk(skill: FlightSkill, v: GateVisual): boolean {
  if (LOOK_SKILLS.includes(skill)) return false;
  return v.kind === 'number' || v.kind === 'day' || v.kind === 'emoji';
}

// =====================================================================================
// Pieces
// =====================================================================================

/** A gate visual drawn from data on a canvas (crisp on any screen). */
export function GateArt({ visual, badge = false, accent, className = '' }: { visual: GateVisual; badge?: boolean; accent?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lang = useLang();
  const key = visualKey(visual);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let alive = true;
    const draw = () => {
      const ctx = alive ? c.getContext('2d') : null;
      // size is the canvas height: day signs are twice as wide as they are tall
      if (ctx) drawGateVisual(ctx, visual, c.height, { lang, badge, accent });
    };
    draw();
    // Baloo / Nunito may still be loading: draw again once they are in
    document.fonts?.ready?.then(draw).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang, badge, accent]);
  return <canvas ref={ref} width={192 * visualAspect(visual)} height={192} className={`gate-art kind-${visual.kind} ${className}`} aria-hidden />;
}

function Layer({ children, className, label, testId, world }: { children: ReactNode; className: string; label: string; testId: string; world: FlightWorld }) {
  const ref = useRef<HTMLDivElement>(null);
  // focus the main button for keyboards, without scrolling the card away from its title
  useEffect(() => {
    const el = ref.current;
    (el?.querySelector<HTMLElement>('.btn.primary') ?? el?.querySelector<HTMLElement>('button:not([disabled])'))?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="modal-backdrop flight-layer" role="presentation">
      <div ref={ref} className={`flight-card ${className}`} role="dialog" aria-modal="true" aria-label={label} data-testid={testId} data-world={world}>
        {children}
      </div>
    </div>
  );
}

// =====================================================================================
// Screen
// =====================================================================================

export function FlightScreen({ world }: { world: string }) {
  const profile = useProfile();
  const t = useT();
  const lang = useLang();
  const theme = flightTheme(world);
  const show3d = use3D();
  const [run, setRun] = useState<RunState>(() => runStart(newSeed()));
  const runRef = useRef(run);
  runRef.current = run;
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(0);
  const [nectar, setNectar] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // the 3D scene is actually up (not the Suspense / lost-context flat fallback): 3D-only controls show only then
  const [live3d, setLive3d] = useState(false);
  // Buzzy hovers at a row until the child steers or taps a lane (no hidden timer)
  const [held, setHeld] = useState(false);
  const [nudge, setNudge] = useState(0);
  const promptRef = useRef<HTMLElement>(null);
  const nectarRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | null>(null);

  const today = todayStr();
  const name = profile ? displayName(profile.nickname) : '';
  const hat = profile ? currentHat(profile) : null;
  const sound = profile?.settings.sound !== false;
  const narrationOn = !!profile?.settings.narration;
  const canNarrate = narrationOn && narrationAvailable(lang);
  const full = profile ? !canEarnFlightNectar(profile, today) : false;
  const accent = worldVars(theme)['--world-accent'];

  const { phase } = run;
  const active = phase === 'fly' || phase === 'look' || phase === 'finish';
  const q = useMemo(
    () => (phase === 'intro' || phase === 'fly' || phase === 'look' ? flightQuestion(theme, run.seed, run.index) : null),
    [theme, run.seed, run.index, phase],
  );
  const running = !paused && (phase === 'fly' || phase === 'finish');
  const three = show3d && live3d;

  // ---- world music and sounds; screen stays awake during a run ----
  useEffect(() => {
    music.setWorld(theme);
    setSfxWorld(theme);
    return () => {
      music.setWorld(null);
      setSfxWorld(null);
      stopSpeaking();
    };
  }, [theme]);
  useEffect(() => {
    if (!active) return;
    keepAwake(true);
    music.setScene('play');
    return () => keepAwake(false);
  }, [active]);
  useEffect(() => installTapJuice(root), [root]);
  // back (gesture, Escape) opens the pause sheet during a run, and closes it again
  useEffect(() => (active ? pushOverlay(() => setPaused((p) => !p)) : undefined), [active]);
  useEffect(() => {
    if (!cheer) return;
    const id = window.setTimeout(() => setCheer(null), 1500);
    return () => window.clearTimeout(id);
  }, [cheer]);

  // ---- narration ----
  const say = useCallback((text: string) => { if (narrationOn) speak(text, lang); }, [narrationOn, lang]);
  const introLine = t(`flight.intro.${theme}`, { name: name || t('ui.friend') });
  useEffect(() => {
    if (phase === 'intro') say(introLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'intro']);
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'fly' && q && spoken.current !== q.id) {
      spoken.current = q.id;
      say(translate(q.prompt, lang));
    }
    if (phase === 'look' && q) say(translate(q.help, lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q?.id]);
  const hear = () => {
    if (!q) return;
    speak(translate(phase === 'look' ? q.help : q.prompt, lang), lang);
  };

  // ---- rewards ----
  /** Pay one gate (idempotent per question id, capped per day). Returns the nectar paid. */
  const pay = (how: 'first' | 'helped', gateId: string): number => {
    let got = 0;
    store.updateProfile((p) => {
      const next = awardGate(p, today, how, gateId);
      got = next.nectar - p.nectar;
      return next;
    });
    if (got > 0) setNectar((n) => n + got);
    return got;
  };
  /** Correct gate: chime, sparkle burst, nectar arc and a success haptic (milestones celebrate). */
  const rejoice = (from: Element | null, combo: number, helped: boolean) => {
    const milestone = !helped && COMBO_MILESTONES.includes(combo);
    if (sound) (milestone ? sfx.sparkle : sfx.good)();
    if (milestone) music.combo(combo);
    setBurst((b) => b + 1);
    setCheer(t(helped ? 'flight.cheer.helped' : `flight.cheer.${(runRef.current.index % 4) + 1}`));
    void celebrateCorrect({ card: promptRef.current, from: from ?? stageRef.current, counter: nectarRef.current, haptic: milestone ? 'celebrate' : 'success' });
  };

  // ---- flying through a gate ----
  const pass = (lane: number, from: Element | null = null) => {
    const s = runRef.current;
    if (s.phase !== 'fly' || paused || !q) return;
    const out = flyThrough(s, q, lane);
    runRef.current = out.state;
    setRun(out.state);
    if (out.paid) {
      pay(out.paid, q.id);
      rejoice(from, out.state.combo, false);
    }
    // a different gate: Buzzy simply lands and the sheet opens — no sound, no wobble, no haptic
  };
  const passRef = useRef(pass);
  passRef.current = pass;
  const onGate = useCallback((lane: number) => passRef.current(lane), []);
  const onArrive = useCallback(() => {
    if (runRef.current.phase === 'finish') setRun((s) => (s.phase === 'finish' ? { ...s, phase: 'results' } : s));
  }, []);

  const pick = (i: number, el: HTMLElement) => {
    const s = runRef.current;
    if (!q || s.phase !== 'look' || s.tried.includes(q.choices[i]?.id)) return;
    const out = lookPick(s, q, i);
    if (out.paid) {
      runRef.current = out.state;
      setRun(out.state);
      pay(out.paid, q.id);
      rejoice(el, 0, true);
    } else {
      // no wobble, no sound, no haptic: the faded choice says it was looked at; Buzzy says the tip again
      setRun(out.state);
      say(`${t('flightui.look.again')} ${translate(q.help, lang)}`);
    }
  };

  const setLane = (l: number) => {
    if (runRef.current.phase !== 'fly' || paused) return;
    const lane = clampLane(l);
    // any steering (even onto the lane Buzzy is in) means the child has chosen: fly on through
    setNudge((n) => n + 1);
    if (lane === runRef.current.lane) return;
    if (sound) sfx.tick();
    runRef.current = { ...runRef.current, lane };
    setRun((s) => ({ ...s, lane }));
    // a pre-reader can hear what the gate says (numbers and day names only — see laneWordsOk)
    if (q && laneWordsOk(q.skill, q.choices[lane].visual)) say(translate(visualLabel(q.choices[lane].visual), lang));
  };

  // ---- finish: the flat view (and a 3D view that cannot finish, e.g. hidden) moves on by itself ----
  useEffect(() => {
    if (phase !== 'finish' || paused) return;
    const ms = three ? 15_000 : prefersReduced() ? 300 : 1200;
    const id = window.setTimeout(onArrive, ms);
    return () => window.clearTimeout(id);
  }, [phase, paused, three, onArrive]);
  const recorded = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'results' || recorded.current === run.seed) return;
    recorded.current = run.seed;
    const s = runRef.current;
    store.updateProfile((p) => recordRun(p, { world: theme, date: today, gates: GATES_PER_RUN, firstTry: s.firstTry, helped: s.helped }, `${theme}:${s.seed}`));
    if (sound) sfx.fanfare();
    haptic('celebrate');
    say(t(`flight.finish.${theme}`, { name: name || t('ui.friend') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, run.seed]);

  // ---- keyboard: ← → steer, Enter flies through now ----
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (paused || runRef.current.phase !== 'fly' || e.defaultPrevented) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); setLane(steer(runRef.current.lane, -1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setLane(steer(runRef.current.lane, 1)); }
      else if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT') return;
        e.preventDefault();
        passRef.current(runRef.current.lane);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ---- swipe on the stage ----
  const onPointerDown = (e: ReactPointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY, swiped: false }; };
  const onPointerUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const dir = swipeDir(e.clientX - s.x, e.clientY - s.y);
    if (dir) {
      s.swiped = true;
      setLane(steer(runRef.current.lane, dir));
    }
  };
  const tapLane = (i: number) => {
    if (swipe.current?.swiped) { swipe.current = null; return; }
    setLane(i);
  };

  // ---- automated browser tests (only with ?e2e) can read the right lane and fly through ----
  useEffect(() => {
    if (!E2E_HOOKS || typeof location === 'undefined' || !new URLSearchParams(location.search).has('e2e')) return;
    (window as unknown as { __mathbeeFlight?: unknown }).__mathbeeFlight = {
      correctLane: q ? correctLane(q) : -1,
      question: q,
      phase,
      gate: run.index,
      lane: run.lane,
      pass: (l: number) => passRef.current(l),
    };
  }, [q, phase, run.index, run.lane]);
  useEffect(() => () => { delete (window as unknown as { __mathbeeFlight?: unknown }).__mathbeeFlight; }, []);

  const start = () => {
    stopSpeaking();
    spoken.current = null;
    setRun((s) => ({ ...s, phase: 'fly' }));
  };
  const again = () => {
    stopSpeaking();
    spoken.current = null;
    setNectar(0);
    setHeld(false);
    setRun(runStart(newSeed(), 'fly'));
  };
  const leave = () => {
    stopSpeaking();
    setPaused(false);
    store.setRoute(backRouteFor(world));
  };

  if (!profile) return <div className="screen center"><p>{t('ui.loading')}</p></div>;

  const art = spriteUrl(`world_${theme}`);
  const style = { ...worldVars(theme), ...(art ? { '--world-art': `url(${art})` } : {}) } as CSSProperties;
  const gateNo = Math.min(run.index + 1, GATES_PER_RUN);
  const choiceText = (v: GateVisual) => t(visualLabel(v));
  const flat = (
    <Flight2D
      q={phase === 'intro' || phase === 'finish' || phase === 'results' ? null : q}
      lane={run.lane}
      theme={theme}
      hat={hat}
      accent={accent}
      enabled={phase === 'fly' && !paused}
      onPick={(i, el) => pass(i, el)}
      onFocusLane={setLane}
    />
  );

  return (
    <div ref={setRoot} className={`screen flight phase-${phase}`} data-testid="flight" data-world={theme} data-phase={phase} style={style}>
      <header className="topbar flight-top">
        <button type="button" className="icon-btn" onClick={() => setPaused(true)} disabled={!active} aria-label={t('flight.pause')} data-testid="pause">❚❚</button>
        <span className="progress-group">
          <span className="f-gates" aria-label={t('flight.hud.gate', { n: gateNo, total: GATES_PER_RUN })} data-testid="flight-gate-count">🌼 {gateNo}/{GATES_PER_RUN}</span>
          <ComboChip n={run.combo} />
        </span>
        <span ref={nectarRef} className="nectar f-nectar" aria-label={full && nectar === 0 ? t('flight.hud.full') : t('flight.hud.nectar', { n: nectar })} data-testid="flight-nectar">🍯 {nectar}</span>
        <button type="button" className="icon-btn hear-big" onClick={hear} disabled={!canNarrate || !q} aria-label={t('flight.hear')} title={canNarrate ? t('flight.hear') : t('ui.noVoice')} data-testid="flight-hear">🔊</button>
      </header>

      <section ref={promptRef} className="f-prompt" aria-live="polite">
        {q && phase !== 'intro' ? (
          <>
            {q.picture && q.picture.length > 0 && (
              <div className={`f-picture n${Math.min(q.picture.length, 6)}`} role="img" aria-label={t(pictureAria(q.picture))} data-testid="flight-picture">
                {q.picture.map((v, i) => <GateArt key={`${i}-${visualKey(v)}`} visual={v} className={`kind-${v.kind}`} />)}
              </div>
            )}
            <h1 className="prompt" data-testid="flight-prompt">{t(q.prompt)}</h1>
          </>
        ) : (
          <h1 className="prompt">{t('flight.title')}</h1>
        )}
        {cheer && <p className="f-cheer" role="status">{cheer}</p>}
      </section>

      <div ref={stageRef} className="f-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = null; }}>
        {show3d ? (
          <>
            <With3D flat={flat} onFail={() => setLive3d(false)}>
              <Flight3D
                theme={theme}
                hat={hat}
                lane={run.lane}
                question={phase === 'finish' || phase === 'results' ? null : q}
                running={running}
                finished={phase === 'finish' || phase === 'results'}
                combo={run.combo}
                burst={burst}
                nudge={nudge}
                lang={lang}
                label={t('flight.aria.scene')}
                onGate={onGate}
                onArrive={onArrive}
                onLive={setLive3d}
                onHold={setHeld}
              />
            </With3D>
            {three && q && phase === 'fly' && (
              <div className="f-lanes" aria-label={t('flightui.steerHelp')} role="group">
                {q.choices.map((c, i) => (
                  <button key={c.id} type="button" className={`f-lane ${run.lane === i ? 'on' : ''}`} onClick={() => tapLane(i)} disabled={paused}
                    aria-label={t('flight.aria.lane', { i: i + 1, what: visualLabel(c.visual) })} aria-pressed={run.lane === i} data-juice="quiet" data-testid={`lane-${i}`} />
                ))}
              </div>
            )}
          </>
        ) : flat}
      </div>

      {three && (
        <footer className="f-controls">
          <button type="button" className="icon-btn f-steer" onClick={() => setLane(steer(run.lane, -1))} disabled={phase !== 'fly' || paused || run.lane === 0} aria-label={t('flight.left')} data-testid="lane-left">◀</button>
          <p className="f-help small" aria-live="polite">{q && phase === 'fly' && (
            <>
              <span>{t('flight.aria.buzzyLane', { i: run.lane + 1 })}</span>
              {held && !paused ? (
                <span className="f-wait" data-testid="flight-wait">{t('flightui.pickGate')}</span>
              ) : laneWordsOk(q.skill, q.choices[run.lane].visual) && (
                <span className="f-here" data-testid="flight-here">{choiceText(q.choices[run.lane].visual)}</span>
              )}
            </>
          )}</p>
          <button type="button" className="icon-btn f-steer" onClick={() => setLane(steer(run.lane, 1))} disabled={phase !== 'fly' || paused || run.lane === LANES - 1} aria-label={t('flight.right')} data-testid="lane-right">▶</button>
        </footer>
      )}

      {phase === 'intro' && (
        <Layer className="f-intro" label={t('flight.title')} testId="flight-intro" world={theme}>
          <div className="fi-friend">
            <FriendFace theme={theme} size={88} />
            <p className="fi-line">{introLine}</p>
            <button type="button" className="icon-btn" onClick={() => speak(introLine, lang)} disabled={!canNarrate} aria-label={t('flight.hear')} data-testid="flight-intro-hear">🔊</button>
          </div>
          <div className="fi-bee" aria-hidden><HatBee hat={hat} size={72} /></div>
          <p className="small">{t(show3d ? 'flightui.steerHelp' : 'flightui.tapGate')}</p>
          <button type="button" className="btn primary big" onClick={start} data-testid="flight-go">{t('flight.fly')} 🐝</button>
          <button type="button" className="btn small secondary" onClick={leave} data-testid="flight-not-now">{t('flightui.notNow')}</button>
        </Layer>
      )}

      {phase === 'look' && q && (
        <Layer className="f-look" label={t('flight.look.title')} testId="flight-look" world={theme}>
          <div className="fc-col">
          <h2>{t('flight.look.title')}</h2>
          <div className="fl-buzzy">
            <Sprite id={pickSprite('bee_think', 'bee')} size={56} decorative />
            <p>{t(q.help)}</p>
            <button type="button" className="icon-btn" onClick={hear} disabled={!canNarrate} aria-label={t('flight.hear')} data-testid="look-hear">🔊</button>
          </div>
          {q.picture && q.picture.length > 0 && (
            <div className={`f-picture n${Math.min(q.picture.length, 6)}`} role="img" aria-label={t(pictureAria(q.picture))}>
              {q.picture.map((v, i) => <GateArt key={`${i}-${visualKey(v)}`} visual={v} className={`kind-${v.kind}`} />)}
            </div>
          )}
          </div>
          <div className="fc-col">
          <p className="fl-prompt">{t(q.prompt)}</p>
          <div className="fl-choices">
            {q.choices.map((c, i) => {
              const tried = run.tried.includes(c.id);
              return (
                <button key={c.id} type="button" className={`fl-choice ${tried ? 'tried' : ''}`} onClick={(e) => pick(i, e.currentTarget)}
                  aria-label={t(gateAria(i, c.visual))} aria-disabled={tried || undefined} data-juice="quiet" data-testid={`look-choice-${i}`}>
                  <GateArt visual={c.visual} badge accent={accent} />
                </button>
              );
            })}
          </div>
          <p className="small fl-note" role="status">{run.tried.length > 1 ? t('flightui.look.again') : t('flight.look.lead')}</p>
          </div>
        </Layer>
      )}

      {phase === 'results' && (
        <Layer className="f-results" label={t('flight.results.titlePlain')} testId="flight-results" world={theme}>
          <div className="fc-col">
          <div className="fr-friend"><FriendFace theme={theme} size={84} /><HatBee hat={hat} size={60} /></div>
          <h2>{name ? t('flight.results.title', { name }) : t('flight.results.titlePlain')}</h2>
          <p>{t(`flight.finish.${theme}`, { name: name || t('ui.friend') })}</p>
          <p className="fr-line">{t('flight.results.gates', { n: GATES_PER_RUN })}</p>
          </div>
          <div className="fc-col">
          {run.firstTry > 0 ? (
            <p className="fr-blooms" role="img" aria-label={t('flight.results.firstTry', { n: run.firstTry })} data-testid="flight-blooms" data-n={run.firstTry}>
              {Array.from({ length: run.firstTry }, (_, i) => <span key={i} className="fr-bloom" style={{ ['--i' as string]: i } as CSSProperties}>🌼</span>)}
            </p>
          ) : (
            <p className="fr-line">{t('flightui.res.noBlooms')}</p>
          )}
          {run.firstTry > 0 && <p className="small">{t('flight.results.firstTry', { n: run.firstTry })}</p>}
          {run.helped > 0 && <p className="small">{t('flight.results.helped', { n: run.helped })}</p>}
          {nectar > 0 && <p className="nectar fr-nectar" data-testid="flight-earned">🍯 {t('flight.results.nectar', { n: nectar })}</p>}
          {full && <p className="small">{t('flight.results.full')}</p>}
          <div className="stack">
            <button type="button" className="btn primary big" onClick={again} data-testid="flight-again">{t('flight.flyAgain')} 🐝</button>
            <button type="button" className="btn secondary" onClick={leave} data-testid="flight-back">{t('flight.backWorld')}</button>
          </div>
          </div>
        </Layer>
      )}

      {paused && (
        <Modal title={t('flight.pause.title')} onClose={() => setPaused(false)}>
          <p>{t('flight.pause.lead')}</p>
          <div className="stack">
            <button type="button" className="btn primary big" onClick={() => setPaused(false)} data-testid="resume">{t('flight.keepFlying')}</button>
            <button type="button" className="btn secondary" onClick={leave} data-testid="stop">{t('flight.stop')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * The calm 2D flight (no WebGL, weak device, reduced motion): the same question and three
 * big gate buttons on the world's painting; Buzzy hops between them (still under reduced motion).
 */
export function Flight2D({ q, lane, theme, hat, accent, enabled, onPick, onFocusLane }: {
  q: FlightQuestion | null; lane: number; theme: FlightWorld; hat: string | null; accent: string; enabled: boolean;
  onPick: (i: number, el: HTMLElement) => void; onFocusLane: (i: number) => void;
}) {
  const t = useT();
  return (
    <div className="flight2d" data-testid="flight-stage" data-3d="0" style={{ ['--lane' as string]: lane } as CSSProperties}>
      {q ? (
        <>
          <div className="f2-bee" aria-hidden><div className="f2-bob"><HatBee hat={hat} size={60} /></div></div>
          <div className="f2-gates" role="group" aria-label={t('flightui.tapGate')}>
            {q.choices.map((c, i) => (
              <button key={c.id} type="button" className={`f2-gate ${lane === i ? 'on' : ''}`} disabled={!enabled}
                onClick={(e) => onPick(i, e.currentTarget)} onFocus={() => onFocusLane(i)}
                aria-label={t('flight.aria.lane', { i: i + 1, what: visualLabel(c.visual) })} data-pitch={i + 2} data-testid={`gate-${i}`}>
                <span className="f2-arch" aria-hidden />
                <GateArt visual={c.visual} badge accent={accent} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="f2-finish" aria-hidden>
          <FriendFace theme={theme} size={110} />
          <HatBee hat={hat} size={64} className="f2-arrive" />
        </div>
      )}
    </div>
  );
}
