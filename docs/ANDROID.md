# MathBee on Android

The Android app is a small Kotlin shell in `android/` around the web game. The game is built with
`vite build --mode android` into `dist-android/`, copied into the APK under `assets/web/`, and served
offline from `https://appassets.androidplatform.net/web/index.html` by `WebViewAssetLoader`.

The app has **no permissions at all**: no INTERNET, no VIBRATE, no advertising id. It never loads
remote content.

> **Never change the origin or the `/web/` path.** The child's progress lives in the WebView's
> IndexedDB, which is keyed by origin. `BridgeRules.ORIGIN` and `BridgeRules.START_URL` are frozen,
> and `BridgeRulesTest.startUrlIsFrozen` pins them.

| | |
|---|---|
| applicationId | `com.stalinpusparaj.mathbee` (debug: `com.stalinpusparaj.mathbee.debug`, with its own storage) |
| App name | MathBee: Number Garden (Tamil label: MathBee: எண் தோட்டம்) |
| SDKs | compileSdk 37, targetSdk 36, minSdk 26 (Android 8.0) |
| Toolchain | AGP 9.4.1 (built-in Kotlin, pinned to KGP 2.4.20), Gradle 9.8.0, JDK 17 (Android Studio JBR) |
| Dependencies | core-ktx, activity-ktx, webkit, core-splashscreen. Nothing else: no Firebase, analytics or ads. |
| Version | `versionName` = `version` in `package.json`; `versionCode` = major·1 000 000 + minor·10 000 + patch·100 + build (`-Pmathbee.build=N`, 0–99) |
| WebView | Android System WebView 111 or newer. Older or feature-less WebViews get a native "Please update Android System WebView" screen. |

## Files

```
android/
  settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/libs.versions.toml
  gradlew, gradle/wrapper/            Gradle 9.8.0 wrapper
  local.properties                    sdk.dir (git-ignored, you write it)
  keystore.properties                 upload key (git-ignored, optional)
  app/build.gradle.kts                copyWebGame, privacy check, signing, versions
  app/src/main/AndroidManifest.xml
  app/src/main/java/com/stalinpusparaj/mathbee/
    MainActivity.kt   WebView, splash, edge-to-edge + immersive, insets, back, lifecycle, covers, print, haptics
    ShellBridge.kt    the MathBeeAndroid message bridge (JSON v:1), chunked save/share
    BridgeRules.kt    pure validation rules (origin, types, sizes, filenames, chunks, crash limit)
    Speech.kt         TextToSpeech for en and ta, offline voices only
    AudioFocus.kt     audio focus → lifecycle pause/duck messages
  app/src/main/res/                   icons (adaptive + monochrome), splash, themes, strings (en, ta),
                                      locales_config, backup rules, file_paths, retry cover layout
  app/src/test/.../BridgeRulesTest.kt JVM unit tests
```

## Build

```bash
cd /Users/stalin/Downloads/claudegamemathbee
npm run build:android                       # tsc + vite build --mode android → dist-android/

cd android
export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties    # once

./gradlew --offline :app:assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew --offline :app:testDebugUnitTest    # BridgeRulesTest
./gradlew --offline :app:lintDebug            # optional
./gradlew --offline :app:bundleRelease        # app/build/outputs/bundle/release/app-release.aab
```

`npm run android:debug` does the web build and `assembleDebug` in one go.

Drop `--offline` once if Gradle reports a missing POM. If `dist-android/` is missing, the build
fails on purpose: the APK must never ship without the game.

### Privacy policy check

`public/privacy.html` (and its copy in `dist-android/`) has placeholders the owner fills in:
`[DEVELOPER NAME]`, `[CONTACT EMAIL]` and `[LAST UPDATED]`. HTML comments are ignored.

- **Release builds fail** (`checkPrivacyPolicyRelease`) while any placeholder remains.
- Debug builds only print a warning.

To test the release pipeline before the policy is final, skip the check explicitly:
`./gradlew :app:bundleRelease -x checkPrivacyPolicyRelease`. Never upload a build made this way.

## Signing

Without `android/keystore.properties` the release build is **unsigned** (fine for local checks,
not for Play). For Play:

