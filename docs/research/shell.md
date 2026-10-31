# MathBee Coach: technical design for the Kotlin Android WebView shell

This is a read-only report. No files were changed and no Gradle builds were run.

Headline decisions:
- **Copy the shell pattern from the local reference project.** `/Users/stalin/Downloads/buzzy-spelling-garden` already has a WebView host that is known to build on this Mac. It uses WebViewAssetLoader, `addWebMessageListener` with an origin allow-list, native TextToSpeech, haptics, render-process recovery and no INTERNET permission. Leave out its Compose UI, the KMP `:shared` core, RevenueCat and SQLDelight, because MathBee has no purchases and its logic lives in the web code.
- **Serve the game from one fixed origin and never change it.** The origin is `https://appassets.androidplatform.net` and the start page is `/web/index.html`. IndexedDB and localStorage are tied to that origin, so changing it later would wipe every child's progress.
- **Target API 36.** It has been required for new uploads since Aug 31, 2026.
- **The 16 KB page-size rule needs no work.** The app has no native libraries.

---

## 1. What the reference project does (checked)

| Item | What it does | Where |
|---|---|---|
| Gradle layout | The Gradle root is the repo root. `:androidApp` points at `android/app`. Repositories are google() and mavenCentral(). | `settings.gradle.kts` |
| Versions | AGP 9.4.1, Kotlin 2.4.20, webkit 1.17.1, Gradle 9.8.0 | `gradle/libs.versions.toml`, `gradle/wrapper/gradle-wrapper.properties` |
| Kotlin plugin | Only `com.android.application` plus `kotlin.compose`. There is no `org.jetbrains.kotlin.android`, because AGP 9 has Kotlin built in. | `android/app/build.gradle.kts` |
| SDK levels | compileSdk 37, minSdk 26, targetSdk 36, Java 17, release has minify and shrinkResources | same |
| Web assets | A configuration-cache-safe `CopyWebGame` task syncs the web files into `<generated>/web`. It is registered with `androidComponents.onVariants { variant.sources.assets?.addGeneratedSourceDirectory(...) }`. | same |
| No compression | `androidResources.noCompress += webp, mp3, png, jpg` | same |
| Manifest | No permissions. One activity with a large `configChanges` set so rotation does not recreate the WebView. `adjustResize`. | `android/app/src/main/AndroidManifest.xml` |
| WebView setup | `WebViewAssetLoader` with `addPathHandler("/", AssetsPathHandler)`. Start URL `https://appassets.androidplatform.net/web/index.html`. JS and DOM storage on, file and content access off, `mediaPlaybackRequiresUserGesture=false`, zoom off, overscroll off. | `android/app/src/main/java/com/buzzy/spellbee/android/game/WebGameHost.kt` |
| Bridge | `WebViewCompat.addWebMessageListener(webView, "BuzzyAndroid", setOf(ORIGIN))`, main frame only. Native-to-web messages go through `evaluateJavascript`. `addDocumentStartJavaScript` injects the initial state. | same |
| Navigation guard | `shouldOverrideUrlLoading` blocks any host other than the app's own origin. | same |
| Crash recovery | `onRenderProcessGone` removes and destroys the old view, creates a new one, shows "Try again" and returns true. | same |
| TTS | Android `TextToSpeech` with an `UtteranceProgressListener`. Callbacks are posted to the main thread and reported per utterance id. `QUEUE_FLUSH`. | same, `Speech` class |
| Haptics | `view.performHapticFeedback(CONFIRM / LONG_PRESS / CLOCK_TICK)`, limited to one every 400 ms. No VIBRATE permission. | same |
| Lifecycle | onPause tells the game to pause, stops speech and calls `webView.onPause()`. onResume calls `webView.onResume()`. | `MainActivity.kt`, `WebGameHost.kt` |
| Faster start | `WebViewCompat.startUpWebView(...)` runs on a background executor, with a fallback. | `MainActivity.kt` |
| Immersive | `WindowInsetsControllerCompat.hide(systemBars())` with `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`, plus `enableEdgeToEdge()` | `ui/GameScreen.kt`, `MainActivity.kt` |
| Gaps you should not copy | No `signingConfigs`. Only PNG mipmaps, so no adaptive or monochrome icon. No SplashScreen API. No `<queries>` for the TTS service. No print, save, share or file chooser. | — |

Libraries already in the local Gradle cache, so they will resolve offline:
- core-ktx 1.19.1
- core-splashscreen 1.2.0
- activity 1.13.0
- webkit 1.17.1
- AGP 9.4.1
- KGP 2.4.20

Also present on this Mac: NDK 28.2 (not needed), AVD `BuzzyPhone`, and SDK platforms 34, 35, 36 and 37.0.

## 2. What MathBee does today that affects the shell (checked in `/Users/stalin/Downloads/claudegamemathbee`)

