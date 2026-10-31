import type { MiniSkin, QuestionInstance } from '../../engine/types';
import type { SceneProps } from '../sceneTypes';

/**
 * Mini-game skins for adventure levels. A skin changes ONLY how a scene looks (bubbles,
 * lily pads, a ferry, a postman's street): the answer spec, the `work` keys, the controls
 * and checking stay exactly the same, and no skin uses a timer. A skin that does not fit a
 * question's scene is ignored and the question plays unskinned.
 */
export type SkinnedSceneProps = SceneProps & { skin?: MiniSkin };

/** What the bee hops on in Lily-Pad Hop. */
export type PadKind = 'lily' | 'ice' | 'stone';

export type ActiveSkin =
  | { family: 'bubbles' }
  | { family: 'lily-hop'; pad: PadKind }
  | { family: 'ferry-loader' }
  | { family: 'postman' };

/** The skin to draw for this question, or null when the skin does not apply to its scene. */
export function activeSkin(skin: MiniSkin | undefined, q: Pick<QuestionInstance, 'scene'>): ActiveSkin | null {
  if (!skin) return null;
  const s = q.scene;
  switch (skin) {
    case 'bubbles':
      return s.type === 'count' && !s.groups ? { family: 'bubbles' } : null;
    case 'lily-hop':
    case 'lily-hop-ice':
    case 'lily-hop-stone': {
      const pad: PadKind = skin === 'lily-hop-ice' ? 'ice' : skin === 'lily-hop-stone' ? 'stone' : 'lily';
      const fits = s.type === 'trail' || ((s.type === 'add' || s.type === 'subtract') && s.representation === 'numberline');
      return fits ? { family: 'lily-hop', pad } : null;
    }
    case 'ferry-loader':
      return s.type === 'ferry' && !s.grouped && !s.subtotals ? { family: 'ferry-loader' } : null;
    case 'postman':
      return s.type === 'week' && !s.cards && s.start !== undefined ? { family: 'postman' } : null;
  }
}

/** Stable small offsets so bubbles bob out of step (no randomness, no timers). */
export function bobDelay(i: number): string {
  return `${-((i * 0.37) % 1.6).toFixed(2)}s`;
}
