import { createRng, hashString, type Rng } from '../engine/rng';
import { joinMsgs, msg, type Msg } from '../engine/types';
import { GATES_PER_RUN, type FlightChoice, type FlightQuestion, type FlightSkill, type FlightWorld, type GateVisual, type ShapeId } from './types';

/**
 * Bee Flight questions: a pure, seeded generator. `flightQuestion(world, seed, index)` always
 * returns the same question for the same arguments. Every question has exactly one correct
 * gate, three visually distinct gates, Grade 1 ranges, and a prompt that never states the
 * answer (things to count are shown as a `group` picture, never as a number in the text).
 * Strings live in `src/i18n/packs/flight.ts` (keys `flight.*`).
 */

export const FLIGHT_WORLDS: readonly FlightWorld[] = ['meadow', 'river', 'orchard', 'ice', 'trail', 'town', 'garden'];

const ALL_SKILLS: FlightSkill[] = ['count', 'next', 'before', 'compare', 'add', 'make10', 'doubles', 'sub', 'skip', 'pattern', 'shape2d', 'shape3d', 'clock', 'day'];

/** The skills each world's flight practises (the garden mixes all of them). */
export const SKILLS_BY_WORLD: Record<FlightWorld, readonly FlightSkill[]> = {
  meadow: ['count', 'next', 'before'],
  river: ['compare', 'count'],
  orchard: ['add', 'make10', 'doubles'],
  ice: ['sub'],
  trail: ['skip', 'pattern'],
  town: ['shape2d', 'shape3d', 'clock', 'day'],
  garden: ALL_SKILLS,
};

/** Range of the correct answer for number-answer skills (Grade 1). */
export const ANSWER_RANGE: Partial<Record<FlightSkill, [number, number]>> = {
  count: [3, 10],
  next: [2, 20],
  before: [1, 19],
  compare: [1, 20],
  add: [2, 10],
  make10: [1, 9],
  doubles: [2, 10],
  sub: [1, 9],
  skip: [8, 100],
  shape2d: [3, 6],
};

// ---------- emoji (each has an i18n name: flight.emoji.<id> singular, flight.emojis.<id> plural) ----------

export const EMOJI: Record<string, string> = {
  '🌼': 'flower', '🐞': 'ladybird', '🦋': 'butterfly', '🍯': 'honey',
  '🐟': 'fish', '🦆': 'duck', '🐸': 'frog', '🐢': 'turtle',
  '🍎': 'apple', '🍐': 'pear', '🍊': 'orange', '🍓': 'strawberry',
  '❄️': 'snowflake', '🐧': 'penguin',
  '🍄': 'mushroom', '🌰': 'nut', '🍂': 'leaf', '🐌': 'snail',
  '⭐': 'star', '🎈': 'balloon', '🔔': 'bell',
  '➡️': 'arrowNext', '⬅️': 'arrowBack',
  '🌸': 'blossom', '🌻': 'sunflower', '🐝': 'bee',
  '🍌': 'banana', '🍇': 'grapes', '🌙': 'moon', '☀️': 'sun',
};

/** Things to count / compare / add in each world (all are keys of EMOJI). */
const THINGS: Record<FlightWorld, string[]> = {
  meadow: ['🌼', '🐞', '🦋', '🍯'],
  river: ['🐟', '🦆', '🐸', '🐢'],
  orchard: ['🍎', '🍐', '🍊', '🍓'],
  ice: ['❄️', '🐧', '🐟'],
  trail: ['🍄', '🌰', '🍂', '🐌'],
  town: ['⭐', '🎈', '🔔'],
  garden: ['🌸', '🌻', '🐝', '🍯'],
};

/** Pattern pieces: distinct by shape, never by colour alone. */
const PATTERN_POOL = ['🍎', '🍌', '🍇', '🌸', '🌼', '⭐', '🌙', '🍄', '🐞', '🦋', '🐟', '🍓', '☀️', '🍂'];

// ---------- shapes ----------

