import type { ActiveSession, DateStr, Profile } from './types';
import { themeFor, type JourneyTheme } from '../activities/journey';
import { levelFor, lifetimeNectar } from './gamification';

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
export type QuestKind = 'journey' | 'solve5' | 'places2' | 'firstTry3' | 'lesson' | 'hintHelp' | 'worksheet3' | 'solve10';
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

/** Three quests a day: always one journey, plus two others chosen by the date. */
export function questsFor(p: Pick<Profile, 'id' | 'attempts' | 'sessions'>, date: DateStr): Quest[] {
  const h = hash(`${p.id}|${date}`);
  const a = h % QUEST_POOL.length;
  let b = (h >>> 8) % QUEST_POOL.length;
  // never two quests of the same sort (e.g. "5 right" and "10 right" together)
  const family = (i: number) => (QUEST_POOL[i].kind.startsWith('solve') ? 'solve' : QUEST_POOL[i].kind);
  while (family(b) === family(a)) b = (b + 1) % QUEST_POOL.length;
  const picks = [{ kind: 'journey' as const, need: 1 }, QUEST_POOL[a], QUEST_POOL[b]];
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
    }
  };
  return picks.map((q) => {
    const have = Math.min(q.need, count(q.kind));
    return { kind: q.kind, need: q.need, have, done: have >= q.need };
  });
}

/** Days on which all three quests were finished — each one is a golden sunflower. */
export function goldenDays(p: Pick<Profile, 'id' | 'attempts' | 'sessions'>): DateStr[] {
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

/** A friend is met by finishing a journey in their world. */
export function friendsMet(p: Pick<Profile, 'sessions'>): JourneyTheme[] {
  const met = new Set(p.sessions.filter((s) => s.completed && s.questions > 0 && s.categories.length > 0).map((s) => themeFor(s.categories)));
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

export function suggestRest(p: Pick<Profile, 'sessions'>, date: DateStr): boolean {
  return p.sessions.filter((s) => s.date === date && s.completed).length >= REST_AFTER;
}
