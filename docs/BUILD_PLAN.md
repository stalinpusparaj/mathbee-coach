# MathBee 1.0 build plan (binding)

This file is the single source of truth for the 1.0 release work. Section A (binding decisions) OVERRIDES anything in Section B (the original research plan) and the critique in Section C. Research reports live in `docs/research/`.

## A. Binding decisions

### A1. Scaffold already in place (do not redo)
- Routes added in `src/app/store.ts`: `intro`, `adventure`, `adventure-world {world}`, `level-results {levelId, record, newNectar, prevStars}`, `session-end`. `GATED_ROUTES` + `store.setGateOpen()`; `App.tsx` shows `<ParentGate>` for gated routes until passed; leaving gated routes closes the gate.
- String packs: put strings in `src/i18n/packs/<pack>.ts` as `export const EN = {...}; export const TA = {...}` — auto-merged by `src/i18n/i18n.ts` (base tables win). Never edit `en-ui.ts`/`ta-ui.ts` except WP7.
- Feature CSS: `src/styles/features/<pack>.css`, auto-loaded by `src/main.tsx` after `app.css`. Never edit `app.css` except WP7.
- Contracts (stubs to be implemented, keep exported names/signatures): `src/app/shell.ts` (WP2), `src/app/backNav.ts` (WP2; `parentOf`, `pushOverlay`, `goBack`, `canGoBack` are real already), `src/components/ParentGate.tsx` (`ParentGate`, `ParentEntry`; WP6), `src/screens/AdventureScreens.tsx` (`AdventureWorldsScreen`, `WorldMapScreen`, `LevelResultsScreen`; WP4), `src/screens/IntroStory.tsx` (`IntroStory`; WP6), `src/components/SessionEnd.tsx` (`SessionEndScreen`; WP5).
- Fonts are installed as npm packages `@fontsource/nunito`, `@fontsource/baloo-2`, `@fontsource/noto-sans-tamil` (bundled offline; WP6 imports them).

### A2. Scope for 1.0 (complete — do not stop at W1–W3)
- All 7 worlds + 2 bonus levels from §4 of the plan (81 levels), with the fixes in A3.
- Mini-game skins: implement `bubbles` and `lily-hop` (with `ice`/`stone` variants) fully; `ferry-loader` and `postman` too if they fit — skins are presentation only and must never change answers, work keys or checking. Levels whose skin isn't implemented play unskinned.
- Recorded voice: ship the lookup pipeline (`src/audio/voice.ts`, empty manifest) — TTS is the voice for 1.0.
- Cutscenes use existing sprites (no new art required).

### A3. Corrections to the plan (from the critique — all mandatory)
1. Petals per planned question: **2** = solved without seeing the solution and not skipped with retries ≤ 1 (hints NEVER reduce petals); **1** = solved after more retries; **0** = solution seen or skipped. Follow-up/prerequisite slots (`purpose:'follow-up'` or inserted) are not scored. Stars: 1 = finished, 2 = ≥60%, 3 = ≥85%. Best kept. `starsFor(petals,max)` never reads time.
2. Child-facing framing: stars are shown as blooms (1–3 flowers). NO all-3-star world trophy, no "perfect world" badge. Stars unlock nothing that blocks progress.
3. Ext detection derived at runtime from curriculum `source === 'extension'` of each template's subskill; fix w7-07, w7-08 and w7-12 fallbacks; with `showExtensions=false` every main-path level resolves only to non-extension subskills (test it).
4. Evidence: adventure attempts carry `levelId`; at most 8 adventure attempts per subskill per day count as mastery evidence (`countsAsEvidence:false` beyond) and such attempts are removed entirely inside `evaluateSkill` (not counted as supported, retention or transfer). Distinct-session counting for adventure uses `adv:${date}`. Petals are computed from the attempt's own flags, never from the evidence cap.
5. Nectar on replays: per-question nectar for an adventure level is paid only on the first play of that level per day; star bonus (+2 per newly reached star, keyed `adv:${levelId}:star${k}` in `awarded`) is paid once ever.
6. Inserted follow-up slots per adventure level are capped at 2.
7. `isUnlocked(SUBSKILL_BY_ID[id], ev, profile)` — correct signature.
8. `Slot.skin?` lives in `src/learning/types.ts`; `MiniSkin` type in `src/engine/types.ts`. Add `mode.adventure` strings (EN+TA).
9. Themes: adventure sessions use `session.adventure.theme`; practice keeps `themeFor` (unchanged). `friendsMet` = union of the existing rule and completed adventure friend/finale levels (existing test stays green).
10. `recordLevelResult` adds the level's categories to `profile.screened` (so daily practice works without the check-up). The check-up and the controls screen stay (not removed).
11. Import: unknown level ids are dropped silently, stars clamped 0–3; validate new Attempt fields.
12. Daily time limit (`Settings.dailyLimitMin` 0|15|20|30, default 0) is checked only between sessions/levels — never cuts a level mid-way. One rest system: `suggestRest` stays for practice; when the daily limit is set it replaces the 3-session rule.
13. No preview of tomorrow's treasure (no silhouette, no countdown).
14. Combo effects fade after a fixed time regardless of outcome; never removed because of a wrong answer.
15. Parent gate: adult arithmetic (2-digit × 1-digit, e.g. "7 × 8", answers typed on a keypad), bilingual EN/TA, 3 tries then a 30 s cool-off, chance of random pass ≤ 1/100. E2E bypass: when the URL has `?e2e` AND this is not an android build, the gate root has `data-answer` with the expected number. Gate protects every route in `GATED_ROUTES` (already enforced by App.tsx) plus export/import/reset/install-voice/privacy (those live in gated screens).
16. Back: in a session, back opens the pause sheet (testid `stop` inside). On `map` (root) back shows a "Bye-bye" sheet whose confirm sends `exitApp`; on welcome root, back sends `exitApp` directly via the sheet too.
17. Shell detection at runtime (`window.MathBeeAndroid`), bridge = `WebViewCompat.addWebMessageListener` object `MathBeeAndroid` with `postMessage(string)` and `onmessage`/`addEventListener('message', e => e.data)`; JSON `{v:1,type,...}`.
18. `initShell()` resolves after the native `shell` reply (≤1500 ms timeout) with voices cached; `onVoicesChange` lets screens re-render; splash released on `ready`.
19. Native: feature-check `WEB_MESSAGE_LISTENER` and `DOCUMENT_START_SCRIPT`; require WebView major ≥ 111 else a native "Please update Android System WebView" screen; haptics via `window.decorView.performHapticFeedback(..., FLAG_IGNORE_VIEW_SETTING)` with pre-API-30 constants; never haptic on wrong answers.
20. Flush: web flushes the store on `visibilitychange`(hidden) and `pagehide`, and on native `lifecycle:pause`, replying `flushed`; native calls `pauseTimers()` only after `flushed` or 300 ms.
21. Export up to 20 MB via chunked `saveFile`/`shareFile` (`begin`/`chunk` 512 KB/`end`); file chooser opens `*/*` and JS validates.
22. AssetLoader: serve only `/web/` (`AssetsPathHandler`), reject other paths; start URL constant `https://appassets.androidplatform.net/web/index.html` frozen (comment + test).
23. applicationId `com.stalinpusparaj.mathbee` (debug suffix `.debug`), app name "MathBee: Number Garden". Check compileSdk against the reference project (`android-37.0` naming).
24. Privacy policy: bundled `public/privacy.html` with `[DEVELOPER NAME]` and `[CONTACT EMAIL]` placeholders; the Gradle release build fails while placeholders remain (owner fills them in).
25. Teacher Approved / awards are never claimed in copy.

### A4. Package ownership (disjoint; only touch your own files)
- **WP1 Android shell:** `android/**`, `.gitignore`, `docs/ANDROID.md`.
- **WP2 Web platform:** `vite.config.ts`, `package.json` (scripts only), `index.html`, `src/main.tsx`, `src/app/platform.ts`, `src/app/shell.ts`, `src/app/backNav.ts`, `src/audio/speech.ts`, new `src/audio/voice.ts`, `src/persistence/storage.ts`, `src/three/kit.ts`, `src/three/support.ts`, `src/three/Garden3D.tsx`, `src/three/Journey3D.tsx`, `src/three/Lazy3D.tsx`, `src/screens/TestScreens.tsx`, `src/styles/features/shell.css`, `src/i18n/packs/shell.ts`, tests `tests/unit/{shell,backNav,platform,speech}.test.ts`.
- **WP3 Adventure logic:** new `src/adventure/{levels,progress,planner}.ts`, `src/engine/types.ts`, `src/learning/types.ts`, `src/learning/session.ts`, `src/learning/mastery.ts`, `src/learning/fun.ts`, `src/learning/gamification.ts`, `src/persistence/schema.ts`, `src/app/actions.ts`, `src/i18n/packs/adventure.ts`, tests `tests/unit/adventure-*.test.ts`, `tests/unit/fun.test.ts`, `tests/unit/learning.test.ts` (additions).
- **WP4 Adventure UI + skins:** `src/screens/AdventureScreens.tsx`, new `src/components/WorldPath.tsx`, `src/activities/SceneView.tsx`, `src/activities/scenes/*`, `src/activities/journey.ts`, `src/styles/features/adventure.css`, `src/i18n/packs/adventure-ui.ts`, tests `tests/unit/{skins,worldpath,journey}.test.ts`.
- **WP5 Juice + sound + session feel:** new `src/fx/*`, `src/components/SessionEnd.tsx`, `src/audio/sfx.ts`, `src/audio/music.ts`, `src/components/Celebration.tsx`, `src/components/AnswerPanel.tsx`, `src/components/JourneyTrack.tsx`, `src/components/Fun.tsx`, `src/components/dnd.ts`, `src/components/math-models.tsx`, `src/components/art.tsx`, `src/screens/SessionScreen.tsx`, `src/styles/features/juice.css`, `src/i18n/packs/juice.ts`, tests `tests/unit/{juice,sfx,music,session-end}.test.ts`.
- **WP6 Parent + onboarding + compliance:** `src/components/ParentGate.tsx`, `src/components/ui.tsx`, `src/screens/ParentScreens.tsx`, `src/screens/WelcomeScreens.tsx`, `src/screens/IntroStory.tsx`, `src/report/*`, `public/privacy.html`, `src/styles/features/parent.css`, `src/i18n/packs/parent.ts`, tests `tests/unit/parentGate.test.ts`, `tests/e2e/gate.spec.ts`.
- **WP7 Integration (last):** `src/App.tsx`, `src/app/store.ts`, `src/i18n/{i18n,en-ui,ta-ui,en-content,ta-content}.ts`, `src/styles/app.css`, `src/screens/GardenScreens.tsx`, `src/screens/RewardScreens.tsx`, `tests/e2e/*` (except gate.spec.ts), `README.md`, `docs/*`.

If you need a change in a file you don't own, do not edit it: write the exact request in your final report under "Handoffs".

---

## B. Research plan (original)

# MathBee Coach: Play Store release plan and implementation spec

This is a read-only plan. I changed no files. I checked these facts against the repo:
- All 126 template ids used in the level table exist in `src/engine/generators/c01..c14.ts`. A first grep missed `c04-p-order-up` and `c04-p-order-down` because of the hyphen inside the id; a second check found them.
- `c14-e-act` produces both `+` and `−` stories, so it can sit in W4.
- `c08-p-zero` and `c09-p-facts` use the number-line representation.
- `treasureFor()` (`src/learning/fun.ts:95`) is a per-day hash. It is deterministic, but the child cannot see what is coming.
- `showExtensions` defaults to `true` (`src/learning/types.ts:218`).
- These are all in `~/.gradle/caches`:
  - AGP 9.4.1
  - KGP 2.4.20
  - webkit 1.17.1
  - core-ktx 1.19.1
  - core-splashscreen 1.2.0
  - activity-ktx 1.13.0
  - the `gradle-9.8.0-bin` wrapper distribution