export const SHAPES_2D: readonly ShapeId[] = ['triangle', 'square', 'rectangle', 'circle', 'pentagon', 'hexagon'];
export const SHAPES_3D: readonly ShapeId[] = ['cube', 'sphere', 'cone', 'cylinder'];
/** Straight sides (= corners) of each flat shape. */
export const SIDES: Partial<Record<ShapeId, number>> = { triangle: 3, square: 4, rectangle: 4, circle: 0, pentagon: 5, hexagon: 6 };

/** Clue for each solid, so the prompt never names the shape. */
const SOLID_CLUE: Record<string, string> = { sphere: 'ball', cube: 'dice', cone: 'hat', cylinder: 'can' };

// ---------- days ----------

/** Existing i18n day names, indexed 0 = Sunday … 6 = Saturday. */
export const DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'] as const;

// ---------- visuals ----------

/** A stable key: two gates are "visually the same" exactly when their keys are equal. */
export function visualKey(v: GateVisual): string {
  switch (v.kind) {
    case 'number': return `n:${v.n}`;
    case 'emoji': return `e:${v.e}`;
    case 'shape': return `s:${v.shape}`;
    case 'clock': return `c:${v.h}:${v.m}`;
    case 'day': return `d:${v.day}`;
    case 'group': return `g:${v.e}:${v.n}`;
    case 'blank': return 'blank';
  }
}

/** The time as words: "3 o'clock" / "half past 3". */
export function timeMsg(h: number, m: 0 | 30): Msg {
  return msg(m === 0 ? 'flight.time.oclock' : 'flight.time.half', { h });
}

const emojiName = (e: string, plural: boolean): Msg => (EMOJI[e] ? msg(`flight.${plural ? 'emojis' : 'emoji'}.${EMOJI[e]}`) : msg('flight.v.picture'));

/** What a visual shows, in words (aria-labels, the "Let's look" sheet). */
export function visualLabel(v: GateVisual): Msg {
  switch (v.kind) {
    case 'number': return msg('flight.v.number', { n: v.n });
    case 'emoji': return emojiName(v.e, false);
    case 'shape': return msg(`flight.shape.${v.shape}`);
    case 'clock': return timeMsg(v.h, v.m);
    case 'day': return msg(DAY_KEYS[v.day]);
    case 'group': return v.n === 1 ? msg('flight.v.groupOne', { thing: emojiName(v.e, false) }) : msg('flight.v.group', { n: v.n, things: emojiName(v.e, true) });
    case 'blank': return msg('flight.v.blank');
  }
}

/** aria-label for gate i (0-based): "Gate 2: half past 3". */
export function gateAria(i: number, v: GateVisual): Msg {
  return msg('flight.aria.gate', { i: i + 1, what: visualLabel(v) });
}

/** aria-label for a question's picture ("Picture: 2, 4, 6"). */
export function pictureAria(picture: GateVisual[]): Msg {
  return msg('flight.aria.picture', { what: joinMsgs(picture.map(visualLabel)) });
}

// ---------- generator ----------

interface Draft {
  skill: FlightSkill;
  prompt: Msg;
  help: Msg;
  picture?: GateVisual[];
  correct: GateVisual;
  wrong: [GateVisual, GateVisual];
}

const num = (n: number): GateVisual => ({ kind: 'number', n });
const BLANK: GateVisual = { kind: 'blank' };

/**
 * Two distractors near `ans` inside [lo, hi]: the closest numbers first (±1), then further
 * ones (±2, ±3 …), never equal to the answer or to each other.
 */
function nearNumbers(rng: Rng, ans: number, lo: number, hi: number, first: number[] = [-1, 1], then: number[] = [-2, 2, -3, 3]): [number, number] {
  const out: number[] = [];
  const add = (n: number) => { if (n >= lo && n <= hi && n !== ans && !out.includes(n)) out.push(n); };
  for (const o of rng.shuffle(first)) add(ans + o);
  for (const o of rng.shuffle(then)) add(ans + o);
  for (let d = 1; out.length < 2 && d <= hi - lo + 2; d++) { add(ans + d); add(ans - d); }
  if (out.length < 2) throw new Error(`flight: no distractors for ${ans} in ${lo}..${hi}`);
  return [out[0], out[1]];
}