- **Routing is held in memory, not in browser history.** `src/app/store.ts` has `Route` (welcome, profiles, profile-new, controls, map, category, session, results, restore, stickers, review-due, tests, mock, mock-results, print, parent, setup, settings) and `store.setRoute`. `history.back()` cannot be used, so the web app needs its own "parent route" map for the back button (§7.3).
- **Asset URLs already use `import.meta.env.BASE_URL`** (`src/assets/manifest.ts:43`). A `base: '/web/'` build will therefore work.
- **The service worker is registered in `src/main.tsx`** unless the build is the artifact build. It must also be skipped in the Android build: updates come from Play, and the SW would also duplicate what the asset loader does.
- **Saving the JSON export uses `<a download>` with a blob URL** (`src/app/platform.ts`). A WebView silently does nothing with this, so it has to go through a bridge `saveFile` message using the Storage Access Framework.
- **Import uses `<input type="file">`** (`src/screens/ParentScreens.tsx:333`). A WebView only opens a picker if `WebChromeClient.onShowFileChooser` is implemented.
- **Printing uses `window.print()`** (`ParentScreens.tsx:44`, `TestScreens.tsx:244`). The Android docs say JavaScript-triggered printing is not supported in WebView, so this needs a bridge `print` message that calls `PrintManager`. Print CSS already exists (`src/styles/app.css:467,494,694`).
- **Narration uses `speechSynthesis`** (`src/audio/speech.ts`). It already handles "no voice, show text instead" and has `onSpeakingChange`, which is used to duck the music. Swap the backend to the native bridge when running in the shell.
- **Music and sound effects use Web Audio** (`src/audio/music.ts`, `sfx.ts`). `App.tsx:66-68` already calls `music.setHidden` on `visibilitychange`.
- **There is no safe-area CSS** (`env(` does not appear in the styles), but `index.html` already has `viewport-fit=cover`.
- **There is no `color-scheme` meta and no `prefers-color-scheme`.**
- **three.js caps the pixel ratio at 2** (`src/three/kit.ts:8`), but there is no `webglcontextlost` handling. That matters on low-end Android GPUs.
- **The `dist/` build is 3.7 MB.** The AAB will be very small.

## 3. Files to create or change

Make the Android project self-contained under `android/` in the MathBee repo. The reference project uses the repo root as its Gradle root; doing it this way instead keeps Node and Gradle apart.

```
/Users/stalin/Downloads/claudegamemathbee/
  vite.config.ts                         (edit: add 'android' mode)
  package.json                           (edit: "build:android" script)
  index.html                             (edit: <meta name="color-scheme" content="light">)
  src/main.tsx                           (edit: no SW in android mode)
  src/app/platform.ts                    (edit: IS_ANDROID_BUILD, saveTextFile/printPage via shell)
  src/app/shell.ts                       (NEW: bridge client, detection, message bus)
  src/app/backNav.ts                     (NEW: parent-route map + overlay back stack)
  src/audio/speech.ts                    (edit: native TTS backend when in shell)
  src/styles/app.css                     (edit: safe-area vars, html.in-android rules)
  src/three/kit.ts                       (edit: webglcontextlost -> 2D fallback)
  .gitignore                             (edit: dist-android/, android/.gradle, android/**/build, android/local.properties, android/keystore.properties, *.jks, *.keystore)
  android/
    settings.gradle.kts
    build.gradle.kts
    gradle.properties
    gradle/libs.versions.toml
    gradle/wrapper/gradle-wrapper.properties   (copy from reference)
    gradle/wrapper/gradle-wrapper.jar          (copy from reference)
    gradlew, gradlew.bat                       (copy from reference)
    local.properties                           (sdk.dir=/Users/stalin/Library/Android/sdk — git-ignored)
    keystore.properties                        (upload key — git-ignored)
    app/build.gradle.kts
    app/proguard-rules.pro
    app/src/main/AndroidManifest.xml
    app/src/main/java/com/mathbee/coach/MainActivity.kt
    app/src/main/java/com/mathbee/coach/ShellBridge.kt
    app/src/main/java/com/mathbee/coach/Speech.kt
    app/src/main/res/values/{strings,colors,themes}.xml
    app/src/main/res/xml/{file_paths,data_extraction_rules,backup_rules}.xml
    app/src/main/res/drawable/{ic_launcher_foreground,ic_launcher_monochrome,splash_icon}.xml (vector)
    app/src/main/res/mipmap-anydpi-v26/{ic_launcher,ic_launcher_round}.xml (adaptive)
```

`com.mathbee.coach` is a placeholder package name. Pick the real `applicationId` once, because it can never change after the first upload.

## 4. Web build mode for Android

### `vite.config.ts`

Extend the existing config (keep `serviceWorkerPlugin` as it is):

```ts
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  const android = mode === 'android';
  return {
    // Android: served at https://appassets.androidplatform.net/web/ by WebViewAssetLoader
    base: artifact ? './' : android ? '/web/' : '/',
    plugins: artifact || android ? [react()] : [react(), serviceWorkerPlugin()],
    build: {
      target: 'es2020',            // Android System WebView is evergreen Chromium; es2020 is safe
      sourcemap: false,
      outDir: artifact ? 'dist-artifact' : android ? 'dist-android' : 'dist',
      emptyOutDir: true,
    },
  };
});
```

### `package.json`

```json
"build:android": "tsc -p tsconfig.json --noEmit && vite build --mode android"
```

Notes:
- `import.meta.env.MODE === 'android'` gives you a build-time flag (`IS_ANDROID_BUILD`).
- At runtime, detect the shell with the bridge object (§7.1). That way an Android build opened in a desktop browser still works.
- **Verify** that Vite rewrites `<link rel="icon" href="/assets/...">` and `<link rel="manifest" href="/manifest.webmanifest">` in `index.html` to `/web/...` when `base` is `/web/`. If it does not, drop the manifest link in Android mode. The manifest has no purpose inside the shell.

## 5. Gradle files

### `android/settings.gradle.kts`

```kotlin
pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "MathBeeCoach"
include(":app")
```

### `android/build.gradle.kts`

```kotlin
plugins { alias(libs.plugins.android.application) apply false }
```

### `android/gradle.properties`

Copied from the reference:

```
org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8
org.gradle.configuration-cache=true
android.useAndroidX=true
kotlin.code.style=official
```

### `android/gradle/libs.versions.toml`

