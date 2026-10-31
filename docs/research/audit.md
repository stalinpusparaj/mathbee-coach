# MathBee Coach: audit for Android WebView release and product gaps

This was a read-only audit. I changed no source files. The only command that wrote anything was `npx vite build`, which writes to `dist/`. Everything below is based on the code under `/Users/stalin/Downloads/claudegamemathbee`. External facts have URLs. Anything I could not test on a real phone or WebView is marked **[unverified]**.

---

## 0. Summary of release blockers

| # | Blocker | Where |
|---|---|---|
| 1 | Narration uses `window.speechSynthesis`. Android WebView often has no voices or doesn't expose the API, so the app goes silent and the 🔊 button is disabled. A pre-reader can't use the app without narration. | `src/audio/speech.ts:21-58`, `src/screens/SessionScreen.tsx:91-95,131,211` |
| 2 | The hardware or gesture **Back** button has no handler. Navigation is an in-memory `store.setRoute` with no history entries, so Back closes the Activity in the middle of a session. | `src/app/store.ts:57-61`, `src/App.tsx:73-93` |
| 3 | **Data import is broken.** `<input type=file>` does nothing in WebView unless `WebChromeClient.onShowFileChooser` is implemented. | `src/screens/ParentScreens.tsx:332-333` |
| 4 | **Data export is broken.** The `blob:` link with `a.download` doesn't save in WebView. | `src/app/platform.ts:24-29` |
| 5 | **Printing is broken.** `window.print()` does nothing in WebView. Worksheets and the parent report can't be printed. | `src/screens/TestScreens.tsx:244`, `src/screens/ParentScreens.tsx:44` |
| 6 | **Asset paths break under WebViewAssetLoader.** The build uses an absolute base `/` and registers a service worker. Either fix the paths and turn the service worker off for Android, or serve from the root. | `vite.config.ts:47-50`, `src/main.tsx:22-49`, `index.html:8-9` |
| 7 | **No safe-area handling.** `env(safe-area-inset-*)` appears nowhere, but apps targeting API 35+ are forced edge-to-edge, and Play requires API 36 since 31 Aug 2026. The sticky session bar and toasts will sit under the status bar and the gesture bar. | `src/styles/app.css` (whole file), `index.html:5` already has `viewport-fit=cover` |