const pickN = <T>(rng: Rng, items: readonly T[], n: number): T[] => rng.shuffle(items).slice(0, n);

function genCount(rng: Rng, world: FlightWorld): Draft {
  const e = rng.pick(THINGS[world]);
  const n = rng.int(3, 10);
  const [a, b] = nearNumbers(rng, n, 1, 12, [-1, 1], [-2, 2]);
  return {
    skill: 'count',
    prompt: msg('flight.p.count', { things: emojiName(e, true) }),
    help: msg('flight.h.count', { thing: emojiName(e, false) }),
    picture: [{ kind: 'group', e, n }],
    correct: num(n),
    wrong: [num(a), num(b)],
  };
}

/**
 * Next / before show a number-line strip with the gap to fill ([n, ?, n+2] / [n-2, ?, n]), so
 * the picture shows the relation — never a lone number a child might simply copy to a gate.
 * Near the ends of 1–20 the strip shifts ([n-1, n, ?] / [?, n, n+1]).
 */
export function numberStrip(n: number, dir: 1 | -1): GateVisual[] {
  if (dir === 1) return n + 2 <= 20 ? [num(n), BLANK, num(n + 2)] : [num(n - 1), num(n), BLANK];
  return n - 2 >= 1 ? [num(n - 2), BLANK, num(n)] : [BLANK, num(n), num(n + 1)];
}

function genNext(rng: Rng): Draft {
  const n = rng.int(1, 19);
  const [a, b] = nearNumbers(rng, n + 1, 1, 20, [-1, 1], [-2, 2]);
  return { skill: 'next', prompt: msg('flight.p.next', { n }), help: msg('flight.h.next', { n }), picture: numberStrip(n, 1), correct: num(n + 1), wrong: [num(a), num(b)] };
}

function genBefore(rng: Rng): Draft {
  const n = rng.int(2, 20);
  const [a, b] = nearNumbers(rng, n - 1, 1, 20, [1, -1], [-2, 2]);
  return { skill: 'before', prompt: msg('flight.p.before', { n }), help: msg('flight.h.before', { n }), picture: numberStrip(n, -1), correct: num(n - 1), wrong: [num(a), num(b)] };
}

function genCompare(rng: Rng, world: FlightWorld): Draft {
  const big = rng.bool();
  if (rng.bool()) {
    // which number is the biggest / smallest (1–20)
    const ns = pickN(rng, Array.from({ length: 20 }, (_, i) => i + 1), 3).sort((x, y) => x - y);
    const ans = big ? ns[2] : ns[0];
    const others = ns.filter((n) => n !== ans);
    return {
      skill: 'compare',
      prompt: msg(big ? 'flight.p.biggest' : 'flight.p.smallest'),
      help: msg(big ? 'flight.h.biggest' : 'flight.h.smallest'),
      correct: num(ans),
      wrong: [num(others[0]), num(others[1])],
    };
  }
  // which group has the most / fewest (1–6, same thing in every group: few enough that each
  // thing stays big enough to count on a gate badge on a small phone)
  const e = rng.pick(THINGS[world]);
  const ns = pickN(rng, Array.from({ length: 6 }, (_, i) => i + 1), 3).sort((x, y) => x - y);
  const ans = big ? ns[2] : ns[0];
  const others = ns.filter((n) => n !== ans);
  const g = (n: number): GateVisual => ({ kind: 'group', e, n });
  return {
    skill: 'compare',
    prompt: msg(big ? 'flight.p.most' : 'flight.p.fewest', { things: emojiName(e, true) }),
    help: msg(big ? 'flight.h.most' : 'flight.h.fewest'),
    correct: g(ans),
    wrong: [g(others[0]), g(others[1])],
  };
}

function genAdd(rng: Rng, world: FlightWorld): Draft {
  const a = rng.int(1, 9);
  const b = rng.int(1, 10 - a); // a + b ≤ 10
  const e = rng.pick(THINGS[world]);
  const [x, y] = nearNumbers(rng, a + b, 1, 11);
  return {
    skill: 'add',
    prompt: msg('flight.p.add', { a, b }),
    help: msg('flight.h.add', { a, b }),
    picture: [{ kind: 'group', e, n: a }, { kind: 'group', e, n: b }],
    correct: num(a + b),
    wrong: [num(x), num(y)],
  };
}