- JBR is at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`.

---

## 1. Product vision

1. **MathBee: Number Garden** is a calm, story-led maths adventure. A 6-year-old helps a bee and seven animal friends bring a storm-scattered garden back to life, one short level at a time.
2. Every instruction is spoken in English or Tamil, every answer can be tapped, and every mistake becomes "let's look again". There are no lives, timers, ads, purchases or data collection.
3. Parents get a private, gated window into real Grade 1 skills: what the child can do, what needs support, and what to try at home.

**The child's experience:**
- The parent hands over the phone.
- A 25-second narrated intro plays.
- The child reaches a first correct answer and a bloom within 60 seconds.
- They walk a winding path of flower-bud levels (5–8 questions, 4–8 minutes).
- At the end of each world they meet the friend at a party.
- Each session ends naturally: the bee yawns, the garden glows, and the only buttons are "Show my garden" and "Done".

**The parent's experience:**
- Setup, the gate, settings, the weekly "garden letter", backup to a file or Drive, printing worksheets to PDF, and an optional daily time limit.
- Everything works offline, and nothing leaves the phone.

---

## 2. Prioritised feature list

### P0: must ship for the Play release

| # | Feature | Rationale (report) |
|---|---|---|
| P0-1 | Kotlin shell with `WebViewAssetLoader` on `https://appassets.androidplatform.net/web/`, with no INTERNET permission | Families "merely a webview" rule and minimum functionality (policy §8). The origin must never change, or IndexedDB progress is lost (shell §0). |
| P0-2 | Native TTS bridge (en-IN / ta-IN) with an `onDone` callback that keeps music ducking and timer pausing working, plus a parent-side "Install Tamil voice" | `speechSynthesis` is missing in WebView (audit 1.1, design 0.1). A pre-reader can't play without it. |
| P0-3 | Back gesture bridge (`OnBackPressedCallback` + `backNav.ts`) for predictive back on API 36 | Audit blocker #2. Teacher Approved "usability". |
| P0-4 | `--mode android` build: `base:'/web/'`, no service worker, no update banner, no `?gallery` / `?e2e` hooks | Audit blocker #6 and 1.10. |
| P0-5 | Safe areas: native insets passed in as CSS variables, `100dvh`, sticky answer footer | Edge-to-edge is forced on API 35+ (audit blocker #7). |
| P0-6 | Save, share, print and import through bridges (SAF, FileProvider + ACTION_SEND, PrintManager, `onShowFileChooser`) | Audit blockers #3–5. |
| P0-7 | A real parent gate. It asks for an adult-level problem, for example "Tap the number forty-seven" written in words with randomised digits. It protects the parent area, settings, tests and mocks, export, import, reset, the privacy page and "Install voice". | design 0.3, policy §2. The current hold-to-open "is not security". |
| P0-8 | Lifecycle: `onPause` → `webView.onPause()`, a `lifecycle` message, `ctx.suspend()`, and flushing the store. Keep the screen awake only during sessions. Audio focus. | audit 1.2, 1.7. Avoids battery drain and lost writes. |
| P0-9 | WebGL hardening: `webglcontextlost` falls back to 2D, low-RAM devices get 2D on `auto`, DPR capped at 1.5 and no antialias on weak devices, Garden loop at 30 fps and paused offscreen | audit 1.9. Low-end ANR and heat risk. |
| P0-10 | Kid-proofing CSS: `user-select:none`, no callout, `overscroll-behavior:none`, touch targets ≥ 56 px on child controls (calendar cells ≥ 56 px), child text ≥ 16 px | audit §2. Teacher Approved usability. |
| P0-11 | Bundled fonts: Nunito, Baloo 2 and Noto Sans Tamil as `woff2` | audit 1.12. Without them, Roboto replaces the storybook look. |
| P0-12 | Renderer crash recovery, splash released on `ready`, adaptive and monochrome icons, `localeConfig` (en, ta), AD_ID removed | policy §8 and the "no crashes" rule. |
| P0-13 | A privacy policy bundled at `public/privacy.html` and hosted. A Data safety answer of "no data collected". | policy §4–5 |
| P0-14 | Fix the Rules-of-Hooks bug in `SettingsScreen` (`useState` after an early return, `ParentScreens.tsx:245/248`) | audit 5.5 |

### P1: strong engagement and visual wins (target: the v1.0 release)

| # | Feature | Rationale |
|---|---|---|
| P1-1 | **Adventure Mode:** 7 worlds, 79 core levels plus 2 bonus levels, stars by independence, friend parties, unlocking by completion (§4) | "More levels". Gives a sense of a journey (audit 4, 5.2; levels report). Reuses the engine. |
| P1-2 | **Juice kit:** squash on tap, pollen particles, nectar arcs, a gentle wobble on a wrong answer (never a shake or a red X), bloom wipe, haptics (§5) | design 2.5 and P2-12; Teacher Approved "visuals" and "appeal" |
| P1-3 | **Parent-led onboarding and a narrated story intro.** The first level replaces the "check-up". Controls practice is folded into that level with a pointing hand. | audit 5.1 |
| P1-4 | **Natural session end** scene (no "one more"), plus a parent-set daily limit of 15, 20 or 30 minutes | Radesky 2022 and the ICO standard (design 2.3, P1-10) |
| P1-5 | **Predictable gift:** show tomorrow's treasure as a silhouette, with no countdown | design P1-7. Removes the variable-reward lure. |
| P1-6 | **Mini-game skins:** Bubble Pop, Lily-Pad Hop, Bee Postman, Ferry Loader. Presentation only. | levels §7 |
| P1-7 | **Per-world palette and music variation.** Tokens are `--world-sky/ground/accent`, and each world has its own key and tempo for the synthesised theme. | design P2-11 and P2-14 |
| P1-8 | **Sound kit expansion:** about 20 synthesised foley sounds (pop, bloom chime, buzz, splash, tick, page), each pitched up the scale | audit 5.3 |
| P1-9 | **Recorded voice clips** for fixed lines (cheers, stage intros, hints, numbers 0–20) in EN and TA, with TTS as the fallback. The pipeline and manifest ship now. The clips land when recordings and the native-speaker Tamil review are ready. | Teacher Approved "audio" (design 1.1) |
| P1-10 | **"Play together" card** on friend-party levels for the grown-up | Social pillar (design 1.2, P1-9) |

### P2: later (v1.1+)

- **Number Playground sandbox** per world: split and join number bees.
- **Grade 2 pack:** money in ₹, place value to 1000, regrouping, halves.
- Seasonal garden themes (monsoon, Pongal, Diwali).
- Place restored items in 3D.
- Weekly garden letter shared through the share sheet.
- Parent-only daily reminder notification. It is off by default and needs `POST_NOTIFICATIONS`.
- Left-handed keypad and high-contrast mode.
- Rive or Lottie bee rig.
- Lazy-loaded language packs and generators.
- Compacting attempts older than 90 days.
- TalkBack pass.
- Generated-art pipeline output: bee poses, banners, `bg_map_wide`. `generated.json` is empty today.
- Tablet two-column layout.

---

## 3. Android shell spec

### 3.1 Layout

Everything is new under `/Users/stalin/Downloads/claudegamemathbee/android/`, and it is its own Gradle root.

```
android/settings.gradle.kts
android/build.gradle.kts
android/gradle.properties
android/gradle/libs.versions.toml
android/gradle/wrapper/gradle-wrapper.properties   # copy of buzzy-spelling-garden (gradle-9.8.0-bin.zip)
android/gradle/wrapper/gradle-wrapper.jar          # copy
android/gradlew, android/gradlew.bat               # copy
android/local.properties                           # sdk.dir=/Users/stalin/Library/Android/sdk (git-ignored)
android/keystore.properties                        # git-ignored
android/app/build.gradle.kts
android/app/proguard-rules.pro                     # empty (addWebMessageListener needs no keep rules)
android/app/src/main/AndroidManifest.xml
android/app/src/main/java/com/mathbee/coach/MainActivity.kt
android/app/src/main/java/com/mathbee/coach/ShellBridge.kt
android/app/src/main/java/com/mathbee/coach/Speech.kt
android/app/src/main/java/com/mathbee/coach/AudioFocus.kt
android/app/src/main/res/values/{strings,colors,themes}.xml
android/app/src/main/res/values-ta/strings.xml
android/app/src/main/res/values-v29/themes.xml     # forceDarkAllowed=false
android/app/src/main/res/values-v30/themes.xml     # windowLayoutInDisplayCutoutMode=always
android/app/src/main/res/xml/{file_paths,data_extraction_rules,backup_rules,locales_config}.xml
android/app/src/main/res/drawable/{ic_launcher_foreground,ic_launcher_monochrome,splash_icon}.xml
android/app/src/main/res/mipmap-anydpi-v26/{ic_launcher,ic_launcher_round}.xml
android/app/src/main/res/layout/retry_cover.xml    # native "Buzzy needs a tiny rest — Try again"
```

### 3.2 Versions (all present in the local cache)

`libs.versions.toml`:

```toml
[versions]
agp = "9.4.1"
kotlin = "2.4.20"
coreKtx = "1.19.1"
activity = "1.13.0"
webkit = "1.17.1"
splashscreen = "1.2.0"

[libraries]
core-ktx = { module = "androidx.core:core-ktx", version.ref = "coreKtx" }
activity-ktx = { module = "androidx.activity:activity-ktx", version.ref = "activity" }
webkit = { module = "androidx.webkit:webkit", version.ref = "webkit" }
core-splashscreen = { module = "androidx.core:core-splashscreen", version.ref = "splashscreen" }
kotlin-gradle-plugin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
```

**Root `build.gradle.kts`:**
- `buildscript { dependencies { classpath(libs.kotlin.gradle.plugin) } }` pins AGP 9's built-in Kotlin to 2.4.20, which is cached.
- Then add `plugins { alias(libs.plugins.android.application) apply false }`.
- Do **not** apply `org.jetbrains.kotlin.android`, because AGP 9 has Kotlin built in.

**`gradle.properties`:**
- `org.gradle.jvmargs=-Xmx4g`
- `org.gradle.configuration-cache=true`
- `android.useAndroidX=true`

**`settings.gradle.kts`:**
- Repositories `google()` and `mavenCentral()`.
- `FAIL_ON_PROJECT_REPOS`.
- `include(":app")`.

**`app/build.gradle.kts`** (from the shell report §5, with these confirmed values):
- `namespace` and `applicationId` = `com.mathbee.coach`. Choose the final id before the first upload, because it can never change.
- `compileSdk 37`, `minSdk 26`, `targetSdk 36`, Java 17.
- `versionCode` / `versionName` read from `../package.json`, as version × 1000 + build.
- Release: `isMinifyEnabled` and `isShrinkResources` on, signing config `upload` from `keystore.properties`.
- Debug: `applicationIdSuffix ".debug"`.
- `buildConfig = true`.
- `androidResources.noCompress += webp, png, jpg, ogg, mp3, woff2`.
- **`CopyWebGame` task:** configuration-cache-safe `@InputDirectory ../dist-android` synced to `<generated>/web`, excluding `.DS_Store` and `sw.js`. Register it with `androidComponents.onVariants { it.sources.assets?.addGeneratedSourceDirectory(copyWebGame, CopyWebGame::outputDir) }`. If `dist-android` is missing the build fails, which is intended.
- Dependencies: core-ktx, activity-ktx, webkit, core-splashscreen. **Nothing else:** no Firebase, analytics or Compose.

### 3.3 Manifest essentials

- **No `<uses-permission>` at all.** Add `<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>` as a guard.
- `<queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>`
- `application`:
  - `allowBackup=true` with `dataExtractionRules` and `fullBackupContent`
  - `localeConfig="@xml/locales_config"` (en, ta)
  - `appCategory="game"`
  - `hardwareAccelerated=true`
  - theme `Theme.MathBee.Starting` (SplashScreen, honey `#F7BF35`, `postSplashScreenTheme`)
- `MainActivity`:
  - `exported=true`, `singleTask`
  - `screenOrientation="fullUser"`. Android 16 ignores the lock on ≥600dp anyway, so the CSS must handle landscape.
  - `configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard|navigation|uiMode|density|fontScale"`
  - `windowSoftInputMode="adjustResize"`
- A `FileProvider` with authority `${applicationId}.files` and `cache-path exports/`.

### 3.4 WebView configuration (`MainActivity.createWebView`)

**WebView settings:**
- `javaScriptEnabled` on.
- `domStorageEnabled` on.
- `allowFileAccess=false` and `allowContentAccess=false`.
- `mediaPlaybackRequiresUserGesture=false`.
- Zoom off.
- `textZoom=100`. The app's own text-size setting governs text size.
- `setAlgorithmicDarkeningAllowed(false)` and `isForceDarkAllowed=false`.
- `setWebContentsDebuggingEnabled(BuildConfig.DEBUG)`.
- `OVER_SCROLL_NEVER`, scrollbars off.
- Long-click consumed (`setOnLongClickListener { true }`) and `isHapticFeedbackEnabled=false` on the view, so the WebView makes no stray haptics.

**`WebViewClientCompat`:**
- `shouldInterceptRequest` → `assetLoader.shouldInterceptRequest(url)`.
- `shouldOverrideUrlLoading` returns true for any host other than `appassets.androidplatform.net`.
- `onRenderProcessGone`:
  - destroy the view and recreate it, up to 2 times in 60 s;
  - after that, show the retry cover;
  - return true.

**`WebChromeClient`:**
- `onShowFileChooser` launches `StartActivityForResult(p.createIntent())`.
- `onPermissionRequest` → `deny()`.

**`AssetLoader`:** `addPathHandler("/", AssetsPathHandler)`. The start URL is `https://appassets.androidplatform.net/web/index.html`.

**Startup:**
- `installSplashScreen()` keeps the splash on screen until `ready` or 4 s.
- `WebViewCompat.startUpWebView` warm-up, copied from the reference.
- `enableEdgeToEdge()`.
- Immersive bars with `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`, re-applied in `onWindowFocusChanged`.

**Lifecycle:**
- `onPause`:
  1. Run `evaluateJavascript("window.__mbFlush&&window.__mbFlush()")` to flush the store.
  2. Emit `lifecycle:pause`.
  3. Stop speech.
  4. `web.onPause()` and `pauseTimers()`.
  5. Clear keep-awake.
  6. Abandon audio focus.
- `onResume` reverses each step and refreshes the voice list.
- `setVolumeControlStream(AudioManager.STREAM_MUSIC)`.

**`AudioFocus.kt`:** `AudioFocusRequest(USAGE_GAME, CONTENT_TYPE_MUSIC)`. Focus loss sends `lifecycle:{state:'duck'|'pause'}` to the web side.

### 3.5 Bridge protocol (`MathBeeAndroid`, JSON, `v:1`)

- The bridge uses `WebViewCompat.addWebMessageListener(webView, "MathBeeAndroid", setOf(ORIGIN))`.
- It accepts only messages where `isMainFrame` is true and the origin equals `ORIGIN`.
- `type` is whitelisted, strings are capped, and filenames are restricted to `[A-Za-z0-9._-]{1,80}`.
- A document-start script sets:
  - `window.__MATHBEE_SHELL__={platform,versionName,versionCode,sdk,lowRam,animScale}`, where `lowRam` comes from `ActivityManager.isLowRamDevice() || memoryClass<=192`;
  - `reduce-motion` on `<html>` when `ANIMATOR_DURATION_SCALE==0`.

| Direction | type | Payload | Native action |
|---|---|---|---|
| web→native | `hello` | – | Store the reply proxy. Reply with `shell` (version, voices, insets, lowRam). Flush the queue. |
| web→native | `ready` | – | Release the splash |
| web→native | `route` | `{name, canGoBack}` | `backCallback.isEnabled = canGoBack` |
| web→native | `speak` / `stopSpeaking` | `{id, text≤600, lang:'en'\|'ta', rate 0.5–1.5}` | `Speech` → `speech{id,state:start\|end\|error}` |
| web→native | `haptic` | `{style:'tap'\|'success'\|'celebrate'}` | `performHapticFeedback` (KEYBOARD_TAP / CONFIRM / CONFIRM×2), at most one per 150 ms, **never on a wrong answer** |
| web→native | `keepAwake` | `{on}` | `FLAG_KEEP_SCREEN_ON` |
| web→native | `saveFile` | `{reqId, filename, mime, data≤5MB}` | SAF `CreateDocument` → `result` |
| web→native | `shareFile` | same | cache/exports + FileProvider + `ACTION_SEND` chooser |
| web→native | `print` | `{reqId, jobName}` | `PrintManager.print(job, webView.createPrintDocumentAdapter(job), A4)` |
| web→native | `installVoice` | `{lang}` | `TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA` |
| web→native | `exitApp` | – | `finish()`. Used only after the "Bye-bye" screen on root back. |
| native→web | `back` | – | `backNav` closes the top overlay, or goes to the parent route |
| native→web | `lifecycle` | `pause\|resume\|duck` | Suspend or resume the AudioContext, pause timers, duck the music |
| native→web | `insets` | `{top,right,bottom,left}` in CSS px | `--shell-inset-*` |
| native→web | `voices` | `{en, ta}` | `narrationAvailable()` |
| native→web | `result` | `{reqId, status:'saved'\|'shared'\|'printed'\|'cancelled'\|'error'}` | Resolves the request promise |

**`Speech.kt`:**
- Chooses the best offline voice with `locale.language == lang`.
- Excludes voices that need a network connection or have `KEY_FEATURE_NOT_INSTALLED`.
- Prefers the `IN` country and higher quality.
- Pitch 1.05, `QUEUE_FLUSH`.
- `UtteranceProgressListener` events are posted to the main thread.
- If there is no voice, it emits `error`, and the web side shows the text, as today.

### 3.6 Build steps (offline-ish)

```bash
cd /Users/stalin/Downloads/claudegamemathbee
npm run build:android            # tsc --noEmit && vite build --mode android → dist-android/
cd android
export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
./gradlew --offline :app:assembleDebug        # first try; drop --offline once if a POM is missing
./gradlew --offline :app:bundleRelease        # AAB for Play (needs keystore.properties)
unzip -l app/build/outputs/bundle/release/app-release.aab | grep '\.so$'   # must print nothing (16 KB rule N/A)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Upload key, kept outside git and backed up offline:

```bash
keytool -genkeypair -v -keystore ~/keys/mathbee-upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias upload
```

Enrol in Play App Signing. Add `npm run android:debug`, which runs the build and then `gradlew assembleDebug`.

---

## 4. Adventure Mode spec

### 4.1 Worlds

| World | Theme (`THEMES`) | Friend sprite | Categories | Levels |
|---|---|---|---|---|
| W1 Bunny's Flower Meadow | meadow | bunny_florist | C01, C04, C07 | 12 |
| W2 Frog's Ferry River | river | frog | C02, C03, C05 | 11 |
| W3 Squirrel's Apple Orchard | orchard | squirrel_gardener | C08, C14 (join) | 11 |
| W4 Penguin's Ice Floes | ice | penguin_wave | C09, C14 (separate) | 10 |
| W5 Hedgehog's Stepping-Stone Trail | trail | hedgehog | C10, C01.groups50, C02.grouped50 | 11 |
| W6 Owl's Clock Town | town | owl_keeper | C06, C11, C12, C13 | 12 |
| W7 Queen Bee's Hive | garden | svg:hive | apply/extension mix | 12 |
| Bonus: Secret Honeycomb | garden | – | C08.regroup, C09.regroup (gated) | 2 |

This gives 81 levels in total.

### 4.2 Level table

Ids are `w{n}-{nn}` and `bonus-01/02`. Kinds: core (C), mini (M, with a skin), memory (Mem), friend (F), finale (Fin), bonus (B). "Ext" means the level uses an extension subskill: it becomes an optional side branch when `showExtensions=false`.

**W1 (meadow)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w1-01 | First Flowers | C | c01-e-row, c01-e-dice | 5 |
| w1-02 | The Empty Basket | C | c01-e-zero, c01-e-row | 5 |
| w1-03 | Big Pot, Small Pot | C | c04-e-big, c04-e-small, c04-e-match | 5 |
| w1-04 | Bubble Pop Meadow | M bubbles | c01-e-row, c01-e-dice | 6 |
| w1-05 | Flower Buddies | C | c07-e-make, c07-e-match | 5 |
| w1-06 | Count the Bouquet | C | c01-p-rows, c01-p-columns | 6 |
| w1-07 | Scattered Petals | C | c01-p-scatter, c01-p-columns | 6 |
| w1-08 | Pairs Make Flowers | C | c07-e-toflowers, c07-e-make | 5 |
| w1-09 | Pot Parade (Ext) | C | c04-p-order-up, c04-p-order-down, c04-p-smallest | 6 |
| w1-10 | Rose Pairs | C | c07-p-count, c07-p-leftover, c07-p-worksheet | 6 |
| w1-11 | Meadow Memory | Mem | c01-e-dice, c01-e-zero, c04-e-small, c07-e-match, c01-p-rows, c07-p-worksheet | 6 |
| w1-12 | Bunny's Flower Show | F | c01-p-scatter, c04-e-match, c07-p-count, c01-p-columns, c07-p-worksheet | 8 |

**W2 (river)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w2-01 | All Aboard! | C | c02-e-load, c02-e-groups | 5 |
| w2-02 | Hop On, Friends | C | c02-e-hopon, c02-e-groups | 5 |
| w2-03 | Long Plank, Short Plank | C | c05-e-long, c05-e-short, c05-e-arrows | 5 |
| w2-04 | Birds by the River | C | c03-e-vocab | 5 |
| w2-05 | Find the Swans | C | c03-e-target, c03-e-sort | 5 |
| w2-06 | Three-Animal Ferry | C | c02-p-load3, c02-p-table, c02-p-worksheet | 6 |
| w2-07 | Block Bridges (Ext) | C | c05-p-measure, c05-p-find, c05-p-order | 6 |
| w2-08 | Bird Sorting Station | C | c03-p-sortall, c03-p-one, c03-p-worksheet | 6 |
| w2-09 | Ferry Loader | M ferry-loader | c02-e-load, c02-p-load3, c02-e-hopon | 6 |
| w2-10 | River Memory | Mem | c02-e-groups, c02-p-worksheet, c05-e-arrows, c03-e-target, c03-e-vocab | 6 |
| w2-11 | Frog's Big Crossing | F | c02-p-table, c03-p-worksheet, c05-p-find\*, c02-p-worksheet, c03-p-one | 8 |

\*`fallbackTemplates: ['c05-e-arrows']`

**W3 (orchard)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w3-01 | Two Baskets | C | c08-e-baskets, c08-e-numberline | 5 |
| w3-02 | Apple Words | C | c08-e-words, c08-e-baskets | 5 |
| w3-03 | Lily-Pad Plus | M lily-hop | c08-e-numberline | 6 |
| w3-04 | Orchard Stories | C | c14-e-join | 5 |
| w3-05 | Ten-Frame Treats | C | c08-p-tenframe, c08-p-zero | 6 |
| w3-06 | Make a Ten! | C | c08-p-maketen | 6 |
| w3-07 | Zero Surprise | C | c08-p-zero, c08-p-tenframe | 6 |
| w3-08 | Basket Stories | C | c14-p-add | 6 |
| w3-09 | A Brand-New Ten | C | c08-a-decade, c08-p-maketen | 6 |
| w3-10 | Orchard Memory | Mem | c08-e-words, c08-p-tenframe, c08-p-maketen, c14-e-join | 6 |
| w3-11 | Squirrel's Harvest Feast | F | c08-p-tenframe, c08-p-maketen, c14-p-add, c08-a-decade | 8 |

**W4 (ice)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w4-01 | The Boat Leaves | C | c09-e-boat, c09-e-choose | 5 |
| w4-02 | Hop Back, Penguin | C | c09-e-numberline, c09-e-choose | 5 |
| w4-03 | Melting Stories | C | c14-e-separate, c14-e-act | 5 |
| w4-04 | Penguin Parade | C | c09-p-within20, c09-p-facts | 6 |
| w4-05 | None or All | C | c09-p-zeroall, c09-p-within20 | 6 |
| w4-06 | Ice-Floe Hop | M lily-hop (ice) | c09-e-numberline, c09-p-facts | 6 |
| w4-07 | Snowy Stories | C | c14-p-sub, c14-p-worksheet | 6 |
| w4-08 | Big Ice Blocks | C | c09-a-tens, c09-a-wholetens | 6 |
| w4-09 | Ice Memory | Mem | c09-e-choose, c09-p-facts, c14-e-separate, c08-p-zero, c14-p-worksheet | 6 |
| w4-10 | Penguin's Snow Party | F | c09-p-within20, c09-a-wholetens, c14-p-sub, c14-p-worksheet | 8 |

**W5 (trail)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w5-01 | What Comes Next? | C | c10-e-after | 5 |
| w5-02 | What Came Before? | C | c10-e-before | 5 |
| w5-03 | The Missing Stone | C | c10-e-gap, c10-e-after | 5 |
| w5-04 | Stepping-Stone Hop | M lily-hop (stone) | c10-e-gap, c10-p-forward | 6 |
| w5-05 | Counting On to 100 | C | c10-p-forward, c10-p-beforeafter | 6 |
| w5-06 | Counting Back Down | C | c10-p-backward, c10-p-beforeafter | 6 |
| w5-07 | Bundles of Ten (Ext) | C | c01-a-tens, c01-a-partial | 6 |
| w5-08 | Fives and Full Boats (Ext) | C | c01-a-fives, c02-a-boats, c02-a-subtotals | 6 |
| w5-09 | Two Gaps Together | C | c10-a-multi, c10-a-between | 6 |
| w5-10 | Skip Along the Trail (Ext) | C | c10-a-skip | 6 |
| w5-11 | Hedgehog's Long Walk | F | c10-p-forward, c10-p-backward, c10-a-multi, c01-a-tens\* | 8 |

\*`fallback: c10-p-beforeafter`

**W6 (town)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w6-01 | Shape Workshop | C | c06-e-name, c06-e-find | 5 |
| w6-02 | Shadow Shapes | C | c06-e-outline, c06-e-find | 5 |
| w6-03 | Sides and Corners | C | c06-p-sides, c06-p-corners, c06-p-worksheet | 6 |
| w6-04 | Seven Day Cards | C | c11-e-order, c11-e-count, c11-e-next | 5 |
| w6-05 | Yesterday and Tomorrow | C | c11-p-before, c11-p-after, c11-p-yesterday | 6 |
| w6-06 | O'Clock Bells | C | c12-e-read, c12-e-set, c12-e-match | 5 |
| w6-07 | Half Past, Quarter Past | C | c12-p-half, c12-p-quarter, c12-p-set | 6 |
| w6-08 | Bee Postman | M postman | c11-e-next, c11-p-after, c11-p-before | 6 |
| w6-09 | The Calendar Board | C | c13-e-weekday, c13-e-find, c13-e-first | 5 |
| w6-10 | Special Dates | C | c13-p-last, c13-p-length, c13-p-named | 6 |
| w6-11 | Five-Minute Clock | C | c12-a-five, c12-a-setfive | 6 |
| w6-12 | Owl's Clock-Tower Fair | F | c06-p-worksheet, c11-p-before, c12-p-quarter, c13-p-named, c12-a-five | 8 |

**W7 (garden)**

| id | Title | Kind | Templates | Q |
|---|---|---|---|---|
| w7-01 | Bird Count-Off (Ext) | C | c03-a-compare, c03-a-howmanymore, c03-a-multi | 6 |
| w7-02 | The Perfect Pot (Ext) | C | c04-a-fit, c04-a-shelf, c04-a-between | 6 |
| w7-03 | Bridge Builders (Ext) | C | c05-a-build, c05-a-missing, c05-a-difference | 6 |
| w7-04 | Turned and Tiled Shapes (Ext) | C | c06-a-rotated, c06-a-compose, c06-a-poly | 6 |
| w7-05 | Bouquet Orders (Ext) | C | c07-a-needed, c07-a-leftover, c07-a-more | 6 |
| w7-06 | Hidden Passengers (Ext) | C | c02-a-missing, c02-a-subtotals | 6 |
| w7-07 | Big Number Baskets | C | c08-a-tensones\*, c08-a-decade | 6 |
| w7-08 | Days Ahead | C | c11-a-after, c11-a-before, c11-a-howmany, c13-a-elapsed, c13-a-inclusive | 6 |
| w7-09 | Story Detective (Ext) | C | c14-a-missingstart, c14-a-missingchange | 6 |
| w7-10 | Two-Step Tales (Ext) | C | c14-a-twostep | 5 |
| w7-11 | Time Travellers (Ext) | C | c12-a-elapsed, c13-a-transition | 6 |
| w7-12 | Queen Bee's Honey Festival | Fin | c01-a-tens, c02-a-missing, c08-a-tensones, c09-a-tens, c10-a-multi, c12-a-five, c13-a-elapsed, c14-a-twostep | 8 |

For w7-12, `fallbackTemplates` (used when `showExtensions=false`) is: `c01-p-columns, c02-p-table, c08-a-decade, c09-a-wholetens, c10-a-multi, c12-a-five, c13-p-length, c14-p-add`.

**Bonus**

| id | Title | Kind | Templates | Q | Shown when |
|---|---|---|---|---|---|
| bonus-01 | Honeycomb Swap (add) | B | c08-a-regroup, c08-a-tensones | 6 | `isUnlocked(C08.regroup)` |
| bonus-02 | Honeycomb Swap (take away) | B | c09-a-regroup, c09-a-tens | 6 | `isUnlocked(C09.regroup)` |

A level's subskills are derived from `getTemplate(id).subskill` and are not stored. That way the table can never disagree with the generators.

### 4.3 Question formats and slot purposes

| Level kind | Formats | Slot purpose |
|---|---|---|
| Core, explore | All `interactive` | `need` |
| Core, practise/apply | Last question `illustrated` (transfer evidence) | `need` |
| Mini | Same maths with a `skin` | `need` |
| Memory | Mixed formats, `unannounced` | `dueReviews` restricted to this world's subskills first, purpose `review`; the rest `mixed` |
| Friend / finale | Last question `plain`, others interactive | `mixed`, unannounced |

### 4.4 Stars ("petals", never time-based)

Score only the planned slots. Exclude follow-up and prerequisite slots that `finishCurrent` inserts.

| Attempt outcome | Petals |
|---|---|
| `isIndependentEvidence(a) && a.firstCorrect` | 2 |
| `a.finalCorrect && !a.sawSolution` | 1 |
| Solution seen or skipped | 0 |

Thresholds:
- **1 star:** the level is finished.
- **2 stars:** petals ≥ 60% of the maximum.
- **3 stars:** petals ≥ 85% of the maximum.

The best result is kept and never decreases. `starsFor(petals,max)` takes no time argument. A unit test asserts `starsFor.length === 2` and that the progress module never reads `activeMs`.

### 4.5 Unlocking

1. Level n+1 opens when level n has at least 1 star, which means it was finished.
2. A world opens when the previous friend level is finished, **or** when every explore subskill in it is `isSecure`. In that case it is shown as "Your bee already knows this path!"
3. Ext levels sit on a dotted side branch when `showExtensions=false`. They never block progress.
4. Bonus levels appear when `isUnlocked` is true.
5. The parent setting `adventureOpenAll` opens everything.
6. Stars unlock **only cosmetics**:
   - 3 stars on every level of a world gives a golden-path sparkle and a world trophy sticker;
   - every 15 total stars gives a map decoration.

Locked levels look like closed buds, never padlocks.

### 4.6 Data model

Every new field is optional, so `SCHEMA_VERSION` stays at 1.

```ts
// engine/types.ts
export type Mode = ... | 'adventure';
// learning/types.ts
export type WorldId = 'w1'|'w2'|'w3'|'w4'|'w5'|'w6'|'w7'|'bonus';
export interface AdventureLevelProgress { stars: 0|1|2|3; bestPetals: number; maxPetals: number; plays: number; firstClearedOn: DateStr|null; lastPlayedOn: DateStr|null; }
export interface AdventureProgress { version: 1; levels: Record<string, AdventureLevelProgress>; friendsCelebrated: WorldId[]; lastLevelId: string|null; }
// Profile.adventure?: AdventureProgress
// Attempt.levelId?: string; Attempt.countsAsEvidence?: false
// ActiveSession.adventure?: { levelId: string; world: WorldId; theme: JourneyTheme }
// SessionRecord.theme?: JourneyTheme; SessionRecord.levelId?: string
// Settings.adventureOpenAll: boolean (false); Settings.dailyLimitMin: 0|15|20|30 (0); Settings.haptics: boolean (true)
```

**Guarding against double-counting** (in `mastery.ts`):
- `evidenceSessionKey(a)` returns `adv:${levelId}:${date}` for adventure attempts. Distinct-session counting uses this key.
- At most 8 adventure attempts per subskill per day count as evidence. The rest are marked `countsAsEvidence:false`, and `isIndependentEvidence` returns false for them.
- Seeds are fresh on every play.

**Nectar:**
- The existing per-question and per-session nectar is unchanged.
- A one-off **star bonus** of +2 is keyed `adv:${levelId}:star${k}` in `profile.awarded`.

### 4.7 Screens

| Route | Screen | Content |
|---|---|---|
| `adventure` | `AdventureWorldsScreen` | 7 world cards plus Bonus. Each card shows the world palette, the friend sprite (greyed until the world is met), stars collected over the maximum, and a pulsing "current" card. |
| `adventure-world` `{world}` | `WorldMapScreen` | Vertical scrolling SVG path with 3-layer parallax (`sky`, `far`, `mid`, `near` from `THEMES`). Nodes are about 110 px apart and are ≥64 px buds with 1–3 petal stars. The friend house is the last node. The bee wears its `currentHat` on `lastLevelId`. There is a list-view toggle. An optional 3D floating-island view sits behind `use3D()`. |
| `level-intro` (overlay) | `LevelIntroCard` | Friend line (narrated), stars so far, a big "Let's go" button |
| `level-results` `{levelId, record, prevStars}` | `LevelResultsScreen` | Petals fill one by one, stars pop, the star bonus arcs into the counter, the bee flies to the next node. On a friend level, the cutscene plays once (`friendsCelebrated`). "Learn it with Bee" is offered if the level got 1 star and its subskill is not secure. |

### 4.8 How it reuses the session engine

`actions.launchLevel(levelId)` does this:
1. `planAdventureLevel(rng, profile, level, today)` builds the slots: round-robin over the templates, avoiding the last 2, with formats as in §4.3 and fallbacks applied.
2. It calls `startSession(..., 'adventure', plan, now, { adventure: {levelId, world, theme} })` and routes to `session`.

Then:
- `SessionScreen` uses `session.adventure?.theme ?? themeFor(...)`.
- `checkCurrent` / `finishCurrent` are unchanged, so there is exactly one `Attempt` per question.
- `closeSession` calls `recordLevelResult(profile, levelId, sessionId, today)`, which is idempotent and keeps the best result. It then awards the star bonus and routes to `level-results`.
- The `review` slots in memory levels advance spaced review through the existing `updateReviews`.
- `friendsMet` counts `s.theme` only for completed friend or finale levels.
- New quest: `stars2`.
- New stickers: `first-star`, `world-friend-w1..w7`, `three-star-world`, `adventurer`.

---

## 5. Visual and juice upgrade spec

Every effect has a reduced-motion path. The rule: when `html.reduce-motion` is set, there is no translation, scale or particles, only an opacity crossfade of ≤150 ms or an instant change. Haptics stay on, because they are not motion. They are off when the setting is off or the system touch feedback is off.

**A shared module, `src/fx/juice.ts`:**
- `squash(el)`
- `burst(x, y, {count, palette})`: pollen particles on a single pooled `<canvas>` overlay. 8–12 particles, 600 ms, at most 40 alive. Disabled when `graphics:'2d'` is combined with lowRam.
- `arc(fromEl, toEl, sprite)`: a nectar drop following a WAAPI path tween, 700 ms.
- `bump(el)`
- `bloomWipe(originEl)`: a clip-path circle, 500 ms.
- `hitStop(ms)`
- `haptic(style)` → bridge, or `navigator.vibrate` behind a feature check.

Everything is driven by the Web Animations API, and the transform and opacity only. It is capped by `requestAnimationFrame` and checks `prefersReduced()`.

| Moment | Visual | Sound (`sfx.ts`) | Haptic |
|---|---|---|---|
| Any child button tap | squash 0.92 → 1.05 → 1 over 180 ms | soft tick (pitched to the button index) | tap |
| Drag pick and drop (`dnd.ts`) | lift shadow plus scale 1.08; drop settles with a small bounce | pop | tap on drop |
| Counting object marked | the object hops 6 px and glows; the number badge pops | rising pentatonic note n of the scale | – |
| Correct answer | 80 ms hit-stop, the answer card stretches, a pollen burst from the tap point, a nectar drop arcs to the counter, then the counter bumps | 3-note arpeggio in the world key | success |
| Wrong answer | 4° wobble ×2 over 300 ms, the hint slides in. **No shake, no red X, no buzzer.** | soft low "hmm" (sine at 220 Hz, 120 ms) | none |
| Combo 3/5/8/12 | the bee does a loop-the-loop on the journey track, the track tints gold, the music steps up a semitone for 8 bars | sparkle chord | celebrate |
| Level complete | bloomWipe from the bee, petals fill, stars pop in sequence (250 ms apart), confetti capped at 2 s | star chimes (C-E-G) | celebrate |
| Friend party / world complete | a cutscene of 3 illustrated panels with a Ken-Burns pan (5–8 s, skippable), the friend waves, garden items bloom; in 3D, a slow orbit of `Garden3D` | party fanfare in the world theme | celebrate |
| Route change | crossfade plus 12 px rise, 220 ms; map → level uses a shared-element bee (View Transitions API where it exists, otherwise a FLIP tween) | page-flip whoosh, very soft | – |
| Gift box | wiggles only while it is waiting; opening shows a lid pop plus a silhouette of tomorrow's treasure | – | success |
| Natural session end | the scene fades to golden hour, the bee yawns, fireflies drift | lullaby cadence, music fades out over 3 s | – |

**Per-world art direction:**
- CSS tokens `--world-sky`, `--world-ground`, `--world-accent` and `--world-ink` are set by `[data-world=meadow|river|…]` on the screen root.
- `kit.ts` gets `applyWorldLighting(scene, theme)`: hemisphere sky and ground colours, warm key plus cool fill, `Fog(theme.sky[1])`.
- The map has three parallax layers: `transform: translateY(scroll×0.2/0.5/0.8)`. Under reduced motion they are static.

**Music:**
- `music.ts` gains `setWorld(theme)`, which chooses one of 7 key and tempo variations of the existing 38 s theme: meadow C/96, river D/92, orchard F/100, ice A/88, trail G/104, town Bb/96, garden C/100.
- An extra pad stem fades in at combo 5 or more.
- Ducking by 60% under the voice stays as it is.

**Accessibility:**
- Every new node or button has an aria-label, for example "Level 3, Big Pot Small Pot, 2 stars".
- Focus outlines are kept.
- The particle canvas is `aria-hidden`.

---

## 6. Work packages

All file ownership is disjoint. Work happens in two phases:

- **Phase 0:** WP7 lands a scaffold of about half a day first. Work packages 1–6 then proceed in parallel.
- **Phase 2:** WP7 does the final wiring and the end-to-end tests.

Each package adds its UI strings to its **own** `src/i18n/packs/<pack>.ts` (`export const EN = {...}; export const TA = {...}`). Each adds its CSS to its own `src/styles/features/<pack>.css`. WP7's scaffold auto-registers both.

### WP7: Integration and scaffold (owner of shared files)

**Goal:** single owner of the router, routes, i18n tables and the global stylesheet.

**Files:**
- `src/App.tsx`
- `src/app/store.ts`
- `src/i18n/i18n.ts`
- `src/i18n/en-ui.ts`
- `src/i18n/ta-ui.ts`
- `src/i18n/en-content.ts`
- `src/i18n/ta-content.ts`
- `src/styles/app.css`
- `src/screens/GardenScreens.tsx`
- `src/screens/RewardScreens.tsx`
- `tests/e2e/flows.spec.ts`
- `tests/e2e/helpers.ts`
- new `tests/e2e/adventure.spec.ts`, `tests/e2e/android-shell.spec.ts`, `tests/e2e/phone-layout.spec.ts`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/TEST_RESULTS.md`
- `README.md`

**Phase 0 (scaffold):**
- `Route` gains `adventure`, `adventure-world {world}`, `level-results {levelId; record; newNectar; prevStars}`, `intro`, `session-end`.
- `i18n.ts` merges `import.meta.glob('./packs/*.ts', {eager:true})` EN and TA into `TABLES`. The base tables win on key clashes, and a dev-mode warning is printed.
- `app.css` gets:
  - `@import` for `features/{adventure,juice,parent,shell}.css`. Placeholder empty files are created by the owning packages; WP7 may create empty stubs.
  - The safe-area tokens `--sat/--sar/--sab/--sal` (as in the shell report).
  - `.screen` padding using those tokens.
  - `min-height:100dvh`.
  - `overscroll-behavior:none`.
  - `user-select:none; -webkit-touch-callout:none` on `.screen`, `button` and `.map`.
  - Sticky `footer.controls` with `bottom: var(--sab)`.
  - Touch targets raised: `.btn.tiny`, `.link` and `.music-btn` ≥48 px; calendar cells ≥56 px; `.loc3d` ≥44 px.
  - `table.data` wrapped with `overflow-x:auto`.
  - Map labels ≥0.85rem.
  - A landscape `@media (orientation:landscape) and (max-height:500px)` two-column session layout.
- `App.tsx`:
  - lazy `AdventureScreens`, `IntroStory`, `SessionEndScreen`;
  - lazy `ParentScreens` and `TestScreens`;
  - calls `initShell()` and `initBackNav()` (WP2 exports);
  - calls `send('ready')` after first render;
  - on `lifecycle`, calls music `setHidden`.

**Phase 2:**
- `GardenScreens` mission card:
  - "Next adventure level" becomes the primary action;
  - the Adventure entry tile;
  - the quick row hides Tests and Mock (moved behind the parent gate);
  - 2D map label size.
- `RewardScreens` shows the new stickers and the gift silhouette.

**Acceptance criteria:**
- `npm run typecheck`, `npm test` and `npm run test:e2e` pass.
- Every route has a back parent in `backNav`.
- No string key is missing in either language. A test iterates over all `t()` keys used by the packs.
- At 360×640 and 320×568 there is no horizontal scroll, and every interactive element is ≥44 px, with child controls ≥56 px.

**Tests:**
- `phone-layout.spec.ts`:
  - viewports 360×640, 412×915, 915×412 and 768×1024;
  - checks bounding boxes for targets;
  - checks for no overflow.
- `adventure.spec.ts`:
  - play w1-01 with the `?e2e` answers;
  - ≥1 star;
  - w1-02 unlocked;
  - reload, and progress persists.
- `android-shell.spec.ts`:
  - `addInitScript` stubs `window.MathBeeAndroid`;
  - asserts the messages `hello`, `ready`, `route`, `speak`, `keepAwake`, `saveFile` and `print`;
  - back from `session` opens the leave sheet;
  - back on `map` is disabled.

### WP1: Android native shell

**Goal:** a buildable, Play-compliant Kotlin host (§3).

**Files:** everything under `android/**`, plus `.gitignore` (adds `dist-android/`, `android/.gradle`, `android/**/build`, `android/local.properties`, `android/keystore.properties`, `*.jks`, `*.keystore`).

**Acceptance criteria:**
- `./gradlew --offline :app:assembleDebug` and `:app:bundleRelease` succeed with JBR.
- The merged manifest has **zero** `uses-permission` entries.
- The AAB has no `.so` files.
- On the `BuzzyPhone` AVD (API 36):
  - offline cold start shows the splash, then the game, with no "Loading…" flash;
  - back works in-app, and the root exits;
  - en and ta TTS speak, or fall back to text;
  - music pauses when the app is backgrounded and during a call (simulated audio focus loss);
  - save goes through SAF and import goes through the picker;
  - print shows the system dialog and "Save as PDF" works;
  - `adb shell am crash`-style renderer kills recover;
  - rotation keeps state;
  - insets arrive;
  - progress survives `adb install -r`.
- `setWebContentsDebuggingEnabled` is false in release.
- Navigation to any external URL is blocked.

**Tests:**
- `app/src/test/.../ShellBridgeTest.kt` (JVM): filename sanitising, type whitelist, length caps, rejection of a wrong origin or a non-main frame. Uses Robolectric only if cached; otherwise pure functions are extracted into a `BridgeRules.kt` object.
- A manual device matrix checklist goes in `android/README.md`.

### WP2: Web platform layer (shell client, build mode, performance)

**Goal:** the web side of every bridge, plus the Android build mode and WebGL hardening.

**Files:**
- `vite.config.ts` (mode `android`: `base:'/web/'`, `outDir:'dist-android'`, no SW plugin)
- `package.json` (`build:android`, `android:debug`)
- `index.html` (`color-scheme` light meta; manifest link only for non-android builds)
- `src/main.tsx` (no SW or gallery in android mode; `window.__mbFlush`)
- `src/app/platform.ts` (`IS_ANDROID_BUILD`, `saveTextFile` through the bridge returning saved/declined/unavailable, `shareTextFile`, `printPage`, `canPrint`)
- new `src/app/shell.ts`
- new `src/app/backNav.ts`
- `src/audio/speech.ts` (native backend first, then web speech; `whenVoicesReady` wired in)
- new `src/audio/voice.ts` (clip manifest `public/voice/{en,ta}/<key>.ogg` with lookup by i18n key, then TTS)
- `src/persistence/storage.ts` (`flush()`)
- `src/three/kit.ts` (named imports, DPR or antialias by device tier, `webglcontextlost`, `applyWorldLighting`)
- `src/three/support.ts` (`auto` chooses 2D on lowRam)
- `src/three/Garden3D.tsx` (30 fps cap, IntersectionObserver pause)
- `src/three/Journey3D.tsx`
- `src/three/Lazy3D.tsx` (context-lost fallback)
- `src/screens/TestScreens.tsx` (`printPage()` replaces `window.print()`; mock autosave every 15 s instead of 5 s)
- `src/sw/sw-template.js` (unchanged, listed only to state ownership)
- new `src/styles/features/shell.css` (`html.in-android` rules)
- new `src/i18n/packs/shell.ts`

**Acceptance criteria:**
- `npm run build:android` produces `dist-android/index.html` with every asset URL under `/web/` and no `sw.js` registration.
- The normal `npm run build` is byte-for-byte unchanged in behaviour.
- With the bridge stub:
  - `speak` sends `speak` messages, and music ducks on `speech start/end`;
  - `saveTextFile` returns `'declined'` on `cancelled`;
  - `printPage` sends `print`.
- `backNav.parentOf` covers every `Route` name. This is enforced at the type level with an exhaustive switch.
- `keepAwake` is on only for `session` and `mock`.
- A forced `WEBGL_lose_context` falls back to the 2D map without a blank screen.

**Tests:**
- `tests/unit/shell.test.ts`: message bus, request/response, ignoring malformed JSON.
- `tests/unit/backNav.test.ts`: every route, overlay LIFO.
- `tests/unit/platform.test.ts`.
- `tests/unit/speech.test.ts`: chooses the native backend, `narrationAvailable` follows `voices`.

### WP3: Adventure core logic (pure, no UI)

**Goal:** level data, the planner, progress, stars, unlocking and evidence safeguards (§4.4–4.8).

**Files:**
- new `src/adventure/levels.ts`
- new `src/adventure/progress.ts`
- new `src/adventure/planner.ts`
- `src/engine/types.ts` (`Mode`, `Slot.skin?`, `MiniSkin`)
- `src/learning/types.ts`
- `src/learning/session.ts` (`ActiveSession.adventure`, `endSession` copies theme and levelId)
- `src/learning/mastery.ts`
- `src/learning/fun.ts` (`friendsMet`, `stars2` quest, `nextTreasureFor()` for the silhouette, `sessionEndDue()` for the daily limit)
- `src/learning/gamification.ts` (stickers)
- `src/persistence/schema.ts` (defaults and import validation)
- `src/app/actions.ts` (`launchLevel`, `closeSession` → `recordLevelResult`, star bonus, `level-results` routing)
- new `src/i18n/packs/adventure.ts`: 81 titles, 8 world names, 7 intros, 7 thank-you lines and 7 "play together" prompts, in EN plus a TA draft flagged for native review

**Acceptance criteria:**
- Every template id resolves.
- Each level's derived subskills are consistent.
- Every world ends with a friend or finale level.
- `questions` is between 5 and 8.
- Fallbacks are non-extension.
- Star thresholds follow §4.4, and best results never decrease.
- Two same-day replays count as one evidence session, and the 9th or later same-day adventure attempt per subskill is not evidence.
- The star bonus is paid exactly once per star.
- Importing a profile with unknown level ids or stars outside 0–3 is rejected.
- Old saves load with `adventure` defaulted.

**Tests:**
- `tests/unit/adventure-levels.test.ts`.
- `tests/unit/adventure-progress.test.ts`.
- `tests/unit/adventure-planner.test.ts`: determinism by seed, formats per kind, memory levels take due reviews first, follow-up slots excluded from the score.
- Additions to `tests/unit/mastery.test.ts`.
- Schema round-trip.

### WP4: Adventure UI and mini-game skins

**Goal:** the screens in §4.7 and the skins in the levels report §7.

**Files:**
- new `src/screens/AdventureScreens.tsx` (worlds, world map, intro card, level results, friend cutscene)
- new `src/components/WorldPath.tsx` (SVG path and bud nodes)
- new `src/three/Islands3D.tsx` (optional 3D map using `layout3d.ts` helpers, read-only use)
- `src/activities/SceneView.tsx` (passes `skin`)
- `src/activities/scenes/CountScene.tsx` (bubbles)
- `src/activities/scenes/ArithmeticScenes.tsx` (lily-hop, with ice and stone variants)
- `src/activities/scenes/TimeScenes.tsx` (postman)
- `src/activities/scenes/FerryScene.tsx` (ferry-loader)
- `src/activities/journey.ts` (`palette` per world)
- new `src/styles/features/adventure.css`
- new `src/i18n/packs/adventure-ui.ts`

**Acceptance criteria:**
- Locked nodes are buds, not padlocks.
- Node targets are ≥64 px, and each has an aria-label with its stars.
- The current node pulses.
- The bee flies 900 ms to the next node, or jumps instantly under reduced motion.
- A skin never changes the `answer` spec, `work` keys or `checkAnswer`. A unit test renders each skinned template and compares `checkAnswer` results with the unskinned version.
- No timers in any skin.
- The 2D map scrolls at 60 fps on a mid-range emulator, and the 3D map falls back to 2D.
- With `showExtensions=false`, Ext nodes render on a dotted branch, and the world is still completable.

**Tests:**
- `tests/unit/skins.test.ts`.
- `tests/unit/worldpath.test.ts`: node layout fits 320 px width.
- React render smoke test for each screen with fixture profiles: new, mid-W3, all complete.

### WP5: Juice, sound, music and session feel

**Goal:** everything in §5 except the map screens, plus the natural session end.

**Files:**
- new `src/fx/juice.ts`
- new `src/fx/particles.ts`
- new `src/components/SessionEnd.tsx` (`SessionEndScreen`)
- `src/audio/sfx.ts` (about 20 synthesised foley sounds, world key)
- `src/audio/music.ts` (`setWorld`, combo stem, fade-out)
- `src/components/Celebration.tsx`
- `src/components/AnswerPanel.tsx` (squash, sticky footer markup)
- `src/components/JourneyTrack.tsx` (combo loop, gold tint)
- `src/components/Fun.tsx`
- `src/components/dnd.ts` (lift, drop, haptic)
- `src/components/math-models.tsx` (object hop and glow hooks)
- `src/components/art.tsx` (`loading="lazy" decoding="async"`)
- `src/screens/SessionScreen.tsx` (adventure theme, `data-world`, auto-play the prompt once plus a big 🔊, juice on correct and wrong, daily-limit end, `keepAwake` via shell)
- new `src/styles/features/juice.css`
- new `src/i18n/packs/juice.ts`

**Acceptance criteria:**
- The correct-answer sequence follows the §5 table.
- A wrong answer produces no shake, no red X and no haptic.
- `html.reduce-motion` turns off all transforms and particles (asserted by a jsdom test on `juice.ts`).
- At most 40 particles are alive.
- The music changes key by world.
- When `dailyLimitMin` is reached, the current question finishes, then `session-end` shows with only two buttons.
- When the system haptics setting or the in-app toggle is off, no haptic message is sent.

**Tests:**
- `tests/unit/juice.test.ts`: reduced motion is a no-op, the particle cap holds, haptic gating works.
- `tests/unit/sfx.test.ts`: the scheduler creates no nodes when muted.
- `tests/unit/session-end.test.ts`.

### WP6: Onboarding, parent gate, parent features, fonts and compliance

**Goal:** the P0 gate and the parent-led first run, the story intro, the predictable gift UI, bundled fonts and the privacy page.

**Files:**
- `src/components/ui.tsx` (`ParentGate`: a random adult task in words, 3 tries then a 30 s cool-off; keep `HoldButton` for non-gated conveniences)
- `src/screens/ParentScreens.tsx`:
  - fix the hooks bug;
  - wrap everything in the gate;
  - settings `adventureOpenAll`, `dailyLimitMin` and `haptics`;
  - "Install Tamil voice";
  - "Back up progress" via save or share;
  - `printPage()`;
  - Tests and Mock entry;
  - privacy link
- `src/screens/WelcomeScreens.tsx` (parent-led setup flow → `intro`; controls practice folded into w1-01 using a pointing-hand coach mark)
- new `src/screens/IntroStory.tsx` (5 narrated, skippable panels, about 25 s)
- `src/report/parentReport.ts` ("Play together" and "Try at home" items from `diagnosis.ts`)
- new `public/privacy.html`
- new `public/fonts/{Nunito,Baloo2,NotoSansTamil}-*.woff2` (OFL)
- new `public/fonts/OFL.txt`
- new `src/styles/features/parent.css` (includes `@font-face`)
- new `src/i18n/packs/parent.ts`

**Acceptance criteria:**
- No path from the child UI reaches parent, settings, tests, mock, export, import, reset, privacy or install-voice without passing the gate. An e2e test crawls every button on the map.
- The gate can't be solved by tapping randomly: there are ≥6 choices and an exact sequence, with a probability of ≤1/100 per attempt.
- A first run from a clean install reaches the first correct answer in ≤60 s of simulated child taps.
- The intro is narrated and skippable after 2 s.
- The privacy page renders offline in the WebView.
- Fonts load from `/web/fonts/` under the android base (relative URLs in the CSS).
- The full app is usable with narration on and no reading.

**Tests:**
- `tests/unit/parentGate.test.ts`.
- `tests/unit/parentReport.test.ts` additions.
- e2e `gate.spec.ts`, owned by WP6 as a new file.

### Dependency order

1. WP7 Phase 0.
2. WP1, WP2, WP3 and WP6 in parallel.
3. WP4, which needs WP3 types, and WP5, which needs WP2 `shell.ts`. Both only import, so they can start against interfaces stubbed on day 1.
4. WP7 Phase 2.
5. Device QA.

---

## 7. Play Store release checklist and listing copy

### Checklist

**Account:**
- Identity verification is complete.
- For a personal account created after 13 Nov 2023, run a **closed test with ≥12 testers opted in for 14 consecutive days**. Recruit 15–20 parents and ship 2–3 updates during the test.

**Build:**
- targetSdk 36, compileSdk 37, minSdk 26.
- AAB with Play App Signing.
- Upload keystore backed up offline.
- versionCode increments on every upload.
- No `.so` files.
- R8 on.

**Manifest:**
- 0 permissions, AD_ID removed.
- Merged manifest checked in Android Studio.

**App content:**

| Section | Answer |
|---|---|
| Privacy policy URL | Hosted, for example on Coolify at `/privacy.html` or GitHub Pages, and also bundled |
| Ads | No |
| App access | All functionality available without login |
| Target audience | **Ages 6–8**, child-directed, Families policy accepted |
| Data safety | No data collected or shared |
| IARC | Education, no interaction, no purchases, no location → Everyone / PEGI 3 |
| News / gov / health / financial | No |

**Listing:**
- Category: Education. Tags: Math, Kids, Educational games.
- Contact email.
- 512 px icon, 1024×500 feature graphic.
- ≥4 phone screenshots (1080×1920), ≥4 screenshots each for 7" and 10" tablets.
- Optional 30 s video, unlisted, with monetisation off.
- en-US, en-IN and ta-IN listings, with the Tamil reviewed by a native teacher.
- **No "award-winning", "best" or "#1" claims.**

**QA:**
- Offline first launch.
- Kill and reboot persistence.
- Low-end device (2–3 GB) and Android 8–16.
- Tablet.
- TalkBack sanity pass.
- Pre-launch report is clean.
- Vitals monitored.
- Staged rollout at 20%, then 50%, then 100%.

**After launch:**
- Each update triggers a Teacher Approved re-review.
- Revisit Data safety and IARC whenever features change.

### Store listing copy

**Title** (22 characters, limit 30): `MathBee: Number Garden`

**Short description** (78 characters, limit 80): `Grade 1 maths adventure with a friendly bee. Spoken help, no ads, fully offline`

**Full description:**

> Help Buzzy the bee bring a storm-scattered garden back to life — one maths adventure at a time!
>
> MathBee: Number Garden is a calm, story-led maths game made for children aged 6 to 8 (Grade 1). Every instruction is spoken aloud in English or Tamil, so even early readers can play on their own.
>
> 🌼 7 WORLDS, 80+ LEVELS
> Visit Bunny's Flower Meadow, Frog's Ferry River, Squirrel's Apple Orchard, Penguin's Ice Floes, Hedgehog's Stepping-Stone Trail, Owl's Clock Town and the Queen Bee's Hive. Each world ends with a friend's party.
>
> 🔢 REAL GRADE 1 MATHS
> Counting to 100, adding and taking away within 20, making ten, number patterns, comparing sizes and lengths, shapes, pairs, days of the week, telling time and reading a calendar — plus gentle story problems.
>
> 💛 KIND BY DESIGN
> • No lives, no timers, no losing streaks
> • Mistakes become "let's look again" with a helpful hint
> • Stars reward trying on your own, never speed
> • Sessions end naturally — no "one more" pressure
>
> 🎨 A GARDEN THAT GROWS
> Earn nectar, collect stickers, dress your bee in hats, and watch flowers bloom in a 3D garden.
>
> 👪 FOR GROWN-UPS (behind a parent gate)
> • Clear "can do / needs support" skill report
> • Printable worksheets and a "try at home" list
> • Daily time limit, narration and motion settings
> • Back up progress to a file
>
> 🔒 PRIVATE AND OFFLINE
> No ads. No in-app purchases. No accounts. No internet needed. Nothing your child does leaves the device.
>
> Works on phones and tablets. Tamil voice uses your device's text-to-speech; a parent can install the Tamil voice from Settings.

### Privacy policy (`public/privacy.html` and the hosted copy)

> **MathBee: Number Garden — Privacy Policy**
> Last updated: [DATE]
>
> MathBee: Number Garden ("the app") is made by [DEVELOPER NAME] ([CONTACT EMAIL]). The app is designed for children aged 6–8 and their parents.
>
> **We collect no personal information.** The app has no accounts, no advertising, no analytics, no crash-reporting services, no third-party software development kits, and it does not request internet access. No information about your child or your device is sent to us or to anyone else.
>
> **What stays on the device.** To let your child continue where they left off, the app stores a nickname, chosen avatar, language, settings and learning progress in the app's private storage on the device. This information never leaves the device unless you, the parent, choose to export a backup file using the parent area. That file is saved or shared only where you choose.
>
> **Speech.** Spoken instructions use your device's built-in text-to-speech engine, which runs on the device.
>
> **Android backup.** If you have enabled Android device backup, Android may include the app's private data in your own Google account backup, under Google's policies. We never receive this data.
>
> **Deleting data.** Use "Reset progress" in the parent area (behind the parent gate), clear the app's storage in Android Settings, or uninstall the app. All data is then removed from the device.
>
> **Children's privacy (COPPA, GDPR-K, UK Children's Code).** Because the app does not collect, use, or disclose personal information from children, no parental consent is required. Settings default to the most private options.
>
> **Permissions.** The app requests no Android permissions.
>
> **Changes.** If this policy changes, we will update this page and the date above. If the app ever begins to collect any data, we will update this policy and the Google Play Data safety section before doing so.
>
> **Contact.** [CONTACT EMAIL]

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Rejected as a "WebView wrapper" or for minimum functionality | Launch blocked | Ship offline content bundled in the APK. Add native TTS, haptics, back handling, print, SAF save and share, splash, immersive mode, audio focus, `localeConfig` and crash recovery. Never load remote URLs. |
| The asset-loader origin or path changes later | Every child loses progress | Freeze `https://appassets.androidplatform.net/web/` in a code comment and a unit test (the start-URL constant). Never use `file://`. Debug uses a different `applicationId`, so its storage is separate. |
| No offline Tamil TTS voice on a device | Tamil pre-readers get no audio | Show "Install Tamil voice" behind the gate. The text fallback stays. Bundle recorded Tamil clips (P1-9). Check voices again on resume. |
| Tamil text quality is a developer draft | Teacher Approved audio and language score suffers | A native teacher reviews the packs and listing before launch. Flag any untranslated keys in the e2e test. |
| AGP 9 built-in Kotlin pulls a KGP other than 2.4.20, or something is missing from the offline cache | Build breaks | Pin through the `buildscript` classpath (2.4.20 is cached). Run without `--offline` once if a POM is missing. Gradle 9.8.0 bin is cached. |
| WebGL on low-end GPUs: heat, context loss, renderer crash | ANRs and poor vitals | lowRam → 2D on auto, DPR 1.5 with no antialias, 30 fps cap, offscreen pause, context-loss fallback, `onRenderProcessGone` recreation with a retry cover. |
| Writing the whole state document on every tap gets slow as `attempts` grows | Jank after months of play | Throttle mock autosave to 15 s, flush on pause, compact attempts after 90 days (v1.1), and watch the profile size in QA with a 50k-attempt fixture. |
| Replay farming of evidence or nectar | Inflated mastery report | `evidenceSessionKey`, the daily evidence cap of 8, the one-off star bonus and `suggestRest`. |
| Stars feel like failure to some children | Anxiety, against the ethos | Finishing always earns 1 star. Hints still earn petals. Stars never gate progress. No speed input. Copy is reviewed against the Radesky checklist. |
| The 6-year-old passes the parent gate | Reaches settings, reset or export | An adult task written in words with randomised choices, a probability of ≤1/100, and a cool-off after 3 misses. |
| `@media print` is not applied by the WebView print adapter | Worksheets print with chrome around them | Verify on the emulator. Fallback: the dedicated `print` route is chrome-free already. Hide the topbar via `html.printing` set before calling the bridge. |
| Old WebView reports wrong safe-area insets | UI under the status or gesture bar | Inject native insets and use `max(env(), var(--shell-inset-*))`. |
| Android 16 ignores the orientation lock on tablets | Broken landscape layout | `appCategory="game"`, the landscape CSS from WP7, and a tablet test on 768×1024 and 1024×768. |
| The 12-tester, 14-day closed test resets after dropouts | Launch slips | Recruit 15–20 testers, send reminders, and start the closed test as soon as WP1 and WP2 produce a playable build. |
| Parallel packages conflict in shared files | Merge pain | Ownership is disjoint (§6). Strings and CSS go through per-pack files auto-registered by the WP7 scaffold. Routes are fixed in Phase 0. |
| Store copy implies awards | Deceptive-behaviour strike | The listing makes no award, "best" or "#1" claims. Screenshots show the real app. |
| Developer verification and policy dates move | Surprise blocks | Re-check the target API, Families and verification pages in Play Console right before submission. Several of these dates come from secondary sources only. |

