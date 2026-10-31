import { describe, it, expect, vi } from 'vitest';
import {
  ANSWER_RANGE, DAY_KEYS, EMOJI, FLIGHT_WORLDS, SHAPES_2D, SHAPES_3D, SIDES, SKILLS_BY_WORLD,
  correctLane, flightQuestion, flightRun, flightSkill, gateAria, pictureAria, visualKey, visualLabel,
} from '../../src/flight/questions';
import { GATES_PER_RUN, type FlightQuestion, type GateVisual } from '../../src/flight/types';
import { hasKey, keysOf, t } from '../../src/i18n/i18n';
import { EN as FLIGHT_EN, TA as FLIGHT_TA } from '../../src/i18n/packs/flight';

const SEEDS = 1200;
// thousands of generated runs per test: generous time so a busy machine does not time them out
vi.setConfig({ testTimeout: 60_000 });
const LANGS = ['en', 'ta'] as const;

function each(fn: (q: FlightQuestion, seed: number, index: number) => void) {
  for (const world of FLIGHT_WORLDS) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const s = (seed * 2654435761) >>> 0;
      for (let i = 0; i < GATES_PER_RUN; i++) fn(flightQuestion(world, s, i), s, i);
    }
  }
}

const correctOf = (q: FlightQuestion) => q.choices.find((c) => c.correct)!.visual;
const hasNumber = (text: string, n: number) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(text);

describe('flight questions: structure', () => {
  it(`exactly one correct gate and three visually distinct gates (${SEEDS} seeds × 8 gates per world)`, () => {
    each((q) => {
      expect(q.choices).toHaveLength(3);
      expect(q.choices.filter((c) => c.correct)).toHaveLength(1);
      expect(new Set(q.choices.map((c) => visualKey(c.visual))).size).toBe(3);
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(3);
    });
  });

  it('is deterministic by (world, seed, index) and has a stable id', () => {
    for (const world of FLIGHT_WORLDS) {
      for (let seed = 0; seed < 200; seed++) {
        for (let i = 0; i < GATES_PER_RUN; i++) {
          const a = flightQuestion(world, seed, i);
          expect(flightQuestion(world, seed, i)).toEqual(a);
          expect(a.id).toBe(`${world}:${seed}:${i}`);
          expect(a.world).toBe(world);
        }
      }
    }
  });

  it('different seeds give different runs', () => {
    const runs = new Set<string>();
    for (let seed = 0; seed < 50; seed++) runs.add(JSON.stringify(flightRun('meadow', seed).map((q) => [q.prompt, q.choices])));
    expect(runs.size).toBeGreaterThan(45);
  });

  it('a run does not ask the same question twice', () => {
    let runs = 0;
    let repeats = 0;
    for (const world of FLIGHT_WORLDS) {
      for (let seed = 0; seed < 1000; seed++) {
        const keys = flightRun(world, seed).map((q) => JSON.stringify([q.prompt, q.picture ?? null]));
        runs++;
        if (new Set(keys).size < keys.length) repeats++;
      }
    }
    expect(repeats / runs).toBeLessThan(0.002);
  });

  it('each world uses only its own skills, and a run visits every skill before repeating', () => {
    for (const world of FLIGHT_WORLDS) {
      const skills = SKILLS_BY_WORLD[world];
      for (let seed = 0; seed < 300; seed++) {
        const run = flightRun(world, seed);
        expect(run).toHaveLength(GATES_PER_RUN);
        for (const q of run) expect(skills).toContain(q.skill);
        for (let i = 0; i < GATES_PER_RUN; i++) expect(run[i].skill).toBe(flightSkill(world, seed, i));
        const firstLap = run.slice(0, Math.min(skills.length, GATES_PER_RUN)).map((q) => q.skill);
        expect(new Set(firstLap).size).toBe(firstLap.length);
      }
    }
  });

  it('covers every skill of every world, with the correct gate in every lane', () => {
    for (const world of FLIGHT_WORLDS) {
      const seen = new Set<string>();
      const lanes = new Set<number>();
      for (let seed = 0; seed < 400; seed++) for (const q of flightRun(world, seed)) { seen.add(q.skill); lanes.add(correctLane(q)); }
      expect([...seen].sort()).toEqual([...SKILLS_BY_WORLD[world]].sort());
      expect([...lanes].sort()).toEqual([0, 1, 2]);
    }
    expect(new Set(SKILLS_BY_WORLD.garden).size).toBe(14);
  });

  it('places the correct gate in each lane about equally often', () => {
    const count = [0, 0, 0];
    each((q) => { count[correctLane(q)]++; });
    const total = count[0] + count[1] + count[2];
    for (const c of count) expect(c / total).toBeGreaterThan(0.3);
  });

  it('an unknown world falls back to the garden', () => {
    const q = flightQuestion('nowhere' as never, 1, 0);
    expect(q.world).toBe('garden');
  });
});

