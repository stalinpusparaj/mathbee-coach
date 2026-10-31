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

const ALL_SKILLS: FlightSkill[] = [
  'count', 'next', 'before', 'compare', 'add', 'make10', 'doubles', 'sub', 'skip', 'pattern', 'odd', 'shape2d', 'shape3d', 'clock', 'day',
  'missing', 'countdown', 'tens', 'ordinal', 'oneMore', 'missingAdd', 'nearDouble', 'add3', 'story', 'zero', 'whichMakes',
  'missingSub', 'difference', 'family', 'grow', 'riddle', 'countShape', 'fraction', 'faces', 'later', 'month', 'timeFact', 'longHand', 'duration',
];

/**
 * The skills each world's flight practises (the garden mixes all of them). Together they cover
 * every question type of the prototype's QUESTION_BANK (docs/FLIGHT_PARITY.md, "Question types").
 */
export const SKILLS_BY_WORLD: Record<FlightWorld, readonly FlightSkill[]> = {
  meadow: ['count', 'next', 'before', 'missing', 'countdown', 'tens'],
  river: ['compare', 'count', 'ordinal', 'oneMore'],
  orchard: ['add', 'make10', 'doubles', 'missingAdd', 'nearDouble', 'add3', 'story', 'zero', 'whichMakes', 'tens'],
  ice: ['sub', 'missingSub', 'story', 'difference', 'family', 'zero', 'tens'],
  trail: ['skip', 'pattern', 'odd', 'countdown', 'grow', 'riddle'],
  town: ['shape2d', 'shape3d', 'countShape', 'fraction', 'faces', 'clock', 'later', 'longHand', 'day', 'month', 'timeFact', 'duration'],
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
  skip: [7, 100],
  shape2d: [3, 8],
  missing: [2, 19],
  countdown: [0, 60],
  tens: [1, 19],
  oneMore: [1, 19],
  missingAdd: [1, 8],
  nearDouble: [5, 13],
  add3: [3, 11],
  story: [1, 10],
  zero: [0, 12],
  missingSub: [1, 9],
  difference: [1, 9],
  family: [2, 6],
  grow: [4, 6],
  riddle: [1, 20],
  countShape: [1, 8],
  faces: [2, 8],
  longHand: [12, 12],
  timeFact: [7, 60],
};

/**
 * Prompts whose lesson IS that the answer is already named: "7 + 0", "7 − 0", fact families
 * ("3 + 4 = 7, so 7 − 4 = ?") and "Which one is a hexagon?" (knowing the shape's name is the
 * skill). Everywhere else the prompt never shows the answer.
 */
export const ANSWER_IN_PROMPT_OK: readonly string[] = ['flight.p.plus0', 'flight.p.minus0', 'flight.p.family', 'flight.p.whichShape'];

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
  '🍏': 'greenApple', '🌷': 'tulip',
  // real things shaped like solids, and a stop sign (shape facts)
  '⚽': 'football', '🏀': 'basketball', '🌍': 'globe', '🎲': 'dice', '🧊': 'iceCube', '📦': 'box',
  '🍦': 'iceCream', '🥫': 'tin', '🥁': 'drum', '🔋': 'battery', '🛑': 'stopSign',
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

// ---------- odd one out ----------

/** What kind of thing each odd-one-out piece is (Grade 1 sorting: animals, fruit, flowers). */
export const ODD_KIND: Record<string, 'animal' | 'fruit' | 'flower'> = {
  '🐟': 'animal', '🐧': 'animal', '🐢': 'animal', '🐌': 'animal', '🐞': 'animal', '🐝': 'animal', '🐸': 'animal',
  '🍎': 'fruit', '🍐': 'fruit', '🍊': 'fruit', '🍓': 'fruit', '🍌': 'fruit', '🍇': 'fruit', '🍏': 'fruit',
  '🌻': 'flower', '🌼': 'flower', '🌸': 'flower', '🌷': 'flower',
};

/**
 * The main colour of each piece as most emoji fonts draw it. 🦆 and 🦋 are left out: their colour
 * differs between fonts (Android's butterfly is an orange monarch, Apple's is blue).
 */
export const ODD_COLOUR: Record<string, 'red' | 'green' | 'yellow' | 'orange' | 'purple' | 'blue' | 'black' | 'brown' | 'pink'> = {
  '🐟': 'blue', '🐧': 'black', '🐢': 'green', '🐌': 'brown', '🐞': 'red', '🐝': 'yellow', '🐸': 'green',
  '🍎': 'red', '🍐': 'green', '🍊': 'orange', '🍓': 'red', '🍌': 'yellow', '🍇': 'purple', '🍏': 'green',
  '🌻': 'yellow', '🌼': 'yellow', '🌸': 'pink', '🌷': 'pink',
};

/** Pieces that are the same thing in another colour (an apple is an apple): never in one odd-one-out row. */
const SAME_THING: string[][] = [['🍎', '🍏']];