**Key files referenced** (all under `/Users/stalin/Downloads/claudegamemathbee/`):
- `src/App.tsx`
- `src/app/store.ts`
- `src/app/actions.ts`
- `src/app/platform.ts`
- `src/audio/speech.ts`
- `src/learning/fun.ts`
- `src/learning/mastery.ts`
- `src/engine/types.ts`
- `src/i18n/i18n.ts`
- `src/activities/journey.ts`
- `src/screens/SessionScreen.tsx`
- `src/screens/ParentScreens.tsx`
- `vite.config.ts`

The reference shell is `/Users/stalin/Downloads/buzzy-spelling-garden/android/app/`.
---

## C. Critique of the plan

# Adversarial review: MathBee Play Store release plan

I checked these claims against the repo at `/Users/stalin/Downloads/claudegamemathbee` without changing any files:
- **Template ids:** all 126 template ids in the level table exist in `src/engine/generators/c01..c14.ts`. None are missing.
- **Ext labels:** they are wrong in places (issue A4).
- **Local toolchain:** AGP 9.4.1, webkit 1.17.1, Gradle 9.8.0 and the `android-37.0` platform are present.
- **Reference shell:** `buzzy-spelling-garden` uses `outputDir.dir("web")`, so the asset path layout in the plan is consistent with it.