describe('flight questions: the prompt never gives the answer away', () => {
  it('number answers never appear in the prompt (English and Tamil)', () => {
    each((q) => {
      const ans = correctOf(q);
      for (const lang of LANGS) {
        const text = t(q.prompt, lang);
        expect(text).not.toMatch(/\{\w+\}/);
        if (ans.kind === 'number') expect(hasNumber(text, ans.n), `${q.id} ${text}`).toBe(false);
        if (ans.kind === 'group') expect(text).not.toMatch(/[0-9]/);
        if (ans.kind === 'day') expect(text.includes(t(DAY_KEYS[ans.day], lang))).toBe(false);
        if (ans.kind === 'shape') {
          expect(text.toLowerCase().includes(t(`flight.shape.${ans.shape}`, lang).toLowerCase())).toBe(false);
          expect(text.toLowerCase().includes(t(`shape.${ans.shape}`, lang).toLowerCase())).toBe(false);
        }
        if (ans.kind === 'emoji') expect(text.includes(ans.e)).toBe(false);
      }
    });
  });

  it('counting questions show the things as a picture, never as a number', () => {
    each((q) => {
      if (q.skill !== 'count') return;
      expect(q.picture).toHaveLength(1);
      const g = q.picture![0];
      expect(g.kind).toBe('group');
      if (g.kind === 'group') expect(correctOf(q)).toEqual({ kind: 'number', n: g.n });
    });
  });

  it('a clock question names the time of the correct clock only', () => {
    each((q) => {
      if (q.skill !== 'clock') return;
      const time = (q.prompt.p!.time as { k: string; p: { h: number } });
      for (const c of q.choices) {
        if (c.visual.kind !== 'clock') throw new Error('clock gates show clocks');
        const label = visualLabel(c.visual);
        expect(label.k === time.k && label.p!.h === time.p.h).toBe(c.correct);
      }
    });
  });
});