/**
 * Odd one out by shape keeps every row in one dimension, so "flat or solid" is never a second
 * answer: flat rows are two flat shapes with corners and the circle; solid rows are the two
 * solids with no corners (a ball, a can) and the cube. The cone (one point) is left out.
 */
export const ODD_CORNERED: readonly ShapeId[] = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'];
export const ODD_ROUND: readonly ShapeId[] = ['circle'];
export const ODD_SOLID_ROUND: readonly ShapeId[] = ['sphere', 'cylinder'];
export const ODD_SOLID_CORNERED: readonly ShapeId[] = ['cube'];
/**
 * Colour rows use fruit only: the flowers differ in outline (a cup-shaped tulip, a big sunflower,
 * flat five-petal blossoms), so in a flower row the outline would be a second "different".
 */
export const ODD_COLOUR_KINDS: readonly string[] = ['fruit'];

// ---------- shapes ----------

export const SHAPES_2D: readonly ShapeId[] = ['triangle', 'square', 'rectangle', 'circle', 'pentagon', 'hexagon', 'octagon'];
/** Flat shapes with straight sides (for "how many sides / corners"). */
const POLYGONS: readonly ShapeId[] = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'];
export const SHAPES_3D: readonly ShapeId[] = ['cube', 'sphere', 'cone', 'cylinder'];
/** Straight sides (= corners) of each flat shape. */
export const SIDES: Partial<Record<ShapeId, number>> = { triangle: 3, square: 4, rectangle: 4, circle: 0, pentagon: 5, hexagon: 6, octagon: 8 };

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
    case 'word': return `w:${JSON.stringify(v.m)}`;
    case 'expr': return `x:${v.a}+${v.b}`;
    case 'parts': return `p:${v.n}`;
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
    case 'word': return v.m;
    case 'expr': return msg('flight.v.expr', { a: v.a, b: v.b });
    case 'parts': return msg('flight.v.parts', { n: v.n });
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
  // first shown number = k·step; answer = (k + 3)·step ≤ 10·step (2s to 20, 5s to 50, 10s to 100);
  // jumps of 2 also start on an odd number half the time (1, 3, 5, 7 …: the prototype's "find the jump")
  const k = rng.int(1, 7);
  const first = step === 2 && rng.bool() ? rng.pick([1, 3, 5, 7, 9]) : k * step;
  const seq = [first, first + step, first + 2 * step];
  const ans = first + 3 * step;
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
  if (rng.int(0, 2) === 0) return genPatternGap(rng);
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

/** What is hiding in the pattern? An AB pattern of six with one gap inside it (never at the end). */
function genPatternGap(rng: Rng): Draft {
  const [a, b, spare] = pickN(rng, PATTERN_POOL, 3);
  const seq = [a, b, a, b, a, b];
  const gap = rng.int(1, 4);
  const ans = seq[gap];
  return {
    skill: 'pattern',
    prompt: msg('flight.p.patternGap'),
    help: msg('flight.h.pattern', { unit: joinMsgs([emojiName(a, false), emojiName(b, false)]) }),
    picture: seq.map((e, i): GateVisual => (i === gap ? BLANK : { kind: 'emoji', e })),
    correct: { kind: 'emoji', e: ans },
    wrong: rng.shuffle([{ kind: 'emoji', e: ans === a ? b : a }, { kind: 'emoji', e: spare }]) as [GateVisual, GateVisual],
  };
}

/**
 * Odd one out (Grade 1 sorting): three gates, two of which belong together by one property and
 * one that does not. The property is one of: shape family (corners vs round), kind of thing
 * (animal vs fruit), colour (two the same colour, same kind of thing), or how many things (two
 * groups the same size). Every other property is kept from making a second "odd one": in the
 * kind and count rows no two pieces share a colour unless the pair does, the colour row keeps
 * one kind of thing and never puts an apple next to an apple. The prompt never names the answer.
 */
const sameThing = (a: string, b: string) => a === b || SAME_THING.some((g) => g.includes(a) && g.includes(b));