## A. Wrong ids and data-model errors

**A1. `isUnlocked(C08.regroup)` is called with the wrong signature.**
- The real function is `isUnlocked(sub: Subskill, ev, profile)` in `src/learning/planner.ts:14`. It takes a `Subskill` object, an evidence map and a profile, not an id string.
- **Fix:** call `isUnlocked(SUBSKILL_BY_ID['C08.regroup'], evaluateAll(...), profile)`.

**A2. `Slot.skin?` is placed in the wrong file.**
- `Slot` is defined in `src/learning/types.ts:56`, not in `engine/types.ts`. Only `Mode` and `Purpose` live in `engine/types.ts`.
- **Fix:** add `skin?` to `Slot` in `learning/types.ts`. Keep `MiniSkin` in `engine/types.ts`.

**A3. Adding `'adventure'` to `Mode` needs i18n keys.**
- `ParentScreens.tsx:149` renders ``t(`mode.${s.mode}`)``.
- `en-ui.ts:160` has a `mode.*` key for every existing mode.
- **Fix:** WP3's pack must add `mode.adventure` in both EN and TA. Add a test that every `Mode` has a key.

**A4. Ext labels disagree with curriculum `source`.** Ext should follow the subskill's curriculum `source`, not the template's.
- **w7-08 "Days Ahead":** uses `c11-a-after/before/howmany`, whose subskill `C11.offsets` is an extension (`curriculum.ts:89`). The level is not marked Ext and has no fallback. With `showExtensions=false` it sits on the main path, which breaks the plan's own rule that every fallback is non-extension.
- **w7-07:** `c08-a-tensones` (`C08.twoDigit`, extension) carries a `*` with no footnote.
- **w7-12:** the finale's main template list is mostly extension templates.
- **Fix:**
  1. Derive `isExt` at runtime: any template whose `SUBSKILL_BY_ID[getTemplate(id).subskill].source === 'extension'`.
  2. Mark w7-07 and w7-08 as Ext, or give them non-extension fallbacks such as `c11-p-after` and `c08-a-decade`.
  3. Add a test: with `showExtensions=false`, every main-path level resolves only to non-extension subskills.