```toml
[versions]
agp = "9.4.1"
coreKtx = "1.19.1"
activity = "1.13.0"
webkit = "1.17.1"
splashscreen = "1.2.0"

[libraries]
core-ktx = { module = "androidx.core:core-ktx", version.ref = "coreKtx" }
activity-ktx = { module = "androidx.activity:activity-ktx", version.ref = "activity" }
webkit = { module = "androidx.webkit:webkit", version.ref = "webkit" }
core-splashscreen = { module = "androidx.core:core-splashscreen", version.ref = "splashscreen" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
```

Not verified: AGP 9's built-in Kotlin uses the Kotlin Gradle Plugin version AGP depends on. The reference pins KGP 2.4.20 indirectly through the `kotlin.compose` plugin. If the first sync complains or picks a different Kotlin, add `org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.20` to `buildscript { dependencies { classpath(...) } }` in the root build file.

### `android/gradle/wrapper/gradle-wrapper.properties`

Copy it from the reference. It points to `gradle-9.8.0-bin.zip`.

### `android/app/build.gradle.kts`

```kotlin
import java.util.Properties
import javax.inject.Inject

plugins { alias(libs.plugins.android.application) }

val keystoreProps = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}

android {
    namespace = "com.mathbee.coach"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.mathbee.coach"       // permanent once uploaded
        minSdk = 26
        targetSdk = 36                             // Play requirement since Aug 31 2026
        versionCode = 1
        versionName = "1.0.0"
    }
    signingConfigs {
        if (keystoreProps.isNotEmpty()) create("upload") {
            storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
            storePassword = keystoreProps.getProperty("storePassword")
            keyAlias = keystoreProps.getProperty("keyAlias")
            keyPassword = keystoreProps.getProperty("keyPassword")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("upload")
        }
        debug { applicationIdSuffix = ".debug" }   // side-by-side with release; separate storage
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    androidResources { noCompress += listOf("webp", "png", "jpg", "mp3", "ogg", "woff2") }
}

/** Copies the Vite Android build (../dist-android) into the APK under assets/web/. Run `npm run build:android` first. */
abstract class CopyWebGame : DefaultTask() {
    @get:InputDirectory abstract val webDist: DirectoryProperty
    @get:OutputDirectory abstract val outputDir: DirectoryProperty
    @get:Inject abstract val fs: FileSystemOperations
    @TaskAction fun copy() = fs.sync {
        from(webDist) { exclude("**/.DS_Store", "sw.js") }
        into(outputDir.dir("web"))
    }
}
val copyWebGame = tasks.register<CopyWebGame>("copyWebGame") {
    webDist.set(rootProject.layout.projectDirectory.dir("../dist-android"))
}
androidComponents {
    onVariants { it.sources.assets?.addGeneratedSourceDirectory(copyWebGame, CopyWebGame::outputDir) }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.activity.ktx)
    implementation(libs.webkit)
    implementation(libs.core.splashscreen)
}
```

If `dist-android` is missing, `@InputDirectory` validation fails the build with a "does not exist" error. That is the right behaviour: the APK must never ship without the game.

**Signing and Play App Signing:**
- Generate one upload key and keep it out of git (`keytool -genkeypair -v -keystore upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias upload`).
- Enrol in Play App Signing so Google holds the app-signing key.

### `android/app/proguard-rules.pro`

No rules are needed. `addWebMessageListener` uses no reflection, unlike `@JavascriptInterface`. If you ever switch to `addJavascriptInterface`, add:

```
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
```

## 6. Manifest and resources

### `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- No permissions at all: no INTERNET, no VIBRATE (performHapticFeedback needs none). Keeps Data safety = "no data collected". -->
    <queries>
        <!-- Android 11+ package visibility: lets TextToSpeech find installed engines -->
        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>
    </queries>

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:appCategory="game"
        android:theme="@style/Theme.MathBee.Starting">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="fullUser"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard|navigation|uiMode|density|fontScale"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.files"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```

**`<queries>` for TTS:** Android 11 package visibility requires it for apps that bind to TTS engines. I could not get the exact wording from the TextToSpeech reference page. The reference app works without it, probably because it only uses the default engine. Add it anyway because it costs nothing.

**Orientation:**
- `fullUser` lets the responsive layout and the 3D garden use landscape on tablets.
- For apps targeting API 36, Android 16 ignores `screenOrientation` and resizability limits on screens 600dp and wider. Games are exempt through `android:appCategory`. Either way the CSS must handle both orientations.
- If you want phone portrait only, use `sensorPortrait`. It will still be ignored on tablets unless `appCategory="game"` is set.

### `res/xml/file_paths.xml`

```xml
<paths><cache-path name="exports" path="exports/" /></paths>
```

### Backup rules

Progress lives in the WebView's IndexedDB inside `app_webview/`. Not verified: whether Auto Backup (25 MB limit) captures this reliably. Keep the default include behaviour, but tell parents in Settings that the reliable backup is "Save progress file" (the JSON export).

### `res/values/themes.xml`

```xml
<resources>
    <style name="Theme.MathBee" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:isLightTheme">true</item>           <!-- prefers-color-scheme = light in WebView -->
        <item name="android:forceDarkAllowed">false</item>
        <item name="android:windowBackground">@color/cream</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowLayoutInDisplayCutoutMode">always</item>
    </style>
    <style name="Theme.MathBee.Starting" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/honey</item>       <!-- #F7BF35 matches theme-color -->
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="postSplashScreenTheme">@style/Theme.MathBee</item>
    </style>
