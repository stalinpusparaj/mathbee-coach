# Test results

Recorded on 2026-10-31 for release 1.0 on macOS (Darwin 25.5), Node 26.8. Playwright ran with the bundled Chromium (`PW_CHANNEL=chromium`, Playwright 1.63), because Google Chrome is not at its standard path on this machine. The earlier 2026-09-27 run used `channel: 'chrome'`.

## Commands and outcomes (release 1.0)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | passed (no errors) |
| `npx vitest run` | **282 / 282 passed**, 23 files |
| `PW_CHANNEL=chromium npx playwright test --timeout=120000` | **38 / 38 passed** (5.5 min): flows 19, gate 7, android-shell 6, phone-layout 4, adventure 2 |
| `npm run build` | passed; `dist/` 4.2 MB, main JS 774 kB (217 kB gzip; Vite prints its >500 kB advisory), CSS 87 kB, `sw.js` emitted |
| `npm run build:android` | passed; `dist-android/` 4.2 MB, base `/web/`, no service worker, no manifest/icon links, parent-gate e2e answer compiled out (`function …(){return!1}`), no `__mathbeeAnswer`/`__mathbeeMusic` hooks |
| `npm run build:artifact` | passed; `dist-artifact/mathbee.html` + 110 supporting files |
| `cd android && ./gradlew --offline :app:assembleDebug :app:testDebugUnitTest` | passed (debug APK 6.3 MB; BridgeRulesTest green) |

### Checked on the Android emulator (emulator-5554, API 35, WebView 124)
- The rebuilt debug APK installs over the previous one and starts on the welcome screen.
- Back at the welcome root now shows the **Bye-bye sheet** (`docs/screenshots/android/12-bye-sheet.png`) instead of closing at once; "Bye-bye" sends `exitApp` and the launcher comes back.
- The other native checks (lifecycle, speech, save, share, print, renderer-crash recovery) are WP1's emulator smoke test; see docs/ANDROID.md and `docs/screenshots/android/01–11`.

## Release 1.0 tests

### Unit (new or extended for 1.0)
- **adventure-levels / adventure-progress / adventure-planner** (WP3): 81 levels (12/11/11/10/11/12/12 + 2 bonus), every template and fallback resolves, extension status from the curriculum, every main-path level non-extension when extensions are hidden; petals ignore hints and the evidence cap, `starsFor` has no time argument, best result kept, recording idempotent, star bonus once, replay nectar once per level per day, unlocking (chain, friend opens next world, "already knows this path", open-all, side branches, bonus gate); planner determinism, formats per kind, memory reviews first, fallbacks.
- **learning / fun** (WP3 additions): same-day adventure attempts are one evidence session, over-cap attempts are not evidence but keep petals, follow-ups capped at 2, theme and level id on adventure records only, old saves and import cleaning; `friendsMet` union, `stars2` quest, daily limit and the single rest rule.
- **skins / worldpath / journey** (WP4): skins never change controls, questions or checking; no timers in scenes; world-map layout fits 320–520 px with 64 px+ buds; world palettes match the CSS.
- **juice / sfx / music / session-end** (WP5): every effect is a no-op under reduced motion, wrong answers only wobble (no haptic), particle caps, haptics through the shell, sound-off creates no audio, world keys and tempos, combo lift for 8 bars, session end has exactly two buttons.
- **parentGate** (WP6): adult multiplication, random passes ≤ 1/100 (measured), 3 tries then a 30 s rest that survives reopening, every gate/parent string in Tamil, home ideas.
- **shell / backNav / platform / speech** (WP2): JSON v:1 bridge, hello/shell handshake with timeout, request ids, chunked files, haptic throttle, keep-awake, lifecycle flush, overlay LIFO back, route reports, native speech events. `backNav` now also checks that back from a level's results goes to that level's world.
- **i18n-packs** (WP7, new): every key in every `src/i18n/packs/*.ts` exists in English and Tamil with no Tamil-only keys and no invented placeholders; every literal `t()`/`translate()` key in the app exists in English, and in Tamil wherever a pack or a child screen uses it (the grown-up report and test screens are English-first by design).