**A5. Two theme maps would disagree.**
- `BY_CATEGORY` in `journey.ts:32` maps C03 to meadow and C04 to town.
- Adventure puts C04 in W1 meadow (Bunny) and C03 in W2 river (Frog).
- So the same skill shows a different friend in Practice than in Adventure.
- **Fix:** either align `BY_CATEGORY` with the world table, or always use `session.adventure.theme` and say in the docs that practice journeys keep the old mapping.

**A6. Changing `friendsMet` breaks existing behaviour and a test.**
- Today `friendsMet` counts any completed single-category session (`fun.ts:115`).
- `tests/unit/fun.test.ts:87` expects `['ice','garden']` from practice sessions.
- Restricting it to friend levels removes friends existing players have already met.
- **Fix:** take the union of the current rule and adventure friend levels. Make `fun.test.ts` an explicit WP3 file.

**A7. The daily evidence cap lowers stars during normal first play.**
- Petals give 2 only when `isIndependentEvidence(a)`. Over-cap attempts get `countsAsEvidence:false`, so `isIndependentEvidence` returns false.
- `c01-e-row` and `c01-e-dice` are both `C01.to5`. Playing w1-01 (5 Q) and then w1-04 (6 Q) is 11 attempts, so the cap is hit on a first playthrough.
- From then on the child can earn at most 1 petal per question, and stars drop.
- **Fix:** compute petals from the attempt's own flags (`a.independent && a.firstCorrect && !a.sawSolution && !a.skipped`). Apply the cap only inside `mastery.ts`.