function genOdd(rng: Rng): Draft {
  const prompt = msg('flight.p.odd');
  const variant = rng.pick(['shape', 'kind', 'colour', 'count'] as const);
  const emoji = (e: string): GateVisual => ({ kind: 'emoji', e });
  if (variant === 'shape') {
    const shape = (x: ShapeId): GateVisual => ({ kind: 'shape', shape: x });
    if (rng.int(0, 2) > 0) {
      // flat: two flat shapes with corners, and the circle
      const [a, b] = pickN(rng, ODD_CORNERED, 2);
      return { skill: 'odd', prompt, help: msg('flight.h.odd.shape'), correct: shape(rng.pick(ODD_ROUND)), wrong: [shape(a), shape(b)] };
    }
    // solid: a ball and a can (no corners), and the cube
    const [a, b] = rng.shuffle(ODD_SOLID_ROUND);
    return { skill: 'odd', prompt, help: msg('flight.h.odd.shape'), correct: shape(rng.pick(ODD_SOLID_CORNERED)), wrong: [shape(a), shape(b)] };
  }
  const all = Object.keys(ODD_KIND);
  if (variant === 'kind') {
    const [k1, k2] = rng.shuffle(['animal', 'fruit'] as const);
    const pairPool = all.filter((e) => ODD_KIND[e] === k1);
    let a = '';
    let b = '';
    let odd: string | undefined;
    do {
      [a, b] = pickN(rng, pairPool, 2);
      const used = [ODD_COLOUR[a], ODD_COLOUR[b]];
      const odds = all.filter((e) => ODD_KIND[e] === k2 && !used.includes(ODD_COLOUR[e]));
      odd = odds.length ? rng.pick(odds) : undefined;
    } while (!odd || sameThing(a, b));
    return { skill: 'odd', prompt, help: msg('flight.h.odd.kind'), correct: emoji(odd), wrong: [emoji(a), emoji(b)] };
  }
  if (variant === 'colour') {
    // two things of one kind in the same colour, and one of that kind in another colour
    const pairs: [string, string][] = [];
    for (const a of all) for (const b of all) {
      if (a < b && ODD_KIND[a] === ODD_KIND[b] && ODD_COLOUR[a] === ODD_COLOUR[b] && !sameThing(a, b) && ODD_COLOUR_KINDS.includes(ODD_KIND[a])) pairs.push([a, b]);
    }
    const [a, b] = rng.pick(pairs);
    // bananas are long and the rest are round: keep the odd one's colour the only difference
    const odds = all.filter((e) => ODD_KIND[e] === ODD_KIND[a] && ODD_COLOUR[e] !== ODD_COLOUR[a] && e !== '🍌' && !sameThing(e, a) && !sameThing(e, b));
    return { skill: 'odd', prompt, help: msg('flight.h.odd.colour'), correct: emoji(rng.pick(odds)), wrong: rng.shuffle([emoji(a), emoji(b)]) as [GateVisual, GateVisual] };
  }
  // how many: three different things of one kind, all in different colours; two groups the same size
  const kind = rng.pick(['animal', 'fruit'] as const);
  let picks: string[] = [];
  do picks = pickN(rng, all.filter((e) => ODD_KIND[e] === kind), 3);
  while (new Set(picks.map((e) => ODD_COLOUR[e])).size < 3 || sameThing(picks[0], picks[1]) || sameThing(picks[0], picks[2]) || sameThing(picks[1], picks[2]));
  const same = rng.int(1, 4);
  const other = rng.pick([1, 2, 3, 4, 5].filter((n) => n !== same));
  const g = (e: string, n: number): GateVisual => ({ kind: 'group', e, n });
  return { skill: 'odd', prompt, help: msg('flight.h.odd.count'), correct: g(picks[0], other), wrong: [g(picks[1], same), g(picks[2], same)] };
}

