import type { CategoryId, MiniSkin } from '../engine/types';
import { getTemplate } from '../engine/registry';
import { SUBSKILL_BY_ID } from '../curriculum/curriculum';
import type { JourneyTheme } from '../activities/journey';
import type { Settings, WorldId } from '../learning/types';

/**
 * Adventure Mode data: seven worlds and two bonus levels (81 levels). A level lists only
 * template ids — its subskills, categories and "extension" status are derived from the
 * generators and the curriculum at runtime, so this table can never disagree with them.
 */

export type LevelKind = 'core' | 'mini' | 'memory' | 'friend' | 'finale' | 'bonus';

export interface LevelDef {
  /** `w{n}-{nn}` or `bonus-0n` */
  id: string;
  world: WorldId;
  /** position inside the world, from 1 */
  n: number;
  titleKey: string;
  kind: LevelKind;
  /** played round-robin */
  templates: string[];
  /** used instead of `templates` when extensions are hidden (all non-extension) */
  fallbackTemplates?: string[];
  /** planned questions (adaptive follow-ups can add at most 2) */
  questions: number;
  /** mini levels: presentation-only skin */
  skin?: MiniSkin;
  /** bonus levels: shown only when this gated subskill is unlocked */
  gatedSubskill?: string;
}

export interface WorldDef {
  id: WorldId;
  /** 1–7, bonus = 8 */
  n: number;
  theme: JourneyTheme;
  /** friend sprite id ('svg:hive' for the Queen Bee); empty for the bonus world */
  friend: string;
  nameKey: string;
}

export const WORLDS: WorldDef[] = [
  { id: 'w1', n: 1, theme: 'meadow', friend: 'bunny_florist', nameKey: 'adv.world.w1' },
  { id: 'w2', n: 2, theme: 'river', friend: 'frog', nameKey: 'adv.world.w2' },
  { id: 'w3', n: 3, theme: 'orchard', friend: 'squirrel_gardener', nameKey: 'adv.world.w3' },
  { id: 'w4', n: 4, theme: 'ice', friend: 'penguin_wave', nameKey: 'adv.world.w4' },
  { id: 'w5', n: 5, theme: 'trail', friend: 'hedgehog', nameKey: 'adv.world.w5' },
  { id: 'w6', n: 6, theme: 'town', friend: 'owl_keeper', nameKey: 'adv.world.w6' },
  { id: 'w7', n: 7, theme: 'garden', friend: 'svg:hive', nameKey: 'adv.world.w7' },
  { id: 'bonus', n: 8, theme: 'garden', friend: '', nameKey: 'adv.world.bonus' },
];
export const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w])) as Record<WorldId, WorldDef>;
/** The seven story worlds in order (bonus excluded). */
export const STORY_WORLDS: WorldId[] = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];

type Row = [id: string, kind: LevelKind, templates: string[], questions: number, extra?: Partial<LevelDef>];

