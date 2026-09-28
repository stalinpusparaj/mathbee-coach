# Curriculum coverage matrix

_Generated from the code by `npm run docs:coverage` — do not edit by hand._

Legend — **A: observed** in the supplied worksheet photos · **B: prerequisite** skill needed to teach it · **C: extension** proposed beyond the worksheets.

## A. Worksheet items observed in the six photographs (pages 10–14, Q1–Q50)

| Ref | Worksheet content | Readable | Category | Subskills |
|---|---|---|---|---|
| Q1–Q7 | Count and write (stars, teddies, bicycles, books, apples in columns, smileys, scattered drops) | yes | C01 Nectar Collector | C01.to5, C01.to20 |
| Q8 | 10 − 3 in boxes (choice) | yes | C09 Penguin Harbour | C09.to20 |
| Q9 | How many figures altogether (dogs, squirrels, turtles) | yes | C02 Animal Ferry | C02.to20 |
| Q10 | Which is small? (two circles) | yes | C04 Flower Fit | C04.bigSmall |
| Q11 | Which is long? (two arrows) | yes | C05 Bridge Builder | C05.longShort |
| Q12–Q13 | Number of sides: rectangle, triangle | yes | C06 Shape Workshop | C06.sidesCorners |
| Q14 | Add and write total balls (3 + 5), answers as words | yes | C08 Orchard Basket | C08.to5, C08.to20 |
| Q15 | How many pairs of roses (10 roses) | yes | C07 Bouquet Shop | C07.makePairs, C07.countPairs |
| Q16 | 20 apples, 6 taken away | yes | C14 Garden Help Desk | C14.to20 |
| Q17 | 12 chocolates, 8 added | yes | C14 Garden Help Desk | C14.to20 |
| Q18 | 19 − 11 | yes | C09 Penguin Harbour | C09.to20 |
| Q19 | Number before 28 | yes | C10 Number Trail | C10.beforeAfter10, C10.seq100 |
| Q20 | Day before Monday | yes | C11 Weekly Planner | C11.beforeAfter |
| Q21 | How many days in a week | yes | C11 Weekly Planner | C11.order |
| Q22 | 11 birds, 5 more arrive | yes | C14 Garden Help Desk | C14.to20 |
| Q23 | 12 coconuts, 2 fall down | yes | C14 Garden Help Desk | C14.to20 |
| Q24 | "Subtract:" picture of penguins with options 4/5/3/2 — full question text not visible in the photo | partial | C09 Penguin Harbour | C09.to5 |
| Q25 | Read the clock (10:05 / 10:15 / 10:10) | yes | C12 Clock Tower | C12.fiveMin |
| Q26–Q30 | Missing numbers forwards and backwards (17…22, 59…55, 9…14, 36…31, 69…64) | yes | C10 Number Trail | C10.seq100, C10.multiGap |
| Q31–Q35 | July calendar (Monday-first): days from 7th to 27th, last Friday, 16th to 28th, weekday of 15th, weekday of 11th | yes | C13 Festival Planner | C13.read, C13.named, C13.intervals |
| Q36–Q45 | Evaluate: 20−11, 6+14, 9+11, 10+0, 11+19, 4+12, 8+4, 16−7, 48−20, 27−17 | yes | C08 Orchard Basket | C08.to20, C08.makeTen, C08.decade, C09.to20, C09.twoDigit |
| Q46–Q50 | Count each bird: owl, swan, parrot, ostrich, cock (with crows, penguins and others mixed in) | yes | C03 Bird Sanctuary | C03.oneTarget, C03.sortCount |

**Gap recorded:** Q24 shows a "Subtract:" instruction and a row of penguins with options a)4 b)5 c)3 d)2, but the full question text/visual grouping is not legible in the photo. It is not reproduced; generic penguin subtraction within 5 covers the topic.

**Worksheet ambiguity handled:** Q31/Q33 ask "How many days are there from 7th July to 27th July". The app never uses this wording; it asks either "how many days pass" (20 — elapsed) or "how many dates, counting both" (21 — inclusive).

