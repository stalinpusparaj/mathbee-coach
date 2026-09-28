# Test results

Recorded on 2026-09-27 on macOS (Darwin 25.5), Node 26.8, Chrome (stable, via Playwright `channel: 'chrome'`).

## Commands and outcomes

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | passed (no errors) |
| `npm test` (Vitest) | **88 / 88 passed**, 4 files |
| `npm run build` | passed; `dist/` 3.1 MB (JS 1 chunk ~600 kB / ~165 kB gzip; Vite prints its >500 kB chunk advisory) |
| `npm run test:e2e` (Playwright, production build) | **14 / 14 passed** |

## Unit tests (`tests/unit`)

- **generators.test.ts** — for each of the 42 category-stage combinations: ≥3 templates; every template × 60 seeds passes validation and the pure answer check; parameter variety; determinism; stage bounds (counts, sums, no negative early subtraction, regrouping only in its own template); pairs arithmetic; no "rectangle" distractor for a square.
- **math.test.ts** — exact cases: empty count = 0; 11 flowers = 5 pairs + 1; 10 roses = 5 pairs; 12 + 8 = 20; 11 + 19 = 30; 19 − 11 = 8; 48 − 20 = 28; 27 − 17 = 10; 20 − 6 = 14; 59, 58, __, 56 → 57; day before Monday = Sunday; Friday + 3 = Monday; 10:10 → minute hand 60°, hour hand 305°; 9:45 + 30 min = 10:15; July 2025 layout (1st Tue, 15th Tue, 11th Fri, last Friday 25th); July 7→27 = 20 elapsed, 21 inclusive; leap years, Feb/Mar and Dec/Jan transitions; day-number round trip.
- **learning.test.ts** — untested skills are "not assessed", never weak; supported completion cannot create mastery; correct retry ≠ independent; mastery needs accuracy + sessions + templates + later-day retention, and transfer needs a new format; worked examples are not attempts; duplicate checks/finishes/refresh cannot duplicate nectar; skipping is penalty-free; assessment follow-ups; prerequisite offer after two errors; daily mix prioritises assessment; review intervals and overdue handling; review schedule survives save/reload; one error is only a single observation; parent report matches recorded attempts; official mock requires confirmed rules; mock scoring records unassisted attempts; import rejects malformed/unknown/future data; active time excludes narration and hidden tabs; seeing the solution first makes an attempt non-independent.
- **i18n.test.ts** — every generated message resolves in English with no leftover placeholders; Tamil covers all question-content keys; every UI key used in source exists; plural and ordinal formatting.

## Browser tests (`tests/e2e/flows.spec.ts`)

1. Profile → assessment → wrong answer (specific feedback, work kept) → hint → success → reward → **refresh → resume the same question** → no duplicate reward → results.
2. Lesson (worked example, guided, independent) → results → practice → stop early without penalty.
3. **All 42 category-stage combinations** opened from the map and answered correctly.
4. Keyboard-only answer (digits + Enter); Escape pauses.
5. Generic test: no hints/feedback, answer survives refresh, submit confirmation, "not the official format" label.
6. Official mock hidden until the parent enters and confirms rules (press-and-hold parent gate).
7. Parent report counts real attempts, has no readiness score; malformed import rejected; reset cancellation keeps data.
8. Storage blocked (IndexedDB and localStorage throw): warning shown, play continues.
9. Offline: after the first visit, reload with the network off; app and art load, a session plays, no broken images.
10–13. Layout at 390×844 (phone, touch), 768×1024, 1024×768, 1440×900: no horizontal scrolling on map and four scene types; screenshots in `test-results/`.
14. Update handling: a changed service worker installs and waits; banner shown; nothing reloads until "Update now"; then the new version controls the page.

## Bugs found and fixed during verification

- First service-worker install reloaded the page (clients.claim → controllerchange) and lost the child's screen — now reloads only after "Update now".
- After a drag whose element was removed on drop, the next tap was swallowed — fixed in the drag-or-tap hook.
- An answer given immediately before a reload could be lost (async IndexedDB write) — added a synchronous session journal.
- Answer leaks: the "empty basket" note, block-count labels on measuring rows, and the target clock in the clock-matching question — removed or moved behind hints.
- Worked solution paired different flower kinds in the "match pairs" template — solution now pairs by kind.
- Several English agreement errors ("1 pairs", "1 apples") — plural-aware strings.
- Shelf line misaligned with measured pots; plank wood grain looked like unit marks; object fields overlapped on phones — redrawn.
- Single errors were labelled "possibly rushing" — a single observation is now always "uncertain".

## Not covered by automated tests

Real touch hardware, screen readers (only ARIA structure was added), actual printing, narration voices, Tamil wording quality, and learning outcomes.
