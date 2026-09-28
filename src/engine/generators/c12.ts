import type { TemplateDef, Generated } from '../template';
import { opt } from '../template';
import { addMinutes, formatTime } from '../math';
import { msg, type ErrorTag, type QuestionInstance, type Response } from '../types';
import type { Rng } from '../rng';

const tid = (h: number, m: number) => `t${h}:${String(m).padStart(2, '0')}`;
const timeOpt = (h: number, m: number) => opt(tid(h, m), msg('time', { t: formatTime(h, m) }));
const hour12 = (h: number) => ((h - 1 + 12) % 12) + 1;

/** Plausible confusions, each a real clock time (so all options are well-formed). */
function confusions(h: number, m: number): [number, number][] {
  const out: [number, number][] = [];
  if (m % 5 === 0 && m !== 0) out.push([hour12(m / 5), (h % 12) * 5]); // hands swapped
  if (m % 5 === 0 && m > 0 && m / 5 < 10) out.push([h, m / 5]); // minute read as the numeral
  out.push([hour12(h + 1), m]); // hour hand read as the next hour
  out.push([hour12(h - 1), m]);
  out.push([h, (m + 5) % 60]);
  out.push([h, (m + 55) % 60]);
  return out;
}

function timeChoice(rng: Rng, h: number, m: number) {
  const seen = new Set([tid(h, m)]);
  const opts = [timeOpt(h, m)];
  for (const [hh, mm] of confusions(h, m)) {
    if (opts.length >= 4) break;
    if (!seen.has(tid(hh, mm))) {
      seen.add(tid(hh, mm));
      opts.push(timeOpt(hh, mm));
    }
  }
  return { kind: 'choice' as const, options: rng.shuffle(opts), value: tid(h, m) };
}

function explainTime(h: number, m: number) {
  return msg('c12.explainRead', { h, m, t: formatTime(h, m), mark: m === 0 ? 12 : m / 5 });
}

function readQuestion(rng: Rng, h: number, m: number): Generated {
  return {
    prompt: msg('c12.read'),
    plain: msg('c12.readPlain'),
    scene: { type: 'clock', h, m, mode: 'read' },
    answer: timeChoice(rng, h, m),
    hints: [msg('hint.c12.shortHand'), m === 0 ? msg('hint.c12.longAt12') : msg('hint.c12.longHandFives', { mark: m / 5, m })],
    explain: explainTime(h, m),
    plainPicture: true,
  };
}

function setQuestion(h: number, m: number, startH: number): Generated {
  return {
    prompt: msg('c12.set', { t: formatTime(h, m) }),
    scene: { type: 'clock', h, m, mode: 'set', startH, startM: 0 },
    answer: { kind: 'time', h, m },
    hints: [msg('hint.c12.setLongFirst', { mark: m === 0 ? 12 : m / 5 }), msg('hint.c12.setShort', { h })],
    explain: explainTime(h, m),
  };
}

function timeDiag(q: QuestionInstance, r: Response): ErrorTag | null {
  const exp = q.answer.kind === 'time' ? { h: q.answer.h, m: q.answer.m } : parse((q.answer as { value: string }).value);
  const got = r.kind === 'time' ? { h: r.h, m: r.m } : r.kind === 'choice' && r.value ? parse(r.value) : null;
  if (!got || !exp) return 'no-answer';
  if (got.h === exp.h && got.m === exp.m) return null;
  if (exp.m % 5 === 0 && got.h === hour12(exp.m / 5) && got.m === (exp.h % 12) * 5) return 'hour-minute-swap';
  if (got.h === exp.h && got.m === exp.m / 5) return 'minute-as-number';
  if (got.m === exp.m && (got.h === hour12(exp.h + 1) || got.h === hour12(exp.h - 1))) return 'hour-hand-position';
  return 'other';
}
function parse(id: string) {
  const mt = /^t(\d+):(\d+)$/.exec(id);
  return mt ? { h: Number(mt[1]), m: Number(mt[2]) } : null;
}

