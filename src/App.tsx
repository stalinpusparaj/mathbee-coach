import { useEffect } from 'react';
import { store, useProfile, useStore, GATED_ROUTES } from './app/store';
import { WelcomeScreen, ProfilesScreen, ProfileNewScreen, ControlsScreen } from './screens/WelcomeScreens';
import { GardenMapScreen, CategoryScreen, ResultsScreen, RestoreScreen, ReviewDueScreen } from './screens/GardenScreens';
import { SessionScreen } from './screens/SessionScreen';
import { StickerBookScreen } from './screens/RewardScreens';
import { TestsScreen, MockScreen, MockResultsScreen, PrintScreen } from './screens/TestScreens';
import { ParentDashboard, ParentSetup, SettingsScreen } from './screens/ParentScreens';
import { useT, useLang } from './i18n/useT';
import { music } from './audio/music';
import { onSpeakingChange } from './audio/speech';
import { initShell, send } from './app/shell';
import { initBackNav } from './app/backNav';
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
    initBackNav();
    void initShell().then(() => send('ready'));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
  }, [lang]);

  // reduced motion: follow the system unless the grown-up chose otherwise
  const motion = profile?.settings.reducedMotion ?? 'system';
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const reduce = motion === 'on' || (motion === 'system' && !!mq?.matches);
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
    screen = <ParentGate onPass={() => store.setGateOpen(true)} onCancel={() => store.setRoute({ name: 'map' })} />;
  }
  return (
    <>
      {storage === 'memory' && <div className="storage-warning" role="alert">{t('ui.noStorage')}</div>}
      {screen}
    </>
  );
}
