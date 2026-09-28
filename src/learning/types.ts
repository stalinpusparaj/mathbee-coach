import type { CategoryId, ErrorTag, Format, Mode, Purpose, Response, Stage } from '../engine/types';

export type DateStr = string; // YYYY-MM-DD (local calendar date, compared as strings)

/** One question the child finished (or skipped). One attempt per question: retries live inside it. */
export interface Attempt {
  id: string;
  sessionId: string;
  slot: number;
  date: DateStr;
  ts: number;
  templateId: string;
  seed: number;
  category: CategoryId;
  stage: Stage;
  subskill: string;
  format: Format;
  mode: Mode;
  purpose: Purpose;
  /** lesson phase if any */
  phase?: LessonPhase;
  /** no mathematical hint before the first check and not a worked/guided lesson step */
  independent: boolean;
  firstCorrect: boolean;
  finalCorrect: boolean;
  retries: number;
  hints: number;
  sawSolution: boolean;
  skipped: boolean;
  /** active response time (narration, animation, pauses and hidden tabs excluded) */
  activeMs: number;
  interruptions: number;
  errorTag?: ErrorTag;
  /** first wrong response, kept small for parent evidence */
  firstResponse?: Response;
  /** operation / category not announced (mixed session, mock, worksheet) */
  unannounced: boolean;
}

export type LessonPhase = 'worked' | 'guided' | 'faded' | 'independent' | 'transfer';

export type SkillState =
  | 'not-assessed'
  | 'more-evidence'
  | 'learning-supported'
  | 'practising-independently'
  | 'retained'
  | 'applying';

export interface ReviewRecord {
  stage: number; // index into review intervals
  due: DateStr;
  history: { date: DateStr; pass: boolean }[];
}

export interface Slot {
  templateId: string;
  seed: number;
  format: Format;
  purpose: Purpose;
  subskill: string;
  phase?: LessonPhase;
  /** hide the category/operation name (mixed practice) */
  unannounced?: boolean;
}

export interface SlotState {
  response?: Response;
  /** activity manipulation state (marks, moved objects, placed blocks…) — model data only */
  work: Record<string, unknown>;
  checks: number;
  hints: number;
  hintsBeforeFirstCheck: number;
  firstResult?: boolean;
  firstResponse?: Response;
  firstErrorTag?: string;
  solved: boolean;
  sawSolution: boolean;
  skipped: boolean;
  done: boolean;
  activeMs: number;
  interruptions: number;
}

export interface ActiveSession {
  id: string;
  mode: Mode;
  category?: CategoryId;
  subskill?: string;
  startedAt: number;
  plan: Slot[];
  index: number;
  slots: Record<number, SlotState>;
  /** consecutive first-attempt errors per subskill (for prerequisite offers) */
  errorStreak: Record<string, number>;
  finished: boolean;
}

export interface SessionRecord {
  id: string;
  mode: Mode;
  date: DateStr;
  startedAt: number;
  endedAt: number;
  questions: number;
  independentCorrect: number;
  supportedCompleted: number;
  nectar: number;
  categories: CategoryId[];
  completed: boolean;
}

export interface MockConfig {
  kind: 'generic' | 'official';
  questionCount: number;
  durationMin: number | null;
  navigation: 'free' | 'forward';
  categories: CategoryId[];
  marksPerQuestion: number;
}

export interface MockState {
  id: string;
  config: MockConfig;
  questions: { templateId: string; seed: number; format: Format }[];
  answers: Record<number, Response>;
  current: number;
  startedAt: number;
  activeMs: number;
  submitted: boolean;
}

export interface MockResult {
  id: string;
  kind: 'generic' | 'official';
  date: DateStr;
  total: number;
  correct: number;
  marks: number;
  maxMarks: number;
  activeMs: number;
  byCategory: Partial<Record<CategoryId, { total: number; correct: number }>>;
  items: { templateId: string; seed: number; format: Format; correct: boolean; answered: boolean }[];
}

export interface Settings {
  sound: boolean;
  narration: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  /** 3D garden and journey: auto = when the device supports it and motion is not reduced */
  graphics: 'auto' | '3d' | '2d';
  sessionMinutes: number;
  mastery: { window: number; correct: number; minSessions: number; minTemplates: number };
  reviewIntervals: number[];
  unlockRegrouping: boolean;
  showExtensions: boolean;
}

export interface Competition {
  name: string;
  date: DateStr | '';
  examLanguage: 'en' | 'ta' | '';
  rulesConfirmed: boolean;
  durationMin: number | null;
  questionCount: number | null;
  scoring: string;
  marksPerQuestion: number | null;
  navigation: 'free' | 'forward';
}

export interface Profile {
  id: string;
  avatar: string;
  nickname: string;
  grade: number;
  language: 'en' | 'ta';
  createdAt: DateStr;
  familiarised: boolean;
  settings: Settings;
  competition: Competition;
  attempts: Attempt[];
  reviews: Record<string, ReviewRecord>;
  sessions: SessionRecord[];
  nectar: number;
  /** slot keys (`sessionId#slot`) already rewarded — prevents duplicate nectar */
  awarded: string[];
  garden: string[];
  /** stickers already announced to the child, and the last garden level shown */
  stickersSeen: string[];
  levelSeen: number;
  screened: CategoryId[];
  activeSession: ActiveSession | null;
  activeMock: MockState | null;
  mockHistory: MockResult[];
}

export interface AppState {
  schemaVersion: number;
  profiles: Profile[];
  activeProfileId: string | null;
  /** background music on/off for this device (works before any profile exists) */
  music: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  narration: true,
  reducedMotion: 'system',
  graphics: 'auto',
  sessionMinutes: 10,
  mastery: { window: 10, correct: 8, minSessions: 2, minTemplates: 2 },
  reviewIntervals: [1, 3, 7, 14],
  unlockRegrouping: false,
  showExtensions: true,
};

export const DEFAULT_COMPETITION: Competition = {
  name: '',
  date: '',
  examLanguage: '',
  rulesConfirmed: false,
  durationMin: null,
  questionCount: null,
  scoring: '',
  marksPerQuestion: null,
  navigation: 'free',
};
