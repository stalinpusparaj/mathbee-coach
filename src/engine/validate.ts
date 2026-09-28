import type { QuestionInstance } from './types';
import { minSeparation } from './layout';
import { monthGrid, daysInMonth, pairsOf, sequence } from './math';

/**
 * Constraint checks applied to every generated question before it is shown.
 * Returns a list of problems (empty = valid).
 */
export function validateQuestion(q: QuestionInstance): string[] {
  const errs: string[] = [];
  const a = q.answer;
  const isInt = (n: number) => Number.isInteger(n) && n >= 0;

  switch (a.kind) {
    case 'number':
      if (!isInt(a.value)) errs.push(`answer not a non-negative integer: ${a.value}`);
      if (a.max !== undefined && a.value > a.max) errs.push('answer above keypad max');
      break;
    case 'choice': {
      const ids = a.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) errs.push('duplicate option ids');
      if (ids.filter((i) => i === a.value).length !== 1) errs.push('correct option must appear exactly once');
      if (a.options.length < 2) errs.push('too few options');
      const labels = a.options.map((o) => JSON.stringify(o.label));
      if (new Set(labels).size !== labels.length) errs.push('duplicate option labels');
      break;
    }
    case 'order': {
      const ids = a.items.map((i) => i.id).sort();
      const vals = [...a.value].sort();
      if (ids.join() !== vals.join()) errs.push('order answer is not a permutation of items');
      break;
    }
    case 'fields':
      if (a.fields.length === 0) errs.push('no fields');
      a.fields.forEach((f) => { if (!isInt(f.value)) errs.push(`field ${f.id} invalid`); });
      if (new Set(a.fields.map((f) => f.id)).size !== a.fields.length) errs.push('duplicate field ids');
      break;
    case 'time':
      if (a.h < 1 || a.h > 12 || a.m < 0 || a.m > 59 || !Number.isInteger(a.m)) errs.push('bad time');
      break;
  }

  const s = q.scene;
  const uniqueIds = (ids: string[]) => { if (new Set(ids).size !== ids.length) errs.push('duplicate object ids'); };
  switch (s.type) {
    case 'count': {
      uniqueIds(s.objects.map((o) => o.id));
      if (!s.groups && s.objects.length > 1 && minSeparation(s.objects) < 8) errs.push('objects too close / overlapping');
      if (s.groups) {
        const total = s.groups.reduce((t, g) => t + g.filled, 0);
        if (total !== s.objects.length) errs.push('group totals disagree with objects');
        if (s.groups.some((g) => g.filled > g.size || g.filled < 1)) errs.push('group overfilled or empty');
      }
      const expected = a.kind === 'number' ? a.value : a.kind === 'choice' ? Number(a.value.slice(1)) : null;
      if (expected !== null && expected !== s.objects.length) errs.push('count answer disagrees with objects');
      break;
    }
    case 'ferry':
      uniqueIds(s.animals.map((o) => o.id));
      if (s.animals.length > 1 && minSeparation(s.animals) < 8) errs.push('animals overlap');
      break;
    case 'birds':
      uniqueIds(s.birds.map((o) => o.id));
      if (s.birds.length > 1 && minSeparation(s.birds) < 8) errs.push('birds overlap');
      if (a.kind === 'fields') {
        a.fields.forEach((f) => {
          const c = s.birds.filter((b) => b.kind === f.id).length;
          if (c !== f.value) errs.push(`bird count mismatch for ${f.id}`);
        });
      }
      break;
    case 'sizes': {
      const sz = s.items.map((i) => i.size);
      if (new Set(sz).size !== sz.length) errs.push('two items have the same size');
      break;
    }
    case 'lengths': {
      const u = s.planks.map((p) => p.units);
      if (new Set(u).size !== u.length) errs.push('two planks have the same length');
      if (s.planks.some((p) => p.units < 1)) errs.push('empty plank');
      if (s.gap !== undefined && (s.placed ?? 0) >= s.gap) errs.push('gap already filled');
      break;
    }
    case 'pairs':
      uniqueIds(s.flowers.map((o) => o.id));
      if (s.flowers.length > 1 && minSeparation(s.flowers) < 8) errs.push('flowers overlap');
      if (a.kind === 'fields' && s.flowers.length) {
        const { pairs, leftover } = pairsOf(s.flowers.length);
        const f = Object.fromEntries(a.fields.map((x) => [x.id, x.value]));
        if (f.pairs !== pairs || f.left !== leftover) errs.push('pairs answer mismatch');
      }
      break;
    case 'add':
      if (!isInt(s.a) || !isInt(s.b) || s.a + s.b > 100) errs.push('addition out of range');
      break;
    case 'subtract':
      if (!isInt(s.start) || !isInt(s.remove) || s.remove > s.start) errs.push('subtraction would be negative');
      break;
    case 'trail': {
      const known = s.stones.map((v, i) => [v, i] as const).filter(([v]) => v !== null) as [number, number][];
      if (known.length < 2 && s.stones.length > 2) errs.push('trail rule underdetermined');
      if (known.length >= 1) {
        const [v0, i0] = known[0];
        const start = v0 - (s.rule.dir === 'forward' ? 1 : -1) * s.rule.step * i0;
        const full = sequence(start, s.rule.step, s.rule.dir, s.stones.length);
        known.forEach(([v, i]) => { if (full[i] !== v) errs.push('trail inconsistent with stated rule'); });
        if (full.some((v) => v < 0 || v > 100)) errs.push('trail out of 0–100');
        const gapsValues = s.stones.map((v, i) => (v === null ? full[i] : null)).filter((v) => v !== null);
        const expected = a.kind === 'number' ? [a.value] : a.kind === 'fields' ? a.fields.map((f) => f.value) : [];
        if (expected.join() !== gapsValues.join()) errs.push('trail answer does not match rule');
      }
      break;
    }
    case 'clock':
      if (s.h < 1 || s.h > 12 || s.m % 1 !== 0 || s.m < 0 || s.m > 59) errs.push('bad clock');
      break;
    case 'calendar': {
      if (s.month < 1 || s.month > 12) errs.push('bad month');
      const len = daysInMonth(s.year, s.month);
      (s.marks ?? []).forEach((d) => { if (d < 1 || d > len) errs.push('mark outside month'); });
      if (s.range && (s.range[0] < 1 || s.range[1] > len || s.range[0] > s.range[1])) errs.push('bad range');
      if (monthGrid(s.year, s.month).flat().filter((d) => d !== null).length !== len) errs.push('grid mismatch');
      break;
    }
    case 'story':
      if (s.op === '-' && s.change > s.start) errs.push('story would be negative');
      break;
    default:
      break;
  }
  return errs;
}
