# Known limitations

## Content and pedagogy
- The curriculum is inferred from six worksheet photos (pages 10–14). Other pages of the workbook, the competition syllabus, duration, question count and marking are unknown; the official-format mock only uses rules a parent enters and confirms.
- Q24 ("Subtract:" with penguins) is only partly legible and is not reproduced exactly.
- Explore/Practise/Apply ranges, the mastery heuristic (8 of 10, 2 sessions, 2 templates, later-day and new-format checks) and review intervals are product choices, not validated standards. They are adjustable in Settings.
- Error "kinds" (concept gap, slip, rushing, reading) are simple rules over recorded attempts and are shown as tentative. They are not diagnoses.
- Extensions (ordering sizes, measured constraints, pentagons/hexagons, regrouping, skip counting, elapsed time, month transitions, two-step and missing-part stories) go beyond the photographed worksheets and are labelled as extensions.
- No claims are made about learning outcomes; the app has not been trialled with children.

## Language and audio
- Tamil is a developer draft, not reviewed by a native-speaking teacher. This includes every 1.0 string pack (`src/i18n/packs/*.ts`: adventure, adventure UI, juice, parent, shell), the 81 level titles, the friends' lines, `public/privacy.html` and the Android app's native strings. The parent report and the worksheet/test screens are English-first (they fall back to English in Tamil mode); the parent gate is always shown in both languages.
- Narration depends on the device's speech voices. In the Android app it uses the phone's own offline text-to-speech; many phones have no offline Tamil voice, so the app then shows text only and the grown-up area offers "Install Tamil voice". The recorded-voice pipeline (`src/audio/voice.ts`) ships with an empty clip list, so 1.0 has no recorded audio.
- Sound effects and music are synthesised tones.

## Interaction and accessibility
- Every drag has a tap-select → tap-destination alternative and keyboard access via focusable buttons, but the app has not been tested with a screen reader or switch access.
- Drag-and-drop was tested with a mouse in Chrome and emulated touch; not on physical tablets/phones or iOS Safari.
- Very dense scenes (up to 25 birds) are sized per cell but are tight on 320 px-wide phones.

## Technical
- The main JS bundle is still one chunk (Vite prints its >500 kB advisory); only three.js is loaded on demand.
- The service worker precaches all art (~2.4 MB) on first visit. Offline and update behaviour were verified in Chrome only.
- Data lives only on this device/browser. Clearing site data deletes progress unless exported. If storage is blocked, the app runs in memory and warns that nothing is saved.
- Active response time is measured in the browser; very short answers can also reflect a tap on an already-selected choice.
- The printable sheet was checked on screen (print CSS, page break before answers), not on paper.

## Art
- Sprites were cut automatically from the supplied sheets; a few crops include soft edges from the originals. Birds, turtle, clocks, calendars, shapes and all number models are drawn in code.
- The claymation concept images in `download/` (robot bee, lives, scores) were deliberately not used.

## 3D world
- The 3D garden and journey use the existing 2D art as standing cut-outs (billboards) on low-poly 3D scenery; there are no true 3D character models.
- three.js adds about 140 KB (gzipped) the first time a 3D view opens. Very old or low-power devices may render slowly; grown-ups can choose *Settings → 3D world → Flat 2D pictures*.
- On narrow phones the place name labels can cover parts of the landmark art; labels always stay on screen so every place remains tappable.
- 3D rendering was verified in desktop Chrome (including phone/tablet viewport emulation), not on physical phones or tablets.