### Browser (Playwright)
- **adventure.spec.ts**: the garden map's main button reads "Next adventure: First Flowers" and starts w1-01; all answers right → level results with 1–3 blooms, a new-bloom note, nectar, and no "perfect"/trophy wording; on the world map w1-01 is done, w1-02 open, w1-03 a closed bud; after a reload the map suggests "The Empty Basket"; replaying w1-01 the same day through its intro card adds **no nectar**. A closed bud never opens the intro card and shows no padlock; Escape closes the intro card; list view works.
- **android-shell.spec.ts** (stub `MathBeeAndroid` with `postMessage(string)` + `onmessage`): `hello` is the first message and precedes `ready`; every message has `v:1`; `html.in-android` and `--shell-inset-top: 24px` are applied; the first `keepAwake` is `{on:false}`, then `true` in a level and `false` again after it; `route` reports `map canGoBack:true` (Bye-bye handler) and `session canGoBack:true`; narration goes out as `speak` (≤ 600 chars, `lang`); native `back` in a level opens the pause sheet (`stop` inside) and closes it again; `lifecycle:pause` answers `flushed`; back on the map shows the Bye-bye sheet, back again closes it, "Keep playing" stays, "Bye-bye" sends exactly one `exitApp`; back from the sticker book returns to the map; printing sends `print` and keeps `html.printing` until `lifecycle:resume`; backup sends `saveFile` begin/chunk…/end with a safe filename, the right chunk count and size, valid JSON. Without a shell nothing is sent and Escape at the root does nothing.
- **phone-layout.spec.ts**: at 360×640, 412×915, 915×412 and 768×1024 (touch) the garden map, adventure worlds, world map, level intro card, a level and its pause sheet have no horizontal scroll, every visible control is at least 48×48 px (layout size), and the Check button is inside the viewport (sticky answer footer on phones; two columns in landscape).
- **gate.spec.ts** (WP6): gate protects the grown-up area in both languages, wrong answers and the rest, keypad and keyboard, a crawl of every map button never reaches a grown-up screen without the gate, settings persist, privacy sheet, privacy.html makes no external requests, the 5-page intro ends at the controls screen. Its crawl helper now walks back from a stopped adventure level's world map.
- **flows.spec.ts** (updated): new players go intro → controls; the grown-up area opens with a tap plus the gate (`data-answer` under `?e2e`); Worksheets & tests are reached through the grown-up dashboard (`to-tests`) and are no longer on the child's map; resuming a mock test after a reload asks the gate again.

### Bugs found and fixed during 1.0 integration
- The current bud on the world map pulsed by scaling the button itself, so the tap target never stood still (Playwright reported "element is not stable"); the dashed ring now breathes and the button stays still.
- `hello` was not the first bridge message (back navigation reported keep-awake first); the shell now connects before back navigation is wired.
- On 360×640 phones the sticky answer footer with a 3-column keypad covered the whole picture; short portrait phones now get a 2-row keypad, a slimmer journey and no story bubble.
- On portrait tablets the larger map labels overlapped; the picture map is taller there, and the activity row no longer leaves an empty slot.
- The journey story button was 24 px tall; it is now at least 48 px.

## Earlier unit tests (`tests/unit`, 2026-09-27)

- **generators.test.ts** — for each of the 42 category-stage combinations: ≥3 templates; every template × 60 seeds passes validation and the pure answer check; parameter variety; determinism; stage bounds (counts, sums, no negative early subtraction, regrouping only in its own template); pairs arithmetic; no "rectangle" distractor for a square.
- **math.test.ts** — exact cases: empty count = 0; 11 flowers = 5 pairs + 1; 10 roses = 5 pairs; 12 + 8 = 20; 11 + 19 = 30; 19 − 11 = 8; 48 − 20 = 28; 27 − 17 = 10; 20 − 6 = 14; 59, 58, __, 56 → 57; day before Monday = Sunday; Friday + 3 = Monday; 10:10 → minute hand 60°, hour hand 305°; 9:45 + 30 min = 10:15; July 2025 layout (1st Tue, 15th Tue, 11th Fri, last Friday 25th); July 7→27 = 20 elapsed, 21 inclusive; leap years, Feb/Mar and Dec/Jan transitions; day-number round trip.
- **learning.test.ts** — untested skills are "not assessed", never weak; supported completion cannot create mastery; correct retry ≠ independent; mastery needs accuracy + sessions + templates + later-day retention, and transfer needs a new format; worked examples are not attempts; duplicate checks/finishes/refresh cannot duplicate nectar; skipping is penalty-free; assessment follow-ups; prerequisite offer after two errors; daily mix prioritises assessment; review intervals and overdue handling; review schedule survives save/reload; one error is only a single observation; parent report matches recorded attempts; official mock requires confirmed rules; mock scoring records unassisted attempts; import rejects malformed/unknown/future data; active time excludes narration and hidden tabs; seeing the solution first makes an attempt non-independent.
- **i18n.test.ts** — every generated message resolves in English with no leftover placeholders; Tamil covers all question-content keys; every UI key used in source exists; plural and ordinal formatting.

## Original browser tests (`tests/e2e/flows.spec.ts`, 2026-09-27; still run)

1. Profile → assessment → wrong answer (specific feedback, work kept) → hint → success → reward → **refresh → resume the same question** → no duplicate reward → results.
2. Lesson (worked example, guided, independent) → results → practice → stop early without penalty.
3. **All 42 category-stage combinations** opened from the map and answered correctly.
4. Keyboard-only answer (digits + Enter); Escape pauses.
5. Generic test: no hints/feedback, answer survives refresh, submit confirmation, "not the official format" label.
6. Official mock hidden until the parent enters and confirms rules (now behind the parent gate).
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

Real touch hardware and real phones (the Android shell was smoke-tested on one emulator only), screen readers and TalkBack (only ARIA structure was added), actual printing on paper, narration voices on the target device (especially offline Tamil), audio focus during a real phone call, Tamil wording quality, a Playwright run against `dist-android` itself, and learning outcomes.