const ROWS: Row[] = [
  // ---- W1 Bunny's Flower Meadow ----
  ['w1-01', 'core', ['c01-e-row', 'c01-e-dice'], 5],
  ['w1-02', 'core', ['c01-e-zero', 'c01-e-row'], 5],
  ['w1-03', 'core', ['c04-e-big', 'c04-e-small', 'c04-e-match'], 5],
  ['w1-04', 'mini', ['c01-e-row', 'c01-e-dice'], 6, { skin: 'bubbles' }],
  ['w1-05', 'core', ['c07-e-make', 'c07-e-match'], 5],
  ['w1-06', 'core', ['c01-p-rows', 'c01-p-columns'], 6],
  ['w1-07', 'core', ['c01-p-scatter', 'c01-p-columns'], 6],
  ['w1-08', 'core', ['c07-e-toflowers', 'c07-e-make'], 5],
  ['w1-09', 'core', ['c04-p-order-up', 'c04-p-order-down', 'c04-p-smallest'], 6],
  ['w1-10', 'core', ['c07-p-count', 'c07-p-leftover', 'c07-p-worksheet'], 6],
  ['w1-11', 'memory', ['c01-e-dice', 'c01-e-zero', 'c04-e-small', 'c07-e-match', 'c01-p-rows', 'c07-p-worksheet'], 6],
  ['w1-12', 'friend', ['c01-p-scatter', 'c04-e-match', 'c07-p-count', 'c01-p-columns', 'c07-p-worksheet'], 8],
  // ---- W2 Frog's Ferry River ----
  ['w2-01', 'core', ['c02-e-load', 'c02-e-groups'], 5],
  ['w2-02', 'core', ['c02-e-hopon', 'c02-e-groups'], 5],
  ['w2-03', 'core', ['c05-e-long', 'c05-e-short', 'c05-e-arrows'], 5],
  ['w2-04', 'core', ['c03-e-vocab'], 5],
  ['w2-05', 'core', ['c03-e-target', 'c03-e-sort'], 5],
  ['w2-06', 'core', ['c02-p-load3', 'c02-p-table', 'c02-p-worksheet'], 6],
  ['w2-07', 'core', ['c05-p-measure', 'c05-p-find', 'c05-p-order'], 6],
  ['w2-08', 'core', ['c03-p-sortall', 'c03-p-one', 'c03-p-worksheet'], 6],
  ['w2-09', 'mini', ['c02-e-load', 'c02-p-load3', 'c02-e-hopon'], 6, { skin: 'ferry-loader' }],
  ['w2-10', 'memory', ['c02-e-groups', 'c02-p-worksheet', 'c05-e-arrows', 'c03-e-target', 'c03-e-vocab'], 6],
  ['w2-11', 'friend', ['c02-p-table', 'c03-p-worksheet', 'c05-p-find', 'c02-p-worksheet', 'c03-p-one'], 8, {
    fallbackTemplates: ['c02-p-table', 'c03-p-worksheet', 'c05-e-arrows', 'c02-p-worksheet', 'c03-p-one'],
  }],
  // ---- W3 Squirrel's Apple Orchard ----
  ['w3-01', 'core', ['c08-e-baskets', 'c08-e-numberline'], 5],
  ['w3-02', 'core', ['c08-e-words', 'c08-e-baskets'], 5],
  ['w3-03', 'mini', ['c08-e-numberline'], 6, { skin: 'lily-hop' }],
  ['w3-04', 'core', ['c14-e-join'], 5],
  ['w3-05', 'core', ['c08-p-tenframe', 'c08-p-zero'], 6],
  ['w3-06', 'core', ['c08-p-maketen'], 6],
  ['w3-07', 'core', ['c08-p-zero', 'c08-p-tenframe'], 6],
  ['w3-08', 'core', ['c14-p-add'], 6],
  ['w3-09', 'core', ['c08-a-decade', 'c08-p-maketen'], 6],
  ['w3-10', 'memory', ['c08-e-words', 'c08-p-tenframe', 'c08-p-maketen', 'c14-e-join'], 6],
  ['w3-11', 'friend', ['c08-p-tenframe', 'c08-p-maketen', 'c14-p-add', 'c08-a-decade'], 8],
  // ---- W4 Penguin's Ice Floes ----
  ['w4-01', 'core', ['c09-e-boat', 'c09-e-choose'], 5],
  ['w4-02', 'core', ['c09-e-numberline', 'c09-e-choose'], 5],
  ['w4-03', 'core', ['c14-e-separate', 'c14-e-act'], 5],
  ['w4-04', 'core', ['c09-p-within20', 'c09-p-facts'], 6],
  ['w4-05', 'core', ['c09-p-zeroall', 'c09-p-within20'], 6],
  ['w4-06', 'mini', ['c09-e-numberline', 'c09-p-facts'], 6, { skin: 'lily-hop-ice' }],
  ['w4-07', 'core', ['c14-p-sub', 'c14-p-worksheet'], 6],
  ['w4-08', 'core', ['c09-a-tens', 'c09-a-wholetens'], 6],
  ['w4-09', 'memory', ['c09-e-choose', 'c09-p-facts', 'c14-e-separate', 'c08-p-zero', 'c14-p-worksheet'], 6],
  ['w4-10', 'friend', ['c09-p-within20', 'c09-a-wholetens', 'c14-p-sub', 'c14-p-worksheet'], 8],
  // ---- W5 Hedgehog's Stepping-Stone Trail ----
  ['w5-01', 'core', ['c10-e-after'], 5],
  ['w5-02', 'core', ['c10-e-before'], 5],
  ['w5-03', 'core', ['c10-e-gap', 'c10-e-after'], 5],
  ['w5-04', 'mini', ['c10-e-gap', 'c10-p-forward'], 6, { skin: 'lily-hop-stone' }],
  ['w5-05', 'core', ['c10-p-forward', 'c10-p-beforeafter'], 6],
  ['w5-06', 'core', ['c10-p-backward', 'c10-p-beforeafter'], 6],
  ['w5-07', 'core', ['c01-a-tens', 'c01-a-partial'], 6],
  ['w5-08', 'core', ['c01-a-fives', 'c02-a-boats', 'c02-a-subtotals'], 6],
  ['w5-09', 'core', ['c10-a-multi', 'c10-a-between'], 6],
  ['w5-10', 'core', ['c10-a-skip'], 6],
  ['w5-11', 'friend', ['c10-p-forward', 'c10-p-backward', 'c10-a-multi', 'c01-a-tens'], 8, {
    fallbackTemplates: ['c10-p-forward', 'c10-p-backward', 'c10-a-multi', 'c10-p-beforeafter'],
  }],
  // ---- W6 Owl's Clock Town ----
  ['w6-01', 'core', ['c06-e-name', 'c06-e-find'], 5],
  ['w6-02', 'core', ['c06-e-outline', 'c06-e-find'], 5],
  ['w6-03', 'core', ['c06-p-sides', 'c06-p-corners', 'c06-p-worksheet'], 6],
  ['w6-04', 'core', ['c11-e-order', 'c11-e-count', 'c11-e-next'], 5],
  ['w6-05', 'core', ['c11-p-before', 'c11-p-after', 'c11-p-yesterday'], 6],
  ['w6-06', 'core', ['c12-e-read', 'c12-e-set', 'c12-e-match'], 5],
  ['w6-07', 'core', ['c12-p-half', 'c12-p-quarter', 'c12-p-set'], 6],
  ['w6-08', 'mini', ['c11-e-next', 'c11-p-after', 'c11-p-before'], 6, { skin: 'postman' }],
  ['w6-09', 'core', ['c13-e-weekday', 'c13-e-find', 'c13-e-first'], 5],
  ['w6-10', 'core', ['c13-p-last', 'c13-p-length', 'c13-p-named'], 6],
  ['w6-11', 'core', ['c12-a-five', 'c12-a-setfive'], 6],
  ['w6-12', 'friend', ['c06-p-worksheet', 'c11-p-before', 'c12-p-quarter', 'c13-p-named', 'c12-a-five'], 8],
  // ---- W7 Queen Bee's Hive (apply and extension mix) ----
  ['w7-01', 'core', ['c03-a-compare', 'c03-a-howmanymore', 'c03-a-multi'], 6],
  ['w7-02', 'core', ['c04-a-fit', 'c04-a-shelf', 'c04-a-between'], 6],
  ['w7-03', 'core', ['c05-a-build', 'c05-a-missing', 'c05-a-difference'], 6],
  ['w7-04', 'core', ['c06-a-rotated', 'c06-a-compose', 'c06-a-poly'], 6],
  ['w7-05', 'core', ['c07-a-needed', 'c07-a-leftover', 'c07-a-more'], 6],
  ['w7-06', 'core', ['c02-a-missing', 'c02-a-subtotals'], 6],
  ['w7-07', 'core', ['c08-a-tensones', 'c08-a-decade'], 6, { fallbackTemplates: ['c08-a-decade', 'c08-p-maketen'] }],
  ['w7-08', 'core', ['c11-a-after', 'c11-a-before', 'c11-a-howmany', 'c13-a-elapsed', 'c13-a-inclusive'], 6, {
    fallbackTemplates: ['c11-p-after', 'c11-p-before', 'c13-a-elapsed', 'c13-a-inclusive'],
  }],
  ['w7-09', 'core', ['c14-a-missingstart', 'c14-a-missingchange'], 6],
  ['w7-10', 'core', ['c14-a-twostep'], 5],
  ['w7-11', 'core', ['c12-a-elapsed', 'c13-a-transition'], 6],
  ['w7-12', 'finale', ['c01-a-tens', 'c02-a-missing', 'c08-a-tensones', 'c09-a-tens', 'c10-a-multi', 'c12-a-five', 'c13-a-elapsed', 'c14-a-twostep'], 8, {
    fallbackTemplates: ['c01-p-columns', 'c02-p-table', 'c08-a-decade', 'c09-a-wholetens', 'c10-a-multi', 'c12-a-five', 'c13-p-length', 'c14-p-add'],
  }],
  // ---- Bonus: Secret Honeycomb (gated regrouping) ----
  ['bonus-01', 'bonus', ['c08-a-regroup', 'c08-a-tensones'], 6, { gatedSubskill: 'C08.regroup' }],
  ['bonus-02', 'bonus', ['c09-a-regroup', 'c09-a-tens'], 6, { gatedSubskill: 'C09.regroup' }],
];

