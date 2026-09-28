import { useEffect, useState } from 'react';
import { store, useProfile } from '../app/store';
import { useT } from '../i18n/useT';
import { BackButton } from '../components/ui';
import { STICKERS, LEVELS, earnedStickers, levelFor, lifetimeNectar, gardenVisits } from '../learning/gamification';
import type { Profile } from '../learning/types';
import { Collections } from '../components/Fun';
import { HATS } from '../learning/fun';

/** Level badge with a progress bar toward the next level (levels only ever go up). */
export function LevelBadge({ profile, compact }: { profile: Profile; compact?: boolean }) {
  const t = useT();
  const nectar = lifetimeNectar(profile);
  const lv = levelFor(nectar);
  const next = LEVELS[lv.index + 1];
  return (
    <div className={`level-badge ${compact ? 'compact' : ''}`} data-testid="level-badge">
      <span className="level-icon" aria-hidden>{lv.icon}</span>
      <div className="level-text">
        <strong>{t('ui.levelLabel', { n: lv.index + 1, level: t(`level.${lv.key}`) })}</strong>
        <span className="level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.progress * 100)}>
          <span style={{ width: `${Math.round(lv.progress * 100)}%` }} />
        </span>
        {!compact && <small>{next ? t('ui.nextLevel', { n: next.at - nectar, level: t(`level.${next.key}`) }) : t('ui.maxLevel')}</small>}
      </div>
    </div>
  );
}

export function StickerBookScreen() {
  const t = useT();
  const profile = useProfile();
  if (!profile) return null;
  const earned = new Set(earnedStickers(profile));
  return (
    <div className="screen stickers" data-testid="sticker-book">
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} />
        <h1>{t('ui.stickers')}</h1>
        <span />
      </header>
      <LevelBadge profile={profile} />
      <p className="lead center">{t('ui.stickerCount', { n: earned.size, total: STICKERS.length })} · {t('ui.gardenVisits', { n: gardenVisits(profile) })}</p>
      <Collections profile={profile} />
      <h2 className="center">{t('ui.stickers')}</h2>
      <div className="sticker-grid">
        {STICKERS.map((s, i) => {
          const on = earned.has(s.id);
          return (
            <div key={s.id} className={`sticker ${on ? 'on' : 'off'}`} style={{ animationDelay: `${i * 30}ms` }} data-testid={`sticker-${s.id}`}>
              <span className="sticker-face" aria-hidden>{on ? s.icon : '?'}</span>
              <strong>{t(`sticker.${s.id}`)}</strong>
              <small>{on ? t(`stickerDesc.${s.id}`) : t('ui.locked')}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Count a number up from 0 (instant when motion is reduced). */
export function CountUp({ to, ms = 700 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (document.documentElement.classList.contains('reduce-motion') || to === 0) {
      setV(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const f = Math.min(1, (performance.now() - start) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}

/**
 * New stickers and level-ups since the last results screen. Captured once on mount, then
 * marked as seen, so each is announced exactly once.
 */
export function RewardReveal() {
  const t = useT();
  const profile = useProfile();
  const [snapshot] = useState(() => {
    if (!profile) return null;
    const seen = new Set(profile.stickersSeen ?? []);
    const fresh = earnedStickers(profile).filter((id) => !seen.has(id));
    const lv = levelFor(lifetimeNectar(profile));
    return { fresh, levelUp: lv.index > (profile.levelSeen ?? 0) ? lv : null, level: lv.index };
  });
  useEffect(() => {
    if (!snapshot) return;
    store.updateProfile((p) => ({ ...p, stickersSeen: [...new Set([...(p.stickersSeen ?? []), ...snapshot.fresh])], levelSeen: Math.max(p.levelSeen ?? 0, snapshot.level) }));
  }, [snapshot]);
  if (!snapshot || (!snapshot.fresh.length && !snapshot.levelUp)) return null;
  return (
    <div className="reward-reveal" data-testid="reward-reveal">
      {snapshot.levelUp && (
        <div className="level-up" role="status">
          <span className="fireworks" aria-hidden>{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ ['--r' as string]: `${i * 30}deg` }} />)}</span>
          <span className="level-icon big" aria-hidden>{snapshot.levelUp.icon}</span>
          <strong>{t('ui.levelUp', { level: t(`level.${snapshot.levelUp.key}`) })}</strong>
          {HATS[snapshot.levelUp.index - 1] && (
            <button type="button" className="btn small secondary" onClick={() => store.setRoute({ name: 'stickers' })} data-testid="new-hat">
              {HATS[snapshot.levelUp.index - 1]} {t('fun.newHat')}
            </button>
          )}
        </div>
      )}
      {snapshot.fresh.length > 0 && (
        <div className="new-stickers" role="status">
          <h2>{t('ui.newStickers', { n: snapshot.fresh.length })}</h2>
          <div className="sticker-row">
            {snapshot.fresh.map((id, i) => {
              const s = STICKERS.find((x) => x.id === id)!;
              return (
                <div key={id} className="sticker on reveal" style={{ animationDelay: `${300 + i * 250}ms` }}>
                  <span className="sticker-face" aria-hidden>{s.icon}</span>
                  <strong>{t(`sticker.${id}`)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