**A8. Capped attempts would inflate the "learning-supported" state.**
- `evaluateSkill` counts every non-evidence attempt with `finalCorrect` as `supported` (`mastery.ts:63`).
- Capped attempts would raise `supported` and can push a child into `learning-supported` (`supported >= 2` when `indep < 3`).
- **Fix:** filter `countsAsEvidence === false` out of `atts` at the top of `evaluateSkill`. Exclude those attempts from `retentionChecks` and `transferChecks` too.

**A9. `evidenceSessionKey` does not stop farming.**
- `adv:${levelId}:${date}` still counts different levels on the same day that share a subskill as separate sessions. `minSessions=2` (`types.ts:215`) can then be met in one sitting.
- **Fix:** key adventure evidence as `adv:${date}`, or, more simply, count distinct dates for `minSessions`. Add a test: w1-01 and w1-04 on the same day count as 1 session.

**A10. Nectar replay farming is not mitigated, but the risk table says it is.**
- Per-question nectar is keyed `${session.id}#idx` (`session.ts:129`). Every replay has a new session id, so replaying w1-01 forever pays unlimited nectar, and nectar drives levels and hats.
- **Fix:** pay per-question nectar on adventure replays only on the first clear, or once per level per day. Update the risk table.

**A11. Follow-up slots make level length unbounded.**
- `finishCurrent` inserts `errorFollowUp` and `prerequisiteSlot` slots (`session.ts:140-143`). An 8-question level can grow well past 8, which breaks the "5–8 Q, 4–8 min" promise.
- **Fix:** cap inserted slots per adventure level (for example at most 2). Score only `purpose !== 'follow-up'` slots (follow-ups are tagged `purpose:'follow-up'`). Test this.

