import type { QuestionInstance, Response } from '../engine/types';

export interface SceneProps {
  q: QuestionInstance;
  /** manipulation state (serialisable model data only) */
  work: Record<string, unknown>;
  setWork: (w: Record<string, unknown>) => void;
  response?: Response;
  setResponse: (r: Response) => void;
  /** false for illustrated/plain formats, mocks and after solving */
  interactive: boolean;
  /** 0 = no help; 1..n = hint level; 99 = full worked solution shown in the scene */
  reveal: number;
  /** black-and-white worksheet rendering */
  bw?: boolean;
  onFieldFocus?: (id: string) => void;
}

export const SOLUTION = 99;

export function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
export function num(v: unknown, d = 0): number {
  return typeof v === 'number' ? v : d;
}
export function rec<T>(v: unknown): Record<string, T> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {};
}

/** Field sizing: one row of cells is ROW_PX tall; objects never exceed their cell. */
export const ROW_PX = 74;
export function fieldStyle(cols: number, rows: number) {
  return {
    area: { height: rows * ROW_PX + 68 },
    obj: { width: `min(${Math.round(ROW_PX * 0.92)}px, calc(92% / ${cols}))` },
  };
}
