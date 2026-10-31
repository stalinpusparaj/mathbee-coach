import { useEffect, useMemo } from 'react';
import { store, useProfile } from '../app/store';
import { keepAwake } from '../app/shell';
import { useT, useLang } from '../i18n/useT';
import { t as translate } from '../i18n/i18n';
import { speak, stopSpeaking } from '../audio/speech';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { Sprite } from './art';
import { pickSprite } from '../assets/manifest';
import { todayStr } from '../learning/dates';
import { displayName } from '../learning/gamification';
import { sessionEndDue } from '../learning/fun';
import { starsOf } from '../adventure/progress';
import type { DateStr, Profile } from '../learning/types';

/** Fireflies drifting over the evening garden (decorative; static under reduced motion). */
const FIREFLIES = 9;

/**
 * After a finished (or stopped) run: should the calm session-end scene show instead of the
 * usual results? Only when the parent's daily limit is reached — and this is only ever
 * asked between runs, so a level is never cut off mid-way.
 */
export function restDueAfterSession(p: Pick<Profile, 'sessions' | 'settings'>, date: DateStr = todayStr()): boolean {
  return sessionEndDue(p, date);
}

/** Blooms (best stars) of today's last finished adventure level, or null when there is none. */
export function lastBlooms(p: Pick<Profile, 'sessions' | 'adventure'>, date: DateStr = todayStr()): number | null {
  for (let i = p.sessions.length - 1; i >= 0; i--) {
    const s = p.sessions[i];
    if (s.date !== date) break;
    if (s.mode === 'adventure' && s.completed && s.levelId) {
      const n = starsOf(p, s.levelId);
      return n > 0 ? n : null;
    }
  }
  return null;
}

/**
 * Natural session end (docs/BUILD_PLAN.md §1 and §5): the garden turns golden, the bee yawns,
 * fireflies drift, a lullaby cadence plays and the music fades out over 3 s. There is no
 * "one more" — only "Show my garden" and "Done".
 */
export function SessionEndScreen() {
  const profile = useProfile();
  const t = useT();
  const lang = useLang();
  const name = profile ? displayName(profile.nickname) : '';
  const limit = !!profile && restDueAfterSession(profile);
  const blooms = profile ? lastBlooms(profile) : null;

  useEffect(() => {
    keepAwake(false);
    music.rest(true);
    sfx.lullaby();
    // the sleepy line, and when the daily limit ended play, the line that explains why
    if (profile?.settings.narration) speak([translate('juice.end.sleepy', lang), limit ? translate('juice.end.limit', lang) : ''].filter(Boolean).join(' '), lang);
    return () => {
      stopSpeaking();
      music.rest(false);
    };
    // the scene plays once when it appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flies = useMemo(() => Array.from({ length: FIREFLIES }, (_, i) => ({
    left: 8 + ((i * 37) % 84),
    top: 18 + ((i * 53) % 52),
    delay: (i * 0.7) % 4,
    dur: 5 + (i % 4),
  })), []);

  return (
    <div className="screen session-end" data-testid="session-end">
      <div className="se-scene" role="img" aria-label={t('juice.end.label')}>
        <span className="se-sun" aria-hidden />
        <span className="se-hill far" aria-hidden />
        <span className="se-hill near" aria-hidden />
        {flies.map((f, i) => (
          <span key={i} className="se-firefly" aria-hidden
            style={{ left: `${f.left}%`, top: `${f.top}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }} />
        ))}
        <span className="se-bee" aria-hidden>
          <Sprite id={pickSprite('bee_sleep', 'bee')} size={120} decorative />
          <span className="se-yawn">💤</span>
        </span>
      </div>
      <h1 className="se-title">{name ? t('juice.end.title', { name }) : t('juice.end.titlePlain')}</h1>
      <p className="se-text">{t('juice.end.sleepy')}</p>
      {blooms !== null && <p className="se-blooms" data-testid="session-end-blooms"><span aria-hidden>{'🌸'.repeat(blooms)}</span> {t('juice.end.blooms', { n: blooms })}</p>}
      {limit && <p className="se-text" data-testid="session-end-limit">{t('juice.end.limit')}</p>}
      <div className="se-actions">
        <button type="button" className="btn primary big" onClick={() => store.setRoute({ name: 'map' })} data-testid="session-end-garden">🌻 {t('juice.end.garden')}</button>
        <button type="button" className="btn secondary big" onClick={() => store.setRoute({ name: 'welcome' })} data-testid="session-end-done">{t('juice.end.done')}</button>
      </div>
    </div>
  );
}
