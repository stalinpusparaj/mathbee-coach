# Bee Flight mini-game (port of "Fly & Train")

Source prototype: `~/Downloads/index (1).html` (now overwritten; use `~/Downloads/index.html`) (single HTML file, three.js r128 + Tailwind CDN). Read it for the
mechanics; do NOT copy its CDN/Tailwind approach, its speed-up, or its bugs. Build it inside this React + TS +
three.js 0.186 app, in the existing painted storybook theme.

## What the child does
1. From a world map (Adventure → world) or the garden map, tap **🐝 Bee Flight**. Each of the 7 adventure worlds
   has its own flight (same theme, palette and painted backdrop `world_<theme>`; the friend of that world waits at
   the finish).
2. A short intro card (friend line, narrated) → **Fly!**
3. Buzzy (the painted bee billboard, wearing the current hat) flies down a 3-lane path. A question appears in the
   HUD (spoken aloud; picture above it when needed). A row of three answer gates comes into view; the child steers
   with ◀ ▶ big buttons, tapping a lane, swiping, or arrow keys.
4. Flying through the right gate: sparkle burst, chime, +nectar arc, next question. Through a different gate:
   Buzzy gently lands; **"Let's look with Buzzy"** sheet shows the picture/help (count dots, clock, shape…) with the
   three choices as big buttons; the child picks again (no "wrong", no buzzer, no red X); then the run continues.
5. After 8 gates the path ends at the friend (sprite) → short celebration → results (gates, first-try count shown
   as blooms, nectar) → **Fly again** / **Back to the world**.

## Rules (binding)
- **No speed pressure:** constant gentle pace; the bee slows down further while a gate row is close so the child
  can read. No speed-up for streaks (combo only adds a sparkle trail + the existing combo chip). No timers, no lives.
- **Finite:** 8 gates per run. Pause sheet (testid `pause`/`stop` like sessions) and Android back → pause sheet.
- **Questions:** pure, seeded generator `src/flight/questions.ts` → `flightQuestion(world, seed, index)`,
  types in `src/flight/types.ts`. Exactly one correct choice, all three visually distinct, answers never shown in
  the prompt (counting uses a `group` picture). Grade 1 ranges. Skills by world:
  meadow: count (3–10), next/before (1–20) · river: compare (which number is bigger / more), count groups ·
  orchard: add within 10, make10, doubles · ice: sub within 10 · trail: skip by 2/5/10, repeating pattern (AB, AAB,
  ABC with emoji) · town: shape2d (sides/corners), shape3d (cube, sphere, cone, cylinder — drawn correctly),
  clock (o'clock / half past, analogue drawn from data), day (tomorrow/yesterday) · garden: a mix of all.
  Every prompt/help string in EN and TA (`src/i18n/packs/flight.ts`).
- **Rewards:** +1 nectar per gate flown first try, +1 when solved with help; at most 16 flight nectar per day
  (keys `flight:${date}#${n}` in `profile.awarded`, idempotent). Flights do NOT write mastery Attempts (they are
  play, not assessment). Store `profile.flight?: { runs: number; gates: number; firstTry: number; byWorld: Record<world, number> }`
  (optional field; sanitise in `schema.ts` fillDefaults). A finished run counts toward the existing daily quest
  "finish a journey" only if that is trivial to do safely; otherwise leave quests alone.
- **Rendering:** new `src/three/Flight3D.tsx` (lazy via `src/three/Lazy3D.tsx` + `With3D`), reuse `src/three/kit.ts`
  (renderer, sky, lights, billboard, emojiSprite, tree, cloud, island, hive, disposeScene) and `renderBudget()` /
  context-loss handling from `src/three/support.ts`. Gate badges are canvas textures drawn from `GateVisual` in the
  game's palette (honey-gold disc, ink outline, Baloo/Nunito font). Painted backdrop as a far sky plane or CSS
  behind a transparent canvas. One RAF loop, paused when hidden/paused; dispose on unmount.
- **Fallback (no WebGL / weak device / reduced motion):** a calm 2D version — the same question, picture and three
  big gate buttons on the world backdrop, Buzzy hops between gates (no motion under reduced motion). Same rewards.
- **Accessibility:** prompt narrated via `speak()` (and 🔊 button); gate buttons/lane buttons ≥ 56 px with
  aria-labels describing the visual ("gate 2: half past 3"); keyboard ← → and Enter; works at 360×640 portrait
  and 915×412 landscape; haptic via `src/fx/juice.ts` on correct only.
- **Integration:** route `{ name: 'flight'; world: string }` in `src/app/store.ts`, `backNav.parentOf` →
  `adventure-world` (or `map` when world is unknown); App.tsx case; entry buttons on the world map (testid
  `flight-<world>`) and the garden map quick row (testid `flight-btn`, opens the current world). Music uses the
  world key (`music.setWorld`) and the `play` scene; keepAwake on during a run.
- **Tests:** unit — every world × many seeds: exactly one correct, 3 distinct visuals, prompt never contains the
  answer, ranges respected, deterministic by seed; nectar cap & idempotency; schema sanitise. e2e — open flight
  from World 1, complete a run using test hooks (expose the current correct lane under `?e2e` like
  `__mathbeeAnswer`), results show, nectar increased once, back opens pause sheet.