export const LEVELS: LevelDef[] = ROWS.map(([id, kind, templates, questions, extra]) => {
  const world = (id.startsWith('bonus') ? 'bonus' : id.slice(0, 2)) as WorldId;
  return { id, world, n: Number(id.split('-')[1]), titleKey: `adv.level.${id}`, kind, templates, questions, ...extra };
});
export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

/** Levels of one world, in path order. */
export function levelsOf(world: WorldId): LevelDef[] {
  return LEVELS.filter((l) => l.world === world);
}

/** The friend (or finale) level that ends a story world. */
export function friendLevelOf(world: WorldId): LevelDef | undefined {
  return levelsOf(world).find((l) => l.kind === 'friend' || l.kind === 'finale');
}

// ---------- derived from the curriculum ----------
/** A template is "extension" when its subskill's curriculum source is extension. */
export function isExtensionTemplate(templateId: string): boolean {
  return SUBSKILL_BY_ID[getTemplate(templateId).subskill]?.source === 'extension';
}

/** Uses at least one extension subskill in its main template list. */
export function usesExtensions(level: LevelDef): boolean {
  return level.templates.some(isExtensionTemplate);
}

/**
 * An "Ext" level: it has extension content and no non-extension fallback. When extensions
 * are hidden it moves to an optional dotted side branch and never blocks the path.
 */
