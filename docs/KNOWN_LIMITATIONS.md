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
