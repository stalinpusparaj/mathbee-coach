import type { ActiveSession, DateStr, Profile, SessionRecord } from './types';
import { themeFor, type JourneyTheme } from '../activities/journey';
import { levelFor, lifetimeNectar } from './gamification';
import { LEVEL_BY_ID, WORLD_BY_ID } from '../adventure/levels';

/**
 * Things to look forward to: buzz combos, daily quests, a daily surprise gift, friends met on
 * journeys and hats for the bee. Everything is earned by effort and only ever grows — nothing
 * is lost for missing a day, nothing rewards speed, and play is never endless (a gentle
 * "time to rest" appears after a few sessions in a day).
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ---------- buzz combo (inside one session) ----------
/** Questions answered right on the first check, in a row, ending at the current question. */
export function comboAt(s: Pick<ActiveSession, 'index' | 'slots'>): number {
  let n = 0;
  for (let i = s.index; i >= 0; i--) {
    const st = s.slots[i];
    if (i === s.index && !st?.solved) continue; // current question still open: count those before it
    if (st?.firstResult === true && !st.skipped) n++;
    else break;
  }
  return n;
}

/** Combo sizes that earn an extra-big celebration. */
export const COMBO_MILESTONES = [3, 5, 8, 12];

// ---------- daily quests ----------
export type QuestKind = 'journey' | 'solve5' | 'places2' | 'firstTry3' | 'lesson' | 'hintHelp' | 'worksheet3' | 'solve10' | 'stars2';
export interface Quest { kind: QuestKind; need: number; have: number; done: boolean }

const QUEST_POOL: { kind: QuestKind; need: number }[] = [
  { kind: 'solve5', need: 5 },
  { kind: 'places2', need: 2 },
  { kind: 'firstTry3', need: 3 },
  { kind: 'lesson', need: 1 },
  { kind: 'hintHelp', need: 1 },
  { kind: 'worksheet3', need: 3 },
  { kind: 'solve10', need: 10 },
];
/** Adventure quest: make two levels bloom (finish two adventure levels — any number of stars). */
const ADVENTURE_QUEST = { kind: 'stars2' as const, need: 2 };

/**
 * The adventure quest joins the pool only for a child who has adventure progress and played
 * an adventure level on an earlier day — so the rotation of any past day, and of today,
 * never changes under the child, and profiles without adventure keep today's rotation.
 */
function adventureQuestOn(p: Pick<Profile, 'sessions' | 'adventure'>, date: DateStr): boolean {
  return !!p.adventure && p.sessions.some((s) => s.mode === 'adventure' && s.date < date);
}

/** Three quests a day: always one journey, plus two others chosen by the date. */
export function questsFor(p: Pick<Profile, 'id' | 'attempts' | 'sessions'> & Partial<Pick<Profile, 'adventure'>>, date: DateStr): Quest[] {
  const pool = adventureQuestOn(p, date) ? [...QUEST_POOL, ADVENTURE_QUEST] : QUEST_POOL;
  const h = hash(`${p.id}|${date}`);
  const a = h % pool.length;
  let b = (h >>> 8) % pool.length;
  // never two quests of the same sort (e.g. "5 right" and "10 right" together)
  const family = (i: number) => (pool[i].kind.startsWith('solve') ? 'solve' : pool[i].kind);
  while (family(b) === family(a)) b = (b + 1) % pool.length;
  const picks = [{ kind: 'journey' as const, need: 1 }, pool[a], pool[b]];
  const today = p.attempts.filter((x) => x.date === date && !x.skipped && x.mode !== 'mock');
  const sessions = p.sessions.filter((s) => s.date === date);
  const count = (k: QuestKind): number => {
    switch (k) {
      case 'journey': return sessions.filter((s) => s.completed && s.questions > 0).length;
      case 'solve5': case 'solve10': return today.filter((x) => x.finalCorrect).length;
      case 'places2': return new Set(today.map((x) => x.category)).size;
      case 'firstTry3': return today.filter((x) => x.firstCorrect).length;
      case 'lesson': return sessions.filter((s) => s.mode === 'lesson' && s.completed).length;
      case 'hintHelp': return today.filter((x) => x.hints > 0 && x.finalCorrect).length;
      case 'worksheet3': return today.filter((x) => x.format === 'plain' && x.finalCorrect).length;
      case 'stars2': return sessions.filter((s) => s.mode === 'adventure' && s.completed && s.questions > 0).length;
    }
  };
  return picks.map((q) => {
    const have = Math.min(q.need, count(q.kind));
    return { kind: q.kind, need: q.need, have, done: have >= q.need };
  });
}

/** Days on which all three quests were finished — each one is a golden sunflower. */
export function goldenDays(p: Pick<Profile, 'id' | 'attempts' | 'sessions'> & Partial<Pick<Profile, 'adventure'>>): DateStr[] {
  const dates = [...new Set(p.sessions.map((s) => s.date))].sort();
  return dates.filter((d) => questsFor(p, d).every((q) => q.done));
}