</resources>
```

Two attributes need API-level variants:
- `windowLayoutInDisplayCutoutMode` "always" is API 30+. Put it in `values-v30/themes.xml` and use `shortEdges` in `values-v28`.
- `forceDarkAllowed` is API 29+, so it goes in `values-v29`.

Splash icon sizes: a 288×288dp canvas with the bee inside the central 192dp circle. An animated vector must stay under 1,000 ms.

**Icons:**
- Add an adaptive icon: foreground bee vector, solid honey background, and a monochrome layer for Android 13 themed icons. Export the art from `source-art/` or `public/assets/sprites/bee.webp`.
- The Play listing also needs a 512×512 PNG icon and a 1024×500 feature graphic.

## 7. Bridge protocol

Use one message channel named `MathBeeAndroid`. Messages are versioned JSON.

### 7.1 Detection (web side)

`addWebMessageListener` injects `window.MathBeeAndroid` with `postMessage(string)` and `onmessage`. It only does this in frames whose origin matches the allow-list, and the object exists before page scripts run. A document-start script also sets `window.__MATHBEE_SHELL__ = {platform, versionName, versionCode, sdk}`.

```ts
// src/app/shell.ts
export type Insets = { top: number; right: number; bottom: number; left: number };
type Port = { postMessage(m: string): void; onmessage: ((e: { data: string }) => void) | null };
type NativeMsg =
  | { type: 'shell'; versionName: string; sdk: number; voices: { en: boolean; ta: boolean }; insets: Insets }
  | { type: 'insets'; insets: Insets }
  | { type: 'voices'; en: boolean; ta: boolean }
  | { type: 'speech'; id: string; state: 'start' | 'end' | 'error' }
  | { type: 'back' }
  | { type: 'lifecycle'; state: 'pause' | 'resume' }
  | { type: 'result'; reqId: string; status: 'saved' | 'shared' | 'printed' | 'cancelled' | 'error' };

const port = (window as unknown as { MathBeeAndroid?: Port }).MathBeeAndroid;
export const IN_SHELL = !!port && typeof port.postMessage === 'function';

const subs = new Map<string, Set<(m: any) => void>>();
export function onNative<T extends NativeMsg['type']>(type: T, fn: (m: Extract<NativeMsg, { type: T }>) => void) {
  const set = subs.get(type) ?? new Set(); set.add(fn); subs.set(type, set);
  return () => set.delete(fn);
}
export function send(type: string, payload: Record<string, unknown> = {}) {
  port?.postMessage(JSON.stringify({ v: 1, type, ...payload }));
}
let seq = 0;
export function request(type: string, payload: Record<string, unknown>): Promise<string> {
  const reqId = `r${++seq}`;
  return new Promise((resolve) => {
    const off = onNative('result', (m) => { if (m.reqId === reqId) { off(); resolve(m.status); } });
    send(type, { ...payload, reqId });
  });
}
function applyInsets(i: Insets) {
  const s = document.documentElement.style;
  for (const k of ['top', 'right', 'bottom', 'left'] as const) s.setProperty(`--shell-inset-${k}`, `${i[k]}px`);
}
if (IN_SHELL) {
  document.documentElement.classList.add('in-android');
  port!.onmessage = (e) => {
    let m: NativeMsg; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 'shell' || m.type === 'insets') applyInsets(m.insets);
    subs.get(m.type)?.forEach((fn) => fn(m));
  };
  send('hello');                 // native replies with 'shell' (and queued insets); gives native a reply proxy
}
```

Then:
- Call `send('ready')` once `store.init()` resolves and the first screen has rendered. Native uses it to release the splash screen.
- Add `export const IS_ANDROID_BUILD = import.meta.env.MODE === 'android'` to `platform.ts`.

### 7.2 Message table

| Direction | type | Payload | Native action |
|---|---|---|---|
| web→native | `hello` | — | Store the reply proxy. Reply `shell` (version, voices, insets). Flush queued messages. |
| web→native | `ready` | — | Dismiss the splash. Cancel the 15 s "couldn't start" timer. |
| web→native | `route` | `{name, canGoBack}` | Set `backCallback.isEnabled = canGoBack`. |
| web→native | `speak` | `{id, text≤600, lang:'en'\|'ta', rate}` | `Speech.speak`. Emit `speech` start, end and error. |
| web→native | `stopSpeaking` | — | `tts.stop()` |
| web→native | `haptic` | `{style:'tap'\|'success'\|'celebrate'}` | `performHapticFeedback`, at most one every 150 ms |
| web→native | `keepAwake` | `{on}` | Add or clear `FLAG_KEEP_SCREEN_ON` |
| web→native | `saveFile` | `{reqId, filename, mime, data≤5MB}` | SAF `CreateDocument`. Write the file. Emit `result`. |
| web→native | `shareFile` | same | Write to `cache/exports`, FileProvider URI, `ACTION_SEND` chooser |
| web→native | `print` | `{reqId, jobName}` | `PrintManager.print(job, webView.createPrintDocumentAdapter(job), A4)` |
| web→native | `installVoice` | `{lang}` | `TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA` intent. Behind the parent gate. |
| native→web | `back` | — | Web closes the top overlay or goes to the parent route |
| native→web | `lifecycle` | pause / resume | Web suspends or resumes the AudioContext and pauses session timers |
| native→web | `insets` | `{top,right,bottom,left}` in CSS px | CSS variables |
| native→web | `voices` | `{en, ta}` | `narrationAvailable()` |

**Security rules for the bridge:**
- Only accept messages where `isMainFrame` is true and the source origin equals `https://appassets.androidplatform.net`.
- Whitelist `type`, cap string lengths, and sanitise filenames to `[A-Za-z0-9._-]{1,80}`.
- Never execute strings that arrive from the page.
- The game never loads remote content, so the allow-list plus the navigation block is enough.

### 7.3 Back button (Android 16 predictive back)

On Android 16, apps targeting API 36 have predictive back on by default. `onBackPressed` is not called and `KEYCODE_BACK` is not dispatched, so you must use `OnBackPressedCallback`.