Google Play requires new apps and updates to target **API 36 (Android 16)** from 31 Aug 2026 ([Play target SDK](https://developer.android.com/google/play/requirements/target-sdk), [Play Help](https://support.google.com/googleplay/android-developer/answer/11926878)).

---

## 1. Web APIs that differ or are missing in Android System WebView

### 1.1 Narration: `speechSynthesis` (critical)
- **Where it's used:**
  - `src/audio/speech.ts:21-23` checks that `speechSynthesis` exists.
  - `:25-31` (`voiceFor`) prefers `en-IN`/`ta-IN` voices.
  - `:38-43` (`whenVoicesReady`) is exported, but no caller in `src` uses it, so `narrationAvailable()` can return false on first render because the voice list loads asynchronously.
  - `:45-58` (`speak`) is called from `SessionScreen.tsx:94` (question prompt), `:131` (cheer), `:211` (story tap) and `ParentScreens.tsx:293` (Tamil voice status).
- **WebView behaviour:** the voice list depends on the device maker, the device and the Android version ([Readium WebSpeech notes](https://readium.org/speech/docs/WebSpeech.html)). `getVoices()` is often empty at load ([DEV article](https://dev.to/jankapunkt/cross-browser-speech-synthesis-the-hard-way-and-the-easy-way-353)), and some WebView-based browsers don't expose `speechSynthesis` at all ([TestMu compat page](https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/)). **[unverified on a device]** In practice, plan for it being unavailable.
- **What to build:**
  - A native bridge using `android.speech.tts.TextToSpeech`, exposed as `window.MathBeeNative.speak(text, lang, rate)`, `stop()`, `isLangAvailable('ta-IN')`.
  - Send native `UtteranceProgressListener.onStart/onDone` events back with `evaluateJavascript("window.__mbSpeaking(true)")` so that `onSpeakingChange` keeps ducking the music (`App.tsx:64`) and pausing the active timer (`SessionScreen.tsx:68`).
  - In `speech.ts`, choose native first when `window.MathBeeNative` exists, and fall back to web speech otherwise.
  - Check `TextToSpeech.isLanguageAvailable(Locale("ta","IN"))`. If Tamil is missing, show a one-time parent prompt that opens `TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA`.
  - **Recommended for quality:** bundle pre-recorded voice clips (OGG/Opus, about 8-15 kB each) for the fixed lines: cheers (`CHEERS_NAMED`/`CHEERS_PLAIN`, `fun.*`, stage intros, hint templates). Use TTS only for generated numbers and sentences. Award-quality kids' apps use a human voice. The generic TTS voice is the biggest gap in perceived polish.

### 1.2 Sound effects and music: `AudioContext` and the autoplay gesture
- **Where it's used:** `src/audio/sfx.ts:4-15` (creates the context lazily and resumes it), `src/audio/music.ts:110-133` (context), `:68-79` (`start`), `:104-108` (`setHidden`), `src/App.tsx:44-59` (starts on the first `pointerdown`/`keydown`), `App.tsx:65-69` (`visibilitychange`).
- **WebView behaviour:** `WebSettings.setMediaPlaybackRequiresUserGesture` defaults to `true`. Web Audio still needs a gesture to resume in most Chromium builds. **[unverified]** whether WebView applies the gesture rule to `AudioContext` the same way Chrome does. `visibilitychange` only fires reliably when the host calls `webView.onPause()`/`onResume()`.
- **Native requirements:**
  - Call `webView.settings.mediaPlaybackRequiresUserGesture = false`.
  - In `Activity.onPause`, call `webView.onPause()` and `webView.pauseTimers()`. Without this, `music.ts` keeps scheduling notes from its 60 ms `setInterval` while the app is in the background, wasting battery and possibly getting killed. Call `onResume()`/`resumeTimers()` on resume.
  - Request audio focus (`AudioManager.requestAudioFocus`, usage `USAGE_GAME`) and pass focus loss to JS (`music.setHidden(true)`), so a phone call or YouTube pauses the music.
  - The hardware volume keys should control `STREAM_MUSIC`: call `setVolumeControlStream(AudioManager.STREAM_MUSIC)`.

### 1.3 Service worker
- **Where it's used:** `src/main.tsx:22-49` registers `/sw.js`. `vite.config.ts:12-41` generates the precache list. `src/sw/sw-template.js` holds the cache logic. `WelcomeScreens.tsx:51-59` shows an "Update now" banner.
- **On Android it isn't needed.** The bundle ships inside the APK, and updates come from Play. Keeping it causes duplicated storage (about 3.8 MB of cache), stale-shell bugs, and a confusing "Update now" banner.
- **What to do:**
  - Add a `--mode android` build, like the existing `artifact` mode (`vite.config.ts:47-50`), with `base: './'`, no `serviceWorkerPlugin`, and `IS_ANDROID` in `platform.ts`.
  - Skip `manifest.webmanifest` and the favicon link (`index.html:8-9` uses absolute `/` paths).

### 1.4 How assets are loaded (paths and origin)
- `vite.config.ts:48` uses `base: '/'` for normal builds. `spriteUrl()` (`src/assets/manifest.ts:41-44`) uses `import.meta.env.BASE_URL`, which works with `./`.
- Don't use `file:///android_asset`. Chromium WebView discourages it and recommends `WebViewAssetLoader` on `https://appassets.androidplatform.net` so the same-origin rules work normally ([Chromium: CORS and WebView API](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/cors-and-webview-api.md)). ES module scripts (`index.html:15`, `type="module"`) are CORS-checked, so a real origin matters. **[inference]**
- **Setup:** copy `dist/` to `app/src/main/assets/www/`, map `AssetsPathHandler` to `/www/`, and load `https://appassets.androidplatform.net/www/index.html`. This needs `base: './'`.
- Set `allowFileAccess=false` and `allowContentAccess=false`, and block any navigation off that origin in `shouldOverrideUrlLoading`.

### 1.5 Export (`saveTextFile`) and import
- **Export:** `src/app/platform.ts:24-29` uses a `blob:` URL with `a.download`. In WebView this either does nothing or calls `DownloadListener` with a `blob:` URL that native code can't fetch. **[known WebView limitation, unverified here]**
  - Add `MathBeeNative.saveFile(filename, mime, text)`, which launches SAF `Intent.ACTION_CREATE_DOCUMENT`, or better, `ACTION_SEND` so the parent can save to Drive or email it.
  - Have `saveTextFile` return `'saved'` or `'declined'` based on the bridge callback. The copy-to-clipboard fallback (`ParentScreens.tsx:253-257`) only appears when the result is `'unavailable'`, so the current WebView path reports `'saved'` and the parent gets no file.
- **Import:** `ParentScreens.tsx:332-333` (`<input type="file" hidden>`) needs `WebChromeClient.onShowFileChooser` implemented with `ActivityResultContracts.OpenDocument` (`application/json`). Without it the Import button does nothing. **[known WebView behaviour; see [WebChromeClient docs](https://developer.android.com/reference/android/webkit/WebChromeClient), not fetched in this run]**
- **Clipboard:** `navigator.clipboard.writeText` (`ParentScreens.tsx:256`) can fail in WebView. The `select()` fallback works, but a native `ClipboardManager` bridge is better.
- **Strongly recommended:** add automatic local backup. On each save, the bridge writes the JSON into app-private storage (`filesDir/backup.json`), and `backup_rules.xml`/`data_extraction_rules.xml` include it so Android Auto Backup restores progress after reinstall or on a new phone.

### 1.6 Printing worksheets: `window.print`
- **Where it's used:** `TestScreens.tsx:244` (printable sheet), `ParentScreens.tsx:44` (parent report). There's also `@media print` CSS in `app.css:467-474,494,694`.
- **WebView behaviour:** JavaScript can't trigger printing. You need `PrintManager.print(jobName, webView.createPrintDocumentAdapter(jobName), attrs)`, and a WebView can run only one print job at a time ([Android: Printing HTML documents](https://developer.android.com/training/printing/html-docs)).
- **What to do:**
  - Add `MathBeeNative.print(jobName)`. Native code calls `createPrintDocumentAdapter` on the **main** WebView, so the print CSS hides the toolbar, and offers "Save as PDF" through the system dialog.
  - In JS, replace `window.print()` with `platform.print()`. The `IS_ARTIFACT` checks become `canPrint()`.
  - Optionally render the sheet into an off-screen WebView so the visible screen doesn't change.

### 1.7 IndexedDB durability
- **Where it's used:** `src/persistence/storage.ts:32-60` (IndexedDB), `:20-30` (a `sessionStorage` journal), `:88-98,115,123` (localStorage fallback).
- **WebView behaviour:** IndexedDB lives in `app_webview/`. It survives app updates, and is erased by "Clear storage" or uninstall. Persistence also depends on WebView's `domStorageEnabled=true`, which is off by default. Without it, `localStorage` and `sessionStorage` throw and the journal is lost.
- **Risk:** the state is one whole JSON document (`storage.ts:102-116`), and `attempts` grows forever: the validator allows up to 100k (`schema.ts:94`). After months of play, every tap re-serialises and writes the whole document, which is slow on low-end phones. **[inference]**
- **What to do:**
  - Set `domStorageEnabled = true`.
  - Mirror state to native code (see 1.5) for backup.
  - Compact old attempts, for example into per-subskill aggregates after 90 days, or move `attempts` into its own object store.
  - On `onPause`, flush pending writes: call a JS `store.flush()` from native code before the process can be killed.

### 1.8 Reduced motion: `matchMedia`
- **Where it's used:** `App.tsx:27-37`, `three/support.ts:27-28`, and five `@media (prefers-reduced-motion)` blocks (`app.css:462,516,617,690,784`).
- **WebView behaviour:** Chromium on Android ties this to the system "Remove animations" setting. **[unverified for WebView]**
- **What to do:** have native code read `Settings.Global.ANIMATOR_DURATION_SCALE == 0f` and inject `document.documentElement.classList.add('reduce-motion')` at page start, so it works whatever the WebView does. The in-app setting (`ParentScreens.tsx:300-304`) already overrides this.

### 1.9 WebGL and three.js on low-end phones
- **Where it's used:**
  - `src/three/support.ts:4-11` probes for WebGL by creating a context.
  - `src/three/kit.ts:7-8` uses `antialias: true` and `setPixelRatio(min(dpr, 2))`.
  - `src/three/Garden3D.tsx:303-322` runs a **continuous rAF loop**. It skips rendering only when `document.hidden`, and still animates the bee, clouds and strollers every frame.
  - `Journey3D.tsx:144-149` renders on demand, which is good.
- **Risks:**
  - On 2-3 GB phones (Mali-G52, Adreno 610), DPR 2 plus MSAA plus a continuous loop means heat and battery drain.
  - There is no `webglcontextlost` listener. The `Fallback` error boundary (`Lazy3D.tsx:8-13`) catches render errors, not context loss inside effects, so the result is a frozen or black canvas. **[inference]**
  - `emojiSprite` (`kit.ts:87-100`) draws emoji into canvases. On Android the font stack resolves to Noto Color Emoji, which is fine.
  - The `auto` mode turns 3D on for every phone that has WebGL.
- **What to do:**
  - Use DPR `min(dpr, 1.5)` and `antialias: false` when `navigator.hardwareConcurrency <= 4` or `deviceMemory <= 3`, or when native `ActivityManager.isLowRamDevice()` is true (pass this in through the bridge).
  - Cap the Garden loop at 30 fps and pause it when the canvas is offscreen (IntersectionObserver).
  - Handle `webglcontextlost` by setting state so the 2D map renders.
  - Make `auto` choose 2D on low-RAM devices.
  - Enable hardware acceleration in the manifest (it's the default, but keep it on).

### 1.10 External links and navigation
- I found no `http(s)` links, `window.open` or `target=_blank` in `src`. That's good for Families policy. The only query flags are `?gallery` (`main.tsx:9`) and `?e2e` (`SessionScreen.tsx:99`, `music.ts:215`), which test hooks use to read answers.
- **What to do:**
  - Remove the gallery and e2e hooks from the Android build, or guard them with `import.meta.env.MODE !== 'android'`.
  - `shouldOverrideUrlLoading` should return `true` for any URL that isn't on appassets.
  - If you later add a privacy-policy link, put it behind the parent gate and open it in a Custom Tab.

### 1.11 Vibration and haptics
- The app doesn't use any. `navigator.vibrate` in WebView needs the `VIBRATE` permission.
- **Opportunity:** add `MathBeeNative.haptic('tick'|'success'|'soft')` using `View.performHapticFeedback(HapticFeedbackConstants.CONFIRM/CLOCK_TICK)`. That needs no permission, and kids notice it.
- Call it from `sfx.good`, combo milestones and drag-drops (`dnd.ts:41-44`).

### 1.12 Other WebView differences
| Item | Where | What to do |
|---|---|---|
| Back button and predictive back | Not handled anywhere | Native `OnBackPressedCallback` calls `window.MathBee.back()`. JS maps each route to its parent (session → pause modal, never exit; map → welcome; welcome → let the app exit). Alternatively, push `history` entries in `store.setRoute` and handle `popstate`. |
| `window.scrollTo` on route change | `store.ts:60` | Works in WebView. |
| Fonts | `app.css:19` lists `'Nunito','Baloo 2','Noto Sans Tamil'`, but there's no `@font-face` anywhere | Android falls back to Roboto, so the storybook look is lost. Bundle Nunito and Baloo 2 (and Noto Sans Tamil, or rely on the system one) as local `woff2` in `public/fonts`. |
| System text zoom | WebView `textZoom` follows the user's font scale | Decide on a policy: cap with `settings.textZoom = min(sys,115)` or test layouts at 130%. |
| Emoji as UI (🍯, hats, treasures, butterflies) | `learning/fun.ts:110-113,129`, `gamification.ts:13-24`, `GardenScreens.tsx:61` | 🪶 🫐 (Emoji 13.0) and 🪁 🪀 (12.0) show as tofu boxes on Android 10 and older **[unverified per device]**. Set minSdk 30, or better, replace UI emoji with sprite or SVG art so the look is consistent and branded. |
| Long-press and text selection | No `user-select:none` on game UI | A child's long-press selects text or shows the callout. Add `user-select:none; -webkit-touch-callout:none` on `.screen.session`, the map and buttons, and turn off the WebView long-click context menu natively. |
| Overscroll glow and pull | Not set | Add `overscroll-behavior: none` on `html, body`, and `webView.overScrollMode = OVER_SCROLL_NEVER`. |
| Keyboard for nickname | `WelcomeScreens.tsx:103`, `ParentScreens.tsx:287` | Use `adjustResize` (or the `windowSoftInputMode` equivalent) so the input stays visible. |
| `crypto.randomUUID` | `store.ts:105` | Has a fallback already. Fine. |
| Debugging | n/a | Call `WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)` only in debug builds. |
| Immersive mode | n/a | Optionally hide the system bars during sessions (`WindowInsetsControllerCompat`, swipe to show). |

---

## 2. Phone layout issues

- **Safe areas and notches.** `env(safe-area-inset-*)` doesn't appear in `src/styles/app.css`, even though `index.html:5` sets `viewport-fit=cover`. Affected elements:
  - `.session .topbar` (sticky `top:0`, `app.css:164`)
  - `.toast` (fixed `top:16px`, `:184`)
  - `.nectar-fly` (`:553`)
  - `.modal-backdrop` (`:441`)
  - `.celebration` (`:497`)
  - the session `footer.controls` and `garden-foot`
  
  On API 35+ the app is edge-to-edge by default. WebView versions below about 140 reportedly return wrong `env()` values, so inject native `WindowInsetsCompat` as `--safe-top/--safe-bottom/--safe-left/--safe-right` CSS variables and use `max(env(...), var(--safe-*))` ([Capawesome guide](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/), [Chrome edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge)). **[WebView version threshold unverified]**
  - **Requirement:** `.screen { padding: calc(12px + var(--safe-top)) calc(16px + var(--safe-right)) calc(32px + var(--safe-bottom)) calc(16px + var(--safe-left)) }`. Do the same for sticky and fixed elements.
- **Landscape.** There's no orientation-specific CSS. The only wide layout is `@media (min-width: 900px)` (`app.css:445-452`), which most phones in landscape (about 740-915 CSS px wide, about 360-412 px tall) don't hit. In landscape:
  - The session stacks topbar, journey track, prompt, scene, keypad and action row in about 360 px, so the child must scroll to reach ✔ Check.
  - `.garden3d` uses `height:min(62vh,620px); min-height:340px` (`:698`), which fills the whole screen.
  
  **What to do:** lock phones to portrait with `android:screenOrientation="portrait"` on small screens, or `userPortrait`, and let tablets rotate (use `sw600dp` resource qualifiers). Alternatively, add `@media (orientation: landscape) and (max-height: 500px)` with a two-column session layout and a compact journey track.
- **Small screens (320-360 px wide).**
  - Map labels drop to `0.6rem`, about 9.6 px (`app.css:484`; 3D labels at `:709,723`). That's too small for a 6-year-old and below Android's readability guidance.
  - `.quest-card li` goes down to `0.82rem` (`:751`).
  - Calendar day names switch to vertical text below 480 px (`:360`).
  - Dense bird scenes are tight at 320 px (acknowledged in `docs/KNOWN_LIMITATIONS.md`).
  - Keep the minimum at 14 px for adult text and 16-18 px for anything a child reads.
- **Touch targets.** `--tap: 52px` is good. Undersized targets:
  - `.btn.tiny` at 40 px (`:71`)
  - `.link` at 40 px (`:80`)
  - calendar cells at `min-height:36px` (`:383`), which are child answer controls in C13
  - `.loc3d` at 30-34 px (`:706,722`)
  - `.music-btn` at 44 px (`:623`)
  - `.order-slots li` at 44 px
  
  For 6-year-olds, aim for **at least 48 dp, ideally 56-64 dp**, with 8 dp spacing. Calendar cells are the most important to fix.
- **Sticky and fixed bars.**
  - Only the session topbar is sticky. The answer controls are not anchored, so on a phone the child scrolls between the scene and the Check button.
  - **Recommendation:** pin `footer.controls` (keypad and ✔) to the bottom with a safe-area pad and make the scene area scroll, or scale the scene to fit with `dvh` units.
  - `body`/`.screen` use `min-height:100vh` (`:30,86`). Use `100dvh`.
- **Text sizes.** The body is 18 px and drops to 17 px at 420 px or below (`:454`). Fine. The prompt h1 is 1.2rem on small phones, also fine.
- **Hover-only effects:** `@media (hover:hover)` (`:523`) is correctly scoped.
- **The parent table** (`table.data`, `:428`) will overflow at 360 px. Wrap it in `overflow-x:auto`.

---

## 3. Performance risks

### 3.1 Build output (`npx vite build`, Vite 8.3.1, built today)
```
dist/assets/index-*.js      650.76 kB │ gzip 182.40 kB   ← app + React + all i18n + all 14 generators
dist/assets/kit-*.js        566.03 kB │ gzip 142.61 kB   ← three.js (+OrbitControls)
dist/assets/Garden3D-*.js    27.31 kB │ gzip   7.79 kB
dist/assets/Journey3D-*.js    3.15 kB │ gzip   1.72 kB
dist/assets/index-*.css      50.52 kB │ gzip  11.38 kB
dist/sw.js                    4.74 kB
dist total ≈ 3.8 MB (sprites 2.3 MB, 87 WebP; garden_scenery.webp 143 kB)
```
- In an APK, download size isn't the issue. **Parse and compile time on low-end ARM is.**
  - About 650 kB of JS is parsed on start-up. `src/i18n/*.ts` alone is about 155 kB of source. Both languages ship eagerly.
  - The ParentScreens, TestScreens and Print screens are in the main chunk.
- **Recommendations:**
  - Lazy-load each language pack (`ta-content.ts`, `ta-ui.ts`).
  - Lazy-load the screens a child rarely opens: `ParentScreens`, `TestScreens`/`MockScreen`/`PrintScreen`, `Gallery`, `report/parentReport.ts`.
  - Lazy-load generator modules per category.
  - Import three.js by name (`import { WebGLRenderer, ... } from 'three'`). `kit.ts:1` uses `import * as THREE`, which limits tree-shaking. **[effect size unverified]**
  - Enable WebView code caching. It's automatic for scripts served over https from the asset loader **[unverified]**. Add a native splash (`androidx.core:core-splashscreen`) that stays up until JS sends `MathBeeNative.ready()`, so the "Loading…" screen (`App.tsx:71`) never shows.
- **Images.** Sprites are small (largest is 46 kB, `coconut.webp`) and about 350 px. That's fine for phones. For xxhdpi sharpness at the 120 px bee on the welcome screen (`WelcomeScreens.tsx:25`), keep the 350 px source. Add `loading="lazy"` and `decoding="async"` on sprite `<img>`s that aren't visible on first paint. **[I didn't check `components/art.tsx` img attributes in detail]**
- **Runtime.**
  - The continuous Garden3D loop (see 1.9).
  - Music `setInterval` at 60 ms (`music.ts:78`), which needs `pauseTimers` in the background.
  - `MockScreen` re-renders and **persists the whole state every 5 s** (`TestScreens.tsx:128-133`). Combined with whole-document IndexedDB writes (`storage.ts:102-116`), that's heavy on large profiles.
  - `evaluateAll(profile.attempts, ...)` runs on the map and category screens (`GardenScreens.tsx:39,161`) over the full attempts history.
  - Many infinite CSS animations (butterflies, `pulse`, `gift-wiggle`, `bob`) cause constant compositing on the map.

### 3.2 Missing generated art (affects look and file size)
`src/assets/generated.json` is `[]`. Every `pickSprite('bg_welcome'|'bee_celebrate'|'bee_point'|'bee_think'...)` and `spriteUrl('bg_map_wide'|'banner_C0x')` falls back. In practice:
- the welcome screen reuses `garden_scenery`
- the 2D map is a CSS gradient with an SVG path
- there are no category banners and no bee poses
- four garden items (`butterflies`, `birdhouse`, `arch`, `fountain`, `curriculum.ts:150-153`) are hidden

The art pipeline exists in `tools/generate_art.mjs` and `art-generated/CHATGPT_PROMPTS.md`, but its output was never added. This is the single biggest visual gap.

---

## 4. Current levels and content

- **Categories:** 14 (`src/curriculum/curriculum.ts:15-30`), C01-C14:
  - Nectar Collector (counting), Animal Ferry, Bird Sanctuary, Flower Fit (size), Bridge Builder (length), Shape Workshop, Bouquet Shop (pairs), Orchard Basket (addition), Penguin Harbour (subtraction), Number Trail (sequences), Weekly Planner (days), Clock Tower, Festival Planner (calendar), Garden Help Desk (word problems).
- **Stages:** 3 per category: `explore` / `practise` / `apply` (`engine/types` `STAGES`).
- **Subskills:** 54 (`curriculum.ts:47-102`), each tagged `observed`, `prerequisite` or `extension`. Two are `gated` (`C08.regroup`, `C09.regroup`).
- **Templates:** 126, exactly 42 per stage. That's 9 per category on average; C06 has 13. They live in `src/engine/generators/c01..c14.ts` and are registered in `src/engine/registry.ts:20`. Each template is a seeded procedural generator (`registry.ts:44-54`) with up to 12 retries and validation, so the number of distinct questions is effectively unlimited.
- **Scenes:** 9 scene components in `src/activities/scenes/`: Count, Ferry, Bird, Sizes, Lengths, Shapes, Pairs, Arithmetic, Time. Code-drawn models: clock, calendar, ten-frame, base-ten blocks, number line.
- **Journey worlds:** 7 themes (`learning/fun.ts:116`: meadow, river, orchard, ice, trail, town, garden), each with a "friend".
- **Modes:** assessment (4 categories per session, `planner.ts:36`), lesson (worked, then guided), practice, daily, review (spaced, intervals configurable), fluency, worksheet, mock test.
- **How progression and unlocking work** (`learning/planner.ts:14-18`):
  - **Non-gated subskills ignore prerequisites entirely.** All `observed` and `prerequisite` subskills in all 14 categories are open from the first launch.
  - `extension` subskills appear only if the parent turns on `showExtensions`.
  - Only the two regrouping subskills check `prereq` (or the parent's `unlockRegrouping` override).
  - The `prereq` fields on the other 52 subskills are effectively used only for recommendations.
  - **So there is no level gating or sense of a journey across the map.** All 14 locations are tappable and only "bloom" (0-3 flowers, `categoryBloom`) as mastery grows.
- **Meta-progression:**
  - 10 garden levels from lifetime nectar, `seed` up to `master` at 300 nectar (`gamification.ts:13-24`). At about 1 nectar per question plus a session bonus, a daily player reaches `master` in a few weeks, after which nothing new happens.
  - 25 stickers (`gamification.ts:51-75`).
  - 16 garden items, 12 of them visible today (`curriculum.ts:136-154`).
  - 9 hats (`fun.ts:129`).
  - 24 treasures (`fun.ts:89-92`).
  - Daily quests drawn from a pool of 7 (`fun.ts:38-46`).
  - Combo milestones at 3, 5, 8 and 12.
  - A rest suggestion after 3 sessions a day (`fun.ts:134-138`).

### Suggested additions for "more levels"
1. **A world map with chapters.** Group the 14 categories into 5-7 regions that match the 7 journey themes (Meadow → River → Orchard → Ice Harbour → Number Trail → Clock Town → Festival Garden).
   - Each region has around 10-15 numbered nodes (about 3-5 per stage per category) on a winding path, which gives roughly 150-200 visible "levels".
   - A node is a short, fixed-length session (5-6 questions) built from the existing subskill and template planners. **No new engines needed.**
   - Unlock the next node by **completion, not accuracy** (keeps the no-fail ethic). Show stars (1-3) for independence (`firstCorrect && hints==0`), never for speed.
   - Use the existing `prereq` graph to decide which region opens next, and let a parent "open everything".
2. **Boss or "festival" nodes** at the end of each region: a story-wrapped mixed review (the planner's `planReview`/`planDaily`) with a unique cut-scene and a new 3D landmark built in the garden.
3. **Grade 2 content pack** (next version): place value to 1000, adding and subtracting within 100 with regrouping (partly there as gated extensions), money (₹ coins and notes, which suits an Indian audience), simple multiplication as equal groups (`C07` pairs extends naturally), fractions (halves and quarters, alongside the `C12` clock halves and quarters), measurement in cm and kg, data and pictographs (`C03` bird sort extends naturally), and 3D shapes.
4. **Endless but bounded "Garden Playground"** mini-games for fluency (number bonds to 10 with a bee catching flowers, a skip-counting stepping-stone hop). These are untimed, use existing `fluency` mode slots, and are limited to a few rounds by the existing rest rule.

---

## 5. Engagement and UX gaps compared with a world-class kids' app

### 5.1 Onboarding and first session
- **Current flow** (`WelcomeScreens.tsx`): welcome card → "Play" → profile form (avatar grid, nickname input, language buttons, grade note) → controls practice with 3 steps (`:121-171`) → map with "Today's mission" = a check-up assessment.
- **Gaps:**
  - The first screen a pre-reader sees is a **form with a text field**. A parent has to set it up.
  - There is no animated story intro (who the bee is, why the garden needs help).
  - The first real activity is labelled a "check-up", which is an assessment framing.
  - There is no narration of onboarding text, so a non-reader is stuck.
  - Language is chosen after the avatar, but the welcome screen is always English.
- **Recommendations:**
  - Make the **first launch parent-led**: a parent gate (see 5.5) → language → child name and avatar → privacy note. Then hand the phone to the child.
  - The child sees a 20-30 s narrated, skippable intro: a storm scattered the garden, help the bee restore 7 worlds.
  - Turn the check-up into the **first level of the Meadow**, phrased as a "garden walk" (the planner can still run assessment slots).
  - Fold the controls practice into that first level with a hand-pointer animation, instead of a separate tutorial screen.
  - Aim for the **first correct answer and celebration within 60 seconds** of the child getting the phone.

### 5.2 Sense of a world and progression
- The 3D garden (`Garden3D.tsx`) is a ring of 14 billboards with no path, no locks and no "next" marker beyond the `recommended` ring.
- Restoring the garden (`RestoreScreen`) is a shop grid, separate from the world.
- **Recommendations:**
  - Show the path or chapter map from 4.1, with the bee standing on the current node.
  - Let the child place restored items in the 3D garden and watch them bloom in place, instead of buying from a grid.
  - Make garden items grow over time with use (a seedling becomes a flower becomes a tree).
  - Show friends met (`friendsMet`) living in the garden and reacting.
  - Extend levels past 300 nectar with seasonal garden themes (monsoon, Pongal or Diwali lanterns) that change the look, not the power.
  - Add a "photo album" of finished regions.

### 5.3 Audio
- Music is a single 38 s loop synthesised in code (`music.ts:17-40`), the same everywhere.
- Sound effects are 4 sine/triangle blips (`sfx.ts:32-37`).
- There's no voice acting (TTS only, see 1.1).
- **Recommendations:**
  - Add a per-world music theme (7 short loops, about 60-90 s, OGG, -16 LUFS, soft).
  - Add about 20-30 foley sounds (pops, bloom chimes, bee buzz, splash for the ferry, clock tick, page flip).
  - Use a recorded friendly narrator for prompts, cheers and hints in English and Tamil. Use a native-speaker voice actor. Tamil is marked as a developer draft in `docs/KNOWN_LIMITATIONS.md`, so **a native teacher must review the Tamil first.**
  - Duck the music under the voice (already built).

### 5.4 Animation polish
- There are CSS keyframes for celebrations, confetti, pop-ins and the nectar fly (`app.css:497-620,735-784`).
- The bee is a static WebP that bobs. There are no character animations, no screen transitions, and no animated feedback on the scene objects themselves.
- **Recommendations:**
  - Rive or Lottie character rigs for the bee (idle, think, point, cheer, sleep) and each world friend. Lottie and Rive runtimes are available on npm, and Rive files are small.
  - Shared-element transitions between map → level → results (View Transitions API, or a simple crossfade and scale).
  - Juicy object feedback: counted objects hop and glow, ten-frames snap, a ferry animates sailing on a correct answer.
  - A 3D "level complete" fly-over in the garden.
  - Native haptics (1.11).
  - Respect reduced motion everywhere (already structured).

### 5.5 Parent features
- **What exists:** dashboard with "can / needs support / not assessed" statements, worksheet coverage table, next actions, settings, export/import, print, 1.5 s hold-to-open gate (`ui.tsx:31-70`, which the code itself calls "not security").
- **Gaps:**
  - The gate is easy for a 6-year-old to pass. Use a **parent gate** (for example, "type the number forty-seven" with randomised digits, or a multiplication problem a 6-year-old can't do) before the parent area, export, reset and any future external link.
  - There are no notifications. Add an optional, parent-enabled daily reminder ("Time for the garden?") with WorkManager and `POST_NOTIFICATIONS`. Never shame, and never mention a streak.
  - There's no weekly summary. Add a weekly "garden letter" card in the parent area, shareable through the Android share sheet.
  - There's no screen-time control beyond the rest suggestion. Add a parent-set daily limit (for example 15/20/30 min) that ends the current journey gently.
  - Add multi-child switching behind the gate. Profiles exist, but `ProfilesScreen` is reachable by the child.
  - The child can reach Tests/Worksheets/Mock tests from the map quick-row (`GardenScreens.tsx:113`). Consider moving mock tests to the parent area.
- **Bug to fix:** `SettingsScreen` calls `useState` after an early `return null` (`ParentScreens.tsx:245` then `:248`). That breaks the Rules of Hooks and can crash if `profile` changes between null and set while the screen is mounted. **[latent; batching in the reset flow probably hides it today]**

### 5.6 Accessibility and inclusivity
- The design is already good (tap alternative for every drag in `dnd.ts`, focus outlines, aria labels).
- Add TalkBack testing in WebView, since `KNOWN_LIMITATIONS` says screen readers weren't tested.
- Add a "left-handed" keypad mirror and a high-contrast option.

### 5.7 Play Store and compliance checklist (Families)
- **Target audience** under 13 means the Families policy applies. Only Families-approved SDKs are allowed, and there's no analytics today, which is good. Teacher Approved eligibility requires Families compliance and isn't guaranteed ([Play Help: Teacher Approved](https://support.google.com/googleplay/android-developer/answer/10075896), [Android Developers Blog 2022](https://android-developers.googleblog.com/2022/11/helping-kids-and-families-find-high-quality-apps-for-kids.html)).
- **Data safety form:** "No data collected/shared" is accurate only if there's no crash reporting. If you add Crashlytics or similar, check it's Families-certified. Host a privacy policy URL (required).
- **Target API 36** (see section 0).
- **Avoid a "thin WebView wrapper" impression** in review. Ship content offline in the APK and add real native integrations (TTS, haptics, print, back handling, backup, notifications, splash). **[policy interpretation; I didn't fetch Play's spam / minimum functionality policy]**
- **Store listing:** short gameplay video, phone and tablet screenshots, the Tamil listing, and an "ad-free, no purchases" note.

---

## 6. Native bridge contract
| JS call | Native implementation |
|---|---|
| `speak(text, lang, rate)`, `stopSpeaking()`, `voiceStatus()` | `TextToSpeech`, `UtteranceProgressListener` → `window.__mbSpeaking(bool)` |
| `saveFile(name, mime, text)` → `'saved'|'declined'` | SAF `ACTION_CREATE_DOCUMENT` / `ACTION_SEND` |
| `pickFile()` (or implement `onShowFileChooser`) | `ActivityResultContracts.OpenDocument` |
| `print(jobName)` | `PrintManager` + `webView.createPrintDocumentAdapter` |
| `haptic(kind)` | `performHapticFeedback` |
| `backup(json)` / `restore()` | `filesDir` + Auto Backup rules |
| `deviceInfo()` → `{lowRam, memClassMb, animScale, insets, locale}` | `ActivityManager`, `Settings.Global`, `WindowInsetsCompat` |
| `ready()` | dismiss SplashScreen |
| native → JS `MathBee.back()`, `MathBee.pause()`, `MathBee.resume()`, `MathBee.setInsets(t,r,b,l)` | `OnBackPressedCallback`, lifecycle, insets listener |

**Required WebView settings:** `javaScriptEnabled`, `domStorageEnabled`, `mediaPlaybackRequiresUserGesture=false`, `allowFileAccess=false`, `allowContentAccess=false`, `setSupportZoom(false)`, `WebViewAssetLoader` on `/www/`, `shouldOverrideUrlLoading` blocking other origins, `WebView.onPause/onResume` + `pauseTimers/resumeTimers`, hardware acceleration on, `targetSdk 36`.

Expose the bridge with `addJavascriptInterface` (or `WebViewCompat.addWebMessageListener` scoped to the appassets origin, which is safer).

---

## 7. Not verified in this audit
- Real-device WebView behaviour for `speechSynthesis`, `AudioContext` gesture rules, `prefers-reduced-motion`, `env(safe-area-inset-*)`, `blob:` downloads and emoji coverage. These come from documentation, third-party reports or inference.
- three.js frame rate on low-end hardware. The project's docs say 3D was only checked in desktop Chrome emulation.
- Whether `import * as THREE` actually stops tree-shaking in Rolldown.
- Sprite `<img>` attributes in `src/components/art.tsx`, and the contents of `tests/e2e`. I didn't read them.

Sources:
- [Google Play target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Play Console Help: target API level](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Android: Printing HTML documents](https://developer.android.com/training/printing/html-docs)
- [Chromium: CORS and WebView API](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/cors-and-webview-api.md)
- [Chrome on Android edge-to-edge guide](https://developer.chrome.com/docs/css-ui/edge-to-edge)
- [Capawesome: edge-to-edge and safe areas](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/)
- [Readium: SpeechSynthesis in browsers and OSes](https://readium.org/speech/docs/WebSpeech.html)
- [DEV: cross-browser speech synthesis](https://dev.to/jankapunkt/cross-browser-speech-synthesis-the-hard-way-and-the-easy-way-353)
- [TestMu: Speech Synthesis API browser support](https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/)
- [Play Help: Teacher Approved](https://support.google.com/googleplay/android-developer/answer/10075896)
- [Android Developers Blog: kids and families apps (2022)](https://android-developers.googleblog.com/2022/11/helping-kids-and-families-find-high-quality-apps-for-kids.html)