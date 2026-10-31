# MathBee Coach: what award-winning, ethical, good-looking kids' learning games do, and what MathBee should add

This was read-only research: I changed no files. Each external fact has a URL, and anything I could not confirm is marked **[UNVERIFIED]**. File paths point to `/Users/stalin/Downloads/claudegamemathbee`.

---

## 0. Release blockers to fix before the "award" work

1. **Narration will probably go silent in the Android WebView build.**
   - `src/audio/speech.ts` uses `window.speechSynthesis`. Developers report that Android WebView does not implement the Web Speech API, so `speechSynthesis` comes back `undefined` (seen in Chromium 138). The workaround that worked was a native `TextToSpeech` bridge exposed as `window.AndroidTTS` through `@JavascriptInterface`, with an `onDone` callback to keep timing in sync. Sources: https://github.com/bizzkoot/Hand-Math/releases/tag/v1.0.2 and https://community.xibo.org.uk/t/android-player-speechsynthesis-web-speech-api-unavailable-in-webview-chromium-138/38219. These are developer reports, not official Android docs **[UNVERIFIED officially]**.
   - **Why it matters:** the app is audio-first for a child who cannot read yet, and Tamil voices are often missing anyway.
   - **Fix:** in `speech.ts`, call `window.AndroidTTS.speak(text, lang, id)` when it exists and fall back to `speechSynthesis` otherwise. In the Kotlin shell, use `TextToSpeech` with `Locale("ta","IN")` / `Locale("en","IN")` and send `onDone` back through `evaluateJavascript`.
   - **Better long-term:** record human voice-over clips (MP3/OGG) for every fixed line in English and Tamil (instructions, cheers, numbers 0–100), and keep TTS only for generated sentences. Teacher Approved explicitly rates voice-over quality (see 1.1).

2. **Google Play Families policy: an app that only wraps a website will be rejected.** The policy bars apps that "merely provide a webview of a website" without the site owner's permission (https://support.google.com/googleplay/android-developer/answer/9893335).
   - Ship the `dist/` bundle inside the APK and serve it with `WebViewAssetLoader` from `https://appassets.androidplatform.net/`. Do not load a remote URL.
   - Make the app clearly native-feeling: haptics, back button, immersive mode, splash screen, native TTS.
   - Do not request `AD_ID` (apps aimed only at children must not when targeting API 33+, same source). No analytics SDKs.

3. **The parent area needs a real parent gate.** `src/components/ui.tsx:31` says the press-and-hold button is "a convenience gate against accidental taps (not security)". A 6-year-old can press and hold.
   - Gate the parent dashboard, settings, export and any outbound link with something an adult can do but a 6-year-old cannot, for example "Type the number forty-seven" in words, or an adult-level sum.
   - The ICO standard for ages 0–9 expects parent involvement and high privacy by default (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/). A parent gate is also standard Families practice **[exact Play wording not fetched]**.

---

## 1. What award bodies and reviewers judge

### 1.1 Google Play "Teacher Approved" (the most relevant badge for this launch)
Source: https://google.play/business/programs/teacherapproved/

Teachers and specialists rate seven things:
1. **Language, vocabulary and audio** (dialogue, music, sound effects, voice-over, text) of high quality and suited to the age.
2. **Usability:** buttons, menus, navigation and gestures that the target age can understand.
3. **Visuals:** high-quality, age-appropriate art and animation.
4. **Appeal:** "engages and delights".
5. **Healthy development:** creativity, imagination, learning, positive messages.
6. **Content appropriateness** for the youngest age in the target range.
7. **Ads, in-app purchases and cross-promotion:** must be compliant and must not degrade the experience.

The framework was built with academic advisors (Harvard's Joe Blatt, Georgetown's Sandra Calvert), and the status is reviewed again over time. Source: https://support.google.com/googleplay/answer/6209531.

**What this means for MathBee:** it already scores well on 5, 6 and 7 (no ads, no purchases). The weak points are **1 (audio quality, especially Tamil TTS)** and **2 (usability without reading)**. Section 3 targets those.