**Pattern:**
- The web app reports `canGoBack` on every route or overlay change.
- Native keeps an `OnBackPressedCallback` that is enabled only when `canGoBack` is true.
- At a root screen (`welcome`, or `map` with no overlay) the callback is disabled. The system then plays the back-to-home animation and handles it natively. There is no round trip, and the child is never stuck.

`src/app/backNav.ts`:

```ts
const overlays: Array<() => void> = [];               // LIFO: celebration, parent gate, dialogs
export function pushBackHandler(close: () => void) { overlays.push(close); report(); return () => { const i = overlays.lastIndexOf(close); if (i >= 0) overlays.splice(i, 1); report(); }; }

export function parentOf(r: Route): Route | 'confirm-leave' | null {
  switch (r.name) {
    case 'welcome': return null;
    case 'map': return null;                          // root while a child is signed in
    case 'profiles': case 'controls': return { name: 'welcome' };
    case 'profile-new': return { name: 'profiles' };
    case 'session': case 'mock': return 'confirm-leave';   // open the existing gentle "stop here?" sheet; progress saved
    case 'mock-results': case 'print': return { name: 'tests' };
    case 'setup': return { name: 'parent' };
    default: return { name: 'map' };                  // category, results, restore, stickers, review-due, tests, parent, settings
  }
}
// subscribe to the store: send('route', { name, canGoBack: overlays.length > 0 || parentOf(route) !== null })
// onNative('back'): if overlays.length -> overlays.at(-1)!(); else apply parentOf(route)
```

No message is needed while the web app is still loading: the callback starts disabled.

## 8. Native code

### 8.1 `MainActivity.kt`

```kotlin
package com.mathbee.coach

class MainActivity : ComponentActivity(), ShellBridge.Host {
    private lateinit var root: FrameLayout
    private var web: WebView? = null
    private lateinit var bridge: ShellBridge
    private var webReady = false
    private val startedAt = SystemClock.uptimeMillis()
    private val crashTimes = ArrayDeque<Long>()
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))   // /web/** -> assets/web/**
            .build()
    }
    private val backCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() = bridge.emit("back")
    }
    private val createDoc = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        bridge.onSaveTarget(uri)
    }
    private val chooseFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data)); fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { !webReady && SystemClock.uptimeMillis() - startedAt < 4_000 }
        enableEdgeToEdge()
        root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.cream)) }
        setContentView(root)
        bridge = ShellBridge(this, this)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val d = resources.displayMetrics.density                        // px -> CSS px (= dp in WebView)
            bridge.sendInsets(i.top / d, i.right / d, i.bottom / d, i.left / d)
            insets
        }
        onBackPressedDispatcher.addCallback(this, backCallback)
        createWebView()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView() {
        val w = WebView(this)
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                       // localStorage; IndexedDB is always on
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false       // music/sfx without a first tap
            setSupportZoom(false); builtInZoomControls = false; displayZoomControls = false
            textZoom = 100                                 // app has its own text-size setting; keeps layouts stable
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING))
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(w.settings, false)
        if (Build.VERSION.SDK_INT >= 29) w.isForceDarkAllowed = false
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)   // chrome://inspect in debug only
        w.setBackgroundColor(getColor(R.color.cream))
        w.overScrollMode = View.OVER_SCROLL_NEVER
        w.isVerticalScrollBarEnabled = false; w.isHorizontalScrollBarEnabled = false
        w.webViewClient = Client()
        w.webChromeClient = Chrome()
        bridge.attach(w)                                   // addWebMessageListener + document-start script
        root.addView(w, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        web = w
        w.loadUrl(START_URL)
    }

    private inner class Client : WebViewClientCompat() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
            assetLoader.shouldInterceptRequest(request.url)
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
            request.url.host != ORIGIN_HOST                // block every external navigation
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            root.removeView(view); view.destroy(); web = null; webReady = false
            bridge.reset(); backCallback.isEnabled = false; setKeepAwake(false)
            val now = SystemClock.uptimeMillis()
            crashTimes.addLast(now); while (crashTimes.first() < now - 60_000) crashTimes.removeFirst()
            if (crashTimes.size <= 2) createWebView() else showRetryCover()   // native "Buzzy needs a tiny rest - Try again" view
            return true                                    // never crash the app; IndexedDB progress survives
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
            fileCallback?.onReceiveValue(null); fileCallback = cb
            return try { chooseFile.launch(p.createIntent()); true } catch (e: ActivityNotFoundException) { fileCallback = null; false }
        }
        override fun onPermissionRequest(request: PermissionRequest) = request.deny()   // no camera/mic, ever
    }

    // ShellBridge.Host
    override fun onWebReady() { webReady = true }
    override fun setBackEnabled(enabled: Boolean) { backCallback.isEnabled = enabled }
    override fun setKeepAwake(on: Boolean) =
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    override fun pickSaveTarget(filename: String) = createDoc.launch(filename)
    override fun print(jobName: String): Boolean {
        val w = web ?: return false
        val pm = getSystemService(PRINT_SERVICE) as PrintManager
        pm.print(jobName, w.createPrintDocumentAdapter(jobName),
            PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
        return true
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) WindowCompat.getInsetsController(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())    // immersive; re-applied after dialogs/print UI
        }
    }
    override fun onPause() { bridge.emit("lifecycle", "state" to "pause"); bridge.speech.stop(); web?.onPause(); setKeepAwake(false); super.onPause() }
    override fun onResume() { super.onResume(); web?.onResume(); bridge.emit("lifecycle", "state" to "resume"); bridge.refreshVoices() }
    override fun onDestroy() { bridge.shutdown(); web?.let { root.removeView(it); it.destroy() }; super.onDestroy() }

    companion object {
        const val ORIGIN = "https://appassets.androidplatform.net"
        const val ORIGIN_HOST = "appassets.androidplatform.net"
        const val START_URL = "$ORIGIN/web/index.html"
    }
}
```