// ---------- daily surprise gift ----------
export const TREASURES = [
  '🐚', '💎', '🍄', '🌰', '🪶', '🦋', '🐞', '🌈', '⭐', '🌙', '🍓', '🍒',
  '🫐', '🎈', '🪁', '🧸', '🔮', '🎨', '🧩', '🪀', '🍭', '🌻', '🐢', '🦄',
] as const;

/** A gift is waiting once a journey has been finished today and today's gift is unopened. */
export function giftWaiting(p: Pick<Profile, 'sessions' | 'treasures'>, date: DateStr): boolean {
  const opened = (p.treasures ?? []).some((t) => t.date === date);
  return !opened && p.sessions.some((s) => s.date === date && s.completed && s.questions > 0);
}

/** Today's treasure (same answer however many times it is asked). */
export function treasureFor(profileId: string, date: DateStr): string {
  return TREASURES[hash(`gift|${profileId}|${date}`) % TREASURES.length];
}

/** Open today's gift: idempotent, one per day. */
export function openGift(p: Profile, date: DateStr): Profile {
  if (!giftWaiting(p, date)) return p;
  return { ...p, treasures: [...(p.treasures ?? []), { date, id: treasureFor(p.id, date) }] };
}

export function treasureCounts(p: Pick<Profile, 'treasures'>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of p.treasures ?? []) out[t.id] = (out[t.id] ?? 0) + 1;
  return out;
}

// ---------- friends met on journeys ----------
export const FRIEND_ORDER: JourneyTheme[] = ['meadow', 'river', 'orchard', 'ice', 'trail', 'town', 'garden'];

/** The friend an adventure run meets: only a finished friend or finale level counts. */
function adventureFriend(s: SessionRecord): JourneyTheme | null {
  const level = s.levelId ? LEVEL_BY_ID[s.levelId] : undefined;
  return level && (level.kind === 'friend' || level.kind === 'finale') ? WORLD_BY_ID[level.world].theme : null;
}

/**
 * A friend is met by finishing a journey in their world (practice and other modes), or by
 * finishing that world's friend level in Adventure. Adventure core levels never count, so
 * a meadow level about pot sizes does not meet the town's owl.
 */
export function friendsMet(p: Pick<Profile, 'sessions'>): JourneyTheme[] {
  const met = new Set<JourneyTheme>();
  for (const s of p.sessions) {
    if (!s.completed || s.questions === 0) continue;
    if (s.mode === 'adventure') {
      const f = adventureFriend(s);
      if (f) met.add(f);
    } else if (s.categories.length > 0) met.add(themeFor(s.categories));
  }
  return FRIEND_ORDER.filter((f) => met.has(f));
}

// ---------- bee hats ----------
/** One new hat per garden level (level 1 = no hat). */
export const HATS = ['🎀', '🌸', '🧢', '🎩', '👒', '🕶️', '🎓', '⛑️', '👑'] as const;

export function hatsUnlocked(p: Pick<Profile, 'nectar' | 'garden'>): string[] {
  return HATS.slice(0, levelFor(lifetimeNectar(p)).index);
}

/** The hat the bee is wearing (only if still unlocked). */
export function currentHat(p: Pick<Profile, 'nectar' | 'garden' | 'beeHat'>): string | null {
  return p.beeHat && hatsUnlocked(p).includes(p.beeHat) ? p.beeHat : null;
}

// ---------- healthy limits ----------
/** After this many finished journeys in a day, the results screen suggests a rest. */
export const REST_AFTER = 3;

/** A single run counts for at most this long toward the daily limit (a forgotten open tab is not play). */
const MAX_RUN_MS = 30 * 60_000;

/** Minutes played today, from finished and stopped runs. */
export function minutesPlayed(p: Pick<Profile, 'sessions'>, date: DateStr): number {
  const ms = p.sessions.filter((s) => s.date === date).reduce((sum, s) => sum + Math.min(MAX_RUN_MS, Math.max(0, s.endedAt - s.startedAt)), 0);
  return ms / 60_000;
}

/**
 * The parent's daily limit is reached. Checked only between runs (before a level or a
 * session starts, or on a results screen) — it never cuts a level off mid-way.
 */
export function sessionEndDue(p: Pick<Profile, 'sessions'> & { settings?: Pick<Profile['settings'], 'dailyLimitMin'> }, date: DateStr): boolean {
  const limit = p.settings?.dailyLimitMin ?? 0;
  return limit > 0 && minutesPlayed(p, date) >= limit;
}

/**
 * One rest system: without a daily limit, a rest is suggested after a few finished runs;
 * when the parent sets a limit, the limit replaces that rule.
 */
export function suggestRest(p: Pick<Profile, 'sessions'> & { settings?: Pick<Profile['settings'], 'dailyLimitMin'> }, date: DateStr): boolean {
  if ((p.settings?.dailyLimitMin ?? 0) > 0) return sessionEndDue(p, date);
  return p.sessions.filter((s) => s.date === date && s.completed).length >= REST_AFTER;
}
