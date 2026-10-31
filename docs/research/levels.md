# Adventure Mode Design: Worlds, Levels and Stars for MathBee Coach

This is a read-only report. No files were changed. Every template and subskill id below comes from the code in `src/engine/generators/c01.ts`–`c14.ts` and `src/curriculum/curriculum.ts`.

---

## 1. What the code already provides

- **Content:** 126 templates (14 categories × 9) and 54 subskills (`SUBSKILLS` in `src/curriculum/curriculum.ts`). Each subskill has a stage (explore, practise or apply), a source (observed, prerequisite or extension) and optional `prereq`. `C08.regroup` and `C09.regroup` are `gated: true`.
- **Generation:** `generateQuestion(templateId, seed, format)` in `src/engine/registry.ts` is deterministic and validated. `templatesForSubskill()` exists. `TemplateDef.formats` is declared but no generator uses it, so any template can be shown as interactive, illustrated or plain.
- **Session pipeline:** in `src/learning/session.ts`, `startSession`, `checkCurrent` and `finishCurrent` record one `Attempt` per question. Retries stay inside that attempt. Nectar is paid once per `sessionId#slot` key. Adaptive follow-up and prerequisite slots are added automatically (`errorFollowUp`, `prerequisiteSlot`), except in `fluency` and `worksheet` modes.
- **Evidence:** `isIndependentEvidence` and `evaluateSkill` in `src/learning/mastery.ts` use the last 10 independent first attempts. They also require at least 2 distinct `sessionId`s, at least 2 templates, a retention check and a transfer check. Spaced review lives in `src/learning/review.ts`: any independent attempt made on or after the due date counts as the review.
- **Themes:** `src/activities/journey.ts` defines `JourneyTheme` (meadow, river, orchard, ice, trail, town, garden), each with a platform sprite and a friend. `themeFor(categories)` returns `'garden'` for any session with more than one category. `SessionScreen.tsx:203` calls it.
- **Fun features:** `src/learning/fun.ts`:
  - `friendsMet` comes from `SessionRecord.categories` through `themeFor`.
  - Quests count completed sessions.
  - `suggestRest` triggers after 3 sessions in a day.
- **Scene types available for reuse:** count, ferry, birds, sizes, lengths, shapes, pairs, add, subtract, trail, week, clock, calendar, story. Answer kinds: number, choice, order, fields, time.

**Conclusion:** Adventure Mode needs no new maths generators. It is a new planner, a new `Mode`, a progress store, a map screen and optional presentation-only "skins".

---

## 2. Design principles (in line with the existing ethics)

- **Finishing a level always earns 1 star.** Nothing is lost and there are no lives.
- **Stars measure first-try independence only.** Never speed: `activeMs` must never be read by the star code.
- **No star gates for progress.** Stars unlock only cosmetics (a golden path, a trophy, map decorations).
- **Short levels:** 5–8 questions, about 4–8 minutes, so a 6-year-old can finish in one sitting. `suggestRest` still applies because adventure runs are sessions.
- **Replays are welcome, but cannot farm evidence or nectar** (see §6).
- **Locked levels look like closed flower buds, not padlocks.** The bee "can't wait to visit".

---

## 3. Adventure structure

### 3.1 Seven worlds (reusing `THEMES` from `journey.ts`)

| # | World (theme) | Friend (theme `goal` sprite) | Categories | Levels |
|---|---|---|---|---|
| W1 | Bunny's Flower Meadow (`meadow`) | `bunny_florist` | C01, C04, C07 | 12 |
| W2 | Frog's Ferry River (`river`) | `frog` | C02, C03, C05 | 11 |
| W3 | Squirrel's Apple Orchard (`orchard`) | `squirrel_gardener` | C08, C14 (joining) | 11 |
| W4 | Penguin's Ice Floes (`ice`) | `penguin_wave` | C09, C14 (taking away) | 10 |
| W5 | Hedgehog's Stepping-Stone Trail (`trail`) | `hedgehog` | C10, C01.groups50, C02.grouped50 | 11 |
| W6 | Owl's Clock Town (`town`) | `owl_keeper` | C06, C11, C12, C13 | 12 |
| W7 | Queen Bee's Hive (`garden`) | `svg:hive` | Apply and extension subskills, mixed | 12 |
| Bonus | Secret Honeycomb (`garden`) | — | gated regrouping | 2 |

**Total:** 79 core levels plus 2 bonus levels = 81.