Implementation notes:
- **Back-to-back crashes.** If the renderer dies twice within a minute, the same page may crash again in a new WebView (the docs warn about this). That is why the code shows a native retry cover instead of recreating forever.
- **Faster cold start (optional).** The reference uses `WebViewCompat.startUpWebView(...)` to warm up Chromium on a background executor. It compiles against webkit 1.17.1, so you can copy it.
- **Keep the app on WebViewAssetLoader.** Do not switch to `loadDataWithBaseURL` or `file://` later. The origin, and the child's saved garden with it, must stay the same forever.
- **Safe Browsing.** Leave it at the default (on), as Google recommends. With no remote URLs it has no effect on the app.

### 8.2 `ShellBridge.kt`

```kotlin
class ShellBridge(private val ctx: ComponentActivity, private val host: Host) {
    interface Host {
        fun onWebReady(); fun setBackEnabled(enabled: Boolean); fun setKeepAwake(on: Boolean)
        fun pickSaveTarget(filename: String); fun print(jobName: String): Boolean
    }
    private val main = Handler(Looper.getMainLooper())
    private var proxy: JavaScriptReplyProxy? = null
    private val queue = ArrayDeque<String>()
    private var insets = JSONObject().put("top", 0).put("right", 0).put("bottom", 0).put("left", 0)
    private var pendingSave: Pair<String, String>? = null   // reqId to data
    private var lastHaptic = 0L
    private var view: WebView? = null
    val speech = Speech(ctx,
        onEvent = { id, state -> emit("speech", "id" to id, "state" to state) },
        onVoices = { en, ta -> emit("voices", "en" to en, "ta" to ta) })

    fun attach(w: WebView) {
        view = w
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            WebViewCompat.addDocumentStartJavaScript(w,
                "window.__MATHBEE_SHELL__={platform:'android',versionName:'${BuildConfig.VERSION_NAME}',versionCode:${BuildConfig.VERSION_CODE},sdk:${Build.VERSION.SDK_INT}};",
                setOf(MainActivity.ORIGIN))
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return  // very old WebView: web falls back to browser APIs
        WebViewCompat.addWebMessageListener(w, "MathBeeAndroid", setOf(MainActivity.ORIGIN)) { _, msg, origin, isMainFrame, reply ->
            if (!isMainFrame || origin.toString().trimEnd('/') != MainActivity.ORIGIN) return@addWebMessageListener
            proxy = reply
            msg.data?.let { runCatching { handle(JSONObject(it)) } }
        }
    }

    private fun handle(m: JSONObject) {
        if (m.optInt("v") != 1) return
        when (m.optString("type")) {
            "hello" -> { emitNow(shellInfo()); while (queue.isNotEmpty()) proxy?.postMessage(queue.removeFirst()) }
            "ready" -> host.onWebReady()
            "route" -> host.setBackEnabled(m.optBoolean("canGoBack"))
            "speak" -> speech.speak(m.optString("id").take(40), m.optString("text").take(600),
                                    if (m.optString("lang") == "ta") "ta" else "en", m.optDouble("rate", 0.9).coerceIn(0.5, 1.5))
            "stopSpeaking" -> speech.stop()
            "haptic" -> haptic(m.optString("style"))
            "keepAwake" -> host.setKeepAwake(m.optBoolean("on"))
            "saveFile" -> { pendingSave = m.optString("reqId") to m.optString("data").take(5_000_000); host.pickSaveTarget(safeName(m.optString("filename"))) }
            "shareFile" -> share(m.optString("reqId"), safeName(m.optString("filename")), m.optString("data").take(5_000_000), m.optString("mime", "application/json"))
            "print" -> result(m.optString("reqId"), if (host.print(m.optString("jobName", "MathBee worksheet").take(60))) "printed" else "error")
            "installVoice" -> runCatching { ctx.startActivity(Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)) }
        }
    }

    fun onSaveTarget(uri: Uri?) {
        val (reqId, data) = pendingSave ?: return; pendingSave = null
        if (uri == null) return result(reqId, "cancelled")
        val ok = runCatching { ctx.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(data.toByteArray()) } }.isSuccess
        result(reqId, if (ok) "saved" else "error")
    }

    private fun share(reqId: String, name: String, data: String, mime: String) {
        val dir = File(ctx.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, name).apply { writeText(data) }
        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", file)
        val send = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).apply { clipData = ClipData.newRawUri(name, uri) }
        ctx.startActivity(Intent.createChooser(send, null)); result(reqId, "shared")
    }

    private fun haptic(style: String) {
        val now = SystemClock.uptimeMillis(); if (now - lastHaptic < 150) return; lastHaptic = now
        val v = view ?: return
        val confirm = if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
        when (style) {
            "celebrate" -> { v.performHapticFeedback(confirm); v.postDelayed({ v.performHapticFeedback(confirm) }, 160) }
            "success" -> v.performHapticFeedback(confirm)
            else -> v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        }   // honours the user's system "touch feedback" setting; never haptic on wrong answers
    }

    fun sendInsets(t: Float, r: Float, b: Float, l: Float) {
        insets = JSONObject().put("top", t).put("right", r).put("bottom", b).put("left", l)
        emit("insets", "insets" to insets)
    }
    fun emit(type: String, vararg kv: Pair<String, Any>) = main.post {
        val json = JSONObject().put("type", type).apply { kv.forEach { (k, v) -> put(k, v) } }.toString()
        proxy?.postMessage(json) ?: queue.addLast(json)
    }
    private fun emitNow(o: JSONObject) { proxy?.postMessage(o.toString()) }
    private fun result(reqId: String, status: String) = emit("result", "reqId" to reqId, "status" to status)
    private fun shellInfo() = JSONObject().put("type", "shell").put("versionName", BuildConfig.VERSION_NAME)
        .put("sdk", Build.VERSION.SDK_INT).put("insets", insets).put("voices", speech.voicesJson())
    private fun safeName(s: String) = s.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80).ifEmpty { "mathbee.json" }
    fun refreshVoices() = speech.reportVoices()
    fun reset() { proxy = null; queue.clear() }
    fun shutdown() = speech.shutdown()
}
```

