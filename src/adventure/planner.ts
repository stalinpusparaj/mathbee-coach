import type { Format } from '../engine/types';
import type { Rng } from '../engine/rng';
import { getTemplate } from '../engine/registry';
import type { DateStr, Profile, Slot } from '../learning/types';
import { dueReviews } from '../learning/review';
import { levelTemplates, levelsOf, worldSubskills, type LevelDef } from './levels';

/**
 * Plan one adventure level. Deterministic for a given rng seed (each play uses a fresh seed,
 * so replays are new questions). Formats by kind:
 * - core / bonus: explore levels all interactive; practise/apply levels end with an
 *   illustrated question (transfer evidence); purpose `need`
 * - mini: same maths, interactive, with the level's skin; purpose `need`
 * - memory: this world's due reviews first (purpose `review`), the rest `mixed`; all
 *   unannounced with mixed formats
 * - friend / finale: `mixed`, unannounced, last question plain (worksheet transfer)
 * The planner never emits `follow-up` slots, so scoring can tell planned questions apart.
 */
export function planAdventureLevel(rng: Rng, profile: Pick<Profile, 'settings' | 'reviews'>, level: LevelDef, today: DateStr): Slot[] {
  const templates = levelTemplates(level, profile.settings);
  const n = level.questions;
  if (!templates.length || n <= 0) return [];
  const seed = () => rng.int(1, 2 ** 31 - 1);
  const mk = (templateId: string, format: Format, purpose: Slot['purpose'], extra: Partial<Slot> = {}): Slot => ({
    templateId, seed: seed(), format, purpose, subskill: getTemplate(templateId).subskill, ...extra,
  });
  // round-robin from a random start: with 3+ templates no template repeats within the last 2
  const start = rng.int(0, templates.length - 1);
  const pick = (i: number) => templates[(start + i) % templates.length];

  switch (level.kind) {
    case 'core':
    case 'bonus': {
      const explore = templates.every((t) => getTemplate(t).stage === 'explore');
      return Array.from({ length: n }, (_, i) => mk(pick(i), !explore && i === n - 1 ? 'illustrated' : 'interactive', 'need'));
    }
    case 'mini':
      return Array.from({ length: n }, (_, i) => mk(pick(i), 'interactive', 'need', level.skin ? { skin: level.skin } : {}));
    case 'friend':
    case 'finale':
      return Array.from({ length: n }, (_, i) => mk(pick(i), i === n - 1 ? 'plain' : 'interactive', 'mixed', { unannounced: true }));
    case 'memory': {
      const scope = worldSubskills(level.world, profile.settings);
      const due = dueReviews(profile.reviews, today).filter((s) => scope.includes(s));
      // reviews come first but leave room for mixed questions (at most half the level)
      const reviews = due.slice(0, Math.ceil(n / 2));
      const worldTemplates = [...new Set(levelsOf(level.world).flatMap((l) => levelTemplates(l, profile.settings)))];
      const reviewSlots = reviews.map((sub) => {
        const own = templates.filter((t) => getTemplate(t).subskill === sub);
        const pool = own.length ? own : worldTemplates.filter((t) => getTemplate(t).subskill === sub);
        return mk(rng.pick(pool), rng.bool(0.5) ? 'illustrated' : 'interactive', 'review', { unannounced: true });
      });
      const mixed = Array.from({ length: n - reviewSlots.length }, (_, i) =>
        mk(pick(i), rng.pick(['plain', 'illustrated', 'interactive'] as Format[]), 'mixed', { unannounced: true }));
      return rng.shuffle([...reviewSlots, ...mixed]);
    }
  }
}
