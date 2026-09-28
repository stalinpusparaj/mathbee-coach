import extracted from './sprites.generated.json';
import generated from './generated.json';

export interface SpriteAsset {
  id: string;
  file: string;
  width: number;
  height: number;
  alt: string;
  source: string;
  sourceRect: number[];
}

/**
 * Raster sprites cut from the supplied asset sheets (tools/extract_assets.py), plus optional
 * art generated with tools/generate_art.mjs → tools/process_generated.py. Generated entries
 * are decorative or identify object kinds only; they never carry quantities or answers.
 */
export const SPRITES: Record<string, SpriteAsset> = Object.fromEntries(
  [...(extracted as SpriteAsset[]), ...(generated as SpriteAsset[])].map((s) => [s.id, s]),
);

export const hasSprite = (id: string) => id in SPRITES;

/** First available sprite id from a preference list (e.g. a pose, then the default bee). */
export function pickSprite(...ids: string[]): string {
  return ids.find(hasSprite) ?? ids[ids.length - 1];
}

/** Assets drawn in code, because mathematical truth must not depend on generated art. */
export const CODE_DRAWN = [
  { id: 'bird:owl|swan|parrot|ostrich|rooster|crow|penguin', where: 'src/components/art.tsx', why: 'Distinct silhouettes for sorting; supplied sheets have only a costumed owl and a bluebird.' },
  { id: 'turtle', where: 'src/components/art.tsx', why: 'No turtle in the supplied sheets.' },
  { id: 'clock', where: 'src/components/Clock.tsx', why: 'Hand angles computed from time.' },
  { id: 'calendar', where: 'src/components/Calendar.tsx', why: 'Grid computed from real dates.' },
  { id: 'shapes', where: 'src/components/art.tsx', why: 'Exact geometry.' },
  { id: 'ten-frame, base-ten blocks, number line', where: 'src/components/math-models.tsx', why: 'Quantities rendered from data.' },
  { id: 'measured pots, planks, unit blocks', where: 'src/activities/scenes', why: 'Sizes must be exact for fair comparison.' },
];

export function spriteUrl(id: string): string | null {
  const s = SPRITES[id];
  return s ? `${import.meta.env.BASE_URL}${s.file}` : null;
}
