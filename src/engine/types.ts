/** Core typed models shared by generators, checking, learning logic and UI. */

export type CategoryId =
  | 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06' | 'C07'
  | 'C08' | 'C09' | 'C10' | 'C11' | 'C12' | 'C13' | 'C14';

export type Stage = 'explore' | 'practise' | 'apply';
export const STAGES: Stage[] = ['explore', 'practise', 'apply'];

/** A: interactive scene, B: simple illustrated, C: plain worksheet text. */
export type Format = 'interactive' | 'illustrated' | 'plain';

/** Localisable message: key into the string table plus parameters. */
export interface Msg {
  k: string;
  p?: Record<string, string | number | Msg>;
}
export const msg = (k: string, p?: Msg['p']): Msg => (p ? { k, p } : { k });
/** "a, b and c" — the joining words come from the active language. */
export const joinMsgs = (parts: Msg[]): Msg => ({ k: 'join', p: Object.fromEntries(parts.map((m, i) => [`i${i}`, m])) });

export interface ChoiceOption {
  id: string;
  label: Msg;
  /** optional visual for the option (sprite id, shape, etc.) */
  visual?: Visual;
}

export type Visual =
  | { type: 'sprite'; id: string; scale?: number }
  | { type: 'bird'; species: BirdSpecies }
  | { type: 'shape'; shape: ShapeKind; rotation?: number; w?: number; h?: number }
  | { type: 'clock'; h: number; m: number }
  | { type: 'text'; text: string };

export type AnswerSpec =
  | { kind: 'number'; value: number; min?: number; max?: number }
  | { kind: 'choice'; options: ChoiceOption[]; value: string }
  | { kind: 'order'; items: ChoiceOption[]; value: string[] }
  | { kind: 'fields'; fields: { id: string; label: Msg; value: number; visual?: Visual }[] }
  | { kind: 'time'; h: number; m: number };

export type Response =
  | { kind: 'number'; value: number | null }
  | { kind: 'choice'; value: string | null }
  | { kind: 'order'; value: string[] }
  | { kind: 'fields'; values: Record<string, number | null> }
  | { kind: 'time'; h: number; m: number };

export type BirdSpecies = 'owl' | 'swan' | 'parrot' | 'ostrich' | 'rooster' | 'crow' | 'penguin';
export type ShapeKind = 'circle' | 'triangle' | 'square' | 'rectangle' | 'pentagon' | 'hexagon';

export interface SceneObject {
  id: string;
  /** sprite id or bird species or animal id */
  kind: string;
  /** position in percent of play field */
  x: number;
  y: number;
  /** optional group membership (ten-frame, boat, basket) */
  group?: string;
  scale?: number;
}

/** Scene descriptions. Rendering reads these; answers never come from rendering. */
export type Scene =
  | { type: 'count'; objects: SceneObject[]; layout: 'row' | 'grid' | 'scatter' | 'dice' | 'columns';
      groups?: { id: string; size: number; filled: number }[]; container?: string; worksheetIcon?: string }
  | { type: 'ferry'; animals: SceneObject[]; types: string[]; grouped?: { type: string; boats: number; loose: number }[];
      subtotals?: { type: string; count: number }[] }
  | { type: 'birds'; birds: SceneObject[]; target?: BirdSpecies[]; habitats: BirdSpecies[] }
  | { type: 'sizes'; items: { id: string; size: number }[]; sprite: string; constraint?: { kind: 'min-width' | 'max-height'; value: number };
      measured?: boolean }
  | { type: 'lengths'; planks: { id: string; units: number }[]; gap?: number; placed?: number; unitBlocks?: boolean; arrows?: boolean }
  | { type: 'shapes'; shapes: { id: string; shape: ShapeKind; rotation: number; w: number; h: number }[]; mode: 'sides' | 'corners' | 'pick' | 'name' | 'compose' | 'outline';
      composeTarget?: ShapeKind }
  | { type: 'pairs'; flowers: SceneObject[]; orderPairs?: number }
  | { type: 'add'; a: number; b: number; item: string; representation: 'objects' | 'tenframe' | 'baseten' | 'numberline' }
  | { type: 'subtract'; start: number; remove: number; representation: 'objects' | 'baseten' | 'numberline' }
  | { type: 'trail'; stones: (number | null)[]; rule: { step: number; dir: 'forward' | 'backward' }; gapIds: string[] }
  | { type: 'week'; start?: number; offset?: number; direction?: 'after' | 'before'; highlight?: number[]; cards?: boolean }
  | { type: 'clock'; h: number; m: number; mode: 'read' | 'set' | 'digital'; startH?: number; startM?: number; elapsed?: number }
  | { type: 'calendar'; year: number; month: number; marks?: number[]; range?: [number, number]; showNextMonth?: boolean }
  | { type: 'story'; item: string; start: number; change: number; op: '+' | '-'; steps?: { change: number; op: '+' | '-' }[]; unknown: 'result' | 'start' | 'change' };

export interface QuestionInstance {
  /** stable id: template + seed + format */
  id: string;
  seed: number;
  category: CategoryId;
  stage: Stage;
  templateId: string;
  subskill: string;
  format: Format;
  extension: boolean;
  prompt: Msg;
  /** plain worksheet wording; defaults to prompt */
  plain?: Msg;
  scene: Scene;
  answer: AnswerSpec;
  hints: Msg[];
  /** explanation of the worked solution for this exact question */
  explain: Msg;
  /** narration text for the story; replay is not a hint */
  narration?: Msg;
  /** plain worksheet format still shows a black-and-white picture (e.g. counting) */
  plainPicture?: boolean;
}

export type ErrorTag =
  | 'off-by-one'
  | 'double-count'
  | 'skipped-object'
  | 'flowers-not-pairs'
  | 'pairs-leftover-missed'
  | 'wrong-operation'
  | 'counted-all-not-target'
  | 'bird-vocabulary'
  | 'reversed-order'
  | 'size-length-confusion'
  | 'circle-sides'
  | 'sides-corners-confusion'
  | 'ones-tens-mixed'
  | 'regroup-missed'
  | 'sequence-direction'
  | 'week-wrap'
  | 'week-offset-inclusive'
  | 'hour-minute-swap'
  | 'hour-hand-position'
  | 'minute-as-number'
  | 'elapsed-vs-inclusive'
  | 'weekday-column'
  | 'month-length'
  | 'intermediate-step'
  | 'no-answer'
  | 'other';

export type Purpose = 'assess' | 'follow-up' | 'need' | 'review' | 'mixed' | 'new' | 'lesson' | 'fluency' | 'worksheet' | 'mock';
export type Mode = 'assessment' | 'lesson' | 'practice' | 'daily' | 'review' | 'worksheet' | 'test' | 'mock' | 'fluency';
