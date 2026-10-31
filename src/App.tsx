import { useCallback, useEffect, useRef, useState } from 'react';
import { store, useProfile, useStore, GATED_ROUTES } from './app/store';
import { WelcomeScreen, ProfilesScreen, ProfileNewScreen, ControlsScreen } from './screens/WelcomeScreens';
import { GardenMapScreen, CategoryScreen, ResultsScreen, RestoreScreen, ReviewDueScreen } from './screens/GardenScreens';
import { SessionScreen } from './screens/SessionScreen';
import { StickerBookScreen } from './screens/RewardScreens';
import { TestsScreen, MockScreen, MockResultsScreen, PrintScreen } from './screens/TestScreens';
import { ParentDashboard, ParentSetup, SettingsScreen } from './screens/ParentScreens';
import { useT, useLang } from './i18n/useT';
import { music } from './audio/music';
import { onSpeakingChange, onVoicesChange, speak, stopSpeaking } from './audio/speech';
import { sfx } from './audio/sfx';
import { initShell, send, shellInfo } from './app/shell';
import { initBackNav, onRootBack, pushOverlay, exitApp } from './app/backNav';
import { Modal } from './components/ui';
import { Sprite } from './components/art';
import { ParentGate } from './components/ParentGate';
import { AdventureWorldsScreen, WorldMapScreen, LevelResultsScreen } from './screens/AdventureScreens';
import { IntroStory } from './screens/IntroStory';
import { SessionEndScreen } from './components/SessionEnd';