function genMake10(rng: Rng, world: FlightWorld): Draft {
  const a = rng.pick([1, 2, 3, 4, 6, 7, 8, 9]); // never 5: the answer would repeat the prompt's number
  const ans = 10 - a;
  const e = rng.pick(THINGS[world]);
  const [x, y] = nearNumbers(rng, ans, 0, 10, [-1, 1], [-2, 2]);
  return {
    skill: 'make10',
    prompt: msg('flight.p.make10', { a }),
    help: msg('flight.h.make10', { a }),
    picture: [{ kind: 'group', e, n: a }],
    correct: num(ans),
    wrong: [num(x), num(y)],
  };
}

function genDoubles(rng: Rng, world: FlightWorld): Draft {
  const a = rng.int(1, 5);
  const e = rng.pick(THINGS[world]);
  // a common slip is a + 1 (counting on one), then the neighbours of the double
  const cands = rng.shuffle([a + 1, 2 * a - 1, 2 * a + 1, 2 * a + 2, 2 * a - 2]).filter((n, i, arr) => n >= 1 && n <= 11 && n !== 2 * a && n !== a && arr.indexOf(n) === i);
  return {
    skill: 'doubles',
    prompt: msg('flight.p.double', { a }),
    help: msg('flight.h.double', { a }),
    picture: [{ kind: 'group', e, n: a }, { kind: 'group', e, n: a }],
    correct: num(2 * a),
    wrong: [num(cands[0]), num(cands[1])],
  };
}

function genSub(rng: Rng, world: FlightWorld): Draft {
  let a = 0;
  let b = 0;
  do {
    a = rng.int(3, 10);
    b = rng.int(1, a - 1);
  } while (a - b === b); // the answer never repeats a number in the prompt
  const e = rng.pick(THINGS[world]);
  const [x, y] = nearNumbers(rng, a - b, 0, 10);
  return {
    skill: 'sub',
    prompt: msg('flight.p.sub', { a, b }),
    help: msg('flight.h.sub', { a, b }),
    picture: [{ kind: 'group', e, n: a }],
    correct: num(a - b),
    wrong: [num(x), num(y)],
  };
}

function genSkip(rng: Rng): Draft {
  const step = rng.pick([2, 5, 10]);
  // first shown number = k·step; answer = (k + 3)·step ≤ 10·step (2s to 20, 5s to 50, 10s to 100)
  const k = rng.int(1, 7);
  const seq = [k * step, (k + 1) * step, (k + 2) * step];
  const ans = (k + 3) * step;
  // slips: counting on by one, or jumping one step too far
  const wrong = rng.shuffle([ans + 1, ans + step, ans - 1]).filter((n) => !seq.includes(n)).slice(0, 2) as [number, number];
  return {
    skill: 'skip',
    prompt: msg('flight.p.skip', { step }),
    help: msg('flight.h.skip', { step }),
    picture: seq.map(num),
    correct: num(ans),
    wrong: [num(wrong[0]), num(wrong[1])],
  };
}

const PATTERNS = { AB: [0, 1], AAB: [0, 0, 1], ABB: [0, 1, 1], ABC: [0, 1, 2] } as const;

function genPattern(rng: Rng): Draft {
  const kind = rng.pick(['AB', 'AAB', 'ABB', 'ABC'] as const);
  const unit = PATTERNS[kind];
  const pieces = pickN(rng, PATTERN_POOL, 4); // 3 pattern pieces + 1 spare
  const len = unit.length * 2 + rng.int(0, unit.length - 1); // at least two full repeats
  const seq = Array.from({ length: len }, (_, i) => pieces[unit[i % unit.length]]);
  const ans = pieces[unit[len % unit.length]];
  const used = [...new Set(unit)].map((i) => pieces[i]);
  const pool = [...used.filter((p) => p !== ans), pieces[3]];
  const wrong = kind === 'ABC' ? pool.slice(0, 2) : rng.shuffle(pool).slice(0, 2);
  return {
    skill: 'pattern',
    prompt: msg('flight.p.pattern'),
    help: msg('flight.h.pattern', { unit: joinMsgs(unit.map((i) => emojiName(pieces[i], false))) }),
    picture: seq.map((e) => ({ kind: 'emoji', e })),
    correct: { kind: 'emoji', e: ans },
    wrong: [{ kind: 'emoji', e: wrong[0] }, { kind: 'emoji', e: wrong[1] }],
  };
}