describe('flight questions: Grade 1 maths is right', () => {
  it('number answers stay in range and are correct for the prompt', () => {
    each((q) => {
      const ans = correctOf(q);
      const p = q.prompt.p ?? {};
      const range = ANSWER_RANGE[q.skill];
      if (ans.kind === 'number' && range) {
        expect(ans.n).toBeGreaterThanOrEqual(range[0]);
        expect(ans.n).toBeLessThanOrEqual(range[1]);
      }
      for (const c of q.choices) if (c.visual.kind === 'number') expect(c.visual.n).toBeGreaterThanOrEqual(0);
      const n = (k: string) => p[k] as number;
      switch (q.prompt.k) {
        case 'flight.p.next': expect(ans).toEqual({ kind: 'number', n: n('n') + 1 }); break;
        case 'flight.p.before': expect(ans).toEqual({ kind: 'number', n: n('n') - 1 }); break;
        case 'flight.p.add': expect(ans).toEqual({ kind: 'number', n: n('a') + n('b') }); expect(n('a') + n('b')).toBeLessThanOrEqual(10); break;
        case 'flight.p.make10': expect(ans).toEqual({ kind: 'number', n: 10 - n('a') }); break;
        case 'flight.p.double': expect(ans).toEqual({ kind: 'number', n: 2 * n('a') }); break;
        case 'flight.p.sub': expect(ans).toEqual({ kind: 'number', n: n('a') - n('b') }); expect(n('a')).toBeLessThanOrEqual(10); break;
        case 'flight.p.skip': {
          const seq = q.picture!.map((v) => (v as { n: number }).n);
          expect(seq[1] - seq[0]).toBe(n('step'));
          expect(seq[2] - seq[1]).toBe(n('step'));
          expect(ans).toEqual({ kind: 'number', n: seq[2] + n('step') });
          expect((ans as { n: number }).n).toBeLessThanOrEqual(n('step') * 10);
          break;
        }
        case 'flight.p.biggest': case 'flight.p.smallest': {
          const ns = q.choices.map((c) => (c.visual as { n: number }).n);
          expect((ans as { n: number }).n).toBe(q.prompt.k === 'flight.p.biggest' ? Math.max(...ns) : Math.min(...ns));
          for (const x of ns) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(20); }
          break;
        }
        case 'flight.p.most': case 'flight.p.fewest': {
          const gs = q.choices.map((c) => c.visual as Extract<GateVisual, { kind: 'group' }>);
          expect(new Set(gs.map((g) => g.e)).size).toBe(1);
          const ns = gs.map((g) => g.n);
          expect((ans as { n: number }).n).toBe(q.prompt.k === 'flight.p.most' ? Math.max(...ns) : Math.min(...ns));
          for (const x of ns) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(10); }
          break;
        }
      }
    });
  });

  it('distractors are close by and sensible (counting 1–12, numbers to 20, sums to 11)', () => {
    each((q) => {
      const ns = q.choices.flatMap((c) => (c.visual.kind === 'number' ? [c.visual.n] : []));
      if (q.skill === 'count') for (const x of ns) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(12); }
      if (q.skill === 'next' || q.skill === 'before') for (const x of ns) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(20); }
      if (['add', 'make10', 'doubles', 'sub'].includes(q.skill)) for (const x of ns) expect(x).toBeLessThanOrEqual(11);
    });
  });

  it('shapes: the right shape has the asked sides/corners, the others do not, and solids are solids', () => {
    each((q) => {
      if (q.skill === 'shape3d') {
        for (const c of q.choices) expect(c.visual.kind === 'shape' && SHAPES_3D.includes(c.visual.shape)).toBe(true);
        const clue = q.prompt.k.split('.').pop();
        const want = { ball: 'sphere', dice: 'cube', hat: 'cone', can: 'cylinder' }[clue!];
        expect(correctOf(q)).toEqual({ kind: 'shape', shape: want });
      }
      if (q.skill !== 'shape2d') return;
      if (q.prompt.k === 'flight.p.howManySides') {
        const s = q.picture![0] as { kind: 'shape'; shape: 'square' };
        expect(correctOf(q)).toEqual({ kind: 'number', n: SIDES[s.shape] });
        return;
      }
      for (const c of q.choices) expect(c.visual.kind === 'shape' && SHAPES_2D.includes(c.visual.shape)).toBe(true);
      const sides = q.choices.map((c) => SIDES[(c.visual as { shape: 'square' }).shape]!);
      const want = q.prompt.k === 'flight.p.round' ? 0 : (q.prompt.p!.n as number);
      q.choices.forEach((c, i) => expect(sides[i] === want).toBe(c.correct));
    });
  });

  it('clocks are o’clock or half past with hours 1–12', () => {
    each((q) => {
      for (const c of q.choices) {
        if (c.visual.kind !== 'clock') continue;
        expect(c.visual.h).toBeGreaterThanOrEqual(1);
        expect(c.visual.h).toBeLessThanOrEqual(12);
        expect([0, 30]).toContain(c.visual.m);
      }
    });
  });

  it('days: tomorrow is one day after today and yesterday one day before (with week wrap)', () => {
    each((q) => {
      if (q.skill !== 'day') return;
      // the picture is a week strip: today, an arrow toward the gap, and the gap
      const strip = q.picture!;
      expect(strip.map((v) => v.kind)).toEqual(q.prompt.k === 'flight.p.tomorrow' ? ['day', 'emoji', 'blank'] : ['blank', 'emoji', 'day']);
      const today = (strip.find((v) => v.kind === 'day') as { day: number }).day;
      const want = q.prompt.k === 'flight.p.tomorrow' ? (today + 1) % 7 : (today + 6) % 7;
      expect(correctOf(q)).toEqual({ kind: 'day', day: want });
      for (const c of q.choices) expect((c.visual as { day: number }).day).toBeGreaterThanOrEqual(0);
      for (const c of q.choices) expect((c.visual as { day: number }).day).toBeLessThanOrEqual(6);
    });
  });

  it('patterns: the answer continues the repeating unit and every gate is a known emoji', () => {
    each((q) => {
      if (q.skill !== 'pattern') return;
      const seq = q.picture!.map((v) => (v as { e: string }).e);
      expect(seq.length).toBeGreaterThanOrEqual(4);
      // find the shortest repeating unit (2 or 3) that explains the picture
      const unit = [2, 3].find((u) => seq.every((e, i) => e === seq[i % u]))!;
      expect(unit).toBeDefined();
      expect(seq.length).toBeGreaterThanOrEqual(unit * 2);
      expect(correctOf(q)).toEqual({ kind: 'emoji', e: seq[seq.length % unit] });
      for (const c of q.choices) expect(EMOJI[(c.visual as { e: string }).e]).toBeDefined();
    });
  });
});