**A12. Removing the check-up starves the planner.**
- `profile.screened` is filled only by assessment. `planDaily` (`planner.ts:119-132`) and the mission card (`GardenScreens.tsx:42-46`) depend on it.
- If w1-01 replaces the check-up, Daily and Practice keep forcing screening.
- **Fix:** have `recordLevelResult` add level categories to `screened`, or keep the check-up as a parent option. Update `flows.spec.ts` test 1, which clicks `mission` for the check-up.

**A13. Import validation would reject old backups later.**
- Rejecting unknown level ids means any future rename or removal of a level makes old backups unimportable.
- **Fix:** silently drop unknown level ids. Clamp `stars` to 0–3. Validate the new `Attempt.levelId` and `countsAsEvidence` fields in `validateImport`.

**A14. "Leave sheet" does not exist.**
- SessionScreen has a pause sheet with `data-testid="stop"` (line 303).
- **Fix:** define back during a session as "open the pause sheet" and assert on that test id.

## B. Android WebView gaps

**B1. Haptics will never fire.**
- The plan sets `isHapticFeedbackEnabled=false` on the WebView and then calls `performHapticFeedback` on that same view, which is then ignored.
- `CONFIRM` needs API 30, but `minSdk` is 26.
- **Fix:** call it on `window.decorView`, or pass `FLAG_IGNORE_VIEW_SETTING`. Use a `VIRTUAL_KEY` or `CONTEXT_CLICK` fallback below API 30.

**B2. WebView feature checks are missing.**
- `addWebMessageListener`, `addDocumentStartJavaScript` and `setAlgorithmicDarkeningAllowed` each need `WebViewFeature.isFeatureSupported` (the reference shell does this).
- Android 8 devices may run an old WebView. The app also needs ES2020, `dvh`, WAAPI and View Transitions.
- **Fix:**
  1. Read `WebViewCompat.getCurrentWebViewPackage()` and require a minimum version (for example ≥ 111).
  2. Below that, show a native "Please update Android System WebView" screen.
  3. Feature-detect `offset-path` and View Transitions in JS.

**B3. The pause order can lose writes.**
- `evaluateJavascript("__mbFlush()")` is asynchronous, and `pauseTimers()` is called right after it. `pauseTimers()` is process-wide and can stall the flush. The promise is not awaited.
- **Fix:**
  1. Flush on the web side's own `visibilitychange` and `pagehide`.
  2. On native, call `pauseTimers()` only after a `flushed` reply, or after a 300 ms timeout.
  3. Or drop `pauseTimers` and rely on `onPause()`.

**B4. The 5 MB `saveFile` cap is below the import limit.**
- Import allows 20 MB (`ParentScreens.tsx`, `f.size > 20_000_000`). The plan's own 50k-attempt fixture would make exports around 20 MB, so backups would fail exactly for long-term users.
- **Fix:** use chunked transfer (`saveFile` begin, chunk, end), or set the cap to 20 MB. Test with the 50k fixture.