## Template matrix (14 categories × 3 stages)

| Category | Stage | Template | Subskill | Source | Worksheet refs | Verified by |
|---|---|---|---|---|---|---|
| C01 Nectar Collector | explore | `c01-e-row` — Count 1–5 objects in a row | C01.to5 | A observed | Q1–Q7 (count and write) | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | explore | `c01-e-dice` — Match a neat arrangement (1–5) to its numeral | C01.to5 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | explore | `c01-e-zero` — Zero as an empty container, and small amounts in a basket | C01.zero | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | practise | `c01-p-rows` — Count 6–20 objects in rows | C01.to20 | A observed | Q1–Q6 | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | practise | `c01-p-scatter` — Count 6–20 scattered objects | C01.to20 | A observed | Q7 (scattered shapes) | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | practise | `c01-p-columns` — Count stacked columns (worksheet style) | C01.to20 | A observed | Q5 (apples in columns) | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | apply | `c01-a-tens` — Count full ten-frames plus extras (21–50) | C01.groups50 | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | apply | `c01-a-fives` — Count groups of five plus extras | C01.groups50 | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C01 Nectar Collector | apply | `c01-a-partial` — Count ten-frames that are not all full | C01.groups50 | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | explore | `c02-e-load` — Load two kinds of animals (total up to 5) and count all | C02.to5 | A observed | Q9 (how many altogether) | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | explore | `c02-e-groups` — Two groups of different animals: how many altogether? | C02.to5 | A observed |  | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | explore | `c02-e-hopon` — Some passengers, then one more kind hops on (to 5) | C02.to5 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | practise | `c02-p-load3` — Three kinds of animals, total 6–20 | C02.to20 | A observed | Q9 | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | practise | `c02-p-table` — Count each kind, then the total | C02.to20 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | practise | `c02-p-worksheet` — Worksheet style: how many figures altogether (choice) | C02.to20 | A observed | Q9 | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | apply | `c02-a-boats` — Full boats of ten plus extra passengers (to 50) | C02.grouped50 | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | apply | `c02-a-subtotals` — Add subtotals of passengers (tens and ones) | C02.grouped50 | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C02 Animal Ferry | apply | `c02-a-missing` — Total is known: find the missing group | C02.partWhole | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | explore | `c03-e-target` — Count one bird type among two very different types (3–6 birds) | C03.oneTarget | A observed | Q46–Q50 | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | explore | `c03-e-sort` — Move the target birds to their home, then count them | C03.oneTarget | A observed |  | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | explore | `c03-e-vocab` — Bird names (tracked separately from counting) | C03.vocab | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | practise | `c03-p-sortall` — Sort three or four kinds and count each (6–15 birds) | C03.sortCount | A observed | Q46–Q50 | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | practise | `c03-p-one` — Count one kind among four or five kinds | C03.sortCount | A observed |  | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | practise | `c03-p-worksheet` — Worksheet picture: count each of the five birds (with other birds mixed in) | C03.sortCount | A observed | Q46–Q50 | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | apply | `c03-a-compare` — Which group has more birds? (15–25 birds) | C03.compare | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | apply | `c03-a-howmanymore` — How many more of one bird than another? | C03.compare | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C03 Bird Sanctuary | apply | `c03-a-multi` — Two instructions: count two kinds together | C03.compare | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | explore | `c04-e-big` — Which pot is big? (two same-shaped pots) | C04.bigSmall | A observed | Q10 | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | explore | `c04-e-small` — Which circle is small? (worksheet style) | C04.bigSmall | A observed | Q10 | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | explore | `c04-e-match` — Put the big plant in the big pot | C04.bigSmall | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | practise | `c04-p-order-up` — Order 3–5 pots from smallest to biggest | C04.order | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | practise | `c04-p-order-down` — Order 3–5 pots from biggest to smallest | C04.order | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | practise | `c04-p-smallest` — Find the smallest or biggest of four | C04.order | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | apply | `c04-a-fit` — Choose the smallest pot that is at least as wide as the plant | C04.constraint | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | apply | `c04-a-shelf` — Choose the biggest pot that still fits under a shelf | C04.constraint | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C04 Flower Fit | apply | `c04-a-between` — Choose the pot bigger than one pot but smaller than another | C04.constraint | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | explore | `c05-e-long` — Which plank is long? (shared starting line) | C05.longShort | A observed | Q11 | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | explore | `c05-e-short` — Which plank is short? | C05.longShort | A observed | Q11 | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | explore | `c05-e-arrows` — Worksheet style: which arrow is long? | C05.longShort | A observed | Q11 | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | practise | `c05-p-order` — Order 3–5 planks from shortest to longest | C05.measure | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | practise | `c05-p-measure` — Measure a plank with equal blocks (no gaps, no overlaps) | C05.measure | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | practise | `c05-p-find` — Which plank is N blocks long? | C05.measure | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | apply | `c05-a-build` — Build a bridge of exactly the gap length | C05.build | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | apply | `c05-a-missing` — Some blocks are placed: how many more are needed? | C05.build | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C05 Bridge Builder | apply | `c05-a-difference` — How many blocks longer is one plank than another? | C05.build | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | explore | `c06-e-name` — Name a circle, triangle, square or rectangle | C06.names | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | explore | `c06-e-find` — Tap the named shape | C06.names | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | explore | `c06-e-outline` — Match a shape to its outline | C06.names | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | practise | `c06-p-sides` — Trace and count straight sides (circle has no straight sides) | C06.sidesCorners | A observed | Q12; Q13 | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | practise | `c06-p-corners` — Mark and count corners | C06.sidesCorners | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | practise | `c06-p-worksheet` — Worksheet style: number of sides (choice) | C06.sidesCorners | A observed | Q12 (rectangle); Q13 (triangle) | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | apply | `c06-a-rotated` — Name a turned (rotated) shape by its sides and corners | C06.rotateCompose | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | apply | `c06-a-compose` — How many small squares make this rectangle? | C06.rotateCompose | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C06 Shape Workshop | apply | `c06-a-poly` — EXTENSION: sides of pentagons and hexagons (not in the supplied worksheets) | C06.polygons | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | explore | `c07-e-make` — Join 2–6 flowers into pairs; count the pairs | C07.makePairs | A observed | Q15 | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | explore | `c07-e-toflowers` — One to three pairs: how many flowers? | C07.makePairs | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | explore | `c07-e-match` — Join matching flowers into pairs (two or three kinds) | C07.makePairs | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | practise | `c07-p-count` — Count pairs in 8–20 flowers | C07.countPairs | A observed | Q15 (10 roses) | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | practise | `c07-p-leftover` — Odd number of flowers: pairs and one left over | C07.countPairs | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | practise | `c07-p-worksheet` — Worksheet style: how many pairs of roses? (choice) | C07.countPairs | A observed | Q15 | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | apply | `c07-a-needed` — An order of N pairs: how many flowers are needed? | C07.pairsApply | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | apply | `c07-a-leftover` — 11–20 flowers: pairs and leftovers (e.g. 11 = 5 pairs + 1) | C07.pairsApply | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C07 Bouquet Shop | apply | `c07-a-more` — Have some flowers; how many more for N pairs? | C07.pairsApply | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | explore | `c08-e-baskets` — Pour two baskets together (sum to 5) | C08.to5 | A observed | Q14 | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | explore | `c08-e-words` — Add two groups and choose the answer written in words | C08.to5 | A observed | Q14 (answers as words) | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | explore | `c08-e-numberline` — Hop on a number line (sum to 5) | C08.to5 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | practise | `c08-p-tenframe` — Add within 20 with ten-frames | C08.to20 | A observed | Q37 6+14; Q41 4+12; Q42 8+4 | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | practise | `c08-p-maketen` — Make ten first (e.g. 8 + 5, 12 + 8 = 20) | C08.makeTen | A observed | Q17 12+8; Q38 9+11 | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | practise | `c08-p-zero` — Adding zero and other facts within 20 (number line) | C08.to20 | A observed | Q39 10+0 | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | apply | `c08-a-tensones` — Two-digit addition with tens and ones (no regrouping) | C08.twoDigit | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | apply | `c08-a-decade` — Ones make a new ten (e.g. 11 + 19 = 30) | C08.decade | A observed | Q40 11+19 | unit: 60 seeds valid · e2e: stage reachable |
| C08 Orchard Basket | apply | `c08-a-regroup` — EXTENSION: two-digit addition with regrouping (e.g. 27 + 16 = 43) | C08.regroup | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | explore | `c09-e-boat` — Penguins leave on the boat: how many are left? (within 5) | C09.to5 | A observed | Q24 (penguins, partly readable) | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | explore | `c09-e-choose` — Picture subtraction within 5 (choice) | C09.to5 | A observed | Q8 10−3 (boxes) | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | explore | `c09-e-numberline` — Hop back on a number line (within 5) | C09.to5 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | practise | `c09-p-within20` — Subtract within 20 with penguins | C09.to20 | A observed | Q16 20−6; Q18 19−11; Q43 16−7 | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | practise | `c09-p-zeroall` — Take away zero, or take away all | C09.to20 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | practise | `c09-p-facts` — Subtraction facts within 20 on a number line | C09.to20 | A observed | Q36 20−11; Q8 10−3 | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | apply | `c09-a-tens` — Two-digit subtraction, no regrouping (e.g. 27 − 17 = 10) | C09.twoDigit | A observed | Q45 27−17 | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | apply | `c09-a-wholetens` — Take away whole tens (e.g. 48 − 20 = 28) | C09.twoDigit | A observed | Q44 48−20 | unit: 60 seeds valid · e2e: stage reachable |
| C09 Penguin Harbour | apply | `c09-a-regroup` — EXTENSION: subtraction with regrouping (e.g. 42 − 17 = 25) | C09.regroup | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | explore | `c10-e-after` — Number just after (within 10) | C10.beforeAfter10 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | explore | `c10-e-before` — Number just before (within 10) | C10.beforeAfter10 | A observed | Q19 (number before 28) | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | explore | `c10-e-gap` — One gap in a counting-on trail within 10 | C10.beforeAfter10 | A observed | Q26–Q30 (missing numbers) | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | practise | `c10-p-forward` — Counting on within 100 with two gaps (e.g. 17, __, 19, 20, __, 22) | C10.seq100 | A observed | Q26; Q28 | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | practise | `c10-p-backward` — Counting back within 100 (e.g. 59, 58, __, 56, 55) | C10.seq100 | A observed | Q27; Q30 | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | practise | `c10-p-beforeafter` — Number before or after within 100 | C10.seq100 | A observed | Q19 (before 28) | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | apply | `c10-a-multi` — Two gaps side by side (e.g. 36, __, __, 33, 32, 31) | C10.multiGap | A observed | Q29; Q30 | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | apply | `c10-a-skip` — EXTENSION: skip-count by 2, 5 or 10 (rule stated) | C10.skip | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C10 Number Trail | apply | `c10-a-between` — The number between two numbers | C10.multiGap | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | explore | `c11-e-order` — Put the seven day cards in order (Monday first) | C11.order | A observed | Q21 (days in a week) | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | explore | `c11-e-count` — How many days in a week / in the weekend? | C11.order | A observed | Q21 | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | explore | `c11-e-next` — The day after (no week crossing) | C11.order | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | practise | `c11-p-before` — The day before, including the day before Monday | C11.beforeAfter | A observed | Q20 (day before Monday) | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | practise | `c11-p-after` — The day after, including the day after Sunday | C11.beforeAfter | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | practise | `c11-p-yesterday` — Yesterday and tomorrow | C11.beforeAfter | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | apply | `c11-a-after` — N days after a day, across the week (e.g. Friday + 3 = Monday) | C11.offsets | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | apply | `c11-a-before` — N days before a day, across the week | C11.offsets | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C11 Weekly Planner | apply | `c11-a-howmany` — How many days later is one day than another? | C11.offsets | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | explore | `c12-e-read` — Read o'clock times | C12.hours | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | explore | `c12-e-set` — Set the hands to an o'clock time | C12.hours | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | explore | `c12-e-match` — Pick the clock that shows a digital o'clock time | C12.hours | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | practise | `c12-p-half` — Read half past times (hour hand halfway) | C12.halfQuarter | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | practise | `c12-p-quarter` — Read quarter past and quarter to | C12.halfQuarter | A observed | Q25 option 10.15 | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | practise | `c12-p-set` — Set half past / quarter times | C12.halfQuarter | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | apply | `c12-a-five` — Read five-minute times (e.g. 10:10) | C12.fiveMin | A observed | Q25 (10:05 / 10:15 / 10:10) | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | apply | `c12-a-setfive` — Set the hands to a five-minute time | C12.fiveMin | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C12 Clock Tower | apply | `c12-a-elapsed` — EXTENSION: what time will it be after N minutes? (e.g. 9:45 + 30 min = 10:15) | C12.elapsed | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | explore | `c13-e-weekday` — Which day of the week is a date? (July 2025: 11th = Friday) | C13.read | A observed | Q35 (11th July) | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | explore | `c13-e-find` — Read the marked date | C13.read | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | explore | `c13-e-first` — The date of the first Monday/Tuesday/… of the month | C13.read | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | practise | `c13-p-last` — Date of the last Friday (or other day) of the month | C13.named | A observed | Q32 (last Friday of July) | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | practise | `c13-p-length` — How many days are in this month? (incl. leap-year February) | C13.named | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | practise | `c13-p-named` — A named date in a story: which weekday? (15th July 2025 = Tuesday) | C13.named | A observed | Q34 (pocket money on the 15th) | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | apply | `c13-a-elapsed` — Days that pass from one date to another (July 7 → July 27 = 20) | C13.intervals | A observed | Q31; Q33 (wording made explicit) | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | apply | `c13-a-inclusive` — Count the dates from one date to another, counting both (July 7–27 = 21 dates) | C13.intervals | A observed | Q31; Q33 (other reading) | unit: 60 seeds valid · e2e: stage reachable |
| C13 Festival Planner | apply | `c13-a-transition` — N days after a date, into the next month (incl. February and December) | C13.transitions | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | explore | `c14-e-join` — One-step joining story within 5 | C14.to5 | A observed | Q22 (birds arrive) | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | explore | `c14-e-separate` — One-step taking-away story within 5 | C14.to5 | A observed | Q23 (coconuts fall) | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | explore | `c14-e-act` — Act out a story within 5, then type the answer | C14.to5 | B prerequisite |  | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | practise | `c14-p-add` — Addition stories within 20, varied wording | C14.to20 | A observed | Q17 (12 chocolates + 8); Q22 (11 birds + 5) | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | practise | `c14-p-sub` — Taking-away stories within 20, varied wording | C14.to20 | A observed | Q16 (20 apples − 6); Q23 (12 coconuts − 2) | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | practise | `c14-p-worksheet` — The worksheet stories (20−6, 12+8, 11+5, 12−2) and close variations | C14.to20 | A observed | Q16; Q17; Q22; Q23 | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | apply | `c14-a-twostep` — EXTENSION: two-step story; each step answered (12 + 8 = 20, 20 − 6 = 14) | C14.twoStep | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | apply | `c14-a-missingstart` — EXTENSION: missing start (some birds, 5 arrive, now 16) | C14.missing | C extension |  | unit: 60 seeds valid · e2e: stage reachable |
| C14 Garden Help Desk | apply | `c14-a-missingchange` — EXTENSION: missing change (12 coconuts, some fall, 10 left) | C14.missing | C extension |  | unit: 60 seeds valid · e2e: stage reachable |

