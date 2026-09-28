# MathBee Coach — My Number Garden

An offline, browser-based maths practice game for a Grade 1 child preparing for a MathBee-style competition. It is built from the six supplied worksheet photographs (`silabus/`, pages 10–14, Q1–Q50) and the supplied storybook asset sheets.

MathBee Coach is an independent practice app. It is not affiliated with any competition or publisher, it does not promise results, and it does not diagnose learning difficulties.

## Quick start

Requires Node.js 20+ (developed on Node 26) and npm.

```bash
npm install
```

```bash
npm run dev
```

Then open the printed local URL. To build and serve the production version (with offline support):

```bash
npm run build
```

```bash
npm run preview
```

## Tests

```bash
npm test
```

Unit tests (Vitest, 88 tests): all 42 category–stage combinations, exact worksheet maths, learning-state rules, review scheduling, rewards, import validation, i18n completeness.

```bash
npm run test:e2e
```

Browser flows (Playwright, 14 tests) against the production build. They use the locally installed Google Chrome (`channel: 'chrome'`); set `PW_CHANNEL=chromium` after `npx playwright install chromium` if Chrome is not installed.

Regenerate the coverage matrix and asset manifest from the code:

```bash
npm run docs:coverage
```

Re-cut sprites from the asset sheets (needs Python 3 with pillow, numpy, scipy; outputs are already committed):

```bash
npm run assets
```

## Live version on claude.ai

The game is published as a private claude.ai Artifact: https://claude.ai/artifact/G2bg7d6hfS6Zy7YgfX5MBA (share it from the page's Share menu).

```bash
npm run build:artifact
```

