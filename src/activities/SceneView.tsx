import type { SceneProps } from './sceneTypes';
import { CountScene } from './scenes/CountScene';
import { FerryScene } from './scenes/FerryScene';
import { BirdScene } from './scenes/BirdScene';
import { SizesScene } from './scenes/SizesScene';
import { LengthsScene } from './scenes/LengthsScene';
import { ShapesScene } from './scenes/ShapesScene';
import { PairsScene } from './scenes/PairsScene';
import { AddScene, SubScene } from './scenes/ArithmeticScenes';
import { TrailScene, WeekScene, ClockScene, CalendarScene, StoryScene } from './scenes/TimeScenes';

/** Chooses the activity renderer for a question's scene type. */
export function SceneView(props: SceneProps) {
  switch (props.q.scene.type) {
    case 'count': return <CountScene {...props} />;
    case 'ferry': return <FerryScene {...props} />;
    case 'birds': return <BirdScene {...props} />;
    case 'sizes': return <SizesScene {...props} />;
    case 'lengths': return <LengthsScene {...props} />;
    case 'shapes': return <ShapesScene {...props} />;
    case 'pairs': return <PairsScene {...props} />;
    case 'add': return <AddScene {...props} />;
    case 'subtract': return <SubScene {...props} />;
    case 'trail': return <TrailScene {...props} />;
    case 'week': return <WeekScene {...props} />;
    case 'clock': return <ClockScene {...props} />;
    case 'calendar': return <CalendarScene {...props} />;
    case 'story': return <StoryScene {...props} />;
  }
}

/** Plain worksheet questions whose picture is not needed (text says it all). */
export function needsPictureInPlain(q: SceneProps['q']): boolean {
  if (q.plainPicture) return true;
  // time-setting and ordering questions need their items/clock even in plain form
  return q.answer.kind === 'time' || (q.scene.type === 'shapes' && q.scene.mode !== 'compose') || q.scene.type === 'week' && q.answer.kind === 'order';
}
