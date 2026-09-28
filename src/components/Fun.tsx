import { useState } from 'react';
import { store } from '../app/store';
import { useT } from '../i18n/useT';
import { Sprite } from './art';
import { THEMES } from '../activities/journey';
import { todayStr } from '../learning/dates';
import { displayName } from '../learning/gamification';
import {
  FRIEND_ORDER, HATS, TREASURES, currentHat, friendsMet, giftWaiting, goldenDays, hatsUnlocked, openGift, questsFor,
  suggestRest, treasureCounts, treasureFor,
} from '../learning/fun';
import type { Profile } from '../learning/types';

/** The bee sprite wearing its chosen hat. */
export function HatBee({ hat, size, className = '' }: { hat: string | null; size: number; className?: string }) {
  return (
    <span className={`hat-bee ${className}`} style={{ width: size, height: size }} aria-hidden>
      <Sprite id="bee" size={size} decorative />
      {hat && <span className="bee-hat" style={{ fontSize: size * 0.42 }}>{hat}</span>}
    </span>
  );
}

/** A friend's picture (the Queen Bee is the bee in a crown). */
export function FriendFace({ theme, size }: { theme: (typeof FRIEND_ORDER)[number]; size: number }) {
  const goal = THEMES[theme].goal;
  return goal === 'svg:hive' ? <HatBee hat="👑" size={size} /> : <Sprite id={goal} size={size} decorative />;
}

/** Buzz combo chip in the session top bar (appears from 2 in a row, disappears silently). */
export function ComboChip({ n }: { n: number }) {
  const t = useT();
  if (n < 2) return null;
  return <span key={n} className={`combo-chip ${n >= 5 ? 'hot' : ''}`} role="status" data-testid="combo">{t('combo.chip', { n })}</span>;
}

/** Today's three quests with progress; all three done = a golden sunflower. */
export function QuestCard({ profile }: { profile: Profile }) {
  const t = useT();
  const quests = questsFor(profile, todayStr());
  const all = quests.every((q) => q.done);
  return (
    <section className={`quest-card ${all ? 'all-done' : ''}`} data-testid="quests">
      <h2>{all ? '🌻' : '🎯'} {t('quest.title')}</h2>
      <ul>
        {quests.map((q) => (
          <li key={q.kind} className={q.done ? 'done' : ''} data-testid={`quest-${q.kind}`}>
            <span className="quest-tick" aria-hidden>{q.done ? '✅' : '⬜'}</span>
            <span className="quest-name">{t(`quest.${q.kind}`)}</span>
            <span className="quest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.need} aria-valuenow={q.have}>
              <span style={{ width: `${(q.have / q.need) * 100}%` }} />
            </span>
            <small>{q.have}/{q.need}</small>
          </li>
        ))}
      </ul>
      {all && <p className="quest-all" role="status">{t('quest.allDone')} {t('quest.comeBack')}</p>}
    </section>
  );
}

/** Once a day, after finishing a journey: a wrapped gift to tap open. */
export function GiftBox({ profile }: { profile: Profile }) {
  const t = useT();
  const today = todayStr();
  const [opened, setOpened] = useState<string | null>(null);
  if (!opened && !giftWaiting(profile, today)) return null;
  const open = () => {
    const id = treasureFor(profile.id, today);
    store.updateProfile((p) => openGift(p, today));
    setOpened(id);
  };
  return (
    <section className={`gift ${opened ? 'opened' : ''}`} data-testid="gift">
      {opened ? (
        <>
          <span className="gift-rays" aria-hidden />
          <span className="treasure-big" aria-hidden>{opened}</span>
          <p role="status" data-testid="gift-found"><strong>{t('gift.found', { t: opened })}</strong></p>
          <p className="small">{t('gift.tomorrow')}</p>
        </>
      ) : (
        <>
          <p><strong>{t('gift.title')}</strong></p>
          <button type="button" className="gift-box" onClick={open} data-testid="open-gift" aria-label={t('gift.tap')}>
            <span aria-hidden>🎁</span>
          </button>
          <p className="small">{t('gift.tap')}</p>
        </>
      )}
    </section>
  );
}

/** Gentle stop after a few journeys in one day. */
export function RestNote({ profile }: { profile: Profile }) {
  const t = useT();
  if (!suggestRest(profile, todayStr())) return null;
  return (
    <p className="rest-note" role="status" data-testid="rest-note">
      😴 {t('rest.note', { name: displayName(profile.nickname) || t('ui.friend') })}
    </p>
  );
}

/** Sticker-book sections: friends, treasures, golden sunflowers and the bee's wardrobe. */
export function Collections({ profile }: { profile: Profile }) {
  const t = useT();
  const met = new Set(friendsMet(profile));
  const counts = treasureCounts(profile);
  const found = profile.treasures?.length ?? 0;
  const golden = goldenDays(profile).length;
  const unlocked = hatsUnlocked(profile);
  const wearing = currentHat(profile);
  const setHat = (h: string | null) => store.updateProfile((p) => ({ ...p, beeHat: h }));
  return (
    <>
      <section className="card collection" data-testid="wardrobe">
        <h2>{t('fun.wardrobe')}</h2>
        <div className="wardrobe-row">
          <HatBee hat={wearing} size={84} className="wardrobe-bee" />
          <div className="hat-grid">
            <button type="button" className={`hat-btn ${wearing === null ? 'on' : ''}`} onClick={() => setHat(null)} aria-pressed={wearing === null}>{t('fun.noHat')}</button>
            {HATS.map((h, i) => {
              const ok = unlocked.includes(h);
              return (
                <button key={h} type="button" className={`hat-btn ${wearing === h ? 'on' : ''}`} disabled={!ok} onClick={() => setHat(h)}
                  aria-pressed={wearing === h} aria-label={ok ? h : t('fun.hatLocked', { n: i + 2 })} data-testid={`hat-${i}`}>
                  {ok ? <span className="hat-face">{h}</span> : <small>🔒 {t('fun.hatLocked', { n: i + 2 })}</small>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card collection" data-testid="friends">
        <h2>{t('fun.friends')} <small>{t('fun.friendsCount', { n: met.size, total: FRIEND_ORDER.length })}</small></h2>
        <div className="friend-grid">
          {FRIEND_ORDER.map((f) => (
            <div key={f} className={`friend ${met.has(f) ? 'on' : 'off'}`} title={met.has(f) ? t(`friend.${f}`) : t('fun.friendHint')}>
              <span className="friend-face"><FriendFace theme={f} size={56} /></span>
              <small>{met.has(f) ? t(`friend.${f}`) : '?'}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card collection" data-testid="treasures">
        <h2>{t('fun.treasures')} <small>{t('fun.treasureCount', { n: found })}</small> · 🌻 <small>{t('fun.goldenCount', { n: golden })}</small></h2>
        {found === 0 ? <p className="small muted">{t('fun.noTreasure')}</p> : (
          <div className="treasure-grid">
            {TREASURES.map((tr) => (
              <span key={tr} className={`treasure ${counts[tr] ? 'on' : 'off'}`} aria-hidden={!counts[tr]}>
                {counts[tr] ? tr : '·'}{counts[tr] > 1 && <b>×{counts[tr]}</b>}
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