Threading: `JavaScriptReplyProxy.postMessage` must be called on the UI thread, which is why `emit` posts to the main handler. The listener callback itself runs on the UI thread. TTS callbacks arrive on binder threads, so `Speech` must post to the main thread too, as the reference does.

### 8.3 `Speech.kt` (English and Tamil)

```kotlin
class Speech(ctx: Context, private val onEvent: (String, String) -> Unit, private val onVoices: (Boolean, Boolean) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private var ready = false
    private val tts = TextToSpeech(ctx.applicationContext) { st -> ready = st == TextToSpeech.SUCCESS; reportVoices() }
    init {
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String) { main.post { onEvent(id, "start") } }
            override fun onDone(id: String) { main.post { onEvent(id, "end") } }
            @Deprecated("") override fun onError(id: String) { main.post { onEvent(id, "error") } }
            override fun onError(id: String, code: Int) { main.post { onEvent(id, "error") } }
            override fun onStop(id: String, interrupted: Boolean) { main.post { onEvent(id, "end") } }
        })
    }
    private fun bestVoice(lang: String): Voice? = runCatching { tts.voices }.getOrNull()
        ?.filter { it.locale.language == lang && !it.isNetworkConnectionRequired &&
                   TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features }
        ?.sortedWith(compareByDescending<Voice> { it.locale.country == "IN" }.thenByDescending { it.quality })
        ?.firstOrNull()
    fun has(lang: String) = ready && bestVoice(lang) != null
    fun voicesJson() = JSONObject().put("en", has("en")).put("ta", has("ta"))
    fun reportVoices() = main.post { onVoices(has("en"), has("ta")) }
    fun speak(id: String, text: String, lang: String, rate: Double) {
        val v = if (ready) bestVoice(lang) else null
        if (v == null) { onEvent(id, "error"); return }        // web shows text instead (existing behaviour)
        tts.voice = v; tts.setSpeechRate(rate.toFloat()); tts.setPitch(1.05f)
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
    }
    fun stop() { if (ready) tts.stop() }
    fun shutdown() = tts.shutdown()
}
```

**About voice availability:**
- The filter excludes network-only voices. The app has no INTERNET permission, so those voices would fail anyway.
- Re-check voices in `onResume`, because a parent may have just installed Tamil voice data.
- Not verified: whether "Speech Services by Google" ships an offline Tamil (ta-IN) voice on every device. Test on real devices.
- If Tamil voice data exists but is not installed, the parent Settings screen should offer "Install Tamil voice". This sends `installVoice` and opens the system TTS installer.

**Web side (`src/audio/speech.ts`).** When `IN_SHELL` is true:
- `speak()` sends `speak` with a fresh id and returns `true` only if `voices[lang]` is true.
- `onNative('speech')` calls the existing `setSpeaking(start=true, end/error=false)`, so music ducking keeps working.
- `narrationAvailable(lang)` reads the latest `voices` message.
- `stopSpeaking()` sends `stopSpeaking`.

## 9. Other platform concerns

### Audio
- `mediaPlaybackRequiresUserGesture=false` lets media play without a user gesture.
- Not verified: whether a Web Audio `AudioContext` also starts in the `running` state without a gesture in every WebView version. Keep the existing "resume on first pointerdown" code (`App.tsx` already has it).
- On `lifecycle: pause`, call `music.setHidden(true)` and `ctx.suspend()`. Do the reverse on resume.
- Do not rely on `visibilitychange` firing after `WebView.onPause()`. That is not verified, so native sends an explicit `lifecycle` message.

### Keep the screen on
- Send `keepAwake {on:true}` only on the `session`, `mock` and lesson routes. Turn it off everywhere else and on pause.
- This fits the existing rest suggestion: the screen is never forced on while a child sits on a menu.

### Safe area (`src/styles/app.css`)

```css
:root {
  --sat: max(env(safe-area-inset-top, 0px), var(--shell-inset-top, 0px));
  --sar: max(env(safe-area-inset-right, 0px), var(--shell-inset-right, 0px));
  --sab: max(env(safe-area-inset-bottom, 0px), var(--shell-inset-bottom, 0px));
  --sal: max(env(safe-area-inset-left, 0px), var(--shell-inset-left, 0px));
}
#root { padding: var(--sat) var(--sar) var(--sab) var(--sal); box-sizing: border-box; min-height: 100dvh; }
html.in-android { -webkit-tap-highlight-color: transparent; overscroll-behavior: none; user-select: none; touch-action: manipulation; }
html.in-android [data-update-banner] { display: none; }   /* Play handles updates */
```

Why inject insets from native: a third-party guide reports that Android WebView before version 140 returned wrong `env(safe-area-inset-*)` values, and edge-to-edge cannot be turned off when targeting API 36. Taking the larger of the two values is safe on both old and new WebViews.

### Dark mode
- The app theme sets `isLightTheme=true`.
- Call `setAlgorithmicDarkeningAllowed(false)` and set `isForceDarkAllowed=false`.
- Add `<meta name="color-scheme" content="light">` to `index.html`.

