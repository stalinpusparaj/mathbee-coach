import { useMemo, useState } from 'react';
import { store, useProfile } from '../app/store';
import { launch, restoreItem } from '../app/actions';
import { useT } from '../i18n/useT';
import { CATEGORIES, CATEGORY_BY_ID, GARDEN_ITEMS, SUBSKILLS, ASSESSMENT_ORDER } from '../curriculum/curriculum';
import { evaluateAll, categoryBloom, isSecure, STATE_RANK } from '../learning/mastery';
import { dueReviews } from '../learning/review';
import { isUnlocked } from '../learning/planner';
import { todayStr } from '../learning/dates';
import { Sprite } from '../components/art';
import { BackButton, BeeSays, HoldButton } from '../components/ui';
import { hasSprite, spriteUrl, pickSprite } from '../assets/manifest';
import { LevelBadge, RewardReveal, CountUp } from './RewardScreens';
import { displayName } from '../learning/gamification';
import { MusicToggle } from '../components/MusicToggle';
import { JourneyFinale } from '../components/JourneyTrack';
import { themeFor } from '../activities/journey';
import type { CategoryId, Stage } from '../engine/types';
import { use3D } from '../three/support';
import { Garden3D, With3D } from '../three/Lazy3D';
import { QuestCard, GiftBox, RestNote, HatBee, FriendFace } from '../components/Fun';
import { currentHat, friendsMet } from '../learning/fun';
import { STAGES } from '../engine/types';
import type { SessionRecord } from '../learning/types';

function Flowers({ n, label }: { n: number; label: string }) {
  return (
    <span className="blooms" aria-label={label}>
      {[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''} aria-hidden>✿</span>)}
    </span>
  );
}