1. Create the upload key once, keep it outside git and back it up offline:
   ```bash
   keytool -genkeypair -v -keystore ~/keys/mathbee-upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias upload
   ```
2. Write `android/keystore.properties` (git-ignored):
   ```properties
   storeFile=/Users/stalin/keys/mathbee-upload.jks
   storePassword=…
   keyAlias=upload
   keyPassword=…
   ```
3. `./gradlew :app:bundleRelease` now signs the AAB with the upload key.
4. Enrol in **Play App Signing** on the first upload. Google keeps the app-signing key.

The `applicationId` can never change after the first upload.

## Install and debug

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.stalinpusparaj.mathbee.debug/com.stalinpusparaj.mathbee.MainActivity
adb logcat -s MathBee MathBeeShell MathBeeSpeech MathBeeWeb    # MathBeeWeb = page console (debug only)
```

- In debug builds the page can be inspected at `chrome://inspect`. Release builds turn WebView
  debugging off.
- `adb install -r` keeps progress. Uninstalling, or clearing the app's storage, removes it.

## How the shell behaves

- **Start:** the splash (honey background, bee) stays until the page sends `ready`, for 4 s at most.
  Chromium warms up off the main thread first (`WebViewCompat.startUpWebView`).
- **Screen:** edge-to-edge with the system bars hidden (a swipe from the edge shows them for a moment).
  The insets (system bars, display cutout, keyboard) go to the page in CSS px as `--shell-inset-*`.
- **Back:** the page reports `route {name, canGoBack}`. While `canGoBack` is true, back is sent to
  the page (`back`). Otherwise the system handles it and the app closes. The page asks to close with
  `exitApp` after its Bye-bye sheet.
- **Pause:** the page is asked to save (`window.__mbFlush()` and `lifecycle: pause`). Speech stops,
  keep-awake is cleared and audio focus is released. The WebView's JS timers stop only after the
  page answers `flushed`, or after 300 ms.
- **Resume:** timers resume, `lifecycle: resume` is sent, audio focus is requested again and the
  voice list is re-read (a parent may have just installed a Tamil voice).
- **Audio focus:** losing focus sends `lifecycle: pause` (or `duck`), and getting it back sends
  `resume` (or `unduck`). Volume keys always control the media stream.
- **Renderer crash:** the WebView is rebuilt, at most twice a minute. After that a native "Buzzy
  needs a tiny rest — Try again" screen shows. Progress is safe in IndexedDB.
- **Navigation:** only `https://appassets.androidplatform.net/web/…` is served. Every other path or
  host gets a 404, and every navigation away is blocked.
- **Files:**
  - Saving uses the system "save as" dialog (SAF).
  - Sharing uses `cache/exports/` with a FileProvider and the share sheet.
  - Both arrive in 512 KB pieces, up to 20 MB in total.
  - Import opens the system picker for any file type, and the page validates the file.
  - Printing opens the system print dialog (A4, with "Save as PDF").
- **Haptics:** these are sent through the window's decor view (the WebView's own haptics are off).
  The system touch-feedback setting is honoured. There is at most one every 150 ms, and the page
  never asks for one on a wrong answer.

## Bridge protocol (summary)

Object `window.MathBeeAndroid` (from `addWebMessageListener`, our origin only). Every message is a
JSON string `{ "v": 1, "type": …, … }`. Native accepts only main-frame messages from
`https://appassets.androidplatform.net`, with a whitelisted `type`, of at most about 3 MB.

| Web → native | Payload | Native → web | Payload |
|---|---|---|---|
| `hello` | – | `shell` | `versionName, versionCode, sdk, lowRam, animScale, insets, voices` |
| `ready` | – | `back` | – |
| `route` | `name, canGoBack` | `lifecycle` | `state: pause / resume / duck / unduck` |
| `speak` | `id, text ≤ 600, lang en/ta, rate 0.5–1.5` | `speech` | `id, state: start / end / error` |
| `stopSpeaking` | – | `voices` | `voices: {en, ta}` |
| `haptic` | `style: tap / success / celebrate` | `insets` | `insets: {top, right, bottom, left}` |
| `keepAwake` | `on` | `result` | `reqId, status: saved / shared / printed / cancelled / error` |
| `saveFile`, `shareFile` | `reqId, phase begin (filename, mime, size, chunks) / chunk (index, data) / end` | | |
| `print` | `reqId, jobName` | | |
| `installVoice` | `lang` | | |
| `exitApp`, `flushed` | – | | |