### 1.2 Learning science behind "educational" ratings
- **The "four pillars" (Hirsh-Pasek et al., 2015).** Apps that serve a learning goal should be:
  - **active** ("minds-on"; tapping alone does not count),
  - **engaged** (few distractions),
  - **meaningful** (linked to the child's life),
  - **socially interactive**.

  Sources: https://www.psychologicalscience.org/publications/educational-apps.html and https://www.newamerica.org/insights/new-framework-identify-truly-educational-apps/.

  MathBee is strong on active, engaged and meaningful. It is weakest on **social interaction**, which section 3.3 addresses with parent co-play.
- **Manipulative design (Radesky et al., JAMA Network Open, 2022).** In apps used by 3–5-year-olds, researchers found parasocial pressure from characters, made-up time pressure, navigation constraints, and "attractive lures" that extend play. Only about 20% of apps had none of these features. Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC9206186/ and https://deceptive.design/articles/prevalence-and-characteristics-of-manipulative-design-in-mobile-applications-used-by-children.

  **Use this as a design checklist** (section 4). The sample size (160 children vs 133 apps) differs between sources **[UNVERIFIED]**.
- **Common Sense Media** privacy ratings are Pass, Warning or Fail (https://www.commonsensemedia.org/app-reviews/busy-shapes). I could not find their learning-rating method **[UNVERIFIED]**. Khan Academy Kids is widely reported as a Common Sense "Editor's Choice" with 5/5 for learning (https://www.commonsensemedia.org/app-reviews/khan-academy-kids) **[score not confirmed on the page]**.

### 1.3 Award winners and what they share
| Product | Recognition | What made it work |
|---|---|---|
| Pok Pok Playroom | Apple Design Award 2021, Delight & Fun (https://blog.playpokpok.com/pok-pok-playroom-is-a-202-1-apple-design-award-winner-cf07e4b1f450) | No winning or losing, no failure; "curiosity is met with play rather than prizes"; calm, tactile, Montessori-inspired; an app parents "wouldn't have to mute in a restaurant" (https://playpokpok.com/press/press-kit/) |
| Addimal Adventure | Apple Design Award 2014, single-digit addition (https://www.macworld.com/article/223509/wwdc-apple-design-awards-winners-for-2014.html) | A narrow maths goal turned into a tactile story |
| Funexpected Math | Self-reported: Kidscreen 2025 Best Original Learning App, Webby Best Visual Design (https://apps.apple.com/us/app/funexpected-maths/id1473965253) **[self-reported]** | Mixes games, **interactive stories** and adaptive practice; aimed at maths anxiety (https://techcrunch.com/2019/12/09/can-a-games-platform-tackle-kids-anxiety-about-having-to-do-math) |
| Lingokids | Self-reported Kidscreen Best Original Learning App two years running (https://lingokids.com/?p=56066) **[self-reported]** | Recurring character cast, songs |
| DragonBox Numbers | Parents magazine best learning app 2020 and 2021 (https://www.eschoolnews.com/2016/02/01/app-of-the-week-eat-your-way-to-basic-math-skills/); Games for Change 2016 **[UNVERIFIED]** | **Numbers as characters** ("Nooms") that kids physically split and join; 4 modes (Ladder, Puzzles, Run, Sandbox); number line built as a ladder to a star |
| Khan Academy Kids | Ages 2–8, free, no ads | **Adaptive learning path** guided by Kodi Bear, who uses expressive gestures and encourages retries (https://blog.khanacademy.org/supporting-english-language-acquisition-with-khan-academy-kids/) |
| Todo Math (Enuma) | Parents' Choice 2015/2018; LAUNCH Best Design 2013 | Accessibility is a feature: **left-handed mode, dyslexia-friendly font, help button, 8 languages** (https://apps.apple.com/app/id666465255) |
| Toca Boca, Sago Mini | Category leaders | **Little or no text**; "leave some space so kids can fill in the gaps"; characters designed around how kids play (https://www.killscreen.com/secret-smart-kids-entertainment-give-them-toy-not-game/). Sago Mini Jinja's Garden reportedly has zero words and switched joystick controls to tap-to-move after testing with 100 four-year-olds (https://gori.me/apps/ipad-app-news/167337) **[single source]** |
| Monument Valley (visual craft) | Apple Design Award | "Every single screen a piece of art that could be hung on a wall"; a palette chosen per level; simple lighting gives 3D forms depth; puzzles tested and tuned first, art pass last (https://www.creativebloq.com/computer-arts/making-monument-valley-71412213, https://activation.unity3d.com/case-study/monument-valley) |
| Prodigy (counter-example) | FTC complaint by 22 groups, 2021 | Rewards locked behind membership; one 19-minute session had **16 membership ads and 4 maths problems** (https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/). **Never copy this pattern.** |

BAFTA Children's 2025 game winner: not found **[UNVERIFIED]**. Sackboy won the Game category in 2022 (https://britishcinematographer.co.uk/bafta-children-young-people-awards-winners-announced/).

---

## 2. Patterns pulled from the research

### 2.1 Core loop for ages 5–7
The pattern across Khan Kids, Funexpected and DragonBox (my synthesis):

**A** Guide character asks, using voice →
**B** child manipulates objects (drag, split, join; not multiple choice only) →
**C** immediate physical feedback (object reacts, sound) →
**D** small celebration →
**E** a visible change in the world (path grows, garden blooms) →
**F** a natural stopping point.

Sessions are short (5–15 minutes). MathBee's default `sessionMinutes: 10` (`src/learning/types.ts:214`) is right.

### 2.2 World and level map
- **Common structure:**
  - worlds or biomes of 8–15 nodes,
  - one "celebration/boss" node per world (a story moment, never a hard test),
  - stars per node,
  - new things unlocking every 1–3 sessions.
- **Ethical version:**
  - stars measure effort or completion, not speed;
  - **never lock content behind stars**, and always offer a gentler path;
  - replays can only raise stars.
- **MathBee today:** 14 categories × 3 stages = 42 nodes, plus a 7-theme journey (`FRIEND_ORDER` in `src/learning/fun.ts:112`). That is enough content for **7 worlds × 6 nodes = 42**, with a celebration node closing each world (section 3.2).

### 2.3 Ethical reward schedules
Good rewards are fixed and predictable (complete X, get Y), cosmetic, never lost, and never tied to time pressure. They are rewards to collect, not "come back or lose it".

**Avoid:**
- gift boxes with random prizes (a variable-ratio "loot box" feel),
- countdown timers,
- characters who are sad or guilt-tripping when the child leaves (Radesky's "parasocial pressure"),
- "one more" prompts at the natural end of a session,
- push notifications aimed at the child.

**Encourage:** prompts to take a break, and pause/save (ICO, ages 0–9).

### 2.4 Audio
- Human voice-over beats TTS for pre-readers (Teacher Approved criterion 1).
- Music should be calm and duck under speech.
- Sound effects should be pitched and musical: rising notes for counting, a chord on success.
- Pok Pok's "won't need to mute in a restaurant" is a useful target: soft by default.

### 2.5 "Juice" (game feel)
- "Juice it or lose it" (Jonasson & Purho, 2012) lists squash and stretch, particles, tweening, screen shake and hit-stop (https://ojs.aaai.org/index.php/AIIDE/article/download/18889/18654/22655).
- Guides warn: keep camera shake small, and juice "should always echo your core gameplay" (https://www.wayline.io/learn/game-feel/1).
- **For ages 5–7:** no screen shake on wrong answers (it reads as punishment). Use squash and stretch, soft particles and a short pause before a success reveal.

### 2.6 Accessibility for pre-readers
- Instructions are spoken first; every instruction has a 🔊 replay button.
- UI is led by icons; text is secondary.
- Touch targets of at least 48dp (Android guidance), large for small fingers.
- Tap-to-place as an alternative to drag (Sago's finding).
- Left-handed mode and a dyslexia-friendly font (Todo Math).
- Respect reduced motion. MathBee already does this in `src/styles/app.css` and `src/three/support.ts`.

### 2.7 Parent dashboard expectations
Parents expect:
- skills mastered and skills in progress, in plain language;
- time played per day;
- suggested offline activities;
- control over session length;
- no account required.

MathBee already has most of this in `src/screens/ParentScreens.tsx` and `src/report/parentReport.ts`.

---

## 3. Recommendations for MathBee, ranked by impact

### P0: Release-critical (Teacher Approved and policy)
1. **Native TTS bridge plus recorded voice-over** (section 0.1).
   - Files: `src/audio/speech.ts` (add a `nativeBridge()` check first), the new Kotlin `MainActivity.kt`, and new `public/assets/voice/{en,ta}/*.ogg`.
   - Add a voice manifest in `src/assets/manifest.ts` that maps i18n keys to clips, with TTS as fallback.
   - Requirements:
     - every fixed instruction key in `src/i18n/en-ui.ts` and `ta-ui.ts` has a clip;
     - numbers 0–100 are clips, so generated sentences can be joined from clips plus TTS;
     - music volume drops by about 60% while a voice line plays (`src/audio/music.ts`).
2. **Bundled assets via `WebViewAssetLoader`**, a real parent gate, no `AD_ID`, no network permission unless needed. Remove the service worker in the Android build, since the assets are already local (`src/sw/sw-template.js`).
3. **Native integration** so the app does not feel like a wrapped page:
   - Haptics bridge `window.AndroidHaptics.tap()` and `.success()` using `performHapticFeedback` (it respects the system haptics setting: https://learn.microsoft.com/dotnet/api/android.views.view.performhapticfeedback). Add a toggle in Settings.
   - Hardware back button maps to in-app back. On the home screen it shows "Bye-bye, see you tomorrow!", not a nag.
   - Immersive full screen, portrait or landscape lock, splash screen, `keepScreenOn` only during a session.
4. **Audio-first instruction pattern everywhere.**
   - Each question screen auto-plays its prompt once, shows a large 🔊 replay button, and keeps the bee's mouth animating while speaking (`onSpeakingChange` already exists).
   - Files: `src/screens/SessionScreen.tsx`, `src/components/AnswerPanel.tsx`.

### P1: Engagement that wins awards and stays ethical
5. **World map with 7 worlds, 6 nodes each, and a celebration node per world.**
   - Map the 7 `FRIEND_ORDER` themes (meadow, river, orchard, ice, trail, town, garden) to worlds. Each world holds 2 categories × 3 stages.
   - The 7th node in each world is a **"Friend's Party"** story level: a mixed review of that world's skills (pulled from `src/learning/review.ts`), told as helping the friend, for example "help Penguin count fish for the party". It is not a test: no score, and a celebration whatever happens.
   - Show a **1–3 flower rating per node**:
     - 1 flower for finishing,
     - 2 for finishing with hints used and then solving,
     - 3 for mastery (already computed in `src/learning/mastery.ts`).

     Never rate by speed. Never block the next node on flowers; unlocking follows the existing `prereq` in `src/curriculum/curriculum.ts`.
   - Files: `src/three/Journey3D.tsx`, `src/components/JourneyTrack.tsx`, and new `src/learning/worlds.ts` (pure, testable).
   - Adds about 49 "levels" with no new maths content.
6. **"Grow more levels" through a bonus "Number Playground" per world** (the DragonBox / Pok Pok idea).
   - An open sandbox with no right or wrong: split and join number bees (number bonds to 10/20), build towers on a number line (Ladder-style), or pour nectar to compare.
   - Unlocks when the world's party is done and stays open for good. This answers "add more levels" without stretching the curriculum, and adds the open-ended creativity that Teacher Approved criterion 5 rewards.
   - Files: new `src/activities/scenes/playground*.tsx`, reusing `src/components/math-models.tsx` and `src/components/dnd.ts`.
7. **Make the gift box predictable.**
   - Check `treasureFor()` in `src/learning/fun.ts:95`. If it is pseudo-random, show the next treasure as a silhouette ("Tomorrow's gift: a shell 🐚"), or use a fixed, visible calendar of treasures. This removes the variable-reward "lure".
   - Never show a countdown. If the child misses days, nothing is lost and the gift simply waits (keep current behaviour).
8. **Story spine and a character with feelings.**
   - One short story per world: the friend has a problem, the bee helps with maths, the friend thanks the bee.
   - The bee shows **curiosity and encouragement, never sadness at leaving** (avoids Radesky's parasocial pressure).
   - A wrong answer gets "Hmm, let's look again!" plus a visual hint, as Kodi Bear does.
   - Files: `src/i18n/en-content.ts`, `ta-content.ts`, `src/components/Celebration.tsx`.
9. **Parent–child co-play ("Play together" mode)**, for the social pillar.
   - On a world-party node, show a card for the grown-up: "Ask: how many more to make 10? Count together on fingers."
   - Weekly printable "Try at home" activities generated from weak skills in `src/learning/diagnosis.ts`.
   - Files: `ParentScreens.tsx`, `src/report/parentReport.ts`.
10. **Natural session end.**
    - When `sessionMinutes` is reached, finish the current item, then play an ending scene: the garden blooms, the bee yawns, "Great work today!".
    - The only buttons are "Show my garden" and "Done". No "one more". This extends the existing `suggestRest`/`REST_AFTER` in `src/learning/fun.ts:135`.

### P2: Making it look stunning
11. **Art direction pass in the Monument Valley spirit.**
    - One distinct **palette per world**: CSS tokens in `src/styles/app.css` (`--world-sky`, `--world-ground`, `--world-accent`) and matching `three.js` fog, hemisphere-light colours and a gradient sky in `src/three/kit.ts`.
    - Requirements:
      - soft warm key light plus a cool fill;
      - gentle fog for depth;
      - time-of-day that tracks the session, from morning at start to golden hour at the end;
      - every map view framed like a postcard.
12. **A juice kit, as one shared module** (new `src/components/juice.ts` plus CSS keyframes):
    - Tap: squash (scale 0.92) then overshoot (1.05) then settle, about 180ms, plus a soft tick sound and a light haptic.
    - Correct answer:
      - 80ms pause,
      - the answer card pops (stretch),
      - 8–12 pollen particles burst from the tap point,
      - rising 3-note arpeggio,
      - nectar drop flies along an arc to the counter (tween), then the counter bumps.
    - Combo milestone (`COMBO_MILESTONES` in `src/learning/fun.ts:32`): the bee does a loop, the trail changes colour, the music key steps up.
    - Wrong answer: **no shake and no red X**. Gentle wobble, a soft low note, then the hint appears.
    - Level-up and world completion: full-screen bloom transition (circle wipe from the bee), confetti limited to 2s, then a slow camera pan over the grown garden in `Garden3D.tsx`.
    - All of it honours `reducedMotion` (already a setting) and is capped at 60fps. Turn particles off on the `graphics: 'low'` tier.
13. **Screen transitions.** Use a consistent "fly with the bee" transition between screens (shared-element tween of the bee sprite) in place of hard cuts. Files: `src/App.tsx` routing, plus the `three` scenes.
14. **Adaptive music.** Each world gets a variation on one theme, and stems are added as combo or progress grows. Keep it calm. Files: `src/audio/music.ts`, `src/audio/sfx.ts`. Target soft default loudness with one master slider in Settings.

### P3: Accessibility and inclusion (wins reviewer goodwill)
15. **Left-handed mode** (mirror the answer panel and drag source), a **dyslexia-friendly or rounded font option**, and a **tap-to-place alternative to drag** throughout `src/components/dnd.ts`.
16. **Touch targets of at least 56dp for children**, and test at 360×640. Add a Playwright e2e test at a phone viewport that checks every interactive element is 48px or larger (`tests/`).
17. **Tamil parity:** every voice line recorded in Tamil, and Tamil numerals or words where the curriculum calls for them. This is a real advantage, since few competing apps localise to Tamil.

---

## 4. Ethics checklist to keep (from Radesky 2022, ICO and the Prodigy complaint)

| Do not | MathBee status |
|---|---|
| Lives, losing streaks, speed pressure | Already absent (`gamification.ts` header) |
| Countdown timers or "gift expires" | Check that the gift UI and quests never show time left |
| Random-reward boxes | Make treasures predictable (P1 item 7) |
| Character sad or guilt when leaving | Keep the bee positive at exit (P1 items 8 and 10) |
| "One more?" at session end | Natural ending only (P1 item 10) |
| Locking progress behind collectibles | Unlocking uses curriculum prereqs only |
| Ads, IAP, cross-promotion, child notifications | None. Keep it that way, and if notifications are ever added, address them only to parents through the parent gate |
| Data collection or identifiers | Offline, IndexedDB only, no AD_ID. Write a one-page privacy policy (required on Play) saying "no data leaves the device" |

Encourage: break prompts (existing `suggestRest`) and pause/save (sessions already resume from storage). Both are positive nudges under the ICO standard.

---

## 5. Suggested order of work

1. **P0, items 1–4** (TTS bridge, asset loader, parent gate, haptics and back button, audio-first prompts). Without these the WebView release is likely to be silent and to fail review.
2. **P1, item 5** (worlds, party nodes, flowers) and **P2, item 12** (juice kit). These give the largest visible jump in engagement and polish.
3. **P1, items 7, 8 and 10** (predictable gift, story spine, natural end). Mostly copy and small logic changes.
4. **P2, items 11, 13 and 14** (per-world art direction, transitions, music).
5. **P1, items 6 and 9** (Number Playground sandbox, co-play), then **P3** accessibility.
6. Before submitting: self-score against the 7 Teacher Approved criteria, playtest with 3–5 children aged 5–7 (Sago-style weekly testing), and record any failures to understand an instruction without reading.

---

## 6. Things I could not verify
- Common Sense Media's learning-rating method.
- The BAFTA Children's 2025 game winner.
- The Kidscreen 2025 "Original" winner (Funexpected's claim is self-reported).
- Whether DragonBox won Games for Change.
- The Sago Mini Jinja's Garden testing details (one source).
- Official Android documentation on WebView `speechSynthesis` (only developer reports).
- The exact Play Families parent-gate wording.
- Whether `treasureFor()` is predictable today. I did not read its body; check `src/learning/fun.ts:95`.