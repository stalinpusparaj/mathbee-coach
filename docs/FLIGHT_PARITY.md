# Fly & Train parity (nothing from the prototype left out)

Source: `~/Downloads/index (1).html`. Everything below must exist in Number Garden, in the painted storybook
theme, with the house rules (EN + TA strings in packs, reduced-motion paths, ≥56px child targets, no speed
pressure, no losing signals, 2D fallback when 3D is not available).

| Prototype gameplay | Number Garden | Owner |
|---|---|---|
| Live 3D home scene: bee hovering over the world path, flowers, idle orbit camera behind the home menu | `src/three/Home3D.tsx` behind the Welcome card (lazy, With3D fallback = today's painted picture; paused when hidden; idle render ≤30fps; reduced motion → still frame) | P1 |
| Home card "CURRENT ADVENTURE": world icon+name+tagline, ☆☆☆ stars, 🔥 best streak, FLY & TRAIN, CHANGE WORLD, MY GARDEN, player name, nectar | Garden map: a "Bee Flight" card (keep testid `flight-btn` on its Fly button) showing the current flight world (art + friend), its stars (0–3), best streak, Fly, Change world (picker of the 7 worlds, testid `flight-world-<theme>`), and a shortcut to Restore garden | P3 |
| Logic Forest "find the odd one out" | New FlightSkill `odd` (trail + garden): three gates of which two share a property (e.g. two triangles + a circle; two even numbers + an odd one is NOT Grade 1 — use shapes, animal vs fruit emoji groups, colours, number of things) — exactly one gate is the odd one; picture shows nothing extra; prompt "Which one is different?" | P2 |
| Pause modal: Resume, Change world, My Garden, Restart run, Audio on/off, Exit home | Flight pause sheet gains Restart run (testid `flight-restart`), Change world (picker, `flight-change-world`), My garden (`flight-garden`, ends the run kindly), Sound toggle (existing music/sound settings). Keep `resume`, `stop`. | P2 |
| Combo + best streak | `profile.flight.best[world] = { combo, firstTry }` and `lastWorld`; helper `flightWorldSummary(p, world) → { stars: 0|1|2|3, bestCombo, runs }` in `src/flight/rewards.ts` (stars from the best first-try share of a finished run: ≥8/8→3, ≥6→2, finished→1) | P2 (P3 consumes) |
| Garden shop: daisy 20, mushroom 40, frog 80 | `GARDEN_ITEMS` gains `daisy` (sprite `daisy`, exists) and `mushroom` (sprite `mushroom`, generated art being added; item hidden until `hasSprite('mushroom')`), priced in this game's economy (≈ 7 and 9 nectar); frog already exists | P3 |
| Parent insights: mastery % per world, accuracy, recommendation | Parent dashboard: a "Bee Flight" section with runs, first-try share per flight world (bars), and a plain-language tip for the weakest world. No response-time metric (speed is never measured for the child). | P3 |
| Speed pill "Ninja Bee Rush 2x", speeding up with streaks | Deliberately NOT ported (no speed pressure); documented in docs/KNOWN_LIMITATIONS.md | — |
| Average answer latency for parents | Deliberately NOT ported (same reason) | — |
