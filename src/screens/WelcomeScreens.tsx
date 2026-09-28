import { useState } from 'react';
import { store, useProfile, useStore } from '../app/store';
import { createProfile, selectProfile, markFamiliarised } from '../app/actions';
import { useT } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { Sprite } from '../components/art';
import { BeeSays, HoldButton, BackButton } from '../components/ui';
import { Keypad } from '../components/AnswerPanel';
import { MusicToggle } from '../components/MusicToggle';
import { sfx } from '../audio/sfx';
import { spriteUrl, pickSprite } from '../assets/manifest';

export const AVATARS = ['bee', 'rabbit_helper', 'squirrel_gardener', 'penguin', 'frog', 'hedgehog', 'owl_keeper', 'beaver'];

export function WelcomeScreen() {
  const t = useT();
  const app = useStore((s) => s.app);
  const updateReady = useStore((s) => s.updateReady);
  const profile = useProfile();
  const sound = profile?.settings.sound ?? true;
  const bg = spriteUrl(pickSprite('bg_welcome', 'garden_scenery'));
  return (
    <div className="screen welcome" style={bg ? { backgroundImage: `linear-gradient(rgba(255,248,232,.55), rgba(255,248,232,.9)), url(${bg})` } : undefined}>
      <div className="welcome-card">
        <Sprite id="bee" size={120} className="bee-idle" decorative />
        <h1 className="logo">MathBee <span>Coach</span></h1>
        <p className="tagline">{t('ui.tagline')}</p>
        <div className="stack">
          {profile && (
            <button type="button" className="btn primary big" onClick={() => selectProfile(profile.id)} data-testid="continue">
              {t('ui.continueAs', { name: profile.nickname || t('ui.friend') })}
            </button>
          )}
          <button type="button" className={`btn ${profile ? 'secondary' : 'primary'} big`} onClick={() => store.setRoute(app.profiles.length ? { name: 'profiles' } : { name: 'profile-new' })} data-testid="play">
            {t('ui.play')}
          </button>
        </div>
        <div className="row spread wrap">
          <MusicToggle />
          <button type="button" className="btn small secondary" onClick={() => profile && store.updateProfile((p) => ({ ...p, settings: { ...p.settings, sound: !p.settings.sound } }))} disabled={!profile} aria-pressed={sound}>
            {sound ? '🔊' : '🔈'} {t(sound ? 'ui.soundOn' : 'ui.soundOff')}
          </button>
          {profile && <HoldButton label={t('ui.grownUps')} onDone={() => store.setRoute({ name: 'parent' })} testId="parent-hold" />}
        </div>
        {updateReady && <UpdateBanner />}
      </div>
    </div>
  );
}

export function UpdateBanner() {
  const t = useT();
  return (
    <div className="update-banner" role="status">
      <p>{t('ui.updateReady')}</p>
      <button type="button" className="btn small" onClick={() => window.dispatchEvent(new Event('mathbee:apply-update'))}>{t('ui.updateNow')}</button>
    </div>
  );
}

export function ProfilesScreen() {
  const t = useT();
  const profiles = useStore((s) => s.app.profiles);
  return (
    <div className="screen profiles">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'welcome' })} label={t('ui.back')} /><h1>{t('ui.whoIsPlaying')}</h1><span /></header>
      <div className="profile-grid">
        {profiles.map((p) => (
          <button key={p.id} type="button" className="profile-card" onClick={() => selectProfile(p.id)} data-testid={`profile-${p.id}`}>
            <Sprite id={p.avatar} size={80} decorative />
            <span>{p.nickname || t('ui.friend')}</span>
          </button>
        ))}
        <button type="button" className="profile-card add" onClick={() => store.setRoute({ name: 'profile-new' })} data-testid="new-profile">
          <span className="plus">＋</span><span>{t('ui.newPlayer')}</span>
        </button>
      </div>
    </div>
  );
}