**B5. The import file picker can grey out JSON files.**
- `accept="application/json,.json"` (`ParentScreens.tsx:333`) goes through `createIntent()`. `.json` is not a MIME type, and Downloads or Drive often report JSON as `application/octet-stream` or `text/plain`.
- **Fix:** build the intent with `*/*` (or `application/json`, `text/plain`, `application/octet-stream`) and validate the file in JS.

**B6. The start of the session has no narration.**
- `narrationAvailable` and `speak` are synchronous (`speech.ts`), but native voices arrive only after the `hello` reply. The narrated intro and the first prompt would fall back to text.
- `App` subscribes to nothing that triggers a re-render when voices arrive.
- **Fix:**
  1. Have `initShell()` resolve before `send('ready')`, with the voices cached.
  2. Add `onVoicesChange` so screens re-render.
  3. Release the splash only after the voices are known.

**B7. Root back behaviour contradicts itself.**
- The plan says "back on map is disabled" (callback off, so the system exits instantly) and also "exitApp after a Bye-bye screen".
- **Fix:** pick one. For a child, keep the callback enabled on `map`, show the Bye-bye sheet, and then call `exitApp`. Update `android-shell.spec.ts` to match.

**B8. Shell detection must be at runtime.**
- Playwright builds the normal web build (`playwright.config.ts` webServer), not `--mode android`.
- If `shell.ts` only turns on when `IS_ANDROID_BUILD` is set, `android-shell.spec.ts` cannot test it.
- The android build also strips `?e2e`, so there is no e2e coverage of the actual android bundle.
- **Fix:**
  1. Enable the shell when `window.__MATHBEE_SHELL__` or `window.MathBeeAndroid` exists.
  2. Make the stub mimic the real API: `postMessage(string)` plus `onmessage` / `addEventListener('message', e => e.data)`.
  3. Add a second Playwright project that serves `dist-android` under `/web/` with the e2e hooks enabled through a build flag.

**B9. The asset path handler exposes more than needed.**
- `addPathHandler("/", AssetsPathHandler)` serves every APK asset. It only works because the copy task writes into `outputDir/web`.
- **Fix:** keep the `web/` subfolder and add a unit or instrumented test that `/web/index.html` resolves. Reject paths outside `/web/` in `shouldInterceptRequest`.

**B10. `compileSdk 37` may not match the installed platform.**
- The installed platform folder is `android-37.0`, which uses the new minor-version naming.
- **Fix:** confirm AGP 9.4.1 resolves `compileSdk = 37`. If not, use `compileSdk { version = release(37) }`.

**B11. Haptics and vibration fallback.**
- `navigator.vibrate` silently does nothing without the VIBRATE permission. That is fine, but the plan should say so.
- **Fix:** route haptics only through the bridge on Android.

**B12. Shortening mock autosave from 5 s to 15 s.**
- In a WebView, `visibilitychange` may not fire on `onPause`, so up to 15 s of mock active time can be lost.
- **Fix:** keep 5 s, or hold the timer on the `lifecycle:pause` message.

## C. Play policy

**C1. The parent gate tests the very skill the app teaches.**
- "Tap the number forty-seven in words" is number reading to 100 and number words, which is what C08 (`c08-e-words`) and C10 (seq100) teach.
- One tap among 6 choices is 1/6, not the ≤1/100 the plan claims.
- Tamil parents would get an English-only instruction.
- **Fix:**
  - Use an adult task such as 2-digit by 1-digit multiplication (`7 × 8`) or "type the year", entered on the keypad. That gives about 1/100.
  - Make it bilingual.
  - Add a cool-off.
  - Test it.

**C2. Teacher Approved is not a deliverable.**
- Teacher Approved is chosen by Google's reviewers. The developer cannot apply for it or claim it.
- **Fix:** remove it from acceptance criteria and treat it only as a guideline. Never mention it in the listing.

**C3. "MathBee" brand risk.**
- Other "Math Bee" apps already exist on Play, which risks metadata or impersonation complaints.
- **Fix:** run a trademark and store search before locking the `applicationId` and title.

**C4. Data safety and IARC for sharing.**
- User-initiated `ACTION_SEND` and SAF export are exempt from "sharing", but the IARC questionnaire asks whether users can share content.
- **Fix:** document that exports happen only at the user's initiative, behind the gate, and answer IARC to match.

**C5. A hosted privacy policy URL is needed before the first upload.**
- The app has no INTERNET permission, so the in-app link must use the bundled copy.
- **Fix:** host the policy before the first closed-test upload, not at launch. Replace the `[DEVELOPER NAME]` and `[CONTACT EMAIL]` placeholders, and add a test that blocks release builds while they remain.

**C6. Target API dates.**
- targetSdk 36 is fine for submissions after Aug 31, 2026.
- **Fix:** re-verify in Play Console as the plan says, and add a CI check that `targetSdk >= 36`.

## D. Ethical design for a 6-year-old

**D1. Stars punish hints.**
- With hints, a question earns 1 petal instead of 2, so the child learns to avoid help. That contradicts the existing `hint-hero` sticker and "mistakes become let's look again".
- The "3 stars on every level" trophy invites compulsive replays.
- **Fix:**
  - Count a hinted correct answer as full petals, and reduce petals only when the solution is shown.
  - Or hide star counts from the child and show only "bloomed" or "fully bloomed".
  - Drop the all-3-star world trophy.

**D2. The tomorrow-treasure silhouette is an appointment mechanic.**
- Showing tomorrow's reward is a "come back tomorrow" lure. It does not remove the pull of the daily return; it strengthens it.
- **Fix:** don't preview future rewards. Make the gift openable on the next play, whenever that is, with no date framing.

**D3. The daily limit cuts off a level.**
- When the limit hits, the current question finishes, then `session-end` shows. `session.finished` stays false, so a level at 7 of 8 gives no star, which the child experiences as a loss.
- **Fix:**
  1. Check the limit only between levels; at most, finish the current level.
  2. Or save partial progress so the level resumes.
  3. Add a unit test.

**D4. Combo visuals create a losing-streak signal.**
- A gold track and an extra music stem that drop when a wrong answer resets the combo amount to a visible "losing streak".
- **Fix:** let the effects fade naturally after 8 bars whatever the outcome, and never tie their removal to a wrong answer.

**D5. Two rest systems overlap.**
- `suggestRest` fires after 3 finished sessions per day (`REST_AFTER=3`, `fun.ts:135`). Adventure levels last 4–8 minutes, so it fires after about 15 minutes. That clashes with `dailyLimitMin` and the session-end scene.
- **Fix:** base the rest suggestion on active minutes for adventure, and keep one system.

**D6. "Pulsing current card" and auto-play.**
- These are fine, but the pulse must stop under reduced motion.
- **Fix:** add the reduced-motion case to the acceptance tests.

## E. File-ownership conflicts

**E1. Replacing the hold-to-open button.**
- `HoldButton` / `parent-hold` is used in `GardenScreens.tsx:152` (owned by WP7) and `WelcomeScreens.tsx:43` (owned by WP6). `flows.spec.ts` uses `parent-hold` 3 times.
- **Fix:**
  1. WP6 exports `<ParentEntry/>`.
  2. WP7 swaps it into GardenScreens in Phase 0.
  3. Add an e2e-only gate bypass (`?e2e` in non-android builds) so `flows.spec.ts` keeps working.

**E2. Controls practice removal breaks e2e tests.**
- `skip-controls` is used in 5 e2e tests.
- **Fix:** WP6's onboarding change needs a matching WP7 update to `flows.spec.ts` and `helpers.ts`. List it explicitly as a cross-package handoff.

**E3. Skins cross a package boundary.**
- `SceneView` (WP4) needs `slot.skin`, which only `SessionScreen` (WP5) has.
- **Fix:** WP5 passes `skin={slot.skin}` in Phase 0. Freeze the prop name in the WP7 scaffold.

**E4. Back buttons cross a package boundary.**
- `BackButton` is in `ui.tsx` (WP6), but it should use `backNav.parentOf` (WP2).
- **Fix:** assign the `BackButton` change to WP6 with a WP2 import, or move `BackButton` to `backNav.tsx`.

**E5. Footer styling is split between two packages.**
- WP7 owns `app.css`, which gets the sticky `footer.controls`. WP5 owns the `AnswerPanel` sticky markup.
- `footer.controls` is not styled in `app.css` today (the markup is at `SessionScreen.tsx:249/258` and `TestScreens.tsx:163`).
- **Fix:** one owner (WP7) for the footer CSS. WP5 only adds classes.

**E6. Unit tests changed by WP3 and WP5 have no owner.**
- `tests/unit/fun.test.ts` (friendsMet, quests), `music.test.ts` and `journey.test.ts`.
- **Fix:** assign each to its package.

**E7. Gate coverage for Tests and Mock is unassigned.**
- Moving Tests and Mock behind the gate needs `TestScreens` (WP2) back routes and `GardenScreens` (WP7).
- **Fix:** make the gate check live in a route guard in `App.tsx` (WP7), so no screen-level change is needed.

## F. Scope and missing acceptance tests

**F1. The scope is unrealistic for one developer before the 14-day closed test.**
- P1 includes:
  - 81 levels with EN and TA titles;
  - 4 skins;
  - 21 illustrated cutscene panels, while `src/assets/generated.json` is empty;
  - about 20 foley sounds;
  - recorded voice clips with a native-speaker review.
- **Fix:**
  - Release 1 = P0 plus Adventure W1–W3 (34 levels) with simple cutscenes made from existing sprites.
  - Ship W4–W7, the skins and the voice clips as updates during the closed test or in v1.1.

**F2. Missing acceptance tests:**
- A storage-origin regression test: install the v1 APK, save, `install -r` v1.1, and confirm progress survives. Also an instrumented test of the start-URL constant.
- An export → import round trip in the WebView with a large profile.
- Simulated renderer kill → recreate → state intact.
- Tamil-only device with no ta-IN voice: the text fallback and the "Install voice" message appear behind the gate.
- `showExtensions=false`: every world can be completed, and no Ext level is on the main path (catches A4).
- No-regression: existing modes keep the same `friendsMet` and `screened` behaviour.
- Back in each overlay (pause sheet, celebration, gate, intro) is handled last-in-first-out.

**F3. The quest pool is not tied to adventure progress.**
- Adding a `stars2` quest changes the deterministic daily quest rotation, and `questsFor` takes `Pick<'id'|'attempts'|'sessions'>`, which has no adventure progress.
- **Fix:** widen the type, and only offer the quest when `profile.adventure` exists.

## Top 10 must-fix items

1. **Petals and the evidence cap (A7, A8):** compute petals from the attempt's own flags, not `isIndependentEvidence`. Remove `countsAsEvidence:false` attempts from `evaluateSkill` entirely. Otherwise stars drop during normal first play of W1.
2. **Parent gate (C1):** use adult arithmetic entered on the keypad (≥1/100 chance of a random pass), in both languages, not number words the app itself teaches. Add an e2e bypass.
3. **Ext labelling (A4):** derive Ext from curriculum `source`. Fix w7-07 and w7-08 and the w7-12 fallbacks. Test that `showExtensions=false` never puts an extension on the main path.
4. **Haptics bug (B1):** use `decorView` or `FLAG_IGNORE_VIEW_SETTING`, with a fallback below API 30.
5. **WebView feature and version checks (B2):** check `WEB_MESSAGE_LISTENER` and `DOCUMENT_START_SCRIPT` support and require a minimum WebView version, with a native update screen.
6. **Flush on pause (B3):** don't call `pauseTimers()` before the flush completes. Flush on the web side's `visibilitychange` and `pagehide` too.
7. **Export cap (B4) and file picker (B5):** make the export cap match the 20 MB import limit (chunked), and open the picker with `*/*`, validating in JS.
8. **E2E coverage (B8, E1, E2, A12, A14):**
   - detect the shell at runtime;
   - add a Playwright project for `dist-android`;
   - update `flows.spec.ts` for the gate, the check-up removal and the controls removal;
   - keep `screened` populated from levels.
9. **Ethics fixes (D1, D2, D3):**
   - hints must not cost petals;
   - no preview of tomorrow's treasure;
   - the daily limit never cuts a level off mid-way;
   - drop the all-3-star trophy.
10. **Scope (F1):** ship P0 plus W1–W3 for the closed test, and stage the rest. Also fix `friendsMet` and the theme mapping (A5, A6) and nectar replay farming (A10) so existing players don't lose friends and progress can't be inflated.