- **Ordering follows `prereq`.** C01 comes before C02 and C08 (both need `C01.to5`). C08 and C09 come before C14 apply. C10 needs no prerequisite.
- **One soft deviation:** W3 uses `c14-e-join` before W4 teaches `C09.to5`, even though `C14.to5` lists `C09.to5` as a prerequisite. This is acceptable because `C14.to5` is not gated and `c14-e-join` is joining only.
- **Theme assignment differs from `BY_CATEGORY`.** For example, C04 is in Meadow (flower pots) and C03 is in River. An adventure run must therefore pass its world theme explicitly (see §8).

### 3.2 Level kinds

| Kind | Count per world | Purpose |
|---|---|---|
| `core` | 6–9 | Teaches or practises one subskill (one stage) |
| `mini` | 1 | Same maths with a play-style skin (§7) |
| `memory` | 1 (second to last) | Mixed, unannounced questions. Due reviews are pulled in first. Gives transfer evidence. |
| `friend` | 1 (last) | Celebration "boss": 8 mixed questions from the whole world, the last one in plain worksheet format. Finishing it meets the friend, plays a cutscene and opens the next world. |
| `finale` | W7 only | The Queen's Honey Festival: one apply question per world |
| `bonus` | 2 | Only shown when `isUnlocked()` is true for the gated regroup subskills |

Friend levels are boss levels without threat. The friend has a problem (the bunny's flower show needs counting, the frog's crossing needs loading), and each correct answer adds decoration to the friend's scene. A wrong answer only means "let's try again together". Nothing is taken away.

### 3.3 Question formats per level
- **Explore core levels:** all `interactive`.
- **Practise and apply core levels:** last question `illustrated`. This gives transfer evidence through `transferChecks`, because the format is not interactive.
- **Memory levels:** `unannounced: true`, with a mix of formats (same as `planDaily`).
- **Friend and finale levels:** last question `plain` (worksheet transfer), all others interactive.

---

## 4. Level table (81 levels)

Legend:
- **Q** = base question count. Adaptive follow-ups can add up to 2 more.
- **Ext** = uses an `extension`-source subskill. When `settings.showExtensions === false` it becomes an optional side branch (see §5).
- Template ids are listed in round-robin order.

### W1: Bunny's Flower Meadow (`meadow`)
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 1-1 | First Flowers | core | C01.to5 | c01-e-row, c01-e-dice | 5 | |
| 1-2 | The Empty Basket | core | C01.zero, C01.to5 | c01-e-zero, c01-e-row | 5 | |
| 1-3 | Big Pot, Small Pot | core | C04.bigSmall | c04-e-big, c04-e-small, c04-e-match | 5 | |
| 1-4 | Bubble Pop Meadow | mini (bubbles) | C01.to5 | c01-e-row, c01-e-dice | 6 | |
| 1-5 | Flower Buddies | core | C07.makePairs | c07-e-make, c07-e-match | 5 | |
| 1-6 | Count the Bouquet | core | C01.to20 | c01-p-rows, c01-p-columns | 6 | |
| 1-7 | Scattered Petals | core | C01.to20 | c01-p-scatter, c01-p-columns | 6 | |
| 1-8 | Pairs Make Flowers | core | C07.makePairs | c07-e-toflowers, c07-e-make | 5 | |
| 1-9 | Pot Parade | core | C04.order | c04-p-order-up, c04-p-order-down, c04-p-smallest | 6 | Ext |
| 1-10 | Rose Pairs | core | C07.countPairs | c07-p-count, c07-p-leftover, c07-p-worksheet | 6 | |
| 1-11 | Meadow Memory | memory | C01.to5, C01.zero, C04.bigSmall, C07.makePairs, C01.to20 | c01-e-dice, c01-e-zero, c04-e-small, c07-e-match, c01-p-rows, c07-p-worksheet | 6 | |
| 1-12 | Bunny's Flower Show | friend | C01.to20, C04.bigSmall, C07.countPairs | c01-p-scatter, c04-e-match, c07-p-count, c01-p-columns, c07-p-worksheet | 8 | |