## Release 1.0 (Adventure Mode and the Android app)
- **Verified only in desktop Chromium and the Android emulator.** The Android shell was smoke-tested on one emulator (API 35, WebView 124; see docs/ANDROID.md and `docs/screenshots/android/`). Real phones, a real phone call (audio focus), display cutouts and the on-screen keyboard insets, predictive back on Android 16, the old-WebView update screen, the themed icon and TalkBack are not yet checked on a device.
- The Android bridge is tested in the browser with a stub `MathBeeAndroid` (`tests/e2e/android-shell.spec.ts`) against the normal web build, not against `dist-android`. A Playwright project for the Android build is not set up; the parent gate's e2e answer is never exposed in an Android build, by design.
- The Android release bundle is unsigned until `android/keystore.properties` exists, and it fails to build while the privacy policy still has its placeholders.
- `lowRam` is true when the phone reports `isLowRamDevice` or a memory class of 192 MB or less. Many mid-range phones therefore get the flat 2D garden on *Automatic*.
- Daily play-limit minutes are wall-clock time per run (each run counts for at most 30 minutes), not active answering time. The limit is checked only between levels and runs.
- Adventure nectar is paid at most once per question position (and once for finishing) per level per day, across all runs. A replay the same day pays nothing new; a run stopped early keeps what it earned, and a later full run that day pays only the questions and finishing bonus not yet paid. Star bonuses (+2 per newly reached bloom) are paid once ever.
- Memory levels take at most half their questions from this world's due reviews; the rest are mixed.
- Finishing adventure levels adds their topics to the check-up list, so a child who plays across all worlds can also earn the "Check-up done" sticker without the separate check-up.
- *Open all levels* opens every story world and level but not the 2 bonus levels; those still need the regrouping gate (secure prerequisites or the parent's regrouping setting).
- The optional 3D floating-island world map was not built; the adventure map is 2D. Journey3D has the context-loss fallback but no 30 fps cap or off-screen pause (Garden3D has both).
- Calendar date cells are 56 px tall but can only be about 44 px wide on a 320–360 px phone, because a week needs 7 columns.
- In landscape on short screens (height ≤ 500 px) the session uses two columns and hides the journey strip to keep the answer controls on screen.
- The intro story adds about 25 seconds of narration before the first question (skippable after 2 s), so "first correct answer within 60 seconds" is tight for a new player.
- The bundled fonts add about 312 KB, including `.woff` fallbacks a modern WebView never downloads.
- The privacy page inside the app is shown in a sandboxed iframe; whether it renders through the Android asset loader at `/web/privacy.html` was not checked on a device.

## Bee Flight
- The Tamil strings for Bee Flight (`src/i18n/packs/flight.ts`, `flight-ui.ts`) are a developer draft and need review by a native Tamil-speaking teacher.
- Flight nectar counts toward the daily nectar total but not toward daily quests; a finished flight does not complete the "finish a journey" quest.
- In 3D the pace is deliberately slow (about 12 s per gate); the e2e test finishes gates through the `?e2e` hook (`window.__mathbeeFlight.pass`) instead of waiting. 3D flying was checked in desktop Chromium and the Android emulator only, not on physical phones.
- Without a gate id `awardGate` is not idempotent; the screen always passes the question id.
- A brief washed-out frame was once seen in a browser screenshot during the correct-gate celebration; it was not reproduced and its cause is unconfirmed.
- Deliberately not ported from the "Fly & Train" prototype: the speed-up pill ("Ninja Bee Rush 2x", faster with streaks) and the parents' average answer latency. Bee Flight never puts the child under speed pressure and never measures speed; streaks only add sparkles and the best-streak badge.
- The prototype file named in the parity plan (`~/Downloads/index (1).html`) was later overwritten by an unrelated page; the port followed the same prototype in `~/Downloads/index.html` ("MathBee Coach").
- Per-world first-try share in the grown-ups' Bee Flight section is the best finished flight in that world (FlightStats keeps first-try totals only overall); gates per world are flights × 8. Flights recorded before best-flight data existed show an empty bar and are left out of the tip.
- Choosing a world on the garden card sets `profile.flight.lastWorld` before any flight is flown, so it means "the world chosen or flown last".
- The odd-one-out colour and animal-vs-fruit sets assume common emoji-font colours (🦆 is left out because it varies). Its Tamil strings, like the rest of the Bee Flight, home and garden-extra packs, are developer drafts.
- The 3D home scene's added see-through wings sit behind the painted bee's own wings. Buzzy is placed in the largest free space beside, above or below the Welcome card (measured by projecting him, so it holds for any lens) and shrinks to fit a narrow strip; on short portrait phones (about 360×640) that strip is small, so he is small. On a tall phone in the emulator he hovers below the card over the path (`docs/screenshots/parity/01-welcome-3d.png`). The emulator reports a low-memory device, so *Automatic* shows the painted picture there; the 3D screenshot used *Always 3D*.
- The tap-to-hop on 3D garden items has no automated test (it needs a tap on a 3D sprite).
- The prototype's honey drops are ported as an optional 3D-only tally (💛 in the HUD and on the results card). Unlike the prototype they pay no nectar, so the flight economy (1 nectar per gate, at most 16 a day) is unchanged; the calm 2D flight has no honey trail.
