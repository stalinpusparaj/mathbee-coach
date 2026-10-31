import { beforeEach, describe, expect, it } from 'vitest';
import {
  GATE_ANSWER_COUNT,
  GATE_COOLOFF_MS,
  GATE_MAX_DIGITS,
  GATE_TRIES,
  bilingual,
  gateResting,
  gateSubmit,
  makeGateTask,
  newGateState,
  resetGateMemory,
  GATE_TRIES_MEMORY_MS,
} from '../../src/components/ParentGate';
import { EN, TA } from '../../src/i18n/packs/parent';
import { homeIdeas } from '../../src/report/parentReport';

/** Small deterministic PRNG (mulberry32) so the statistics below are reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => resetGateMemory());

describe('parent gate task', () => {
  it('is always a 2-digit × 1-digit multiplication with a 3-digit answer', () => {
    const r = rng(1);
    for (let i = 0; i < 5000; i++) {
      const task = makeGateTask(r);
      expect(task.a).toBeGreaterThanOrEqual(12);
      expect(task.a).toBeLessThanOrEqual(49);
      expect(task.a % 10).not.toBe(0);
      expect(task.b).toBeGreaterThanOrEqual(3);
      expect(task.b).toBeLessThanOrEqual(9);
      expect(task.answer).toBe(task.a * task.b);
      expect(task.answer).toBeGreaterThanOrEqual(100);
      expect(task.answer).toBeLessThanOrEqual(999);
    }
  });

  it('varies, so an answer cannot be memorised', () => {
    const r = rng(2);
    const answers = new Set(Array.from({ length: 300 }, () => makeGateTask(r).answer));
    expect(answers.size).toBeGreaterThan(50);
  });

  it('no single answer is likely enough to guess: every answer has probability ≤ 1/100', () => {
    const r = rng(3);
    const n = 50_000;
    const counts = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const a = makeGateTask(r).answer;
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    expect(GATE_ANSWER_COUNT).toBeGreaterThanOrEqual(100);
    expect(counts.size).toBe(GATE_ANSWER_COUNT);
    // answers are chosen uniformly: the best fixed guess is 1/138, with sampling slack
    const top = Math.max(...counts.values()) / n;
    expect(top).toBeLessThanOrEqual(1 / 100);
  });
});

describe('random tapping', () => {
  it('passes with probability ≤ 1/100 per attempt (keypad mashing, 1 to 4 digits)', () => {
    const r = rng(4);
    const taps = rng(5);
    const trials = 100_000;
    let passes = 0;
    for (let i = 0; i < trials; i++) {
      const st = newGateState(r, 0);
      const len = 1 + Math.floor(taps() * GATE_MAX_DIGITS);
      let typed = '';
      for (let d = 0; d < len; d++) typed += Math.floor(taps() * 10);
      if (gateSubmit(st, Number(typed), 0, r).result === 'pass') passes++;
    }
    expect(passes / trials).toBeLessThanOrEqual(1 / 100);
  });

  it('a whole round of 3 random tries before the cool-off still passes ≤ 1/100 of the time', () => {
    const r = rng(6);
    const taps = rng(7);
    const rounds = 30_000;
    let passes = 0;
    for (let i = 0; i < rounds; i++) {
      resetGateMemory();
      let st = newGateState(r, 0);
      for (let k = 0; k < GATE_TRIES; k++) {
        const res = gateSubmit(st, Math.floor(taps() * 1000), 0, r);
        st = res.st;
        if (res.result === 'pass') { passes++; break; }
      }
    }
    expect(passes / rounds).toBeLessThanOrEqual(1 / 100);
  });
});

describe('gate state', () => {
  it('passes on the right answer', () => {
    const st = newGateState(rng(8), 0);
    expect(gateSubmit(st, st.task.answer, 0).result).toBe('pass');
  });

  it('gives a new question after each wrong answer, and rests after 3 wrong answers', () => {
    const r = rng(9);
    let st = newGateState(r, 1000);
    const first = st.task;
    let res = gateSubmit(st, null, 1000, r);
    expect(res.result).toBe('wrong');
    expect(res.st.triesLeft).toBe(GATE_TRIES - 1);
    st = res.st;
    res = gateSubmit(st, first.answer + 1, 1000, r);
    expect(res.result).toBe('wrong');
    st = res.st;
    res = gateSubmit(st, -1, 1000, r);
    expect(res.result).toBe('cooloff');
    st = res.st;
    expect(st.coolUntil).toBe(1000 + GATE_COOLOFF_MS);
    expect(gateResting(st, 1000 + GATE_COOLOFF_MS - 1)).toBe(true);
    // while resting even the right answer is not accepted
    expect(gateSubmit(st, st.task.answer, 2000).result).toBe('resting');
    // after 30 s it works again, with a full set of tries
    expect(gateResting(st, 1000 + GATE_COOLOFF_MS)).toBe(false);
    expect(st.triesLeft).toBe(GATE_TRIES);
    expect(gateSubmit(st, st.task.answer, 1000 + GATE_COOLOFF_MS).result).toBe('pass');
  });

  it('remembers the cool-off when the gate is closed and opened again', () => {
    const r = rng(10);
    let st = newGateState(r, 0);
    for (let k = 0; k < GATE_TRIES; k++) st = gateSubmit(st, -1, 0, r).st;
    const reopened = newGateState(r, 5_000);
    expect(gateResting(reopened, 5_000)).toBe(true);
    expect(gateResting(newGateState(r, GATE_COOLOFF_MS + 1), GATE_COOLOFF_MS + 1)).toBe(false);
  });

  it('remembers wrong tries when the gate is cancelled and opened again (no endless fresh tries)', () => {
    const r = rng(11);
    let st = newGateState(r, 0);
    st = gateSubmit(st, -1, 0, r).st;
    st = gateSubmit(st, -1, 1000, r).st;
    st = newGateState(r, 2000); // cancel and reopen
    expect(st.triesLeft).toBe(1);
    expect(gateSubmit(st, -1, 3000, r).result).toBe('cooloff');
  });

  it('forgets old wrong tries after a while, and after a pass', () => {
    const r = rng(12);
    const st = gateSubmit(newGateState(r, 0), -1, 0, r).st;
    expect(newGateState(r, 1000).triesLeft).toBe(GATE_TRIES - 1);
    expect(newGateState(r, GATE_TRIES_MEMORY_MS).triesLeft).toBe(GATE_TRIES);
    gateSubmit(st, st.task.answer, 1000, r);
    expect(newGateState(r, 2000).triesLeft).toBe(GATE_TRIES);
  });
});

describe('bilingual instructions', () => {
  const gateKeys = Object.keys(EN).filter((k) => k.startsWith('gate.'));

  it('every gate string exists in English and Tamil', () => {
    expect(gateKeys.length).toBeGreaterThan(5);
    for (const k of gateKeys) {
      expect(TA[k], k).toBeTruthy();
      expect(TA[k]).not.toBe(EN[k]);
      expect(TA[k], k).toMatch(/[஀-௿]/);
    }
  });

  it('every parent pack key has a Tamil draft', () => {
    expect(Object.keys(TA).sort()).toEqual(Object.keys(EN).sort());
  });

  it('shows the child’s language first and the other language second', () => {
    const [en, ta] = bilingual('gate.ask', 'en');
    expect(en).toBe(EN['gate.ask']);
    expect(ta).toBe(TA['gate.ask']);
    const [ta2, en2] = bilingual('gate.ask', 'ta');
    expect(ta2).toBe(TA['gate.ask']);
    expect(en2).toBe(EN['gate.ask']);
    const [w1, w2] = bilingual('gate.wait', 'en', { s: 30 });
    expect(w1).toContain('30');
    expect(w2).toContain('30');
  });
});

describe('home ideas in the parent report', () => {
  it('suggests starter topics when there is no evidence', () => {
    const h = homeIdeas([], []);
    expect(h.tryAtHome.map((x) => x.category)).toEqual(['C01', 'C07', 'C11']);
    expect(h.playTogether).toHaveLength(2);
  });

  it('puts topics that need support first, and plays together on what the child can do', () => {
    const h = homeIdeas(
      [
        { kind: 'can', subskill: 'C12.oclock' },
        { kind: 'support', subskill: 'C08.join10' },
        { kind: 'assess', subskill: 'C03.vocab' },
      ],
      [],
    );
    expect(h.tryAtHome[0].category).toBe('C08');
    expect(h.tryAtHome[1].category).toBe('C03');
    expect(h.playTogether[0].category).toBe('C12');
    expect(h.tryAtHome.length).toBeLessThanOrEqual(3);
    expect(h.playTogether.length).toBeLessThanOrEqual(2);
  });

  it('every idea has an English and a Tamil string', () => {
    for (let c = 1; c <= 14; c++) {
      const id = `C${String(c).padStart(2, '0')}`;
      for (const k of [`home.try.${id}`, `home.play.${id}`]) {
        expect(EN[k], k).toBeTruthy();
        expect(TA[k], k).toBeTruthy();
      }
    }
  });
});