### W2: Frog's Ferry River (`river`)
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 2-1 | All Aboard! | core | C02.to5 | c02-e-load, c02-e-groups | 5 | |
| 2-2 | Hop On, Friends | core | C02.to5 | c02-e-hopon, c02-e-groups | 5 | |
| 2-3 | Long Plank, Short Plank | core | C05.longShort | c05-e-long, c05-e-short, c05-e-arrows | 5 | |
| 2-4 | Birds by the River | core | C03.vocab | c03-e-vocab | 5 | |
| 2-5 | Find the Swans | core | C03.oneTarget | c03-e-target, c03-e-sort | 5 | |
| 2-6 | Three-Animal Ferry | core | C02.to20 | c02-p-load3, c02-p-table, c02-p-worksheet | 6 | |
| 2-7 | Block Bridges | core | C05.measure | c05-p-measure, c05-p-find, c05-p-order | 6 | Ext |
| 2-8 | Bird Sorting Station | core | C03.sortCount | c03-p-sortall, c03-p-one, c03-p-worksheet | 6 | |
| 2-9 | Ferry Loader | mini (ferry-loader) | C02.to5, C02.to20 | c02-e-load, c02-p-load3, c02-e-hopon | 6 | |
| 2-10 | River Memory | memory | C02.to5, C02.to20, C05.longShort, C03.oneTarget, C03.vocab | c02-e-groups, c02-p-worksheet, c05-e-arrows, c03-e-target, c03-e-vocab | 6 | |
| 2-11 | Frog's Big Crossing | friend | C02.to20, C03.sortCount, C05.measure | c02-p-table, c03-p-worksheet, c05-p-find, c02-p-worksheet, c03-p-one | 8 | Ext (C05.measure) |

### W3: Squirrel's Apple Orchard (`orchard`)
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 3-1 | Two Baskets | core | C08.to5 | c08-e-baskets, c08-e-numberline | 5 | |
| 3-2 | Apple Words | core | C08.to5 | c08-e-words, c08-e-baskets | 5 | |
| 3-3 | Lily-Pad Plus | mini (lily-hop) | C08.to5 | c08-e-numberline | 6 | |
| 3-4 | Orchard Stories | core | C14.to5 | c14-e-join | 5 | |
| 3-5 | Ten-Frame Treats | core | C08.to20 | c08-p-tenframe, c08-p-zero | 6 | |
| 3-6 | Make a Ten! | core | C08.makeTen | c08-p-maketen | 6 | |
| 3-7 | Zero Surprise | core | C08.to20 | c08-p-zero, c08-p-tenframe | 6 | |
| 3-8 | Basket Stories | core | C14.to20 | c14-p-add | 6 | |
| 3-9 | A Brand-New Ten | core | C08.decade, C08.makeTen | c08-a-decade, c08-p-maketen | 6 | |
| 3-10 | Orchard Memory | memory | C08.to5, C08.to20, C08.makeTen, C14.to5 | c08-e-words, c08-p-tenframe, c08-p-maketen, c14-e-join | 6 | |
| 3-11 | Squirrel's Harvest Feast | friend | C08.to20, C08.makeTen, C14.to20, C08.decade | c08-p-tenframe, c08-p-maketen, c14-p-add, c08-a-decade | 8 | |

### W4: Penguin's Ice Floes (`ice`)
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 4-1 | The Boat Leaves | core | C09.to5 | c09-e-boat, c09-e-choose | 5 | |
| 4-2 | Hop Back, Penguin | core | C09.to5 | c09-e-numberline, c09-e-choose | 5 | |
| 4-3 | Melting Stories | core | C14.to5 | c14-e-separate, c14-e-act | 5 | |
| 4-4 | Penguin Parade | core | C09.to20 | c09-p-within20, c09-p-facts | 6 | |
| 4-5 | None or All | core | C09.to20 | c09-p-zeroall, c09-p-within20 | 6 | |
| 4-6 | Ice-Floe Hop | mini (lily-hop, ice skin) | C09.to5, C09.to20 | c09-e-numberline, c09-p-facts | 6 | |
| 4-7 | Snowy Stories | core | C14.to20 | c14-p-sub, c14-p-worksheet | 6 | |
| 4-8 | Big Ice Blocks | core | C09.twoDigit | c09-a-tens, c09-a-wholetens | 6 | |
| 4-9 | Ice Memory | memory | C09.to5, C09.to20, C14.to5, C08.to20 | c09-e-choose, c09-p-facts, c14-e-separate, c08-p-zero, c14-p-worksheet | 6 | |
| 4-10 | Penguin's Snow Party | friend | C09.to20, C09.twoDigit, C14.to20 | c09-p-within20, c09-a-wholetens, c14-p-sub, c14-p-worksheet | 8 | |

