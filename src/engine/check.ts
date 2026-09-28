import type { AnswerSpec, Response } from './types';

/** Pure answer checking. Returns true only for a complete, exactly correct response. */
export function checkAnswer(answer: AnswerSpec, r: Response): boolean {
  switch (answer.kind) {
    case 'number':
      return r.kind === 'number' && r.value !== null && r.value === answer.value;
    case 'choice':
      return r.kind === 'choice' && r.value === answer.value;
    case 'order':
      return r.kind === 'order' && r.value.length === answer.value.length && r.value.every((v, i) => v === answer.value[i]);
    case 'fields':
      return r.kind === 'fields' && answer.fields.every((f) => r.values[f.id] === f.value);
    case 'time':
      return r.kind === 'time' && r.h === answer.h && r.m === answer.m;
  }
}

/** Whether the child has given a complete response (Check is disabled until then). */
export function isComplete(answer: AnswerSpec, r: Response | undefined): boolean {
  if (!r || r.kind !== answer.kind) return false;
  switch (r.kind) {
    case 'number':
      return r.value !== null && Number.isFinite(r.value);
    case 'choice':
      return !!r.value;
    case 'order':
      return answer.kind === 'order' && r.value.length === answer.items.length;
    case 'fields':
      return answer.kind === 'fields' && answer.fields.every((f) => typeof r.values[f.id] === 'number');
    case 'time':
      return true;
  }
}

export function emptyResponse(answer: AnswerSpec, sceneStart?: { h: number; m: number }): Response {
  switch (answer.kind) {
    case 'number':
      return { kind: 'number', value: null };
    case 'choice':
      return { kind: 'choice', value: null };
    case 'order':
      return { kind: 'order', value: [] };
    case 'fields':
      return { kind: 'fields', values: Object.fromEntries(answer.fields.map((f) => [f.id, null])) };
    case 'time':
      return { kind: 'time', h: sceneStart?.h ?? 12, m: sceneStart?.m ?? 0 };
  }
}
