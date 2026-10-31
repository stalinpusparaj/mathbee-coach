import { beforeAll, describe, it, expect, vi } from 'vitest';
import {
  ANSWER_IN_PROMPT_OK, ANSWER_RANGE, DAY_KEYS, EMOJI, FLIGHT_WORLDS, ODD_COLOUR, ODD_CORNERED, ODD_KIND, ODD_ROUND, ODD_SOLID_CORNERED, ODD_SOLID_ROUND,
  SHAPES_2D, SHAPES_3D, SIDES, SKILLS_BY_WORLD, SOLID_THINGS,
  correctLane, flightQuestion, flightRun, flightSkill, gateAria, pictureAria, sameQuestionKey, visualKey, visualLabel,
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
        // odd one out has no picture and one prompt: there the gates themselves make the question
        const keys = flightRun(world, seed).map(sameQuestionKey);
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
    expect(new Set(SKILLS_BY_WORLD.garden).size).toBe(39);
    expect(SKILLS_BY_WORLD.trail).toContain('odd');
    expect(SKILLS_BY_WORLD.garden).toContain('odd');
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
        if (ans.kind === 'number' && !ANSWER_IN_PROMPT_OK.includes(q.prompt.k)) expect(hasNumber(text, ans.n), `${q.id} ${text}`).toBe(false);
        if (ans.kind === 'group') expect(text).not.toMatch(/[0-9]/);
        if (ans.kind === 'day') expect(text.includes(t(DAY_KEYS[ans.day], lang))).toBe(false);
        if (ans.kind === 'word') expect(text.includes(t(ans.m, lang)), `${q.id} ${text}`).toBe(false);
        if (ans.kind === 'shape' && !ANSWER_IN_PROMPT_OK.includes(q.prompt.k)) {
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
      if (q.prompt.k === 'flight.p.readClock') {
        // read the clock: the picture is the clock, the right gate says its time in words
        const c = q.picture![0] as { kind: 'clock'; h: number; m: 0 | 30 };
        expect(c.kind).toBe('clock');
        for (const ch of q.choices) {
          expect(ch.visual.kind).toBe('word');
          expect(JSON.stringify((ch.visual as { m: unknown }).m) === JSON.stringify(visualLabel(c))).toBe(ch.correct);
        }
        return;
      }
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
      if (q.skill === 'shape3d' && q.prompt.k === 'flight.p.objectLike') {
        const want = (q.prompt.p!.shape as { k: string }).k.split('.').pop()!;
        q.choices.forEach((c) => {
          const e = (c.visual as { e: string }).e;
          expect(SOLID_THINGS[want].includes(e)).toBe(c.correct);
          expect(EMOJI[e]).toBeDefined();
        });
        return;
      }
      if (q.skill === 'shape3d') {
        for (const c of q.choices) expect(c.visual.kind === 'shape' && SHAPES_3D.includes(c.visual.shape)).toBe(true);
        const clue = q.prompt.k.split('.').pop();
        const want = { ball: 'sphere', dice: 'cube', hat: 'cone', can: 'cylinder' }[clue!];
        expect(correctOf(q)).toEqual({ kind: 'shape', shape: want });
      }
      if (q.skill !== 'shape2d') return;
      if (q.prompt.k === 'flight.p.whichShape') {
        const want = (q.prompt.p!.shape as { k: string }).k.split('.').pop();
        q.choices.forEach((c) => expect((c.visual as { shape: string }).shape === want).toBe(c.correct));
        const names = q.choices.map((c) => (c.visual as { shape: string }).shape);
        // asked for a square or a rectangle, the other one is never a gate (a square is a rectangle too)
        if (want === 'square' || want === 'rectangle') expect(names.includes('square') && names.includes('rectangle')).toBe(false);
        return;
      }
      if (q.prompt.k === 'flight.p.howManySides' || q.prompt.k === 'flight.p.howManyCorners') {
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
      if (q.prompt.k === 'flight.p.patternGap') {
        // an AB pattern of six with one gap inside it: the gap is the piece that belongs there
        const pic = q.picture!;
        const gap = pic.findIndex((v) => v.kind === 'blank');
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(pic.length - 1);
        const at = (i: number) => (pic[i] as { e: string }).e;
        expect(correctOf(q)).toEqual({ kind: 'emoji', e: at(gap + 2 < pic.length ? gap + 2 : gap - 2) });
        return;
      }
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

describe('flight questions: odd one out (trail and garden)', () => {
  const odds: FlightQuestion[] = [];
  beforeAll(() => {
    for (const world of ['trail', 'garden'] as const) {
      for (let seed = 0; seed < 3000; seed++) for (const q of flightRun(world, seed)) if (q.skill === 'odd') odds.push(q);
    }
  });
  const split = (q: FlightQuestion) => ({ odd: correctOf(q), pair: q.choices.filter((c) => !c.correct).map((c) => c.visual) });
  const kindOf = (v: GateVisual) => ODD_KIND[(v as { e: string }).e];
  const colourOf = (v: GateVisual) => ODD_COLOUR[(v as { e: string }).e];
  const isApple = (v: GateVisual) => ['🍎', '🍏'].includes((v as { e: string }).e);

  it('only trail and garden fly odd one out', () => {
    for (const world of FLIGHT_WORLDS) expect(SKILLS_BY_WORLD[world].includes('odd')).toBe(world === 'trail' || world === 'garden');
    expect(odds.length).toBeGreaterThan(3000);
  });

  it('asks "Which one is different?" with no picture and no numbers, names or emoji in the prompt', () => {
    for (const q of odds) {
      expect(q.prompt).toEqual({ k: 'flight.p.odd' });
      expect(q.picture).toBeUndefined();
      for (const lang of LANGS) {
        const text = t(q.prompt, lang);
        expect(text).not.toMatch(/[0-9]/);
        for (const c of q.choices) {
          expect(text.toLowerCase()).not.toContain(t(visualLabel(c.visual), lang).toLowerCase());
          if (c.visual.kind === 'emoji' || c.visual.kind === 'group') expect(text).not.toContain(c.visual.e);
        }
      }
    }
  });

  it('every property turns up, and the help names the property, never the answer', () => {
    const seen = new Set<string>();
    for (const q of odds) {
      seen.add(q.help.k);
      expect(q.help.p).toBeUndefined();
      for (const lang of LANGS) {
        const help = t(q.help, lang);
        expect(help).not.toContain(t(visualLabel(correctOf(q)), lang));
      }
    }
    expect([...seen].sort()).toEqual(['flight.h.odd.colour', 'flight.h.odd.count', 'flight.h.odd.kind', 'flight.h.odd.shape']);
  });

  it('exactly one gate is the odd one, by one Grade 1 property, with no second "odd one" by another', () => {
    for (const q of odds) {
      const { odd, pair } = split(q);
      expect(new Set(q.choices.map((c) => visualKey(c.visual))).size).toBe(3);
      switch (q.help.k) {
        case 'flight.h.odd.shape': {
          for (const v of [odd, ...pair]) expect(v.kind).toBe('shape');
          const shapeOf = (v: GateVisual) => (v as { shape: 'circle' }).shape;
          // one dimension per row: all flat or all solid, so "flat or solid" is never a second answer
          const flat = [odd, ...pair].map((v) => SHAPES_2D.includes(shapeOf(v)));
          expect(flat.every((f) => f === flat[0]), `${q.id}`).toBe(true);
          const fam = (v: GateVisual) => ([...ODD_ROUND, ...ODD_SOLID_ROUND].includes(shapeOf(v)) ? 'round' : [...ODD_CORNERED, ...ODD_SOLID_CORNERED].includes(shapeOf(v)) ? 'corners' : 'other');
          expect(fam(pair[0])).toBe(fam(pair[1]));
          expect(fam(odd)).not.toBe(fam(pair[0]));
          expect([fam(odd), fam(pair[0])].sort()).toEqual(['corners', 'round']);
          break;
        }
        case 'flight.h.odd.kind': {
          for (const v of [odd, ...pair]) expect(v.kind).toBe('emoji');
          expect(kindOf(pair[0])).toBe(kindOf(pair[1]));
          expect(kindOf(odd)).not.toBe(kindOf(pair[0]));
          expect(['animal', 'fruit']).toContain(kindOf(odd));
          // colour never makes a different gate look like the odd one
          expect([colourOf(pair[0]), colourOf(pair[1])]).not.toContain(colourOf(odd));
          expect(isApple(pair[0]) && isApple(pair[1])).toBe(false);
          break;
        }
        case 'flight.h.odd.colour': {
          for (const v of [odd, ...pair]) expect(v.kind).toBe('emoji');
          expect(colourOf(pair[0])).toBe(colourOf(pair[1]));
          expect(colourOf(odd)).not.toBe(colourOf(pair[0]));
          // all one kind of thing, and never two apples
          expect(kindOf(odd)).toBe(kindOf(pair[0]));
          expect(kindOf(pair[1])).toBe(kindOf(pair[0]));
          expect([odd, ...pair].filter(isApple).length).toBeLessThanOrEqual(1);
          expect((odd as { e: string }).e).not.toBe('🍌');
          // flowers differ in outline (cup tulip, big sunflower, flat blossoms): never in a colour row
          expect(kindOf(odd)).toBe('fruit');
          break;
        }
        case 'flight.h.odd.count': {
          for (const v of [odd, ...pair]) expect(v.kind).toBe('group');
          const [a, b, o] = [pair[0], pair[1], odd] as Extract<GateVisual, { kind: 'group' }>[];
          expect(a.n).toBe(b.n);
          expect(o.n).not.toBe(a.n);
          for (const g of [a, b, o]) { expect(g.n).toBeGreaterThanOrEqual(1); expect(g.n).toBeLessThanOrEqual(5); }
          // three different things of one kind, all different colours: only the number sets one apart
          expect(new Set([a.e, b.e, o.e]).size).toBe(3);
          expect(new Set([kindOf(a), kindOf(b), kindOf(o)]).size).toBe(1);
          expect(new Set([colourOf(a), colourOf(b), colourOf(o)]).size).toBe(3);
          break;
        }
        default: throw new Error(`unexpected help ${q.help.k}`);
      }
    }
  });

  it('every odd-one-out piece has a name, a kind and a colour', () => {
    for (const q of odds) {
      for (const c of q.choices) {
        if (c.visual.kind !== 'emoji' && c.visual.kind !== 'group') continue;
        expect(EMOJI[c.visual.e], c.visual.e).toBeDefined();
        expect(ODD_KIND[c.visual.e]).toBeDefined();
        expect(ODD_COLOUR[c.visual.e]).toBeDefined();
      }
    }
    for (const e of Object.keys(ODD_KIND)) { expect(EMOJI[e], e).toBeDefined(); expect(ODD_COLOUR[e], e).toBeDefined(); }
  });

  it('the odd one is in every lane, and the same gates are not asked twice in a run', () => {
    const lanes = new Set(odds.map(correctLane));
    expect([...lanes].sort()).toEqual([0, 1, 2]);
    for (let seed = 0; seed < 500; seed++) {
      const keys = flightRun('trail', seed).filter((q) => q.skill === 'odd').map(sameQuestionKey);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});


describe('flight questions: the rest of the prototype question bank', () => {
  const all: FlightQuestion[] = [];
  beforeAll(() => {
    for (const world of FLIGHT_WORLDS) for (let seed = 0; seed < 600; seed++) all.push(...flightRun(world, seed));
  });
  const ans = (q: FlightQuestion) => (correctOf(q) as { n: number }).n;
  const p = (q: FlightQuestion, k: string) => q.prompt.p![k] as number;

  it('every prototype question type turns up', () => {
    const keys = new Set(all.map((q) => q.prompt.k));
    for (const k of [
      'flight.p.missing', 'flight.p.countdown', 'flight.p.countdownStep', 'flight.p.tenOnes', 'flight.p.tenMore', 'flight.p.teenAdd', 'flight.p.teenSub',
      'flight.p.ordinal', 'flight.p.oneMore', 'flight.p.oneLess', 'flight.p.missingAdd', 'flight.p.missingSub', 'flight.p.nearDouble', 'flight.p.add3',
      'flight.p.plus0', 'flight.p.minus0', 'flight.p.minusAll', 'flight.p.whichMakes', 'flight.p.difference', 'flight.p.family', 'flight.p.grow',
      'flight.p.riddle.between', 'flight.p.riddle.moreLess', 'flight.p.riddle.more', 'flight.p.riddle.less', 'flight.p.riddle.after',
      'flight.p.countShape', 'flight.p.fraction', 'flight.p.faces.cube', 'flight.p.faces.can', 'flight.p.faces.stop', 'flight.p.faces.triangles',
      'flight.p.later', 'flight.p.monthAfter', 'flight.p.monthBefore', 'flight.p.fact.week', 'flight.p.fact.year', 'flight.p.fact.hour', 'flight.p.fact.clock',
      'flight.p.longHand', 'flight.p.longest', 'flight.p.shortest', 'flight.p.readClock', 'flight.p.patternGap', 'flight.p.howManyCorners',
      'flight.p.whichShape', 'flight.p.objectLike',
    ]) expect(keys.has(k), k).toBe(true);
    expect([...keys].some((k) => k.startsWith('flight.p.story.add.'))).toBe(true);
    expect([...keys].some((k) => k.startsWith('flight.p.story.sub.'))).toBe(true);
  });

  it('the maths is right for every new type', () => {
    for (const q of all) {
      const pic = q.picture ?? [];
      switch (q.prompt.k) {
        case 'flight.p.missing': {
          const gap = pic.findIndex((v) => v.kind === 'blank');
          const first = (pic[gap === 0 ? 1 : 0] as { n: number }).n - (gap === 0 ? 1 : 0);
          expect(ans(q)).toBe(first + gap);
          break;
        }
        case 'flight.p.countdown': case 'flight.p.countdownStep': {
          const seq = pic.map((v) => (v as { n: number }).n);
          const step = seq[0] - seq[1];
          expect(seq[1] - seq[2]).toBe(step);
          expect(ans(q)).toBe(seq[2] - step);
          expect(ans(q)).toBeGreaterThanOrEqual(0);
          break;
        }
        case 'flight.p.tenOnes': case 'flight.p.tenMore': case 'flight.p.teenAdd': expect(ans(q)).toBe(10 + p(q, 'n')); break;
        case 'flight.p.teenSub': expect(ans(q)).toBe(p(q, 't') - 10); break;
        case 'flight.p.ordinal': {
          const pos = Number((q.prompt.p!.ord as { k: string }).k.split('.').pop());
          expect(correctOf(q)).toEqual(pic[pos - 1]);
          expect(new Set(pic.map(visualKey)).size).toBe(5);
          break;
        }
        case 'flight.p.oneMore': expect(ans(q)).toBe(p(q, 'n') + 1); break;
        case 'flight.p.oneLess': expect(ans(q)).toBe(p(q, 'n') - 1); break;
        case 'flight.p.missingAdd': expect(p(q, 'a') + ans(q)).toBe(p(q, 'c')); break;
        case 'flight.p.missingSub': expect(p(q, 'a') - ans(q)).toBe(p(q, 'c')); break;
        case 'flight.p.nearDouble': expect(p(q, 'b')).toBe(p(q, 'a') + 1); expect(ans(q)).toBe(p(q, 'a') + p(q, 'b')); break;
        case 'flight.p.add3': expect(ans(q)).toBe(p(q, 'a') + p(q, 'b') + p(q, 'c')); break;
        case 'flight.p.plus0': case 'flight.p.minus0': expect(ans(q)).toBe(p(q, 'n')); break;
        case 'flight.p.minusAll': expect(ans(q)).toBe(0); break;
        case 'flight.p.whichMakes':
          for (const c of q.choices) { const x = c.visual as { a: number; b: number }; expect(x.a + x.b === p(q, 'n')).toBe(c.correct); expect(x.b).toBeGreaterThanOrEqual(1); }
          break;
        case 'flight.p.difference': expect(ans(q)).toBe(p(q, 'big') - p(q, 'small')); break;
        case 'flight.p.family': expect(ans(q)).toBe(p(q, 's') - p(q, 'b')); expect(p(q, 'a') + p(q, 'b')).toBe(p(q, 's')); break;
        case 'flight.p.grow': {
          const ns = pic.map((v) => (v as { n: number }).n);
          expect(ns[1] - ns[0]).toBe(1);
          expect(ans(q)).toBe(ns[2] + 1);
          break;
        }
        case 'flight.p.riddle.between': case 'flight.p.riddle.moreLess': expect(ans(q)).toBe(p(q, 'a') + 1); expect(p(q, 'b')).toBe(p(q, 'a') + 2); break;
        case 'flight.p.riddle.more': expect(ans(q)).toBe(p(q, 'n') + p(q, 'k')); break;
        case 'flight.p.riddle.less': expect(ans(q)).toBe(p(q, 'n') - p(q, 'k')); break;
        case 'flight.p.riddle.after': expect(ans(q)).toBe(p(q, 'n') + 1); break;
        case 'flight.p.countShape': {
          const want = (q.prompt.p!.shapes as { k: string }).k.split('.').pop();
          expect(ans(q)).toBe(pic.filter((v) => (v as { shape: string }).shape === want).length);
          break;
        }
        case 'flight.p.fraction': {
          const n = (pic[0] as { n: number }).n;
          expect((correctOf(q) as { m: { k: string } }).m.k).toBe(n === 2 ? 'flight.w.half' : 'flight.w.fourth');
          break;
        }
        case 'flight.p.faces.cube': case 'flight.p.faces.triangles': expect(ans(q)).toBe(6); break;
        case 'flight.p.faces.can': expect(ans(q)).toBe(2); break;
        case 'flight.p.faces.stop': expect(ans(q)).toBe(8); break;
        case 'flight.p.later': {
          const h = (q.prompt.p!.time as unknown as { p: { h: number } }).p.h;
          expect(correctOf(q)).toEqual({ kind: 'clock', h: h + 1, m: 0 });
          break;
        }
        case 'flight.p.monthAfter': case 'flight.p.monthBefore': {
          const i = Number((q.prompt.p!.month as { k: string }).k.split('.').pop());
          const want = q.prompt.k === 'flight.p.monthAfter' ? (i % 12) + 1 : ((i + 10) % 12) + 1;
          expect((correctOf(q) as { m: { k: string } }).m.k).toBe(`month.${want}`);
          break;
        }
        case 'flight.p.fact.week': expect(ans(q)).toBe(7); break;
        case 'flight.p.fact.year': case 'flight.p.fact.clock': expect(ans(q)).toBe(12); break;
        case 'flight.p.fact.hour': expect(ans(q)).toBe(60); break;
        case 'flight.p.longHand': expect(ans(q)).toBe(12); break;
        case 'flight.p.longest': case 'flight.p.shortest': {
          const order = ['second', 'minute', 'hour', 'day'];
          const idx = q.choices.map((c) => order.indexOf((c.visual as { m: { k: string } }).m.k.split('.').pop()!));
          const want = q.prompt.k === 'flight.p.longest' ? Math.max(...idx) : Math.min(...idx);
          q.choices.forEach((c, i) => expect(idx[i] === want).toBe(c.correct));
          break;
        }
        default: break;
      }
      if (q.prompt.k.startsWith('flight.p.story.add.')) expect(ans(q)).toBe(p(q, 'a') + p(q, 'b'));
      if (q.prompt.k.startsWith('flight.p.story.sub.')) expect(ans(q)).toBe(p(q, 'a') - p(q, 'b'));
    }
  });

  it('every new answer stays in its Grade 1 range', () => {
    for (const q of all) {
      const r = ANSWER_RANGE[q.skill];
      const a = correctOf(q);
      if (!r || a.kind !== 'number') continue;
      expect(a.n, `${q.id} ${q.prompt.k}`).toBeGreaterThanOrEqual(r[0]);
      expect(a.n, `${q.id} ${q.prompt.k}`).toBeLessThanOrEqual(r[1]);
    }
  });

  it('word gates and sums have labels in English and Tamil, and pizza pictures are 2 or 4 parts', () => {
    for (const q of all) {
      for (const v of [...q.choices.map((c) => c.visual), ...(q.picture ?? [])]) {
        if (v.kind === 'word' || v.kind === 'expr' || v.kind === 'parts') {
          for (const lang of LANGS) expect(t(visualLabel(v), lang)).not.toMatch(/flight\.|month\.|\{/);
        }
        if (v.kind === 'parts') expect([2, 4]).toContain(v.n);
      }
    }
  });
});