### W5: Hedgehog's Stepping-Stone Trail (`trail`)
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 5-1 | What Comes Next? | core | C10.beforeAfter10 | c10-e-after | 5 | |
| 5-2 | What Came Before? | core | C10.beforeAfter10 | c10-e-before | 5 | |
| 5-3 | The Missing Stone | core | C10.beforeAfter10 | c10-e-gap, c10-e-after | 5 | |
| 5-4 | Stepping-Stone Hop | mini (lily-hop, stone skin) | C10.beforeAfter10, C10.seq100 | c10-e-gap, c10-p-forward | 6 | |
| 5-5 | Counting On to 100 | core | C10.seq100 | c10-p-forward, c10-p-beforeafter | 6 | |
| 5-6 | Counting Back Down | core | C10.seq100 | c10-p-backward, c10-p-beforeafter | 6 | |
| 5-7 | Bundles of Ten | core | C01.groups50 | c01-a-tens, c01-a-partial | 6 | Ext |
| 5-8 | Fives and Full Boats | core | C01.groups50, C02.grouped50 | c01-a-fives, c02-a-boats, c02-a-subtotals | 6 | Ext |
| 5-9 | Two Gaps Together | core | C10.multiGap | c10-a-multi, c10-a-between | 6 | |
| 5-10 | Skip Along the Trail | core | C10.skip | c10-a-skip | 6 | Ext |
| 5-11 | Hedgehog's Long Walk | friend | C10.seq100, C10.multiGap, C01.groups50 | c10-p-forward, c10-p-backward, c10-a-multi, c01-a-tens | 8 | Ext (C01.groups50) |

W5 has no memory level, by design: its pacing is already mixed. If symmetry is wanted, add an optional `5-10b Trail Memory`.

### W6: Owl's Clock Town (`town`)
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 6-1 | Shape Workshop | core | C06.names | c06-e-name, c06-e-find | 5 | |
| 6-2 | Shadow Shapes | core | C06.names | c06-e-outline, c06-e-find | 5 | |
| 6-3 | Sides and Corners | core | C06.sidesCorners | c06-p-sides, c06-p-corners, c06-p-worksheet | 6 | |
| 6-4 | Seven Day Cards | core | C11.order | c11-e-order, c11-e-count, c11-e-next | 5 | |
| 6-5 | Yesterday and Tomorrow | core | C11.beforeAfter | c11-p-before, c11-p-after, c11-p-yesterday | 6 | |
| 6-6 | O'Clock Bells | core | C12.hours | c12-e-read, c12-e-set, c12-e-match | 5 | |
| 6-7 | Half Past, Quarter Past | core | C12.halfQuarter | c12-p-half, c12-p-quarter, c12-p-set | 6 | |
| 6-8 | Bee Postman | mini (postman) | C11.order, C11.beforeAfter | c11-e-next, c11-p-after, c11-p-before | 6 | |
| 6-9 | The Calendar Board | core | C13.read | c13-e-weekday, c13-e-find, c13-e-first | 5 | |
| 6-10 | Special Dates | core | C13.named | c13-p-last, c13-p-length, c13-p-named | 6 | |
| 6-11 | Five-Minute Clock | core | C12.fiveMin | c12-a-five, c12-a-setfive | 6 | |
| 6-12 | Owl's Clock-Tower Fair | friend | C06.sidesCorners, C11.beforeAfter, C12.halfQuarter, C13.named, C12.fiveMin | c06-p-worksheet, c11-p-before, c12-p-quarter, c13-p-named, c12-a-five | 8 | |

`c12-a-setfive` is extension-source but its subskill `C12.fiveMin` is observed, so level 6-11 is core.