function genShape2d(rng: Rng): Draft {
  const shape = (s: ShapeId): GateVisual => ({ kind: 'shape', shape: s });
  const variant = rng.pick(['sides', 'corners', 'round', 'howMany'] as const);
  if (variant === 'howMany') {
    const s = rng.pick(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'] as const);
    const n = SIDES[s]!;
    const [a, b] = nearNumbers(rng, n, 3, 8, [-1, 1], [-2, 2]);
    return { skill: 'shape2d', prompt: msg('flight.p.howManySides'), help: msg('flight.h.sides'), picture: [shape(s)], correct: num(n), wrong: [num(a), num(b)] };
  }
  if (variant === 'round') {
    const [a, b] = pickN(rng, ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'] as const, 2);
    return { skill: 'shape2d', prompt: msg('flight.p.round'), help: msg('flight.h.round'), correct: shape('circle'), wrong: [shape(a), shape(b)] };
  }
  const s = rng.pick(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'] as const);
  const n = SIDES[s]!;
  const [a, b] = pickN(rng, SHAPES_2D.filter((x) => SIDES[x] !== n), 2);
  return {
    skill: 'shape2d',
    prompt: msg(variant === 'sides' ? 'flight.p.sides' : 'flight.p.corners', { n }),
    help: msg(variant === 'sides' ? 'flight.h.sides' : 'flight.h.corners'),
    correct: shape(s),
    wrong: [shape(a), shape(b)],
  };
}

function genShape3d(rng: Rng): Draft {
  const s = rng.pick(SHAPES_3D);
  const [a, b] = pickN(rng, SHAPES_3D.filter((x) => x !== s), 2);
  const clue = SOLID_CLUE[s];
  return {
    skill: 'shape3d',
    prompt: msg(`flight.p.solid.${clue}`),
    help: msg(`flight.h.solid.${clue}`),
    correct: { kind: 'shape', shape: s },
    wrong: [{ kind: 'shape', shape: a }, { kind: 'shape', shape: b }],
  };
}

const wrapHour = (h: number) => ((h - 1 + 12) % 12) + 1;

function genClock(rng: Rng): Draft {
  const h = rng.int(1, 12);
  const m: 0 | 30 = rng.bool() ? 0 : 30;
  const clock = (hh: number, mm: 0 | 30): GateVisual => ({ kind: 'clock', h: hh, m: mm });
  // slips: the other half of the same hour, and the neighbouring hour
  const wrong: [GateVisual, GateVisual] = m === 0
    ? [clock(h, 30), clock(wrapHour(h + (rng.bool() ? 1 : -1)), 0)]
    : [clock(h, 0), clock(wrapHour(h + 1), 30)];
  return {
    skill: 'clock',
    prompt: msg('flight.p.clock', { time: timeMsg(h, m) }),
    help: msg(m === 0 ? 'flight.h.oclock' : 'flight.h.half', { h }),
    correct: clock(h, m),
    wrong,
  };
}

function genDay(rng: Rng): Draft {
  const today = rng.int(0, 6);
  const tomorrow = rng.bool();
  const d = (n: number): GateVisual => ({ kind: 'day', day: ((n % 7) + 7) % 7 });
  const step = tomorrow ? 1 : -1;
  return {
    skill: 'day',
    prompt: msg(tomorrow ? 'flight.p.tomorrow' : 'flight.p.yesterday', { day: msg(DAY_KEYS[today]) }),
    help: msg(tomorrow ? 'flight.h.tomorrow' : 'flight.h.yesterday', { day: msg(DAY_KEYS[today]) }),
    // a week strip with today and the gap on the side the question points to (→ tomorrow, ← yesterday)
    picture: tomorrow ? [d(today), { kind: 'emoji', e: '➡️' }, BLANK] : [BLANK, { kind: 'emoji', e: '⬅️' }, d(today)],
    correct: d(today + step),
    // slips: today itself, and the day on the other side (or two days on)
    wrong: [d(today), d(rng.bool() ? today - step : today + 2 * step)],
  };
}

function draft(skill: FlightSkill, rng: Rng, world: FlightWorld): Draft {
  switch (skill) {
    case 'count': return genCount(rng, world);
    case 'next': return genNext(rng);
    case 'before': return genBefore(rng);
    case 'compare': return genCompare(rng, world);
    case 'add': return genAdd(rng, world);
    case 'make10': return genMake10(rng, world);
    case 'doubles': return genDoubles(rng, world);
    case 'sub': return genSub(rng, world);
    case 'skip': return genSkip(rng);
    case 'pattern': return genPattern(rng);
    case 'shape2d': return genShape2d(rng);
    case 'shape3d': return genShape3d(rng);
    case 'clock': return genClock(rng);
    case 'day': return genDay(rng);
  }
}

/**
 * The skill of gate `index` in a run: each run visits the world's skills in a seeded order,
 * so every skill turns up before any repeats (the garden visits 8 different skills per run).
 */
export function flightSkill(world: FlightWorld, seed: number, index: number): FlightSkill {
  const skills = SKILLS_BY_WORLD[world];
  const order = createRng(hashString(`flight:${world}:${seed >>> 0}:order`)).shuffle(skills);
  const i = ((Math.floor(index) % order.length) + order.length) % order.length;
  return order[i];
}

/** Two questions are "the same" when they ask the same thing about the same picture. */
const sameQuestionKey = (q: { prompt: Msg; picture?: GateVisual[] }) => JSON.stringify([q.prompt, (q.picture ?? []).map(visualKey)]);

/** One gate's question. Pure and deterministic: same (world, seed, index) → same question. */
export function flightQuestion(world: FlightWorld, seed: number, index: number): FlightQuestion {
  const w: FlightWorld = world in SKILLS_BY_WORLD ? world : 'garden';
  const idx = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const skill = flightSkill(w, seed, idx);
  // The same skill comes back every `lap` gates: replay those earlier gates of this run and
  // re-roll (a few times) rather than repeat one of their questions.
  const lap = SKILLS_BY_WORLD[w].length;
  const earlier = new Set<string>();
  let rng = createRng(0);
  let d: Draft | undefined;
  for (let j = idx % lap; j <= idx; j += lap) {
    rng = createRng(hashString(`flight:${w}:${seed >>> 0}:${j}`));
    d = draft(skill, rng, w);
    for (let tries = 0; tries < 8 && earlier.has(sameQuestionKey(d)); tries++) d = draft(skill, rng, w);
    earlier.add(sameQuestionKey(d));
  }
  if (!d) throw new Error('flight: no question');
  const choices = rng.shuffle([
    { visual: d.correct, correct: true },
    { visual: d.wrong[0], correct: false },
    { visual: d.wrong[1], correct: false },
  ]).map((c, i): FlightChoice => ({ id: `g${i}`, ...c })) as [FlightChoice, FlightChoice, FlightChoice];
  return {
    id: `${w}:${seed}:${idx}`,
    world: w,
    skill: d.skill,
    prompt: d.prompt,
    ...(d.picture ? { picture: d.picture } : {}),
    choices,
    help: d.help,
  };
}

/** All the questions of one run (GATES_PER_RUN gates). */
export function flightRun(world: FlightWorld, seed: number): FlightQuestion[] {
  return Array.from({ length: GATES_PER_RUN }, (_, i) => flightQuestion(world, seed, i));
}

/** Lane (0–2) of the correct gate. */
export function correctLane(q: FlightQuestion): number {
  return q.choices.findIndex((c) => c.correct);
}