### WebGL
- In `src/three/kit.ts`, listen for `webglcontextlost` on the canvas, call `preventDefault()`, and switch to the 2D garden map and bee journey.
- Low-end Android GPUs lose contexts more often than desktops. GPU problems can also bring down the renderer, which the native crash handling above covers.

### Service worker and update banner
- Skip registration when `IS_ANDROID_BUILD` (edit the `src/main.tsx` condition).
- Hide the "Update now" UI.

### Saving, sharing and printing (`src/app/platform.ts`)

```ts
if (IN_SHELL) { const s = await request('saveFile', { filename, mime: 'application/json', data }); return s === 'saved' ? 'saved' : s === 'cancelled' ? 'declined' : 'unavailable'; }
export const printPage = () => IN_SHELL ? void request('print', { jobName: 'MathBee worksheet' }) : window.print();
```

- Replace both `window.print()` calls with `printPage()`.
- Not verified: whether the WebView print path applies `@media print` rules. Chromium normally does, but the Android docs list "no CSS print attributes such as landscape". Check that print preview on the emulator hides the banners.
- Fallback if it does not work: a dedicated print route rendered without the app chrome.

### Parent gate
- Save, share, print, import and "Install voice" all leave the child space, or hand data to other apps.
- Keep them only in the parent area, behind the existing grown-up gate. This fits the Families Policy expectations.

## 10. Release checklist (shell-specific)

- **Target API 36.** New apps and updates must target it since Aug 31, 2026; extension requests run to Nov 1, 2026. compileSdk 37 matches the reference.
- **16 KB page size.** Required for updates from Feb 1, 2027. Apps that use only Kotlin or Java, with no `.so` files, already comply. After `bundleRelease`, check that `unzip -l app-release.aab | grep '\.so$'` prints nothing.
- **Build an AAB.** Minify and resource shrinking are on, and Play App Signing is enabled. The web payload is about 3.7 MB, so the bundle should stay under about 10 MB (estimate).
- **Families Policy:**
  - Set the target audience to ages 5–8.
  - The rule against "merely provides a webview of a website" does not apply: the content is original, bundled and offline.
  - Declare no ads, no AD_ID permission and no location.
  - A privacy policy URL is still required.
  - Data safety can say "no data collected or shared", because there is no INTERNET permission. JSON export is user-initiated and stays on the device.
- **Content rating.** Complete the IARC questionnaire.
- **Build commands (not run):**
  ```
  cd /Users/stalin/Downloads/claudegamemathbee && npm run build:android
  cd android && JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:assembleDebug   # or :app:bundleRelease
  ```
- **Testing:**
  - Playwright: `page.addInitScript` stubs `window.MathBeeAndroid` with a fake `postMessage`/`onmessage`, so the shell code paths run in CI (back map, speak, save, keepAwake).
  - Manual, on AVD `BuzzyPhone`, using `chrome://inspect` against the debug build:
    - Tamil voice present and absent.
    - Rotation.
    - Renderer kill: `adb shell am crash`, or kill the WebView sandbox process.
    - Back from every route.
    - Pausing during music.
    - Printing to PDF.
    - SAF save, then import.
    - Progress survives an app update (install the old version, then `adb install -r` the new one).

## 11. Not verified

1. Whether Vite rewrites absolute `<link href>` URLs in `index.html` when `base` is `/web/`.
2. Pinning KGP 2.4.20 under AGP 9's built-in Kotlin without the compose plugin.
3. The exact wording in the TextToSpeech docs about the `<queries>` TTS_SERVICE requirement.
4. Whether `visibilitychange` fires on `WebView.onPause()`, and whether `AudioContext` autoplays without a gesture when `mediaPlaybackRequiresUserGesture=false`.
5. Whether WebView print applies `@media print` styles.
6. Offline Tamil voice availability on typical devices.
7. Whether Auto Backup reliably includes the WebView's IndexedDB.
8. The claim that WebView before version 140 had wrong safe-area insets. Only a third-party guide says so.

## Sources
- Load local content / WebViewAssetLoader: https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- Managing WebView (onRenderProcessGone, renderer priority, Safe Browsing): https://developer.android.com/develop/ui/views/layout/webapps/managing-webview
- WebView dark theme / algorithmic darkening: https://developer.android.com/develop/ui/views/layout/webapps/dark-theme
- Printing HTML from WebView: https://developer.android.com/training/printing/html-docs
- SplashScreen API: https://developer.android.com/develop/ui/views/launch/splash-screen
- Edge-to-edge and immersive mode: https://developer.android.com/develop/ui/views/layout/edge-to-edge
- Android 16 behaviour changes (edge-to-edge opt-out removed, predictive back, large-screen orientation, game exemption): https://developer.android.com/about/versions/16/behavior-changes-16
- Play target API requirement: https://developer.android.com/google/play/requirements/target-sdk
- 16 KB page sizes: https://developer.android.com/guide/practices/page-sizes
- Families Policy: https://support.google.com/googleplay/android-developer/answer/9893335
- Safe-area / WebView 140 note (third party): https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/ and https://github.com/NiklasMerz/edge
- TextToSpeech `isLanguageAvailable` codes: https://learn.microsoft.com/en-us/dotnet/api/android.speech.tts.texttospeech.islanguageavailable
- Local reference: `/Users/stalin/Downloads/buzzy-spelling-garden/android/app/src/main/java/com/buzzy/spellbee/android/game/WebGameHost.kt`, `.../MainActivity.kt`, `.../ui/GameScreen.kt`, `/Users/stalin/Downloads/buzzy-spelling-garden/android/app/build.gradle.kts`, `/Users/stalin/Downloads/buzzy-spelling-garden/gradle/libs.versions.toml`