import type { CSSProperties } from 'react';
import { Sprite } from './art';
import { THEMES, platformPositions, worldWidth, cameraOffset, storyBeat, type JourneyTheme } from '../activities/journey';
import { useT } from '../i18n/useT';

export interface StepMark { done: boolean; own: boolean; skipped: boolean }

/** Parallax factors: far hills barely move, the path moves with the camera, grass moves fastest. */
const LAYERS = [
  { cls: 'jl-clouds', f: 0.12 },
  { cls: 'jl-far', f: 0.25 },
  { cls: 'jl-mid', f: 0.55 },
] as const;
const NEAR = 1.35;

/** Layer box sized for its parallax factor, shifted by camera × factor (percent of its own width). */
function layerStyle(f: number, world: number, cam: number): CSSProperties {
  const w = 1 + (world - 1) * f;
  return { width: `${w * 100}%`, transform: `translateX(${(-(cam * f) / w) * 100}%)` };
}

function Hive() {
  return (
    <svg viewBox="0 0 60 64" width="58" height="62" aria-hidden>
      <path d="M30 2 v8" stroke="#6b4a2a" strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx="30" cy={16 + i * 11} rx={14 + i * 4} ry="7" fill={i % 2 ? '#F2B533' : '#F7C948'} stroke="#8a5a1f" strokeWidth="2" />
      ))}
      <ellipse cx="30" cy="50" rx="6" ry="5" fill="#5a3a18" />
    </svg>
  );
}

/**
 * The session journey: the bee stands on the platform of the current question and hops to
 * the next one when a question is finished. Scenery layers slide at different speeds
 * (parallax) only during that hop, so nothing moves while the child is thinking.
 */
export function JourneyTrack({ theme, index, total, marks, finished, name, onStoryTap, quiet }: {
  theme: JourneyTheme; index: number; total: number; marks: StepMark[]; finished?: boolean; name: string; onStoryTap?: (text: string) => void; quiet?: boolean;
}) {
  const t = useT();
  const th = THEMES[theme];
  const world = worldWidth(total);
  const pts = platformPositions(total);
  const at = finished ? total : Math.min(index, total);
  const bee = pts[at];
  const cam = cameraOffset(bee.x, world);
  const beat = finished || quiet ? null : storyBeat(index, total);
  const friend = t(`friend.${theme}`);
  const story = beat ? t(beat === 'intro' ? `journey.intro.${theme}` : 'journey.mid', { name, friend }) : null;
  const vars = { '--sky1': th.sky[0], '--sky2': th.sky[1], '--far': th.far, '--mid': th.mid, '--near': th.near, '--ground': th.ground } as CSSProperties;

  return (
    <div className="journey-wrap">
    <div className={`journey theme-${theme}`} style={vars} role="img" aria-label={t('ui.journey', { n: Math.min(index + 1, total), total, friend })} data-testid="journey">
      <span className="jl-sun" aria-hidden />
      {LAYERS.map((l) => <div key={l.cls} className={`jl ${l.cls}`} style={layerStyle(l.f, world, cam)} aria-hidden />)}
      <div className="jl jl-world" style={layerStyle(1, world, cam)}>
        <div className="jl-ground" aria-hidden />
        {pts.slice(0, total).map((p, k) => (
          <span key={k} className={`jl-platform ${k === at ? 'now' : ''} ${k < at ? 'passed' : ''}`} style={{ left: `${p.x * 100}%`, top: `${p.y}%` }}>
            <Sprite id={th.platform} size="100%" decorative />
            {marks[k]?.done && !marks[k].skipped && <span className={`jl-reward ${marks[k].own ? 'own' : 'helped'}`} aria-hidden>{marks[k].own ? '🍯' : '🌼'}</span>}
          </span>
        ))}
        <span className="jl-goal" style={{ left: `${pts[total].x * 100}%`, top: `${pts[total].y}%` }}>
          {th.goal === 'svg:hive' ? <Hive /> : <Sprite id={th.goal} size="100%" decorative />}
          <span className="jl-flag" aria-hidden>🏁</span>
        </span>
        <span className={`jl-bee ${finished ? 'arrived' : ''}`} style={{ left: `${bee.x * 100}%`, top: `${bee.y}%` }}>
          <span key={at} className="jl-bee-inner"><Sprite id="bee" size="100%" decorative /></span>
        </span>
      </div>
      <div className="jl jl-near" style={layerStyle(NEAR, world, cam)} aria-hidden />
    </div>
      {story && (
        <button type="button" className="jl-story" onClick={() => onStoryTap?.(story)} data-testid="journey-story">
          <Sprite id="bee" size={26} decorative /> <span>{story}</span>
        </button>
      )}
    </div>
  );
}

/** Results-screen finale: the bee reaches the friend (or rests on the way if stopped early). */
export function JourneyFinale({ theme, completed, name, steps }: { theme: JourneyTheme; completed: boolean; name: string; steps: number }) {
  const t = useT();
  const total = Math.max(1, steps);
  return (
    <section className={`journey-finale ${completed ? 'done' : ''}`} data-testid="journey-finale">
      <JourneyTrack theme={theme} index={completed ? total : Math.max(0, total - 1)} total={total} marks={[]} finished={completed} name={name} quiet />
      <p className="finale-text">
        {completed ? `${t('journey.end', { name, friend: t(`friend.${theme}`) })} ${t(`journey.end.${theme}`)}` : t('journey.stopped')}
      </p>
    </section>
  );
}
