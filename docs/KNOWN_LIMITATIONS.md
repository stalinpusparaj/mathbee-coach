# Known limitations

## Content and pedagogy
- The curriculum is inferred from six worksheet photos (pages 10–14). Other pages of the workbook, the competition syllabus, duration, question count and marking are unknown; the official-format mock only uses rules a parent enters and confirms.
- Q24 ("Subtract:" with penguins) is only partly legible and is not reproduced exactly.
- Explore/Practise/Apply ranges, the mastery heuristic (8 of 10, 2 sessions, 2 templates, later-day and new-format checks) and review intervals are product choices, not validated standards. They are adjustable in Settings.
- Error "kinds" (concept gap, slip, rushing, reading) are simple rules over recorded attempts and are shown as tentative. They are not diagnoses.
- Extensions (ordering sizes, measured constraints, pentagons/hexagons, regrouping, skip counting, elapsed time, month transitions, two-step and missing-part stories) go beyond the photographed worksheets and are labelled as extensions.
- No claims are made about learning outcomes; the app has not been trialled with children.

## Language and audio
- Tamil is a developer draft, not reviewed by a native-speaking teacher. The parent area is English-only (falls back to English in Tamil mode).
- Narration depends on the device's speech voices. Many devices have no Tamil voice; the app then shows text only. No recorded audio is included.
- Sound effects are generated tones.

## Interaction and accessibility
- Every drag has a tap-select → tap-destination alternative and keyboard access via focusable buttons, but the app has not been tested with a screen reader or switch access.
- Drag-and-drop was tested with a mouse in Chrome and emulated touch; not on physical tablets/phones or iOS Safari.
- Very dense scenes (up to 25 birds) are sized per cell but are tight on 320 px-wide phones.

## Technical
- Single JS bundle (~165 kB gzip); no code splitting yet.
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