export const C12: TemplateDef[] = [
  {
    id: 'c12-e-read', category: 'C12', stage: 'explore', subskill: 'C12.hours', source: 'prerequisite',
    title: 'Read o\'clock times',
    generate: (rng) => readQuestion(rng, rng.int(1, 12), 0),
    diagnose: timeDiag,
  },
  {
    id: 'c12-e-set', category: 'C12', stage: 'explore', subskill: 'C12.hours', source: 'prerequisite',
    title: 'Set the hands to an o\'clock time',
    generate: (rng) => {
      const h = rng.int(1, 12);
      return setQuestion(h, 0, hour12(h + rng.int(2, 6)));
    },
    diagnose: timeDiag,
  },
  {
    id: 'c12-e-match', category: 'C12', stage: 'explore', subskill: 'C12.hours', source: 'prerequisite',
    title: 'Pick the clock that shows a digital o\'clock time',
    generate: (rng) => {
      const h = rng.int(1, 12);
      const others = rng.shuffle([hour12(h + 1), hour12(h - 1), hour12(h + 6)]).slice(0, 2);
      const opts = rng.shuffle([h, ...others]).map((x) => opt(tid(x, 0), msg('time', { t: formatTime(x, 0) }), { type: 'clock', h: x, m: 0 }));
      return {
        prompt: msg('c12.match', { t: formatTime(h, 0) }),
        scene: { type: 'clock', h, m: 0, mode: 'digital' },
        answer: { kind: 'choice', options: opts, value: tid(h, 0) },
        hints: [msg('hint.c12.oclockLong'), msg('hint.c12.shortHand')],
        explain: explainTime(h, 0),
      };
    },
    diagnose: timeDiag,
  },
  {
    id: 'c12-p-half', category: 'C12', stage: 'practise', subskill: 'C12.halfQuarter', source: 'prerequisite',
    title: 'Read half past times (hour hand halfway)',
    generate: (rng) => readQuestion(rng, rng.int(1, 12), 30),
    diagnose: timeDiag,
  },
  {
    id: 'c12-p-quarter', category: 'C12', stage: 'practise', subskill: 'C12.halfQuarter', source: 'observed',
    title: 'Read quarter past and quarter to', worksheetRefs: ['Q25 option 10.15'],
    generate: (rng) => readQuestion(rng, rng.int(1, 12), rng.pick([15, 45])),
    diagnose: timeDiag,
  },
  {
    id: 'c12-p-set', category: 'C12', stage: 'practise', subskill: 'C12.halfQuarter', source: 'prerequisite',
    title: 'Set half past / quarter times',
    generate: (rng) => {
      const h = rng.int(1, 12);
      return setQuestion(h, rng.pick([15, 30, 45]), hour12(h + rng.int(2, 5)));
    },
    diagnose: timeDiag,
  },
  {
    id: 'c12-a-five', category: 'C12', stage: 'apply', subskill: 'C12.fiveMin', source: 'observed',
    title: 'Read five-minute times (e.g. 10:10)', worksheetRefs: ['Q25 (10:05 / 10:15 / 10:10)'],
    generate: (rng) => {
      if (rng.bool(0.25)) return readQuestion(rng, 10, 10);
      return readQuestion(rng, rng.int(1, 12), rng.pick([5, 10, 20, 25, 35, 40, 50, 55]));
    },
    diagnose: timeDiag,
  },
  {
    id: 'c12-a-setfive', category: 'C12', stage: 'apply', subskill: 'C12.fiveMin', source: 'extension',
    title: 'Set the hands to a five-minute time',
    generate: (rng) => {
      const h = rng.int(1, 12);
      return setQuestion(h, rng.int(1, 11) * 5, hour12(h + rng.int(2, 5)));
    },
    diagnose: timeDiag,
  },
  {
    id: 'c12-a-elapsed', category: 'C12', stage: 'apply', subskill: 'C12.elapsed', source: 'extension',
    title: 'EXTENSION: what time will it be after N minutes? (e.g. 9:45 + 30 min = 10:15)',
    generate: (rng) => {
      const h = rng.int(1, 12);
      const m = rng.pick([0, 15, 30, 45]);
      const elapsed = rng.pick([15, 30, 45]);
      const end = addMinutes(h, m, elapsed);
      return {
        prompt: msg('c12.elapsed', { t: formatTime(h, m), n: elapsed }),
        scene: { type: 'clock', h: end.h, m: end.m, mode: 'read', startH: h, startM: m, elapsed },
        answer: timeChoice(rng, end.h, end.m),
        hints: [msg('hint.c12.moveLong', { n: elapsed }), msg('hint.c12.passTwelve')],
        explain: msg('c12.explainElapsed', { t: formatTime(h, m), n: elapsed, e: formatTime(end.h, end.m) }),
      };
    },
    diagnose: timeDiag,
  },
];