That builds `dist-artifact/` with relative paths and no service worker (the Artifact viewer doesn't support them), and writes the page fragment `dist-artifact/mathbee.html`. Then republish it to the same URL from Claude. In that version, Print buttons are hidden (the viewer blocks printing), Export saves through the viewer's download prompt, and progress is kept in each player's own browser.

## Generating extra art with Gemini (optional)

The app ships with sprites cut from the supplied sheets and works without any generated art. To add more (calm topic banners, map and welcome backgrounds, clearly recognisable birds, a turtle, bee poses and extra garden items), use Google's Gemini image model at development time. The app itself never calls an API.

1. Create a Gemini API key at Google AI Studio (image generation may be billed on your Google account), then set it in your own terminal (don't paste it into any file):

```bash
export GEMINI_API_KEY="your-key"
```

2. Preview what will be sent (no API calls):

```bash
npm run art:generate -- --dry-run
```

3. Generate everything in `tools/art-brief.json` (or a subset with `--only bird_owl,bee_think`; add `--force` to redo, `--model gemini-3.1-flash-lite-image` for a cheaper model):

```bash
npm run art:generate
```

4. Remove backgrounds, resize to WebP and register the art (needs Python with pillow, numpy, scipy):

```bash
npm run art:process
```

5. Review everything (for example `/?gallery=C03` for the birds) before letting a child use it. Delete a file from `art-generated/raw/` and re-run step 4 to drop an image you don't like. Then run `npm run docs:coverage` to refresh the asset manifest.

How it works: sprites are requested on a flat magenta background, which `tools/process_generated.py` removes (only regions connected to the image edge, so pink details inside a subject survive). Bee poses are sent with the existing bee as a reference image to keep one consistent character. Generated images are only decorative or identify an object's kind (e.g. "owl"). Quantities, clocks, calendars and shapes are still drawn in code, and each generated asset falls back to the current art if it's missing.

## What is in the app

| Screen | Notes |
|---|---|
| Welcome | Play, Continue, sound toggle, "hold for grown-ups" (a press-and-hold convenience gate, not security). |
| Local profile | Avatar, optional nickname (≤20 chars), English/Tamil, Grade 1 default. No birth date or other personal data. |
| Button practice | Unscored control familiarisation (tap, keypad, what Hint/Check/Hear/Pause do). |
| Garden map | 14 locations with bloom levels, today's recommended mission, restored garden items, and a **List view** alternative. |
| Category screen | Explore / Practise / Apply per category with **Learn** (lesson) and **Practise** buttons; extensions marked. |
| Garden check-up | Gentle starting assessment: 4 topics per session, adaptive follow-ups, max 3 questions per topic. |
| Lesson | Worked example → guided try → fading help → new independent question → different (plain) format. |
| Practice / daily mix / review / fluency | Targeted, 50/30/20 mixed, spaced review due screen, and fluency checks (only after reliable accuracy). |
| Worksheets & tests | Plain worksheet practice on screen, printable sheet + separate answer/explanation page, generic practice test, and a mock using parent-confirmed rules. |
| Results & restoration | On-your-own vs with-help counts, nectar earned, one suggestion; spend nectar on cosmetic garden items. |
| Parent dashboard | Coverage, unassessed areas, independent vs assisted accuracy, tentative recurring errors with evidence, retention, plain-format performance, own-history response times, history, three next actions. No readiness percentage. |
| Settings | Sound, narration, reduced motion, session length, mastery heuristic, review intervals, regrouping unlock, export / import (validated) / reset (confirmed). |

## Motivation, gamification and effects

Designed to reward effort, correcting mistakes and progress — with no lives, rankings, purchases, or streaks that can be lost.

- **Named celebrations.** Every correct answer brings the bee in (pop, swoop or spin), with confetti, floating stars and a cheer using the child's nickname — "Great job, Mickey!", "Mickey, you did it!" and 10 more, never the same one twice in a row. Fixing a mistake gets its own cheer ("You fixed it, Mickey!"). The cheer is read aloud when narration is on. Set the name when creating the player, or later in *Hold for grown-ups → Settings & data → Nickname*.
- **Garden levels** (Seed → Sprout → Bud → Flower → Blossom → Busy Bee → Honey Keeper → Garden Star → Rainbow Gardener → Honey Master) come from lifetime nectar, so spending nectar never lowers them.
- **Sticker book** with 21 stickers (first star, fixer, hint hero, learner, explorer, clock reader, sunny days…). New stickers and level-ups are revealed once, on the results screen. Practice days count up and never reset.
- **Effects:** nectar drops fly to the top bar, results numbers count up with a sparkle rain, stickers flip in with a shine, level-ups get fireworks, screens fade in, buttons lift, and butterflies and a bee drift across the map. Learning scenes stay calm, and effects are removed when reduced motion is on.
- All of this is computed from recorded progress (`src/learning/gamification.ts`, unit-tested), so refreshing cannot inflate it.

## The 14 categories

C01 Nectar Collector (counting) · C02 Animal Ferry (mixed totals) · C03 Bird Sanctuary (sort & count) · C04 Flower Fit (size) · C05 Bridge Builder (length) · C06 Shape Workshop (shapes, sides) · C07 Bouquet Shop (pairs) · C08 Orchard Basket (addition) · C09 Penguin Harbour (subtraction) · C10 Number Trail (sequences) · C11 Weekly Planner (days) · C12 Clock Tower (time) · C13 Festival Planner (calendar) · C14 Garden Help Desk (word problems).

Each has three stages with at least three parameterised templates per stage (**126 templates**), an interactive scene, an illustrated (static) version, a plain worksheet version, hints that explain the same question, and a worked solution. See [docs/CURRICULUM_COVERAGE.md](docs/CURRICULUM_COVERAGE.md).

## Architecture

```text
src/
  engine/        types, seeded RNG, pure maths (math.ts), layouts, validation, answer checking,
                 generators/c01–c14 (question templates), registry (bounded retries + fallback)
  curriculum/    categories, subskills + prerequisites, worksheet coverage, garden items
  learning/      mastery evidence, error observations, review scheduling, session planner,
                 session engine (check / hint / finish / atomic rewards), active-time timer
  mock/          generic and parent-configured mock tests, scoring
  report/        parent report built only from recorded attempts
  persistence/   versioned schema, migration, import validation, IndexedDB → localStorage → memory
  i18n/          English and Tamil tables, resolver with plurals/ordinals and English fallback
  activities/    scene renderers for all 14 categories
  components/    keypad/choices/order/fields, clock, calendar, ten-frame, base-ten, number line,
                 drag-or-tap, sprites and code-drawn birds/shapes
  screens/       child screens, tests/print/mock, parent area, QA gallery
  sw/            service worker template (precache list generated at build time)
tools/           asset extraction, coverage/manifest doc generator
tests/unit, tests/e2e
```

Key rules implemented in code:

- **Answers come only from pure functions.** Questions are generated deterministically from `(template, seed)`, validated (ranges, non-negative subtraction, distinct options, exactly one correct option, non-overlapping objects, valid dates, rule-specified sequences), retried a bounded number of times, then fall back to a known-good seed. Art never determines an answer.
- **Independent vs supported.** An attempt is independent only if no mathematical hint or worked solution was used before the first check and it is not a worked/guided lesson step. A correct retry is "completed with help". Replaying narration is not a hint.
- **Mastery heuristic (configurable, not a validated standard).** 8 of the latest 10 independent first tries correct, correct work in ≥2 sessions and ≥2 templates, a later-day retention check, and a different-format check. States: not assessed → more evidence needed → learning with support → practising independently → retained → applying.
- **Spaced review** at 1, 3, 7, 14 days (configurable). Missed days leave a review due without penalty. Retries within a question are never separate evidence.
- **Adaptation.** Single first-try errors trigger one follow-up question (different template) to separate slips from gaps; two consecutive errors offer a prerequisite / simpler check. Progress is never erased.
- **Rewards.** 1 nectar per solved question and 1 per finished session, recorded in the same state write as the completion, keyed so refreshes and repeated checks cannot duplicate them.
- **Active time** excludes narration, feedback display, pauses and hidden tabs.
- **Persistence.** The whole state is one document (atomic). A synchronous session journal protects a write that is interrupted by an immediate reload.
- **Offline & updates.** A generated service worker precaches the app and all art. A new version installs in the background and waits; the child sees "Update now" and nothing reloads by itself.

## Implemented and verified vs. not verified

Verified by automated tests (see [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md)): generation/validation of all 126 templates, exact worksheet cases, learning-state rules, reward de-duplication, review persistence, import rejection, full child flow with refresh/resume, lesson flow, all 42 category-stage combinations reachable and answerable in a browser, keyboard answering, mock rules, storage-blocked mode, offline reload, update handling, and no horizontal scrolling at 390×844, 768×1024, 1024×768 and 1440×900.

Visually inspected (screenshots): every category's scenes in interactive, plain and worked-solution modes; phone map and sessions; parent dashboard; a Tamil session.

Not verified — see [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md): real touch devices, screen readers, printing on paper, Tamil translation quality, narration voices on the target device, and any educational effect.

## Documentation

- [docs/CURRICULUM_COVERAGE.md](docs/CURRICULUM_COVERAGE.md) — worksheet items → templates → subskills (generated)
- [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) — every sprite with source sheet and crop (generated)
- [docs/LOCALISATION.md](docs/LOCALISATION.md) — English/Tamil status and narration
- [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) — what ran and what passed
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)

QA helpers: `/?gallery=C01` (…`C14`, optional `&format=plain`, `&solution=1`, `&seed=7`) renders every template of a category; `?e2e` exposes the current expected answer to the browser tests.