export function ProfileNewScreen() {
  const [avatar, setAvatar] = useState('bee');
  const [nick, setNick] = useState('');
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const t = (k: string, p?: Record<string, string | number>) => translate(k, lang, p);
  return (
    <div className="screen profile-new">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'welcome' })} label={t('ui.back')} /><h1>{t('ui.makePlayer')}</h1><span /></header>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); createProfile(avatar, nick, lang); }}>
        <fieldset>
          <legend>{t('ui.pickAvatar')}</legend>
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button key={a} type="button" className={`avatar ${avatar === a ? 'on' : ''}`} onClick={() => setAvatar(a)} aria-pressed={avatar === a} aria-label={a.replace('_', ' ')} data-testid={`avatar-${a}`}>
                <Sprite id={a} size={64} decorative />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field-row">
          <span>{t('ui.nickname')} <small>({t('ui.optional')})</small></span>
          <input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 20))} maxLength={20} autoComplete="off" data-testid="nickname" />
        </label>
        <p className="small muted">{t('ui.nicknameNote')}</p>
        <fieldset>
          <legend>{t('ui.language')}</legend>
          <div className="row">
            <button type="button" className={`choice ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>English</button>
            <button type="button" className={`choice ${lang === 'ta' ? 'on' : ''}`} onClick={() => setLang('ta')} aria-pressed={lang === 'ta'} data-testid="lang-ta">தமிழ்</button>
          </div>
        </fieldset>
        <p className="small muted">{t('ui.gradeDefault')}</p>
        <button type="submit" className="btn primary big" data-testid="create-profile">{t('ui.letsGo')}</button>
      </form>
    </div>
  );
}

/** Control familiarisation: practise tapping, the keypad and Check. Nothing is scored. */
export function ControlsScreen() {
  const t = useT();
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [typed, setTyped] = useState<number | null>(null);
  const done = () => {
    markFamiliarised();
    store.setRoute({ name: 'map' });
  };
  return (
    <div className="screen controls-practice">
      <header className="topbar"><span /><h1>{t('ui.buttonsPractice')}</h1><button type="button" className="btn small secondary" onClick={done} data-testid="skip-controls">{t('ui.skip')}</button></header>
      <BeeSays><p>{t('ui.notScored')}</p></BeeSays>
      {step === 0 && (
        <section className="card">
          <h2>{t('ui.tryTapping')}</h2>
          <div className="tap-row">
            {[0, 1, 2].map((i) => (
              <button key={i} type="button" className={`obj md static ${taps.includes(i) ? 'marked' : ''}`} onClick={() => { if (profile?.settings.sound) sfx.tap(); setTaps((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i])); }} aria-pressed={taps.includes(i)} data-testid={`practice-flower-${i}`}>
                <Sprite id="daisy" size="100%" decorative />
                {taps.includes(i) && <span className="badge">✓</span>}
              </button>
            ))}
          </div>
          <p>{t('ui.tapAgainUndo')}</p>
          <button type="button" className="btn primary" onClick={() => setStep(1)} disabled={taps.length === 0} data-testid="controls-next">{t('ui.next')}</button>
        </section>
      )}
      {step === 1 && (
        <section className="card">
          <h2>{t('ui.tryKeypad')}</h2>
          <output className="answer-display">{typed ?? ' '}</output>
          <Keypad onDigit={(d) => setTyped((v) => (v === null ? d : Math.min(999, v * 10 + d)))} onBack={() => setTyped((v) => (v === null || v < 10 ? null : Math.floor(v / 10)))} onClear={() => setTyped(null)} />
          <button type="button" className="btn primary" onClick={() => setStep(2)} disabled={typed === null} data-testid="controls-next">{t('ui.next')}</button>
        </section>
      )}
      {step === 2 && (
        <section className="card">
          <h2>{t('ui.buttonsMeaning')}</h2>
          <ul className="legend">
            <li><span className="btn secondary static">💡 {t('ui.hint')}</span> {t('ui.hintMeans')}</li>
            <li><span className="btn primary static">✔ {t('ui.check')}</span> {t('ui.checkMeans')}</li>
            <li><span className="icon-btn static">🔊</span> {t('ui.hearMeans')}</li>
            <li><span className="icon-btn static">❚❚</span> {t('ui.pauseMeans')}</li>
          </ul>
          <button type="button" className="btn primary big" onClick={done} data-testid="controls-done">{t('ui.readyToPlay')}</button>
        </section>
      )}
    </div>
  );
}