### W7: Queen Bee's Hive (`garden`): apply and challenge
| Lvl | Title | Kind | Subskills | Templates | Q | Ext |
|---|---|---|---|---|---|---|
| 7-1 | Bird Count-Off | core | C03.compare | c03-a-compare, c03-a-howmanymore, c03-a-multi | 6 | Ext |
| 7-2 | The Perfect Pot | core | C04.constraint | c04-a-fit, c04-a-shelf, c04-a-between | 6 | Ext |
| 7-3 | Bridge Builders | core | C05.build | c05-a-build, c05-a-missing, c05-a-difference | 6 | Ext |
| 7-4 | Turned and Tiled Shapes | core | C06.rotateCompose, C06.polygons | c06-a-rotated, c06-a-compose, c06-a-poly | 6 | Ext |
| 7-5 | Bouquet Orders | core | C07.pairsApply | c07-a-needed, c07-a-leftover, c07-a-more | 6 | Ext |
| 7-6 | Hidden Passengers | core | C02.partWhole, C02.grouped50 | c02-a-missing, c02-a-subtotals | 6 | Ext |
| 7-7 | Big Number Baskets | core | C08.twoDigit, C08.decade | c08-a-tensones, c08-a-decade | 6 | Ext (twoDigit) |
| 7-8 | Days Ahead | core | C11.offsets, C13.intervals | c11-a-after, c11-a-before, c11-a-howmany, c13-a-elapsed, c13-a-inclusive | 6 | Ext (offsets) |
| 7-9 | Story Detective | core | C14.missing | c14-a-missingstart, c14-a-missingchange | 6 | Ext |
| 7-10 | Two-Step Tales | core | C14.twoStep | c14-a-twostep | 5 | Ext |
| 7-11 | Time Travellers | core | C12.elapsed, C13.transitions | c12-a-elapsed, c13-a-transition | 6 | Ext |
| 7-12 | Queen Bee's Honey Festival | finale | C01.groups50, C02.partWhole, C08.twoDigit, C09.twoDigit, C10.multiGap, C12.fiveMin, C13.intervals, C14.twoStep | c01-a-tens, c02-a-missing, c08-a-tensones, c09-a-tens, c10-a-multi, c12-a-five, c13-a-elapsed, c14-a-twostep | 8 | Ext (mixed) |

### Bonus: Secret Honeycomb (only shown when `isUnlocked(SUBSKILL_BY_ID['C08.regroup' / 'C09.regroup'], ev, profile)`)
| Lvl | Title | Kind | Subskills | Templates | Q |
|---|---|---|---|---|---|
| B-1 | Honeycomb Swap (add) | bonus | C08.regroup | c08-a-regroup, c08-a-tensones | 6 |
| B-2 | Honeycomb Swap (take away) | bonus | C09.regroup | c09-a-regroup, c09-a-tens | 6 |

### W7 and extensions
Most of W7 is extension content. If `showExtensions` is off, the W7 path must still be completable. Rule: a world counts as "complete" when its non-Ext levels and its friend or finale level are done. For the finale, swap Ext templates for observed ones from the same world (for example `c08-a-decade` instead of `c08-a-tensones`). In code, add `fallbackTemplates` to such levels.

---

## 5. Unlock rules

1. **Within a world:** level n+1 unlocks when level n has at least 1 star. A star means the child finished every question, whether or not they used hints, the solution or a skip. Stars never gate anything.
2. **Next world:** opens when the previous world's friend level is finished.
3. **"Your bee already knows this path!":** a world also opens if every explore subskill in it is `isSecure` through the normal modes. Already-secure levels show a small "blooming" badge and can be skipped. This respects evidence from other modes.
4. **Ext levels when `showExtensions === false`:** they appear on a dotted side branch, are optional and never block. The next main-path node unlocks from the previous main-path node.
5. **Bonus levels:** appear only when `isUnlocked` returns true for the gated subskill, which needs secure prerequisites or the parent's `unlockRegrouping` setting.
6. **Parent override:** a new setting, `adventureOpenAll: boolean`, opens every world. This is for parents who prefer free choice.
7. **Stars unlock only cosmetics:**
   - 3 stars on every level in a world gives a golden-path sparkle and a world trophy sticker.
   - Every 15 total stars gives a new map decoration.
   - These sit alongside the hats from garden levels.

---

## 6. Stars and evidence integration (no double counting)

### 6.1 Star scoring ("petals", never time-based)
For each *planned* slot (follow-up and prerequisite slots inserted by `finishCurrent` have purpose `follow-up` and are excluded from the score):

| Outcome (from `Attempt`) | Petals |
|---|---|
| `isIndependentEvidence(a) && a.firstCorrect` | 2 |
| `a.finalCorrect && !a.sawSolution` (fixed after a retry or a hint) | 1 |
| solution seen, or skipped | 0 |

- `maxPetals = 2 × plannedSlots`
- **1 star:** finished
- **2 stars:** petals ≥ 60% of max
- **3 stars:** petals ≥ 85% of max. For 6 questions that means 11/12: one fixed mistake is fine.

Hints are rewarded with petals, not punished to zero. This keeps "Hint Hero" consistent. Requirement: the star function signature must not receive `activeMs`. Add a unit test that fails if it does.