function genShape2d(rng: Rng): Draft {
  const shape = (s: ShapeId): GateVisual => ({ kind: 'shape', shape: s });
  const variant = rng.pick(['sides', 'corners', 'round', 'howMany', 'howManyCorners', 'name'] as const);
  if (variant === 'howMany' || variant === 'howManyCorners') {
    const s = rng.pick(POLYGONS);
    const n = SIDES[s]!;
    const [a, b] = nearNumbers(rng, n, 3, 9, [-1, 1], [-2, 2]);
    return {
      skill: 'shape2d',
      prompt: msg(variant === 'howMany' ? 'flight.p.howManySides' : 'flight.p.howManyCorners'),
      help: msg(variant === 'howMany' ? 'flight.h.sides' : 'flight.h.cornersSides'),
      picture: [shape(s)],
      correct: num(n),
      wrong: [num(a), num(b)],
    };
  }
  if (variant === 'round') {
    const [a, b] = pickN(rng, POLYGONS, 2);
    return { skill: 'shape2d', prompt: msg('flight.p.round'), help: msg('flight.h.round'), correct: shape('circle'), wrong: [shape(a), shape(b)] };
  }
  if (variant === 'name') {
    // "Which one is a hexagon?" — a square is a rectangle too, so those two never meet in one row
    const s = rng.pick(SHAPES_2D);
    const others = SHAPES_2D.filter((x) => x !== s && !(['square', 'rectangle'].includes(x) && ['square', 'rectangle'].includes(s)));
    const [a, b] = pickN(rng, others, 2);
    return { skill: 'shape2d', prompt: msg('flight.p.whichShape', { shape: msg(`flight.shape.${s}`) }), help: msg(`flight.h.name.${s}`), correct: shape(s), wrong: [shape(a), shape(b)] };
  }
  const s = rng.pick(POLYGONS);
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

/** Real things shaped like each solid (the prototype's "Which is shaped like a sphere?"). */
export const SOLID_THINGS: Record<string, string[]> = {
  sphere: ['⚽', '🏀', '🌍'],
  cube: ['🎲', '🧊', '📦'],
  cone: ['🍦'],
  cylinder: ['🥫', '🥁', '🔋'],
};

function genShape3d(rng: Rng): Draft {
  if (rng.bool()) {
    // which real thing is shaped like a cube / ball / cone / can?
    const [s, x, y] = pickN(rng, SHAPES_3D, 3);
    const thing = (id: ShapeId): GateVisual => ({ kind: 'emoji', e: rng.pick(SOLID_THINGS[id]) });
    return {
      skill: 'shape3d',
      prompt: msg('flight.p.objectLike', { shape: msg(`flight.shape.${s}`) }),
      help: msg(`flight.h.solid.${SOLID_CLUE[s]}`),
      correct: thing(s),
      wrong: [thing(x), thing(y)],
    };
  }
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
  if (rng.int(0, 2) === 0) {
    // read the clock: the clock is the picture and the gates say times in words
    const time = (hh: number, mm: 0 | 30): GateVisual => ({ kind: 'word', m: timeMsg(hh, mm) });
    return {
      skill: 'clock',
      prompt: msg('flight.p.readClock'),
      help: msg(m === 0 ? 'flight.h.oclock' : 'flight.h.half', { h }),
      picture: [clock(h, m)],
      correct: time(h, m),
      wrong: [time(h, m === 0 ? 30 : 0), time(wrapHour(h + 1), m)],
    };
  }
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

// ---------- the rest of the prototype's question bank ----------

/** Two different wrong numbers from `cands` (in order), ≥ lo, never the answer; nearNumbers fills any gap. */
function slips(rng: Rng, ans: number, cands: number[], lo = 0, hi = 100): [number, number] {
  const out: number[] = [];
  for (const n of cands) if (n >= lo && n <= hi && n !== ans && !out.includes(n)) out.push(n);
  if (out.length >= 2) return [out[0], out[1]];
  const near = nearNumbers(rng, ans, lo, hi);
  for (const n of near) if (!out.includes(n)) out.push(n);
  return [out[0], out[1]];
}

/** Which number is missing? A number line of four with the gap inside it. */
function genMissing(rng: Rng): Draft {
  const s = rng.int(1, 17);
  const gap = rng.int(1, 2);
  const strip = [0, 1, 2, 3].map((i) => (i === gap ? BLANK : num(s + i)));
  const ans = s + gap;
  const [a, b] = nearNumbers(rng, ans, 1, 20, [-1, 1], [-2, 2]);
  return { skill: 'missing', prompt: msg('flight.p.missing'), help: msg('flight.h.missing'), picture: strip, correct: num(ans), wrong: [num(a), num(b)] };
}

/** Count back by 1 (meadow), or by 1, 2 or 10 (logic forest): which number comes next? */
function genCountdown(rng: Rng, world: FlightWorld): Draft {
  const step = world === 'meadow' ? 1 : rng.pick([1, 2, 10]);
  // by 2s and 10s the answer stays above the step, so the prompt ("in 10s") never shows it
  const start = step === 1 ? rng.int(6, 20) : step * rng.int(5, 9);
  const seq = [start, start - step, start - 2 * step];
  const ans = start - 3 * step;
  // slips: counting up instead, a step of one, or one jump too many
  const [a, b] = slips(rng, ans, rng.shuffle([ans - step, ans + 1, ans - 1]).concat([ans + step + 1]), 0, 100);
  return {
    skill: 'countdown',
    prompt: step === 1 ? msg('flight.p.countdown') : msg('flight.p.countdownStep', { step }),
    help: step === 1 ? msg('flight.h.countdown') : msg('flight.h.countdownStep', { step }),
    picture: seq.map(num),
    correct: num(ans),
    wrong: [num(a), num(b)],
  };
}

/** Tens and ones: "1 ten and 4 ones", "10 more than 4", "10 + 4", "14 − 10" (by world). */
function genTens(rng: Rng, world: FlightWorld): Draft {
  const byWorld: Partial<Record<FlightWorld, readonly ('tenOnes' | 'tenMore' | 'teenAdd' | 'teenSub')[]>> = {
    meadow: ['tenOnes', 'tenMore'], orchard: ['teenAdd', 'tenMore'], ice: ['teenSub'],
  };
  const variant = rng.pick(byWorld[world] ?? ['tenOnes', 'tenMore', 'teenAdd', 'teenSub']);
  const n = rng.int(1, 9);
  const e = rng.pick(THINGS[world]);
  if (variant === 'teenSub') {
    const [a, b] = slips(rng, n, rng.shuffle([n + 1, n - 1, 10 + n]), 0, 20);
    return { skill: 'tens', prompt: msg('flight.p.teenSub', { t: 10 + n }), help: msg('flight.h.teenSub', { t: 10 + n, n }), correct: num(n), wrong: [num(a), num(b)] };
  }
  const ans = 10 + n;
  // slips: forgetting the ten (n), or one off the teen number
  const [a, b] = slips(rng, ans, rng.shuffle([ans + 1, ans - 1]).concat([n]), 1, 20);
  if (variant === 'tenOnes') {
    return {
      skill: 'tens', prompt: msg('flight.p.tenOnes', { n }), help: msg('flight.h.tenOnes', { n }),
      picture: [{ kind: 'group', e, n: 10 }, { kind: 'group', e, n }], correct: num(ans), wrong: [num(a), num(b)],
    };
  }
  return {
    skill: 'tens',
    prompt: msg(variant === 'tenMore' ? 'flight.p.tenMore' : 'flight.p.teenAdd', { n }),
    help: msg('flight.h.tenMore', { n }),
    correct: num(ans),
    wrong: [num(a), num(b)],
  };
}

/** Line-up animals, all different in outline (the prototype's critter line). */
const LINE_UP = ['🐝', '🐞', '🦋', '🐌', '🐸', '🐢', '🐟', '🐧'];

/** Who is 3rd? Five animals in a line; count from the left. */
function genOrdinal(rng: Rng): Draft {
  const line = pickN(rng, LINE_UP, 5);
  const pos = rng.int(1, 5);
  // slips: the one just before or after
  const near = [pos - 2, pos].filter((i) => i >= 0 && i < 5);
  const far = rng.shuffle([0, 1, 2, 3, 4].filter((i) => i !== pos - 1 && !near.includes(i)));
  const [i, j] = [...rng.shuffle(near), ...far];
  return {
    skill: 'ordinal',
    prompt: msg('flight.p.ordinal', { ord: msg(`flight.ord.${pos}`) }),
    help: msg('flight.h.ordinal', { ord: msg(`flight.ord.${pos}`) }),
    picture: line.map((e): GateVisual => ({ kind: 'emoji', e })),
    correct: { kind: 'emoji', e: line[pos - 1] },
    wrong: [{ kind: 'emoji', e: line[i] }, { kind: 'emoji', e: line[j] }],
  };
}

/** 1 more than n / 1 less than n. */
function genOneMore(rng: Rng): Draft {
  const more = rng.bool();
  const n = more ? rng.int(2, 18) : rng.int(3, 20);
  const ans = more ? n + 1 : n - 1;
  // slips: the other way, or two steps
  const [a, b] = slips(rng, ans, rng.shuffle([more ? n - 1 : n + 1, more ? n + 2 : n - 2]), 1, 20);
  return { skill: 'oneMore', prompt: msg(more ? 'flight.p.oneMore' : 'flight.p.oneLess', { n }), help: msg(more ? 'flight.h.next' : 'flight.h.oneLess', { n }), correct: num(ans), wrong: [num(a), num(b)] };
}

/** a + ? = c */
function genMissingAdd(rng: Rng): Draft {
  let a = 0;
  let b = 0;
  do { a = rng.int(1, 7); b = rng.int(1, 9 - a); } while (a === b);
  const c = a + b;
  const [x, y] = slips(rng, b, rng.shuffle([b + 1, b - 1, c]), 1, 10);
  return { skill: 'missingAdd', prompt: msg('flight.p.missingAdd', { a, c }), help: msg('flight.h.missingAdd', { a, c }), correct: num(b), wrong: [num(x), num(y)] };
}

/** a − ? = c */
function genMissingSub(rng: Rng): Draft {
  let a = 0;
  let b = 0;
  do { a = rng.int(5, 10); b = rng.int(1, a - 1); } while (a - b === b);
  const c = a - b;
  const [x, y] = slips(rng, b, rng.shuffle([b + 1, b - 1, a]), 1, 10);
  return { skill: 'missingSub', prompt: msg('flight.p.missingSub', { a, c }), help: msg('flight.h.missingSub', { a, c }), correct: num(b), wrong: [num(x), num(y)] };
}

/** Near doubles: n + (n + 1). */
function genNearDouble(rng: Rng, world: FlightWorld): Draft {
  const a = rng.int(2, 6);
  const e = rng.pick(THINGS[world]);
  const ans = 2 * a + 1;
  // slips: the double itself, or one too many
  const [x, y] = slips(rng, ans, rng.shuffle([2 * a, 2 * a + 2]), 1, 14);
  return {
    skill: 'nearDouble', prompt: msg('flight.p.nearDouble', { a, b: a + 1 }), help: msg('flight.h.nearDouble', { a, d: 2 * a }),
    picture: [{ kind: 'group', e, n: a }, { kind: 'group', e, n: a + 1 }], correct: num(ans), wrong: [num(x), num(y)],
  };
}

/** a + b + c */
function genAdd3(rng: Rng, world: FlightWorld): Draft {
  const a = rng.int(1, 4);
  const b = rng.int(1, 4);
  const c = rng.int(1, 3);
  const e = rng.pick(THINGS[world]);
  const ans = a + b + c;
  // slips: adding only two of them, or one off
  const [x, y] = slips(rng, ans, rng.shuffle([a + b, ans + 1, ans - 1]), 1, 12);
  return {
    skill: 'add3', prompt: msg('flight.p.add3', { a, b, c }), help: msg('flight.h.add3', { a, b, c, ab: a + b }),
    picture: [{ kind: 'group', e, n: a }, { kind: 'group', e, n: b }, { kind: 'group', e, n: c }], correct: num(ans), wrong: [num(x), num(y)],
  };
}

const STORY_ADD = [{ k: 'frogs', e: '🐸' }, { k: 'bees', e: '🐝' }, { k: 'berries', e: '🍓' }, { k: 'ducks', e: '🦆' }, { k: 'ladybirds', e: '🐞' }] as const;
const STORY_SUB = [{ k: 'apples', e: '🍎' }, { k: 'butterflies', e: '🦋' }, { k: 'berries', e: '🍓' }, { k: 'balloons', e: '🎈' }, { k: 'frogs', e: '🐸' }] as const;

/** Story problems: put together (orchard) or take away (ice); the garden has both. */
function genStory(rng: Rng, world: FlightWorld): Draft {
  const add = world === 'orchard' ? true : world === 'ice' ? false : rng.bool();
  if (add) {
    const s = rng.pick(STORY_ADD);
    const a = rng.int(2, 6);
    const b = rng.int(1, 4);
    const [x, y] = nearNumbers(rng, a + b, 1, 11);
    return {
      skill: 'story', prompt: msg(`flight.p.story.add.${s.k}`, { a, b }), help: msg('flight.h.add', { a, b }),
      picture: [{ kind: 'group', e: s.e, n: a }, { kind: 'group', e: s.e, n: b }], correct: num(a + b), wrong: [num(x), num(y)],
    };
  }
  const s = rng.pick(STORY_SUB);
  let a = 0;
  let b = 0;
  do { a = rng.int(4, 9); b = rng.int(1, a - 1); } while (a - b === b);
  const [x, y] = nearNumbers(rng, a - b, 0, 10);
  return {
    skill: 'story', prompt: msg(`flight.p.story.sub.${s.k}`, { a, b }), help: msg('flight.h.sub', { a, b }),
    picture: [{ kind: 'group', e: s.e, n: a }], correct: num(a - b), wrong: [num(x), num(y)],
  };
}

/** Adding and taking away zero, and taking away all (orchard: + 0; ice: − 0 and − all). */
function genZero(rng: Rng, world: FlightWorld): Draft {
  const variant = rng.pick(world === 'orchard' ? ['plus0'] as const : world === 'ice' ? ['minus0', 'minusAll'] as const : ['plus0', 'minus0', 'minusAll'] as const);
  const n = rng.int(2, 12);
  const e = rng.pick(THINGS[world]);
  const ans = variant === 'minusAll' ? 0 : n;
  const [x, y] = variant === 'minusAll' ? slips(rng, 0, rng.shuffle([1, n]), 0, 12) : slips(rng, n, rng.shuffle([n + 1, n - 1]), 0, 13);
  return {
    skill: 'zero', prompt: msg(`flight.p.${variant}`, { n }), help: msg(`flight.h.${variant}`),
    picture: [{ kind: 'group', e, n }], correct: num(ans), wrong: [num(x), num(y)],
  };
}

/** Which sum makes n? The other two make one more and one less. */
function genWhichMakes(rng: Rng): Draft {
  const n = rng.int(4, 10);
  const a = rng.int(1, n - 1);
  const w1 = rng.int(1, n - 1);
  const w2 = rng.int(1, n - 2);
  const ex = (x: number, y: number): GateVisual => ({ kind: 'expr', a: x, b: y });
  return { skill: 'whichMakes', prompt: msg('flight.p.whichMakes', { n }), help: msg('flight.h.whichMakes', { n }), correct: ex(a, n - a), wrong: [ex(w1, n - w1 + 1), ex(w2, n - w2 - 1)] };
}

/** How many more? Frog has 7 strawberries, Turtle has 3. */
function genDifference(rng: Rng): Draft {
  let big = 0;
  let small = 0;
  do { big = rng.int(5, 10); small = rng.int(1, big - 1); } while (big - small === small);
  const ans = big - small;
  // slips: the smaller number, or one off
  const [x, y] = slips(rng, ans, rng.shuffle([ans + 1, ans - 1, small]), 1, 10);
  return {
    skill: 'difference', prompt: msg('flight.p.difference', { big, small }), help: msg('flight.h.difference'),
    picture: [{ kind: 'group', e: '🍓', n: big }, { kind: 'group', e: '🍓', n: small }], correct: num(ans), wrong: [num(x), num(y)],
  };
}

/** Fact families: a + b = s, so s − b = ? */
function genFamily(rng: Rng): Draft {
  let a = 0;
  let b = 0;
  do { a = rng.int(2, 6); b = rng.int(2, 6); } while (a === b);
  const [x, y] = slips(rng, a, rng.shuffle([b, a + 1, a - 1]), 1, 12);
  return { skill: 'family', prompt: msg('flight.p.family', { a, b, s: a + b }), help: msg('flight.h.family', { a, b, s: a + b }), correct: num(a), wrong: [num(x), num(y)] };
}

/** Growing pattern: groups of 1, 2, 3 … how many in the next group? */
function genGrow(rng: Rng, world: FlightWorld): Draft {
  const k = rng.int(1, 3);
  const e = rng.pick(THINGS[world]);
  const ans = k + 3;
  const [x, y] = slips(rng, ans, rng.shuffle([ans - 1, ans + 1, ans + 2]), 1, 9);
  return {
    skill: 'grow', prompt: msg('flight.p.grow'), help: msg('flight.h.grow'),
    picture: [k, k + 1, k + 2].map((n): GateVisual => ({ kind: 'group', e, n })), correct: num(ans), wrong: [num(x), num(y)],
  };
}

/** Number riddles: between, 1 or 2 more / less, just after. */
function genRiddle(rng: Rng): Draft {
  const variant = rng.pick(['between', 'moreLess', 'more', 'less', 'after'] as const);
  let ans = 0;
  let prompt: Msg;
  if (variant === 'between' || variant === 'moreLess') {
    const a = rng.int(1, 18);
    ans = a + 1;
    prompt = msg(`flight.p.riddle.${variant}`, { a, b: a + 2 });
  } else if (variant === 'more') {
    const k = rng.pick([1, 2]);
    const n = rng.int(3, 17);
    ans = n + k;
    prompt = msg('flight.p.riddle.more', { k, n });
  } else if (variant === 'less') {
    const k = rng.pick([1, 2]);
    let n = 0;
    do n = rng.int(4, 20); while (n - k === k);
    ans = n - k;
    prompt = msg('flight.p.riddle.less', { k, n });
  } else {
    const n = rng.int(1, 19);
    ans = n + 1;
    prompt = msg('flight.p.riddle.after', { n });
  }
  const [x, y] = nearNumbers(rng, ans, 1, 20, [-1, 1], [-2, 2]);
  return { skill: 'riddle', prompt, help: msg('flight.h.riddle'), correct: num(ans), wrong: [num(x), num(y)] };
}

/** Count only one shape in a row of triangles, squares and circles. */
function genCountShape(rng: Rng): Draft {
  const pool: ShapeId[] = ['triangle', 'square', 'circle'];
  const target = rng.pick(pool);
  const len = rng.int(6, 8);
  const row: ShapeId[] = [target, ...Array.from({ length: len - 1 }, () => rng.pick(pool))];
  const shuffled = rng.shuffle(row);
  const n = shuffled.filter((x) => x === target).length;
  // slips: counting all of them, or one off
  const [a, b] = slips(rng, n, rng.shuffle([n + 1, n - 1]).concat([len]), 1, 9);
  return {
    skill: 'countShape', prompt: msg('flight.p.countShape', { shapes: msg(`flight.shapes.${target}`) }), help: msg('flight.h.countShape', { shapes: msg(`flight.shapes.${target}`) }),
    picture: shuffled.map((x): GateVisual => ({ kind: 'shape', shape: x })), correct: num(n), wrong: [num(a), num(b)],
  };
}

/** Equal shares: a pizza cut into 2 or 4 equal parts — each part is one half / one fourth. */
function genFraction(rng: Rng): Draft {
  const n = rng.pick([2, 4]);
  const word = (k: string): GateVisual => ({ kind: 'word', m: msg(`flight.w.${k}`) });
  return {
    skill: 'fraction', prompt: msg('flight.p.fraction'), help: msg(n === 2 ? 'flight.h.halves' : 'flight.h.fourths'),
    picture: [{ kind: 'parts', n }], correct: word(n === 2 ? 'half' : 'fourth'), wrong: [word(n === 2 ? 'fourth' : 'half'), word('third')],
  };
}

/** Shape facts: faces on a cube, flat faces on a can, sides of a stop sign, corners on two triangles. */
function genFaces(rng: Rng): Draft {
  const facts = [
    { k: 'cube', a: 6, picture: [{ kind: 'shape', shape: 'cube' }] },
    { k: 'can', a: 2, picture: [{ kind: 'shape', shape: 'cylinder' }] },
    { k: 'stop', a: 8, picture: [{ kind: 'emoji', e: '🛑' }] },
    { k: 'triangles', a: 6, picture: [{ kind: 'shape', shape: 'triangle' }, { kind: 'shape', shape: 'triangle' }] },
  ] as const;
  const f = rng.pick(facts);
  const [x, y] = nearNumbers(rng, f.a, 1, 10, [-1, 1], [-2, 2]);
  return { skill: 'faces', prompt: msg(`flight.p.faces.${f.k}`), help: msg(`flight.h.faces.${f.k}`), picture: [...f.picture] as GateVisual[], correct: num(f.a), wrong: [num(x), num(y)] };
}

/** It is 4 o'clock. What time is it 1 hour later? */
function genLater(rng: Rng): Draft {
  const h = rng.int(1, 11);
  const clock = (hh: number, mm: 0 | 30): GateVisual => ({ kind: 'clock', h: hh, m: mm });
  const slipsC = rng.shuffle([clock(h, 0), clock(wrapHour(h - 1), 0), clock(h, 30)]);
  return {
    skill: 'later', prompt: msg('flight.p.later', { time: timeMsg(h, 0) }), help: msg('flight.h.later', { h, h1: h + 1 }),
    picture: [clock(h, 0)], correct: clock(h + 1, 0), wrong: [slipsC[0], slipsC[1]],
  };
}

/** Which month comes after / before …? */
function genMonth(rng: Rng): Draft {
  const i = rng.int(0, 11);
  const after = rng.bool();
  const m = (k: number): GateVisual => ({ kind: 'word', m: msg(`month.${(((k % 12) + 12) % 12) + 1}`) });
  const step = after ? 1 : -1;
  return {
    skill: 'month',
    prompt: msg(after ? 'flight.p.monthAfter' : 'flight.p.monthBefore', { month: msg(`month.${i + 1}`) }),
    help: msg('flight.h.month'),
    correct: m(i + step),
    wrong: [m(i - step), m(i + 2 * step)],
  };
}

/** Time facts: days in a week, months in a year, minutes in an hour, numbers on a clock. */
function genTimeFact(rng: Rng): Draft {
  const facts = [{ k: 'week', a: 7, d: [5, 10] }, { k: 'year', a: 12, d: [10, 7] }, { k: 'hour', a: 60, d: [100, 30] }, { k: 'clock', a: 12, d: [10, 24] }];
  const f = rng.pick(facts);
  const [x, y] = rng.shuffle(f.d);
  return { skill: 'timeFact', prompt: msg(`flight.p.fact.${f.k}`), help: msg(`flight.h.fact.${f.k}`), correct: num(f.a), wrong: [num(x), num(y)] };
}

/** At 3 o'clock, where does the long hand point? (12; the slips are the hour and 6) */
function genLongHand(rng: Rng): Draft {
  const h = rng.pick([1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);
  return { skill: 'longHand', prompt: msg('flight.p.longHand', { h }), help: msg('flight.h.longHand'), correct: num(12), wrong: [num(h), num(6)] };
}

const DURATIONS = ['second', 'minute', 'hour', 'day'] as const;

/** Which is longer / shorter: 1 second, 1 minute, 1 hour, 1 day? */
function genDuration(rng: Rng): Draft {
  const picks = pickN(rng, [0, 1, 2, 3], 3).sort((a, b) => a - b);
  const longer = rng.bool();
  const ans = longer ? picks[2] : picks[0];
  const others = picks.filter((i) => i !== ans);
  const w = (i: number): GateVisual => ({ kind: 'word', m: msg(`flight.w.one.${DURATIONS[i]}`) });
  return { skill: 'duration', prompt: msg(longer ? 'flight.p.longest' : 'flight.p.shortest'), help: msg('flight.h.duration'), correct: w(ans), wrong: [w(others[0]), w(others[1])] };
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
    case 'odd': return genOdd(rng);
    case 'shape2d': return genShape2d(rng);
    case 'shape3d': return genShape3d(rng);
    case 'clock': return genClock(rng);
    case 'day': return genDay(rng);
    case 'missing': return genMissing(rng);
    case 'countdown': return genCountdown(rng, world);
    case 'tens': return genTens(rng, world);
    case 'ordinal': return genOrdinal(rng);
    case 'oneMore': return genOneMore(rng);
    case 'missingAdd': return genMissingAdd(rng);
    case 'nearDouble': return genNearDouble(rng, world);
    case 'add3': return genAdd3(rng, world);
    case 'story': return genStory(rng, world);
    case 'zero': return genZero(rng, world);
    case 'whichMakes': return genWhichMakes(rng);
    case 'missingSub': return genMissingSub(rng);
    case 'difference': return genDifference(rng);
    case 'family': return genFamily(rng);
    case 'grow': return genGrow(rng, world);
    case 'riddle': return genRiddle(rng);
    case 'countShape': return genCountShape(rng);
    case 'fraction': return genFraction(rng);
    case 'faces': return genFaces(rng);
    case 'later': return genLater(rng);
    case 'month': return genMonth(rng);
    case 'timeFact': return genTimeFact(rng);
    case 'longHand': return genLongHand(rng);
    case 'duration': return genDuration(rng);
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

/**
 * Two questions are "the same" when they ask the same thing about the same picture. Odd one out
 * has no picture (its prompt is always the same), so there the gates themselves count.
 */
export const sameQuestionKey = (q: { skill: FlightSkill; prompt: Msg; picture?: GateVisual[]; choices?: { visual: GateVisual }[]; correct?: GateVisual; wrong?: GateVisual[] }) => {
  const gates = q.skill === 'odd' ? (q.choices?.map((c) => c.visual) ?? [q.correct!, ...q.wrong!]).map(visualKey).sort() : [];
  return JSON.stringify([q.prompt, (q.picture ?? []).map(visualKey), gates]);
};

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
