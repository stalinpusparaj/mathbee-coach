import { useEffect, useState } from 'react';
import { store, useProfile } from '../app/store';
import { useLang, useT } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { Sprite } from '../components/art';
import { speak, stopSpeaking } from '../audio/speech';
import { spriteUrl, pickSprite } from '../assets/manifest';

/** Shown once after a new player is made: why the garden needs help. About 25 seconds read aloud. */
interface Panel { key: string; scene: 'garden' | 'storm' | 'friends' | 'puzzle' | 'bloom'; sprites: string[] }

export const INTRO_PANELS: Panel[] = [
  { key: 'intro.p1', scene: 'garden', sprites: ['bee', 'daisy', 'tulip', 'rose'] },
  { key: 'intro.p2', scene: 'storm', sprites: ['moon', 'apple_red', 'tulip', 'pear'] },
  { key: 'intro.p3', scene: 'friends', sprites: ['bunny_florist', 'frog', 'squirrel_gardener', 'penguin_wave', 'hedgehog', 'owl_keeper'] },
  { key: 'intro.p4', scene: 'puzzle', sprites: ['bee', 'basket', 'apple_red', 'daisy'] },
  { key: 'intro.p5', scene: 'bloom', sprites: ['bee', 'sun', 'flower_potted', 'watering_can_flowers'] },
];
/** The skip button appears after this delay, so a stray first tap does not skip the story. */
export const INTRO_SKIP_AFTER_MS = 2000;

export function IntroStory() {
  const t = useT();
  const lang = useLang();
  const profile = useProfile();
  const narrate = profile?.settings.narration ?? true;
  const [i, setI] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const panel = INTRO_PANELS[i];
  const last = i === INTRO_PANELS.length - 1;
  const bg = spriteUrl(pickSprite('bg_welcome', 'garden_scenery'));

  useEffect(() => {
    const id = window.setTimeout(() => setCanSkip(true), INTRO_SKIP_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);
  // read each page aloud once when it appears (the text stays visible if no voice exists)
  useEffect(() => {
    if (narrate) speak(translate(panel.key, lang), lang);
  }, [panel.key, lang, narrate]);
  useEffect(() => () => stopSpeaking(), []);

  const finish = () => {
    stopSpeaking();
    store.setRoute({ name: 'controls' });
  };
  const next = () => (last ? finish() : setI(i + 1));

  return (
    <div className="screen intro-story" data-testid="intro" data-scene={panel.scene} style={bg ? { ['--intro-bg' as string]: `url(${bg})` } : undefined}>
      <header className="topbar">
        <span />
        <h1>{t('intro.title')}</h1>
        {canSkip ? (
          <button type="button" className="btn small secondary intro-skip" onClick={finish} data-testid="intro-skip">{t('intro.skip')}</button>
        ) : <span className="intro-skip-space" aria-hidden />}
      </header>
      <section className="intro-panel" key={panel.key} aria-roledescription="slide" aria-label={t('intro.panel', { n: i + 1, total: INTRO_PANELS.length })}>
        <div className={`intro-art scene-${panel.scene}`} aria-hidden>
          {panel.scene === 'storm' && <span className="intro-wind" />}
          {panel.sprites.map((id, k) => (
            <span key={id} className="intro-sprite" style={{ ['--k' as string]: k }}>
              <Sprite id={id} size={panel.sprites.length > 4 ? 64 : 84} decorative />
            </span>
          ))}
        </div>
        <p className="intro-text" aria-live="polite">{t(panel.key)}</p>
      </section>
      <div className="intro-dots" aria-hidden>
        {INTRO_PANELS.map((p, k) => <span key={p.key} className={k === i ? 'on' : ''} />)}
      </div>
      <footer className="intro-controls">
        <button type="button" className="icon-btn intro-hear" onClick={() => speak(t(panel.key), lang)} aria-label={t('intro.hear')} data-testid="intro-hear">🔊</button>
        <button type="button" className="btn primary big" onClick={next} data-testid={last ? 'intro-done' : 'intro-next'}>{t(last ? 'intro.go' : 'intro.next')}</button>
      </footer>
    </div>
  );
}