export function App() {
  const ready = useStore((s) => s.ready);
  const route = useStore((s) => s.route);
  const storage = useStore((s) => s.storage);
  const profile = useProfile();
  const lang = useLang();
  const t = useT();
  const gateOpen = useStore((s) => s.gateOpen);

  // Android shell + back navigation: tell the shell when the first screen is ready
  useEffect(() => {
    // hello goes first, so the shell's reply can follow before route and keep-awake reports
    const shellUp = initShell();
    const off = initBackNav();
    void shellUp.then(() => send('ready'));
    return off;
  }, []);
  // native voices arrive after the shell's first reply: re-render so narration buttons appear
  const [, bump] = useState(0);
  useEffect(() => onVoicesChange(() => bump((n) => n + 1)), []);

  // back at the root (map/welcome) in the Android app: a calm "Bye-bye" sheet, never an instant exit
  const [bye, setBye] = useState(false);
  const closeBye = useCallback(() => setBye(false), []);
  useEffect(() => onRootBack(() => setBye(true)), []);
  useEffect(() => (bye ? pushOverlay(closeBye) : undefined), [bye, closeBye]);
  // read the sheet aloud for a pre-reader (narration setting), and stop when it closes
  useEffect(() => {
    if (!bye) return;
    if (profile?.settings.narration ?? true) speak(t('shell.bye.body'), lang);
    return () => stopSpeaking();
    // speak once when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bye]);
  useEffect(() => {
    if (bye && !['map', 'welcome'].includes(route.name)) setBye(false);
  }, [bye, route.name]);

  // a very soft page-flip between child screens (none during questions, sfx follows the sound setting)
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return; }
    if (!['session', 'mock'].includes(route.name)) sfx.whoosh();
  }, [route.name]);

  useEffect(() => {
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
  }, [lang]);

  // reduced motion: follow the system unless the grown-up chose otherwise
  const motion = profile?.settings.reducedMotion ?? 'system';
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => {
      // the Android app also reports "animations off" (system animator scale 0)
      const systemReduce = !!mq?.matches || shellInfo()?.animScale === 0;
      const reduce = motion === 'on' || (motion === 'system' && systemReduce);
      document.documentElement.classList.toggle('reduce-motion', reduce);
      document.documentElement.classList.toggle('full-motion', motion === 'off');
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [motion]);

  // screens that need a profile fall back to the welcome screen
  useEffect(() => {
    if (ready && !profile && !['welcome', 'profiles', 'profile-new'].includes(route.name)) store.setRoute({ name: 'welcome' });
  }, [ready, profile, route.name]);

  // background music: starts on the first tap/key (browsers block audio before a gesture)
  const musicOn = useStore((s) => s.app.music !== false);
  useEffect(() => {
    if (!musicOn) {
      music.stop();
      return;
    }
    if (music.isPlaying) return;
    const begin = () => music.start();
    window.addEventListener('pointerdown', begin, { once: true });
    window.addEventListener('keydown', begin, { once: true });
    return () => {
      window.removeEventListener('pointerdown', begin);
      window.removeEventListener('keydown', begin);
    };
  }, [musicOn]);
  // quieter during questions, silent in mock tests, lower while narration speaks
  useEffect(() => {
    music.setScene(route.name === 'mock' ? 'silent' : route.name === 'session' ? 'play' : 'home');
  }, [route.name]);
  useEffect(() => onSpeakingChange((on) => music.duck(on)), []);
  useEffect(() => {
    const vis = () => music.setHidden(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  const openGate = useCallback(() => store.setGateOpen(true), []);
  const leaveGate = useCallback(() => store.setRoute({ name: 'map' }), []);

  if (!ready) return <div className="screen center" aria-busy="true"><p>{t('ui.loading')}</p></div>;

  let screen;
  switch (route.name) {
    case 'welcome': screen = <WelcomeScreen />; break;
    case 'profiles': screen = <ProfilesScreen />; break;
    case 'profile-new': screen = <ProfileNewScreen />; break;
    case 'controls': screen = <ControlsScreen />; break;
    case 'map': screen = <GardenMapScreen />; break;
    case 'category': screen = <CategoryScreen category={route.category} />; break;
    case 'session': screen = <SessionScreen />; break;
    case 'results': screen = <ResultsScreen record={route.record} newNectar={route.newNectar} />; break;
    case 'restore': screen = <RestoreScreen />; break;
    case 'stickers': screen = <StickerBookScreen />; break;
    case 'review-due': screen = <ReviewDueScreen />; break;
    case 'tests': screen = <TestsScreen />; break;
    case 'mock': screen = <MockScreen />; break;
    case 'mock-results': screen = <MockResultsScreen result={route.result} />; break;
    case 'print': screen = <PrintScreen categories={route.categories} count={route.count} seed={route.seed} />; break;
    case 'parent': screen = <ParentDashboard />; break;
    case 'setup': screen = <ParentSetup />; break;
    case 'settings': screen = <SettingsScreen />; break;
    case 'intro': screen = <IntroStory />; break;
    case 'adventure': screen = <AdventureWorldsScreen />; break;
    case 'adventure-world': screen = <WorldMapScreen world={route.world} />; break;
    case 'level-results': screen = <LevelResultsScreen levelId={route.levelId} record={route.record} newNectar={route.newNectar} prevStars={route.prevStars} />; break;
    case 'session-end': screen = <SessionEndScreen />; break;
  }
  // grown-up areas always go through the parent gate first
  if (GATED_ROUTES.includes(route.name) && !gateOpen) {
    screen = <ParentGate onPass={openGate} onCancel={leaveGate} />;
  }
  return (
    <>
      {storage === 'memory' && <div className="storage-warning" role="alert">{t('ui.noStorage')}</div>}
      {screen}
      {bye && (
        <Modal title={t('shell.bye.title')} onClose={closeBye}>
          <div className="bye-sheet" data-testid="bye-sheet">
            <Sprite id="bee" size={96} className="bye-bee" decorative />
            <p>{t('shell.bye.body')}</p>
            <div className="row">
              <button type="button" className="btn primary" onClick={closeBye} data-testid="bye-stay">{t('shell.bye.stay')}</button>
              <button type="button" className="btn secondary" onClick={() => { setBye(false); exitApp(); }} data-testid="bye-leave">{t('shell.bye.leave')}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