export function GardenMapScreen() {
  const t = useT();
  const profile = useProfile();
  const [listView, setListView] = useState(false);
  const threeD = use3D();
  const ev = useMemo(() => (profile ? evaluateAll(profile.attempts, profile.settings.mastery) : {}), [profile?.attempts, profile?.settings.mastery]);
  if (!profile) return null;
  const due = dueReviews(profile.reviews, todayStr()).length;
  const unscreened = ASSESSMENT_ORDER.filter((c) => !profile.screened.includes(c));
  const mission = !profile.familiarised
    ? { label: t('ui.missionControls'), go: () => store.setRoute({ name: 'controls' }), id: 'controls' }
    : unscreened.length > 0
      ? { label: t('ui.missionCheckup', { n: unscreened.length }), go: () => launch('assessment'), id: 'assessment' }
      : due > 0
        ? { label: t('ui.missionReview', { n: due }), go: () => launch('review'), id: 'review' }
        : { label: t('ui.missionDaily'), go: () => launch('daily'), id: 'daily' };
  const recommendedCat = unscreened[0];
  const mapArt = { wide: spriteUrl('bg_map_wide'), tall: spriteUrl('bg_map_tall') };

  const map2d = (
    <div className={`map ${mapArt.wide || mapArt.tall ? 'has-art' : ''}`} role="group" aria-label={t('ui.gardenMap')}
      style={{ ['--map-wide' as string]: mapArt.wide ? `url(${mapArt.wide})` : undefined, ['--map-tall' as string]: `url(${mapArt.tall ?? mapArt.wide})` }}>
      <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M14 22 C30 10 50 30 62 14 S 86 30 86 22 M14 22 C10 36 20 44 12 46 S 30 50 34 42 S 50 34 58 40 S 80 52 84 48 M12 46 C10 60 18 70 14 72 S 30 74 36 68 S 50 60 58 66 S 76 80 82 74 M36 68 C32 80 28 86 30 90 S 50 96 62 90" stroke="#e8c98f" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <ellipse cx="48" cy="56" rx="9" ry="5" fill="#9fd3ee" />
      </svg>
      <div className="map-ambient" aria-hidden>
        <span className="butterfly b1">🦋</span><span className="butterfly b2">🦋</span><span className="butterfly b3">🦋</span>
        <span className="map-bee"><Sprite id="bee" size={40} decorative /></span>
      </div>
      {GARDEN_ITEMS.filter((g) => profile.garden.includes(g.id) && hasSprite(g.sprite)).map((g) => (
        <span key={g.id} className="garden-item" style={{ left: `${g.x}%`, top: `${g.y}%` }}><Sprite id={g.sprite} size={46} decorative /></span>
      ))}
      {CATEGORIES.map((c) => {
        const bloom = categoryBloom(c.id, ev);
        return (
          <button key={c.id} type="button" className={`location ${recommendedCat === c.id ? 'recommended' : ''}`} style={{ left: `${c.map.x}%`, top: `${c.map.y}%` }}
            onClick={() => store.setRoute({ name: 'category', category: c.id })} data-testid={`loc-${c.id}`}>
            <Sprite id={c.icon} size={58} decorative />
            <span className="loc-name">{t(`cat.${c.id}`)}</span>
            <Flowers n={bloom} label={t('ui.bloomLevel', { n: bloom })} />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="screen garden">
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'welcome' })} label={t('ui.back')} />
        <div className="row">
          <div className="nectar" aria-label={t('ui.nectarCount', { n: profile.nectar })}>🍯 {profile.nectar}</div>
          <MusicToggle compact />
        </div>
        <button type="button" className="btn small secondary" onClick={() => setListView((v) => !v)} aria-pressed={listView} data-testid="list-toggle">
          {listView ? t('ui.mapView') : t('ui.listView')}
        </button>
      </header>

      <div className="progress-row">
        <LevelBadge profile={profile} compact />
        <button type="button" className="btn secondary sticker-btn" onClick={() => store.setRoute({ name: 'stickers' })} data-testid="sticker-book-btn">📒 {t('ui.stickers')}</button>
      </div>

      <section className="mission-card">
        <HatBee hat={currentHat(profile)} size={64} className="bee-idle" />
        <div>
          <p className="small">{t('ui.todaysMission')}</p>
          <button type="button" className="btn primary big" onClick={mission.go} data-testid="mission">{mission.label}</button>
        </div>
      </section>

      <QuestCard profile={profile} />
      <GiftBox profile={profile} />

      <nav className="quick-row" aria-label={t('ui.activities')}>
        <button type="button" className="btn secondary" onClick={() => launch('daily')} data-testid="daily">{t('ui.dailyPractice')}</button>
        <button type="button" className="btn secondary" onClick={() => store.setRoute({ name: 'review-due' })} data-testid="review">{t('ui.review')} {due > 0 && <span className="count">{due}</span>}</button>
        <button type="button" className="btn secondary" onClick={() => store.setRoute({ name: 'tests' })} data-testid="tests">{t('ui.worksheetsTests')}</button>
        <button type="button" className="btn secondary" onClick={() => store.setRoute({ name: 'restore' })} data-testid="restore">{t('ui.restoreGarden')}</button>
      </nav>

      {listView ? (
        <ul className="cat-list" data-testid="category-list">
          {CATEGORIES.map((c) => {
            const bloom = categoryBloom(c.id, ev);
            const tried = SUBSKILLS.some((s) => s.category === c.id && ev[s.id]?.attempts > 0);
            return (
              <li key={c.id}>
                <button type="button" className="cat-row" onClick={() => store.setRoute({ name: 'category', category: c.id })} data-testid={`cat-${c.id}`}>
                  <Sprite id={c.icon.startsWith('bird:') ? c.icon : c.icon} size={48} decorative />
                  <span className="cat-name">{t(`cat.${c.id}`)}<small>{t(c.topicKey)}</small></span>
                  <Flowers n={bloom} label={t('ui.bloomLevel', { n: bloom })} />
                  <span className="small muted">{tried ? '' : t('ui.notTriedYet')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        threeD ? (
          <With3D flat={map2d}>
            <Garden3D
              names={Object.fromEntries(CATEGORIES.map((c) => [c.id, t(`cat.${c.id}`)])) as Record<CategoryId, string>}
              blooms={Object.fromEntries(CATEGORIES.map((c) => [c.id, categoryBloom(c.id, ev)])) as Record<CategoryId, number>}
              recommended={recommendedCat}
              owned={profile.garden}
              onOpen={(c) => store.setRoute({ name: 'category', category: c })}
              label={t('ui.gardenMap')}
              hint={t('ui.drag3d')}
              friends={friendsMet(profile)}
              hat={currentHat(profile)}
            />
          </With3D>
        ) : map2d
      )}
      <footer className="garden-foot">
        <HoldButton label={t('ui.grownUps')} onDone={() => store.setRoute({ name: 'parent' })} testId="parent-hold" />
      </footer>
    </div>
  );
}

export function CategoryScreen({ category }: { category: CategoryId }) {
  const t = useT();
  const profile = useProfile();
  const ev = useMemo(() => (profile ? evaluateAll(profile.attempts, profile.settings.mastery) : {}), [profile?.attempts, profile?.settings.mastery]);
  if (!profile) return null;
  const cat = CATEGORY_BY_ID[category];
  const stageName = (s: Stage) => t(`stage.${s}`);
  return (
    <div className="screen category">
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} />
        <h1><Sprite id={cat.icon} size={40} decorative /> {t(`cat.${category}`)}</h1>
        <span />
      </header>
      <p className="lead">{t(`catGoal.${category}`)}</p>
      <div className="stage-cards">
        {STAGES.map((stage) => {
          const subs = SUBSKILLS.filter((s) => s.category === category && s.stage === stage);
          const open = subs.filter((s) => isUnlocked(s, ev, profile));
          const secure = subs.filter((s) => isSecure(ev[s.id])).length;
          const lessonTarget = open.find((s) => !isSecure(ev[s.id])) ?? open[0];
          return (
            <section key={stage} className={`stage-card ${stage}`} data-testid={`stage-${stage}`}>
              <h2>{stageName(stage)}</h2>
              <p className="small">{t(`stageDesc.${stage}`)}</p>
              <ul className="sub-list">
                {subs.map((s) => (
                  <li key={s.id} className={isUnlocked(s, ev, profile) ? '' : 'locked'}>
                    <span>{t(`subChild.${s.id}`)}</span>
                    {s.source === 'extension' && <span className="chip ext">{t('ui.extension')}</span>}
                    {!isUnlocked(s, ev, profile) && <span className="chip">{t('ui.later')}</span>}
                    <Flowers n={Math.min(3, Math.max(0, STATE_RANK[ev[s.id].state] - 2))} label={t(`state.${ev[s.id].state}`)} />
                  </li>
                ))}
              </ul>
              <div className="row wrap">
                <button type="button" className="btn secondary" onClick={() => lessonTarget && launch('lesson', { subskill: lessonTarget.id, category })} disabled={!lessonTarget} data-testid={`learn-${stage}`}>{t('ui.learn')}</button>
                <button type="button" className="btn primary" onClick={() => launch('practice', { category, stage })} disabled={!open.length} data-testid={`practise-${stage}`}>{t('ui.practise')}</button>
              </div>
              <p className="small muted">{t('ui.secureCount', { n: secure, total: subs.length })}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function ResultsScreen({ record, newNectar }: { record: SessionRecord; newNectar: number }) {
  const t = useT();
  const profile = useProfile();
  const cats = record.categories.map((c) => t(`cat.${c}`)).join(', ');
  const suggestion = profile && dueReviews(profile.reviews, todayStr()).length ? t('ui.suggestReview') : t('ui.suggestDaily');
  // a friend met for the first time on this journey
  const [newFriend] = useState(() => {
    if (!profile || !record.completed || !record.questions || !record.categories.length) return null;
    const theme = themeFor(record.categories);
    const before = friendsMet({ sessions: profile.sessions.filter((x) => x.id !== record.id) });
    return before.includes(theme) ? null : theme;
  });
  return (
    <div className="screen results" data-testid="results">
      <BeeSays pose={pickSprite('bee_celebrate', 'bee')}>
        <h1>{profile && displayName(profile.nickname)
          ? t(record.completed ? 'ui.wellDoneName' : 'ui.niceWorkName', { name: displayName(profile.nickname) })
          : t(record.completed ? 'ui.wellDone' : 'ui.niceWork')}</h1>
        <p>{record.completed ? t('ui.sessionDone') : t('ui.stoppedEarly')}</p>
      </BeeSays>
      <div className="stat-row">
        <div className="stat pop-in"><strong><CountUp to={record.independentCorrect} /></strong><span>{t('ui.onYourOwn')}</span></div>
        <div className="stat pop-in d2"><strong><CountUp to={record.supportedCompleted} /></strong><span>{t('ui.withHelp')}</span></div>
        <div className="stat pop-in d3"><strong>🍯 <CountUp to={newNectar} /></strong><span>{t('ui.nectarEarned')}</span></div>
      </div>
      {record.questions > 0 && record.categories.length > 0 && (
        <JourneyFinale theme={themeFor(record.categories)} completed={record.completed} steps={record.questions}
          name={(profile && displayName(profile.nickname)) || t('ui.friend')} hat={profile ? currentHat(profile) : null} />
      )}
      {newFriend && (
        <div className="new-friend pop-in" role="status" data-testid="new-friend">
          <FriendFace theme={newFriend} size={72} />
          <strong>{t('fun.newFriend', { friend: t(`friend.${newFriend}`) })}</strong>
        </div>
      )}
      {profile && <GiftBox profile={profile} />}
      <RewardReveal />
      {profile && <LevelBadge profile={profile} />}
      {profile && <RestNote profile={profile} />}
      {cats && <p className="small">{t('ui.youPractised', { what: cats })}</p>}
      <p className="small">{t('ui.nextIdea')}: {suggestion}</p>
      <div className="row wrap center">
        <button type="button" className="btn primary big" onClick={() => store.setRoute({ name: 'restore' })} data-testid="to-restore">{t('ui.restoreGarden')}</button>
        <button type="button" className="btn secondary" onClick={() => store.setRoute({ name: 'map' })} data-testid="to-map">{t('ui.backToGarden')}</button>
      </div>
    </div>
  );
}

export function RestoreScreen() {
  const t = useT();
  const profile = useProfile();
  const [just, setJust] = useState<string | null>(null);
  if (!profile) return null;
  return (
    <div className="screen restore">
      <header className="topbar">
        <BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} />
        <h1>{t('ui.restoreGarden')}</h1>
        <div className="nectar">🍯 {profile.nectar}</div>
      </header>
      <p className="lead">{t('ui.restoreLead')}</p>
      <div className="restore-grid">
        {GARDEN_ITEMS.filter((g) => hasSprite(g.sprite)).map((g) => {
          const owned = profile.garden.includes(g.id);
          return (
            <div key={g.id} className={`restore-card ${owned ? 'owned' : ''} ${just === g.id ? 'bloom' : ''}`}>
              <Sprite id={g.sprite} size={72} decorative />
              <p>{t(`garden.${g.id}`)}</p>
              {owned ? <span className="chip">{t('ui.inGarden')}</span> : (
                <button type="button" className="btn small" disabled={profile.nectar < g.cost} onClick={() => { restoreItem(g.id); setJust(g.id); }} data-testid={`restore-${g.id}`}>
                  🍯 {g.cost}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewDueScreen() {
  const t = useT();
  const profile = useProfile();
  if (!profile) return null;
  const today = todayStr();
  const due = dueReviews(profile.reviews, today);
  const upcoming = Object.entries(profile.reviews).filter(([, r]) => r.due > today).sort((a, b) => (a[1].due < b[1].due ? -1 : 1)).slice(0, 5);
  return (
    <div className="screen review-due">
      <header className="topbar"><BackButton onClick={() => store.setRoute({ name: 'map' })} label={t('ui.back')} /><h1>{t('ui.review')}</h1><span /></header>
      {due.length ? (
        <>
          <BeeSays><p>{t('ui.reviewLead', { n: due.length })}</p></BeeSays>
          <ul className="sub-list">{due.map((s) => <li key={s}>{t(`subChild.${s}`)}</li>)}</ul>
          <button type="button" className="btn primary big" onClick={() => launch('review')} data-testid="start-review">{t('ui.startReview')}</button>
        </>
      ) : (
        <>
          <BeeSays><p>{t('ui.nothingDue')}</p></BeeSays>
          <button type="button" className="btn primary big" onClick={() => launch('daily')}>{t('ui.dailyPractice')}</button>
        </>
      )}
      {upcoming.length > 0 && (
        <section className="card">
          <h2 className="small">{t('ui.comingUp')}</h2>
          <ul className="sub-list">{upcoming.map(([s, r]) => <li key={s}>{t(`subChild.${s}`)} <span className="muted small">{r.due}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