There is also a document-start script that sets `window.__MATHBEE_SHELL__` and adds `reduce-motion`
to `<html>` when the system animator scale is 0.

## Release checklist

- [ ] `public/privacy.html` placeholders filled in. The same text is hosted at a public URL for the Play listing.
- [ ] `package.json` version bumped. `versionCode` is higher than every earlier upload (use `-Pmathbee.build=N` for re-uploads of the same version).
- [ ] `npm run build:android` has been run from a clean tree.
- [ ] `./gradlew :app:testDebugUnitTest` passes, and `./gradlew :app:bundleRelease` is signed with the upload key.
- [ ] `unzip -l app/build/outputs/bundle/release/app-release.aab | grep '\.so$'` prints nothing.
- [ ] The merged manifest (`app/build/intermediates/merged_manifest/release/…/AndroidManifest.xml`) has **zero** `uses-permission` entries.
- [ ] The merged release manifest keeps `<meta-data android:name="android.webkit.WebView.MetricsOptOut" android:value="true" />` inside `<application>` (WebView metrics opt-out).
- [ ] Release build: `chrome://inspect` does not list the app (WebView debugging off).
- [ ] Play Console:
  - Data safety is "No data collected or shared".
  - Ads: No.
  - Target audience is ages 6–8, and the Families policy is accepted.
  - IARC rating.
  - The privacy policy URL is set.
- [ ] Listing:
  - en-US, en-IN and ta-IN listings, with the Tamil reviewed by a native speaker.
  - No "award-winning", "best", "#1" or Teacher Approved claims.
- [ ] Closed test: at least 12 testers for 14 consecutive days (personal account).

## Device QA matrix

Run on each row. "✓ 31 Oct" marks what was checked on the emulator during WP1.

| Check | BuzzyPhone AVD (API 35, WebView 124) | Low-end phone 2–3 GB, Android 8–10 | Android 14–16 phone | 10" tablet (portrait and landscape) |
|---|---|---|---|---|
| Offline cold start: splash, then the game, with no "Loading…" flash | ✓ 31 Oct | | | |
| Back inside the app goes to the parent screen | ✓ 31 Oct | | | |
| Back at the root shows the Bye-bye sheet; "Bye-bye" closes the app (`exitApp`) | ✓ 31 Oct (sheet + exit, screenshot 12) | | | |
| Predictive back gesture (Android 15+) | | | | |
| Rotation keeps state (the activity is not recreated) | ✓ 31 Oct | | | |
| Insets: nothing under the cutout or gesture bar; the keyboard does not cover inputs | | | | |
| English TTS speaks; start and end reach the page | ✓ 31 Oct | | | |
| Tamil TTS speaks, or the text fallback and "Install voice" appear | ✓ 31 Oct (no ta voice → error → text) | | | |
| Music pauses on Home and resumes on return | ✓ 31 Oct (pause/resume messages) | | | |
| Music pauses during a phone call (audio focus) | | | | |
| Save progress uses the SAF dialog, and the file content is correct | ✓ 31 Oct | | | |
| Share progress opens the share sheet (600 KB, 2 pieces) | ✓ 31 Oct | | | |
| Import picker lists .json in Downloads and Drive | | | | |
| Print dialog appears and "Save as PDF" works | ✓ 31 Oct (dialog) | | | |
| Renderer crash recovers, and the third crash in a minute shows "Try again" | ✓ 31 Oct | | | |
| External URLs are blocked, and paths outside /web/ give 404 | ✓ 31 Oct | | | |
| Progress survives `adb install -r` | ✓ 31 Oct (IndexedDB probe) | | | |
| Haptics on correct and celebrate; none on wrong answers | | | | |
| Keep-awake only in sessions and tests | | | | |
| System animations off: `reduce-motion` is applied | | | | |
| Themed (monochrome) icon on Android 13+ | | | | |
| Old WebView (< 111) shows the update screen | | | | |
| TalkBack sanity pass | | | | |

Screenshots from the emulator run are in `docs/screenshots/android/`.
