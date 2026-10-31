import type { Msg } from '../engine/types';
import type { JourneyTheme } from '../activities/journey';

/**
 * Bee Flight (CONTRACT): a short 3D lane-runner mini-game. Buzzy flies along a world path and
 * steers through one of three answer gates. Ported from the "Fly & Train" prototype and
 * re-themed to the garden; see docs/FLIGHT_PLAN.md. Pure data — no three.js here.
 */
export type FlightWorld = JourneyTheme; // meadow | river | orchard | ice | trail | town | garden

export type FlightSkill =
  | 'count' | 'next' | 'before' | 'compare' // meadow / river
  | 'add' | 'make10' | 'doubles' // orchard
  | 'sub' // ice
  | 'skip' | 'pattern' // trail
  | 'shape2d' | 'shape3d' | 'clock' | 'day'; // town

export type ShapeId = 'triangle' | 'square' | 'rectangle' | 'circle' | 'pentagon' | 'hexagon' | 'cube' | 'sphere' | 'cone' | 'cylinder';

/** What a gate (or a prompt picture) shows. Drawn from data, never from generated art. */
export type GateVisual =
  | { kind: 'number'; n: number }
  | { kind: 'emoji'; e: string }
  | { kind: 'shape'; shape: ShapeId }
  | { kind: 'clock'; h: number; m: 0 | 30 }
  | { kind: 'day'; day: number } // 0 = Sunday … 6 = Saturday (label from i18n day.N)
  | { kind: 'group'; e: string; n: number } // n copies of an emoji, to count
  | { kind: 'blank' }; // the empty spot in a prompt picture ("? " on a number line or a week strip); never a gate

export interface FlightChoice { id: string; visual: GateVisual; correct: boolean }

export interface FlightQuestion {
  id: string; // stable: `${world}:${seed}:${index}`
  world: FlightWorld;
  skill: FlightSkill;
  prompt: Msg; // spoken and shown in the HUD; must not reveal the answer
  picture?: GateVisual[]; // shown above the path (things to count, the pattern so far, the clock…)
  choices: [FlightChoice, FlightChoice, FlightChoice]; // exactly one correct, all visually distinct
  help: Msg; // "Let's look with Buzzy" tip after a wrong gate (never says "wrong")
}

/** One finite run: 8 gates, then the world's friend waits at the finish. */
export const GATES_PER_RUN = 8;

export interface FlightRunResult {
  world: FlightWorld;
  date: string;
  gates: number;
  firstTry: number; // gates flown through right on the first choice
  helped: number; // gates solved after "Let's look with Buzzy"
}