### 6.2 Recording attempts
- Add `'adventure'` to `Mode` in `src/engine/types.ts`.
- Adventure questions go through the existing `finishCurrent`, so each question is **exactly one `Attempt`**. That single attempt feeds mastery, reviews, stickers, quests and the parent report. Stars are **derived** from the attempts of that run (`attempts.filter(a => a.sessionId === run.id)`). They are never stored as a second copy of the evidence.
- Slot purposes:
  - core and mini levels: `'need'`
  - memory levels: `'review'` for subskills that are actually due (via `dueReviews`), otherwise `'mixed'` with `unannounced: true`
  - friend and finale levels: `'mixed'`, unannounced
- This means `retentionChecks` and `updateReviews` handle spaced review with no new code. An adventure question on a due subskill *is* the review: it is counted once and advances the schedule once.

### 6.3 Replay safeguards (the real double-counting risk)
Replaying the same level several times in one day would:
- inflate `sessions` in `evaluateSkill`, which counts distinct `sessionId`s toward `minSessions: 2`;
- fill the 10-attempt window with near-identical practice.

Fixes in `src/learning/mastery.ts`:
- Add an `evidenceSessionKey(a)` helper: return `adv:${a.levelId}:${a.date}` for adventure attempts, otherwise `a.sessionId`. Use it in place of `a.sessionId` when counting `sessions`.
- **Daily cap:** at most 8 adventure attempts per subskill per day count as evidence. Mark extra ones `countsAsEvidence: false` (a new optional field on `Attempt`) and have `isIndependentEvidence` return false for them. Extra attempts still count for stars, quests and nectar.
- **Fresh seeds on every play** (`rng.int` as `slot()` already does), so replays are new questions, not memorised ones.

### 6.4 Nectar
- Keep the existing per-question nectar (1 per solved question, keyed per run). Keep the per-session bonus.
- Add a one-off **star bonus**: +2 nectar the first time each star on a level is earned, keyed `adv:${levelId}:star${k}` in `profile.awarded`. This is idempotent and refresh-proof.
- Because question nectar is paid on replays too, farming is limited by `suggestRest` (after 3 runs a day) and by the slower stars-only bonus. Optional: replays of a level that already has 3 stars pay the per-question nectar only on the first replay of the day.

### 6.5 Learning support hooks
- If a level ends with 1 star and its main subskill is `learning-supported` or `not-assessed`, the results screen offers "Learn it with Bee" (`launch('lesson', { subskill })`). It is never forced.
- Adventure attempts with purpose `'need'` do not mark categories as `screened`, so the assessment flow is unchanged.
- The mission card in `GardenMapScreen` can suggest "Next adventure level" when there are no reviews due and the check-up is complete.

---

## 7. New mini-game styles (presentation only, reusing scenes)

Implementation pattern:
- Add an optional `skin?: MiniSkin` to `Slot` and `SceneProps`.
- In `src/activities/SceneView.tsx`, pass `skin` to the existing scene.
- The scene changes only its visuals and motion. The **`answer` spec, `work` keys and `checkAnswer` stay the same**, so evidence and checking are unaffected.
- There are no timers in any skin. Every skin falls back to static art under reduced motion (`settings.reducedMotion`).

1. **Bubble Pop Counting** (`skin: 'bubbles'`, scene `count`)
   - Each `SceneObject` sits inside a soap bubble that gently bobs around a fixed point. Bubbles never drift away or pop by themselves.
   - Tapping a bubble pops it with a soft "plip" and marks it, using the existing `work.marked` toggle from `CountScene.tsx`. A popped bubble leaves a sparkle. At `reveal >= 2` the sparkle shows its running number, as now.
   - Tap again to "re-bubble" (unmark), keeping undo.
   - Templates: c01-e-row, c01-e-dice, c01-p-rows, c01-p-scatter.
2. **Lily-Pad Hop** (`skin: 'lily-hop'`, scenes `trail`, `add`/`subtract` with `representation: 'numberline'`)
   - The number line or trail becomes pads on water (ice floes in W4, stones in W5).
   - The bee hops one pad per tap. Each hop is a counted step, reusing AddScene/SubScene's hop work. Gaps in `trail` are empty pads that light up when filled.
   - Templates: c08-e-numberline, c08-p-zero, c09-e-numberline, c09-p-facts, c10-e-gap, c10-p-forward.