describe('flight strings', () => {
  it('every prompt, help and visual label resolves in English and Tamil', () => {
    const seen = new Set<string>();
    each((q) => {
      const msgs = [q.prompt, q.help, ...q.choices.map((c, i) => gateAria(i, c.visual)), ...(q.picture ? [pictureAria(q.picture)] : [])];
      for (const m of msgs) for (const k of keysOf(m)) seen.add(k);
    });
    for (const k of seen) {
      expect(hasKey(k, 'en'), k).toBe(true);
      expect(hasKey(k, 'ta'), k).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(60);
  });

  it('rendered prompts and helps have no leftover placeholders and never say "wrong"', () => {
    each((q) => {
      for (const lang of LANGS) {
        for (const m of [q.prompt, q.help]) {
          const s = t(m, lang);
          expect(s).not.toMatch(/\{\w+\}/);
          expect(s.toLowerCase()).not.toContain('wrong');
        }
      }
    });
  });

  it('aria labels describe the gate ("Gate 2: half past 3")', () => {
    expect(t(gateAria(1, { kind: 'clock', h: 3, m: 30 }), 'en')).toBe('Gate 2: half past 3');
    expect(t(gateAria(0, { kind: 'clock', h: 12, m: 0 }), 'en')).toBe('Gate 1: 12 o’clock');
    expect(t(gateAria(2, { kind: 'number', n: 7 }), 'en')).toBe('Gate 3: 7');
    expect(t(visualLabel({ kind: 'day', day: 0 }), 'en')).toBe('Sunday');
    expect(t(visualLabel({ kind: 'day', day: 6 }), 'ta')).toBe('சனி');
    expect(t(visualLabel({ kind: 'shape', shape: 'cone' }), 'en')).toBe('cone');
    expect(t(visualLabel({ kind: 'group', e: '🍎', n: 4 }), 'en')).toBe('4 apples');
    expect(t(visualLabel({ kind: 'group', e: '🍎', n: 1 }), 'en')).toBe('one apple');
    expect(t(visualLabel({ kind: 'emoji', e: '🌙' }), 'en')).toBe('moon');
    expect(t(pictureAria([{ kind: 'number', n: 2 }, { kind: 'number', n: 4 }, { kind: 'number', n: 6 }]), 'en')).toBe('Picture: 2, 4 and 6');
  });

  it('every emoji and shape has a name, and friend lines exist for every world', () => {
    for (const id of Object.values(EMOJI)) {
      for (const k of [`flight.emoji.${id}`, `flight.emojis.${id}`]) { expect(FLIGHT_EN[k], k).toBeTruthy(); expect(FLIGHT_TA[k], k).toBeTruthy(); }
    }
    for (const s of [...SHAPES_2D, ...SHAPES_3D]) { expect(FLIGHT_EN[`flight.shape.${s}`]).toBeTruthy(); expect(FLIGHT_TA[`flight.shape.${s}`]).toBeTruthy(); }
    for (const w of FLIGHT_WORLDS) {
      for (const k of [`flight.intro.${w}`, `flight.finish.${w}`, `flight.friend.${w}`]) { expect(FLIGHT_EN[k], k).toBeTruthy(); expect(FLIGHT_TA[k], k).toBeTruthy(); }
    }
  });

  it('the prototype’s bugs are gone: no "Cone" on a triangle, no answer in the counting prompt', () => {
    for (const lang of LANGS) {
      for (const s of [...SHAPES_2D, ...SHAPES_3D]) {
        if (s !== 'cone') expect(t(visualLabel({ kind: 'shape', shape: s }), lang)).not.toBe(t('flight.shape.cone', lang));
      }
    }
    each((q) => { if (q.skill === 'count') expect(q.prompt.p).not.toHaveProperty('n'); });
  });
});

describe('flight questions: pictures show the relation, not a value to copy', () => {
  it('next / before draw a number line with a gap, never a lone number', () => {
    each((q) => {
      if (q.skill !== 'next' && q.skill !== 'before') return;
      const strip = q.picture!;
      expect(strip).toHaveLength(3);
      const gap = strip.findIndex((v) => v.kind === 'blank');
      expect(gap).toBeGreaterThanOrEqual(0);
      // the numbers around the gap count up by one, so the gap is exactly the answer
      const ns = strip.map((v) => (v.kind === 'number' ? v.n : null));
      const first = ns.find((x) => x !== null)!;
      const start = first - ns.indexOf(first);
      strip.forEach((v, i) => { if (v.kind === 'number') expect(v.n).toBe(start + i); });
      expect(correctOf(q)).toEqual({ kind: 'number', n: start + gap });
      for (const v of strip) if (v.kind === 'number') { expect(v.n).toBeGreaterThanOrEqual(0); expect(v.n).toBeLessThanOrEqual(21); }
    });
  });

  it('no gate is ever a blank, and the blank has a label in both languages', () => {
    each((q) => { for (const c of q.choices) expect(c.visual.kind).not.toBe('blank'); });
    for (const lang of LANGS) expect(t(visualLabel({ kind: 'blank' }), lang)).not.toMatch(/flight\./);
  });
});