export function isExtLevel(level: LevelDef): boolean {
  return level.kind !== 'bonus' && usesExtensions(level) && !level.fallbackTemplates;
}

/** On a dotted side branch for these settings (optional, never blocks progress). */
export function isSideBranch(level: LevelDef, settings: Pick<Settings, 'showExtensions'>): boolean {
  return !settings.showExtensions && isExtLevel(level);
}

/** The templates actually played: fallbacks replace extension content when extensions are hidden. */
export function levelTemplates(level: LevelDef, settings: Pick<Settings, 'showExtensions'>): string[] {
  if (!settings.showExtensions && level.fallbackTemplates && usesExtensions(level)) return level.fallbackTemplates;
  return level.templates;
}

export function levelSubskills(level: LevelDef, settings: Pick<Settings, 'showExtensions'> = { showExtensions: true }): string[] {
  return [...new Set(levelTemplates(level, settings).map((t) => getTemplate(t).subskill))];
}

export function levelCategories(level: LevelDef, settings: Pick<Settings, 'showExtensions'> = { showExtensions: true }): CategoryId[] {
  return [...new Set(levelTemplates(level, settings).map((t) => getTemplate(t).category))];
}

/** Main-path levels of a world for these settings (side branches excluded). */
export function mainPath(world: WorldId, settings: Pick<Settings, 'showExtensions'>): LevelDef[] {
  return levelsOf(world).filter((l) => !isSideBranch(l, settings));
}

/** Every subskill a world practises (used to scope memory-level reviews). */
export function worldSubskills(world: WorldId, settings: Pick<Settings, 'showExtensions'>): string[] {
  return [...new Set(levelsOf(world).filter((l) => !isSideBranch(l, settings)).flatMap((l) => levelSubskills(l, settings)))];
}

/** Explore-stage subskills of a world ("your bee already knows this path" checks these). */
export function worldExploreSubskills(world: WorldId, settings: Pick<Settings, 'showExtensions'>): string[] {
  return worldSubskills(world, settings).filter((s) => SUBSKILL_BY_ID[s]?.stage === 'explore');
}