3. **Bee Postman** (`skin: 'postman'`, scene `week` with `cards`)
   - Seven day-houses along a street. The bee carries a letter and the child drags or taps the house for "the day after Tuesday".
   - The answer is still the existing choice or order spec.
   - Templates: c11-e-next, c11-p-after, c11-p-before, c11-e-order. It extends to c11-a-after later.
4. **Optional: Ferry Loader** (`skin: 'ferry-loader'`, scene `ferry`). Animals waddle onto the boat when tapped. Used in level 2-9.

---

## 8. Save data and code changes

### 8.1 Types (`src/learning/types.ts`, `src/engine/types.ts`)
```ts
// engine/types.ts
export type Mode = ... | 'adventure';

// learning/types.ts
export type WorldId = 'w1'|'w2'|'w3'|'w4'|'w5'|'w6'|'w7'|'bonus';
export interface AdventureLevelProgress {
  stars: 0 | 1 | 2 | 3;          // best ever, never decreases
  bestPetals: number;
  maxPetals: number;
  plays: number;
  firstClearedOn: DateStr | null;
  lastPlayedOn: DateStr | null;
}
export interface AdventureProgress {
  version: 1;
  levels: Record<string, AdventureLevelProgress>;   // key = level id, e.g. 'w1-01'
  friendsCelebrated: WorldId[];                       // cutscene shown once
  lastLevelId: string | null;                         // bee stands here on the map
}
// Profile:          adventure?: AdventureProgress;
// Attempt:          levelId?: string; countsAsEvidence?: false;
// ActiveSession:    adventure?: { levelId: string; world: WorldId; theme: JourneyTheme };
// SessionRecord:    theme?: JourneyTheme; levelId?: string;
// Settings:         adventureOpenAll: boolean (default false)
```
Store only the best result per level. The run-level detail is already in `attempts` and `sessions`.

### 8.2 New files
- `src/adventure/levels.ts`:
  - `WORLDS` (id, theme, friend sprite, titleKey, palette)
  - `LEVELS: LevelDef[]` (the table in §4)
  - `LEVEL_BY_ID`

  ```ts
  interface LevelDef { id: string; world: WorldId; n: number; titleKey: string;
    kind: 'core'|'mini'|'memory'|'friend'|'finale'|'bonus';
    templates: string[]; fallbackTemplates?: string[]; questions: number;
    skin?: MiniSkin; ext?: boolean; gatedSubskill?: string; }
  ```
- `src/adventure/progress.ts`, all pure functions:
  - `petalsFor(attempts, plan)`
  - `starsFor(petals, max)`
  - `isLevelUnlocked(level, profile, ev)`
  - `isWorldOpen(world, profile, ev)`
  - `recordLevelResult(profile, levelId, sessionId, today)`, which is idempotent and keeps the best result
- `planAdventureLevel(rng, profile, level, today): Slot[]`, in `src/adventure/planner.ts` or in `src/learning/planner.ts`:
  - round-robin over `level.templates`, avoiding the last 2 templates;
  - formats as in §3.3;
  - memory levels put `dueReviews` restricted to world-scope subskills first;
  - Ext templates are swapped for `fallbackTemplates` when `showExtensions` is false.
- `src/screens/AdventureScreens.tsx`: world picker, winding level map, level intro card, star results with the friend cutscene.

### 8.3 Edits
- `src/app/actions.ts`: add `launchLevel(levelId)`, which builds the plan and calls `startSession(..., 'adventure', plan, now, { adventure: {...} })`. In `closeSession`, call `recordLevelResult` and award the star bonus.
- `src/app/store.ts`: add the routes `adventure`, `adventure-world`, `level-results`.
- `src/screens/SessionScreen.tsx:203`: use `session.adventure?.theme ?? themeFor(...)`.
- `src/learning/session.ts` `endSession`: copy the theme and levelId into `SessionRecord`.
- `src/learning/fun.ts` `friendsMet`: prefer `s.theme`, but only count it when a friend or finale level was completed. Otherwise every mixed-category adventure run would wrongly count as 'garden'. Add a new quest, `stars2` ("Earn 2 new stars today"), to `QUEST_POOL`.
- `src/learning/mastery.ts`: `evidenceSessionKey` and the `countsAsEvidence` check (§6.3).
- `src/learning/gamification.ts`: stickers `first-star` 🌠, `world-friend-<w>` (7 stickers), `three-star-world` 🏵️, `adventurer` (finished the finale).
- `src/persistence/schema.ts`:
  - `newProfile` / `fillDefaults` initialise `adventure: { version: 1, levels: {}, friendsCelebrated: [], lastLevelId: null }`;
  - `validateImport` checks that level ids exist in `LEVEL_BY_ID`, stars are integers from 0 to 3 and plays are ≥ 0;
  - cap the size, as already done for `treasures`.
  
  `SCHEMA_VERSION` can stay at 1 because the new fields are optional. The `treasures` and `beeHat` fields set this precedent.