Total templates: **126** (minimum required 126).

## Subskills

| Subskill | Category | Stage | Source | Prerequisites | Gated |
|---|---|---|---|---|---|
| C01.to5 | C01 | explore | observed |  |  |
| C01.zero | C01 | explore | prerequisite |  |  |
| C01.to20 | C01 | practise | observed | C01.to5 |  |
| C01.groups50 | C01 | apply | extension | C01.to20 |  |
| C02.to5 | C02 | explore | observed | C01.to5 |  |
| C02.to20 | C02 | practise | observed | C02.to5, C01.to20 |  |
| C02.grouped50 | C02 | apply | extension | C02.to20 |  |
| C02.partWhole | C02 | apply | extension | C02.to20 |  |
| C03.vocab | C03 | explore | prerequisite |  |  |
| C03.oneTarget | C03 | explore | observed | C01.to5 |  |
| C03.sortCount | C03 | practise | observed | C03.oneTarget, C03.vocab |  |
| C03.compare | C03 | apply | extension | C03.sortCount |  |
| C04.bigSmall | C04 | explore | observed |  |  |
| C04.order | C04 | practise | extension | C04.bigSmall |  |
| C04.constraint | C04 | apply | extension | C04.order |  |
| C05.longShort | C05 | explore | observed |  |  |
| C05.measure | C05 | practise | extension | C05.longShort, C01.to5 |  |
| C05.build | C05 | apply | extension | C05.measure |  |
| C06.names | C06 | explore | prerequisite |  |  |
| C06.sidesCorners | C06 | practise | observed | C06.names |  |
| C06.rotateCompose | C06 | apply | extension | C06.sidesCorners |  |
| C06.polygons | C06 | apply | extension | C06.sidesCorners |  |
| C07.makePairs | C07 | explore | observed | C01.to5 |  |
| C07.countPairs | C07 | practise | observed | C07.makePairs |  |
| C07.pairsApply | C07 | apply | extension | C07.countPairs |  |
| C08.to5 | C08 | explore | observed | C01.to5 |  |
| C08.to20 | C08 | practise | observed | C08.to5 |  |
| C08.makeTen | C08 | practise | observed | C08.to5 |  |
| C08.twoDigit | C08 | apply | extension | C08.to20 |  |
| C08.decade | C08 | apply | observed | C08.makeTen |  |
| C08.regroup | C08 | apply | extension | C08.twoDigit, C08.decade | yes (regrouping: unlocked by secure prerequisites or parent setting) |
| C09.to5 | C09 | explore | observed | C01.to5 |  |
| C09.to20 | C09 | practise | observed | C09.to5 |  |
| C09.twoDigit | C09 | apply | observed | C09.to20 |  |
| C09.regroup | C09 | apply | extension | C09.twoDigit | yes (regrouping: unlocked by secure prerequisites or parent setting) |
| C10.beforeAfter10 | C10 | explore | observed |  |  |
| C10.seq100 | C10 | practise | observed | C10.beforeAfter10 |  |
| C10.multiGap | C10 | apply | observed | C10.seq100 |  |
| C10.skip | C10 | apply | extension | C10.seq100 |  |
| C11.order | C11 | explore | observed |  |  |
| C11.beforeAfter | C11 | practise | observed | C11.order |  |
| C11.offsets | C11 | apply | extension | C11.beforeAfter |  |
| C12.hours | C12 | explore | prerequisite |  |  |
| C12.halfQuarter | C12 | practise | observed | C12.hours |  |
| C12.fiveMin | C12 | apply | observed | C12.halfQuarter |  |
| C12.elapsed | C12 | apply | extension | C12.fiveMin |  |
| C13.read | C13 | explore | observed |  |  |
| C13.named | C13 | practise | observed | C13.read |  |
| C13.intervals | C13 | apply | observed | C13.named |  |
| C13.transitions | C13 | apply | extension | C13.named |  |
| C14.to5 | C14 | explore | observed | C08.to5, C09.to5 |  |
| C14.to20 | C14 | practise | observed | C14.to5, C08.to20, C09.to20 |  |
| C14.twoStep | C14 | apply | extension | C14.to20 |  |
| C14.missing | C14 | apply | extension | C14.to20 |  |

"Verified by" means: every template generated 60 deterministic seeds that passed validation and the pure answer check (tests/unit/generators.test.ts), and every category-stage combination was opened and answered in a real browser (tests/e2e/flows.spec.ts). It does not mean the pedagogy has been evaluated with children.