- `src/i18n/en-ui.ts`, `ta-ui.ts`: world names, level titles, friend lines (about 81 titles plus 7 world intros and 7 friend thank-you lines in English and Tamil).

### 8.4 Map visual spec ("visually stunning", mobile portrait first)
- **Per-world layout:** a vertical scrolling map, a single SVG cubic path that winds left to right, with nodes about 110px apart on a 360px-wide phone. Use the theme's `sky`, `far`, `mid` and `near` colours from `THEMES` as 3-layer parallax.
- **Nodes:** flower buds that open with 1–3 petal-stars. The current node pulses gently (CSS scale 1→1.06, 2s). The friend node is a large illustrated house with the friend sprite waving.
- **Bee:** wears `currentHat`. After a result it flies along the path to the next node (about 900ms ease-in-out; instant under reduced motion).
- **3D option:** reuse the floating-island style from `src/three/Journey3D.tsx` and `layout3d.ts`, one island per level, behind `use3D()` with the 2D map as the fallback (same pattern as `With3D` in `GardenScreens.tsx`).
- **Accessibility:** each node is a `<button>` with an aria-label such as "Level 3, Big Pot Small Pot, 2 stars". The list-view toggle matches the existing garden map.

---

## 9. Tests to add
- **vitest** `src/adventure/levels.test.ts`:
  - at least 70 core levels;
  - level ids are unique;
  - every template id resolves through `getTemplate`;
  - each template's `subskill` is in the level's subskill list;
  - `questions` is between 5 and 8;
  - each world ends with a `friend` or `finale` level;
  - every Ext level has a non-Ext path around it;
  - every `fallbackTemplates` entry is non-extension.
- **vitest** `progress.test.ts`:
  - star thresholds;
  - follow-up slots are excluded;
  - best result is kept (never decreases);
  - unlock rules, including `showExtensions=false` and `isSecure` skip-ahead;
  - star bonus nectar paid only once.
- **vitest** `mastery.test.ts`: two replays of the same level on the same day count as one `sessions` unit; attempts beyond the daily cap are excluded from the window.
- **Playwright:** open Adventure, play 1-1 (answer all), see ≥1 star, check that 1-2 is unlocked, reload, check that progress persists.

---

## 10. Unverified points and caveats
- I read only template titles and ids, not every generator body. Two placements depend on template behaviour I did not check:
  - `c14-e-act` ("Act out a story within 5") is placed in W4 on the assumption that it can include taking away. If it only joins, move it to W3.
  - The Lily-Pad skin assumes `c08-p-zero` and `c09-p-facts` use the numberline representation, based on their titles.
- The star thresholds (60% and 85%), the daily evidence cap of 8 and the +2 star bonus are product heuristics. Like the existing `Settings.mastery` values, they are not validated educational standards.
- No external sources were fetched for this report. Google Play Families policy compliance (no ads, no purchases, data handling) should be checked against the current policy at https://support.google.com/googleplay/android-developer/answer/9893335. I did not verify that URL in this task.

Key files referenced:
- `/Users/stalin/Downloads/claudegamemathbee/src/curriculum/curriculum.ts`
- `/Users/stalin/Downloads/claudegamemathbee/src/engine/registry.ts`
- `/Users/stalin/Downloads/claudegamemathbee/src/engine/types.ts`
- `/Users/stalin/Downloads/claudegamemathbee/src/learning/{planner,session,mastery,review,fun,gamification,types}.ts`
- `/Users/stalin/Downloads/claudegamemathbee/src/activities/journey.ts`
- `/Users/stalin/Downloads/claudegamemathbee/src/activities/SceneView.tsx`
- `/Users/stalin/Downloads/claudegamemathbee/src/screens/SessionScreen.tsx`
- `/Users/stalin/Downloads/claudegamemathbee/src/screens/GardenScreens.tsx`
- `/Users/stalin/Downloads/claudegamemathbee/src/persistence/schema.ts`
- `/Users/stalin/Downloads/claudegamemathbee/src/app/actions.ts`