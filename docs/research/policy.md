# MathBee Coach on Google Play: publishing requirements for a children's WebView app (as of 31 October 2026)

This is a read-only report. I changed no files in `/Users/stalin/Downloads/claudegamemathbee`. I checked the codebase only to make the recommendations specific.

---

## 0. Summary

- MathBee is a good fit for the **Families program**: no ads, no purchases, no personal data, and no network calls in `index.html`, `src/` or `public/manifest.webmanifest`. The main risk is not data, it is the **WebView wrapper / minimum functionality** rule. Ship every asset inside the APK/AAB, load them through `WebViewAssetLoader`, and add real Android-native features.
- Hard technical gates for a new app today:
  - **targetSdk 36 (Android 16)**. This has been required since 31 August 2026, and the extension window ends 1 November 2026.
  - An **AAB** upload with **Play App Signing**.
  - **12 testers opted in for 14 consecutive days** of closed testing, if the developer account is a personal account created after 13 November 2023.
- **16 KB page size** does not apply to a pure Kotlin + system WebView app with no `.so` files. Verify this anyway with the APK Analyzer.
- You still need a **privacy policy URL** and a **Data safety form** ("no data collected"), even though the app collects nothing.

---

## 1. Families Policy (target audience 6–8)

Source: https://support.google.com/googleplay/android-developer/answer/9893335

**Target Audience and Content declaration** (Play Console > App content):
- Select only the age groups the app is designed for. For a Grade 1 child that is **"Ages 6–8"**. Consider adding **"Ages 5 & under"** only if it is truly suitable for preschoolers. The policy says apps for that group should select only "Ages 5 & Under", so mixing groups invites reviewer scrutiny.
- Google says the app's imagery and wording can override what you declare. A cartoon bee plus "Grade 1" clearly reads as a children's app, so declare it honestly as a **child-only app, not mixed audience**. That removes the need for a neutral age screen.

**Content**: everything must suit children. Social features need an online-safety reminder, adult controls, and adult action before any personal information is exchanged. Anonymous chat apps may not target children (added in the July 15, 2026 update).
- The "friends in the garden" feature: if these are in-game characters and not real users, say so clearly in the listing and the IARC answers, and do not tick "users interact".

**Identifiers**: apps that target only children must not transmit the AAID, SIM serial, Build serial, BSSID, MAC, SSID, IMEI or IMSI. With targetSdk 33 or higher they must not request `com.google.android.gms.permission.AD_ID`.
- Action: in `AndroidManifest.xml` add `<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>`. This guards against a library merging it in.

**Location**: no location permission, and no collecting, using or transmitting precise location.

**SDKs**: a child-only app may use only SDKs approved for child-directed services.
- Recommendation: **ship with no third-party SDKs at all**. That means no Firebase or Crashlytics and no analytics. Use only `androidx.webkit`, `androidx.core` and `androidx.appcompat`. If you need crash data, use Android vitals in Play Console, which needs no SDK.

**Ads**: none, so the Families Self-Certified Ads SDK rules do not apply. Answer **"No, my app does not contain ads"**.

**Legal**: you must comply with COPPA, GDPR and other applicable laws, including for any SDKs (see section 3).

**Accuracy**: the Target audience, Data safety and IARC answers must agree with each other and stay up to date.

**Permissions to declare in the shell**:
- None, ideally.
- Do not request `INTERNET` if everything is bundled. This is a strong "no data" signal.
  - Caveat: Android TTS voice downloads are handled by the system, not your app, so they do not need `INTERNET`. Confirm in testing.
  - Do not request `RECORD_AUDIO`, `CAMERA`, `READ_MEDIA_*` or `POST_NOTIFICATIONS`. The last one is optional; if you add a daily-gift reminder, it needs a parent opt-in.

---

## 2. Teacher Approved

Sources: https://google.play/business/programs/teacherapproved/ and the [TechCrunch launch coverage](https://techcrunch.com/?p=1974911)

**How apps get selected**:
- There is **no application form**. Apps that meet the Families requirements are queued for review automatically by teachers and children's media specialists, on an ongoing basis.
- Each update triggers a re-review.
- Inclusion is not guaranteed.
- A 2026 study notes that who the reviewers are is not disclosed ([summary](https://edtechpartnerships.substack.com/p/should-we-trust-teacher-approved)). I could not verify the panel's makeup.

**Benefits**: the badge, eligibility for the **Kids tab**, and a "why teachers like it" section on the listing.

**Rating criteria and how MathBee should answer each**:

| Criterion | What MathBee should do |
|---|---|
| **Audio and language** | High-quality voiceover. The device TTS for Tamil is often missing (`src/audio/speech.ts` falls back silently). **Pre-record EN + TA narration as bundled audio files** for the key prompts, so it does not depend on whatever TTS the device has. |
| **Usability** | Large touch targets (at least 48dp, ideally 64dp+ for 6-year-olds), no reading needed to navigate, consistent back behaviour. Map the Android back gesture to in-app navigation. |
| **Visuals** | High-quality, consistent art and animation, and keep the frame rate smooth on low-end devices (see section 7). |
| **Appeal / delight** | Combos, quests, gift and hats are good, but keep them non-manipulative, which the current ethics already ensure. |
| **Healthy development** | Clear learning goals per category. Show the parent the curriculum mapping (`docs/CURRICULUM_COVERAGE.md` is good material for the listing). |
| **Content appropriateness** | Nothing scary. |
| **Ads / IAP / cross-promotion** | None. This is a strong positive. Do not add "more apps from us" links. |

Recommendation: add a **parental gate** (for example "hold for 3 seconds" or a simple adult maths question) in front of:
- the parent dashboard,
- settings,
- the privacy policy link,
- any outbound link, such as "Rate us".

I found **no parental gate** in `src/screens/ParentScreens.tsx`. The policy does not strictly require one when there are no purchases or links, but reviewers expect it.

---

## 3. COPPA and GDPR-K for an app that collects nothing

**COPPA**: the amended rule took effect 23 June 2025, and compliance was due **22 April 2026**. It expands the definition of personal information, requires a written data-retention policy and security programme, and requires separate parental consent before sharing data for targeted ads ([Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule), [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches)). These are secondary summaries; I did not read the FTC's own text.
- If **nothing leaves the device** (no SDKs, no `INTERNET` permission, no persistent identifiers), you collect no "personal information" under COPPA, so parental consent is not triggered.
- Say exactly that in the privacy policy.
- The child's name or nickname and progress stored in IndexedDB/localStorage stay on the device, so they are not "collected".

**GDPR / GDPR-K (EU/UK; age of digital consent 13–16 depending on country)**: no processing by you means no controller obligations for that data. The UK **Age Appropriate Design Code** still expects high-privacy defaults, no nudge techniques, and no geolocation, all of which the app already satisfies. This is general knowledge, not checked against an official source this session.

**US state app-store age laws (Texas, Utah, Louisiana; California from 1 January 2027)**: Google's **Play Age Signals API** exists for these laws. An app with no age-gated features, no accounts and no data has little to act on. The legal status is shifting (Texas injunction and stay), so treat this as **not verified**: monitor it, but no integration is needed for v1 ([Google help](https://support.google.com/googleplay/android-developer/answer/16569691), [FPF comparison](https://fpf.org/blog/comparing-enacted-app-store-accountability-acts/)).
- If you ever use Age Signals, its data may be used only for age-appropriate experiences. That rule took effect 1 January 2026 ([announcements](https://support.google.com/googleplay/android-developer/announcements/13412212?hl=en)).

---

## 4. Data safety form (fully offline app)

Source: https://support.google.com/googleplay/android-developer/answer/10787469

- The form is **required even if no data is collected**, and it requires a privacy policy link.
- "Collection" means sending data off the device. Data processed only on the device does not need to be disclosed.

**Suggested answers**:

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all user data encrypted in transit? | Not applicable (nothing is transmitted). If the form forces an answer, answer accurately for a no-network app. |
| Account creation | None, so no data-deletion URL is required |
| Independent security review | Optional, skip |

If you later add crash reporting, analytics or cloud backup, you **must** revise these answers, and the Families SDK rules then apply.

---

## 5. Privacy policy (required even with no data)

The App content section requires a **public URL**, linked from the store listing **and inside the app** ([Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)).

What it should contain:
- Who you are, with a contact email.
- A statement that the app collects, stores off-device and shares **no personal information**.
- That progress is stored only on the device (IndexedDB/localStorage), with no accounts, ads, analytics, third-party SDKs or network access.
- That the device's text-to-speech engine is used locally.
- How a parent deletes data: uninstall the app or clear its data, plus an in-app "Reset progress" behind the parental gate.
- A COPPA statement.
- The date.

Hosting:
- You can host it on your existing Coolify deployment (for example `/privacy.html`) or on GitHub Pages.
- Also **bundle a copy in the app** (for example `public/privacy.html`), so the in-app link works offline and needs no `INTERNET` permission.

---

## 6. IARC content rating

Source: https://support.google.com/googleplay/android-developer/answer/9898843

- Required. Unrated apps are removed. It is free, and you complete it in Play Console.
- Category: **"Game"** or **"Reference, News, or Educational"**. It is an educational game, so choose the category that matches how you list it. Use **Education** as the store category, which affects Teacher Approved and Kids tab placement.
- Answers: no violence, fear, sex, language, drugs or gambling. **No user interaction / no sharing of info / no location sharing / no digital purchases.**
- Expected results: **Everyone / PEGI 3 / USK 0**.
- Resubmit whenever the content changes.

---

## 7. Technical requirements

| Requirement | Status / action |
|---|---|
| **Target API** | New apps and updates must target **API 36 (Android 16)** since 31 August 2026; extensions run to 1 November 2026 ([source](https://developer.android.com/google/play/requirements/target-sdk)). Set `compileSdk = 36` (or 37) and `targetSdk = 36`. Choose `minSdk` 24–26 so the WebView is recent enough for ES2020+, WebGL (three.js), IndexedDB and Web Audio. |
| **16 KB page size** | Applies only to apps with native code. Pure Kotlin/Java apps already comply. The enforcement date for updates shown on the page is **1 February 2027** ([source](https://developer.android.com/guide/practices/page-sizes)). Check that the APK has no `lib/*.so` (Build > Analyze APK). |
| **AAB** | Upload an Android App Bundle. AAB has been mandatory for new apps since August 2021; the help page I fetched did not restate this. versionCode must increase on every upload, up to a maximum of 2,100,000,000 ([source](https://support.google.com/googleplay/android-developer/answer/9859152)). |
| **Play App Signing** | Accept its terms when creating the app, and let Google generate the app signing key. Keep your **upload keystore** backed up offline, outside the git repository. |
| **Size** | `dist` is about 3.8 MB, far below every limit, so no asset packs are needed. |
| **Developer verification** | Google is rolling out mandatory developer identity verification. User-facing enforcement starts in some countries on 30 September 2026 and goes global in 2027 ([Android Authority](https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/)). Complete identity verification in Play Console. I did not confirm this on an official Google page. |

---

## 8. Avoiding a "WebView wrapper" or "minimum functionality" rejection

**Policies at stake**:
- **Spam**: Play bans apps whose main purpose is to "provide a webview of a website without permission" ([source](https://support.google.com/googleplay/android-developer/answer/9899034?hl=en)).
- **Minimum functionality**: Play bans apps with limited functionality and content, and apps that crash, freeze or don't respond ([source](https://support.google.com/googleplay/android-developer/answer/9898783?hl=en)).
- The Families policy separately says apps must not "merely provide a webview of a website".
- Google's own advice: build features users can't get on the web ([blog](https://android-developers.googleblog.com/2020/10/developer-tips-and-guides-common-policy.html?hl=en)).
- A Spam/Minimum Functionality update about baseline functionality was announced (dated July 2026 in one search result, July 2024 in another); I could not read its text, so this is **unverified**.

**Actions for MathBee**:

1. **Bundle everything offline.**
   - Copy the Vite `dist/` into `app/src/main/assets/www/`.
   - Serve it with `androidx.webkit.WebViewAssetLoader` at `https://appassets.androidplatform.net/assets/www/index.html`. Do not use `file://` ([source](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)).
   - Set `allowFileAccessFromFileURLs` and `allowUniversalAccessFromFileURLs` to false.
   - Never load the Coolify URL.

2. **Add an Android build mode** (similar to `IS_ARTIFACT` in `src/app/platform.ts`), for example `MODE === 'android'`:
   - **Skip service worker registration** (`src/main.tsx:22`, which registers the absolute path `/sw.js`). An absolute path breaks under the `/assets/www/` prefix, and the SW is pointless when the APK already holds every file.
   - Set Vite `base: './'` (or `/assets/www/`) in `vite.config.ts` for that mode.
   - Replace `window.print()` (`src/screens/TestScreens.tsx:244`, `src/screens/ParentScreens.tsx:44`) with a JS bridge to Android `PrintManager` through `WebView.createPrintDocumentAdapter`. A plain `window.print()` does nothing in a WebView.

3. **Persistence**:
   - Enable `domStorageEnabled = true`. IndexedDB is on by default.
   - Note that clearing app data wipes progress.
   - Optionally add an export/import of progress via the Storage Access Framework, behind the parental gate. That is a genuine native feature and needs no permissions.

4. **Native features that show the app is more than a wrapper**:
   - Adaptive launcher icon and splash screen (`androidx.core:core-splashscreen`).
   - Immersive full-screen mode.
   - Screen orientation locked to landscape or portrait.
   - Native handling of the system **back** gesture (`OnBackPressedDispatcher` passes it to the web app's navigation, with no accidental exit).
   - Native `TextToSpeech` bridge with en-IN / ta-IN voice checks and a prompt to install the Tamil voice, or better, bundled recorded audio.
   - Haptics through `Vibrator` for correct answers. This needs no runtime permission (`VIBRATE` is a normal permission).
   - Audio focus handling, so music pauses on `onPause` and during calls.
   - Optional daily-gift **notification** that is off by default and switched on by a parent; this needs `POST_NOTIFICATIONS`. Optional home-screen **widget** for the garden.
   - Print through PrintManager.
   - Per-app language support for English and Tamil (`android:localeConfig`, so Android 13+ shows the language in the system settings).

5. **Lock down the WebView**:
   - `shouldOverrideUrlLoading` blocks or opens externally any non-`appassets` URL, behind the parental gate.
   - Turn off `setWebContentsDebuggingEnabled` in release builds.
   - Set `onRenderProcessGone` to recreate the WebView instead of crashing, which supports the minimum-functionality "no crashes" rule.

6. **Performance on cheap devices** (many children use hand-me-down phones):
   - Test three.js scenes on a 2–3 GB RAM Android Go-class device.
   - Respect `prefers-reduced-motion`, which the app already does.
   - Provide a 2D fallback if WebGL context creation fails.
   - Watch **Android vitals** for ANR and crash rates, because bad vitals reduce visibility.

---

## 9. Store listing assets

Main source: https://support.google.com/googleplay/android-developer/answer/9866151

| Asset | Spec |
|---|---|
| App icon | **512×512** 32-bit PNG with alpha, at most 1024 KB |
| Feature graphic | **1024×500** JPEG or 24-bit PNG, no alpha |
| Phone screenshots | JPEG or 24-bit PNG, sides 320–3840 px, aspect ratio no more than 2:1. Recommended: at least 3–4 shots at 1080×1920 (9:16) or 1920×1080 (16:9). Play allows 2–8 per device type; that count is from general knowledge, not verified this session. |
| 7" / 10" tablet and Chromebook | At least 4 screenshots each, 1080–7680 px, 16:9 or 9:16. **Supply these**: kids use tablets a lot, and the Kids tab favours large-screen-ready apps. |
| Preview video | YouTube URL, public or unlisted, not age-restricted, monetisation off; the first 30 seconds autoplay |
| Short description | **80 characters** |
| App name | **30 characters** (general knowledge, not on the fetched page) |
| Full description | **4000 characters** (general knowledge, not on the fetched page) |

**Listing guidance**:
- Screenshots must show the real app.
- No "best", "#1" or award claims, and no misleading badges (Deceptive Behavior policy, [source](https://support.google.com/googleplay/android-developer/answer/9888077)).
- Add a **Tamil (ta-IN) localized listing** alongside en-US and en-IN.
- Category: **Education**. Tags: Math, Kids, Educational games.
- Contact email is required; a website is optional.
- Name suggestion that fits in 30 characters: "MathBee: Number Garden" (22 characters).

---

## 10. Closed testing for a new personal account

Source: https://support.google.com/googleplay/android-developer/answer/14151465

- Personal accounts created after 13 November 2023 must run a closed test with **at least 12 testers opted in continuously for 14 consecutive days**. A tester who opts out and back in does not count.
- Then apply for production from the Dashboard. Review usually takes 7 days or less.
- Organisation accounts are exempt.
- Tips:
  - Recruit about 15–20 testers, meaning parents with real Android devices, so dropouts don't reset the 14-day clock.
  - Ship 2–3 updates during the test.
  - Collect feedback, because the production application asks what you learned.
- Use an **internal testing** track first for quick checks; it needs no Data safety form.

---

## 11. Release checklist

**Account**
- [ ] Play Console developer account: identity verification done, D-U-N-S number if it is an organisation account (an organisation account skips the 12-tester rule).
- [ ] Payments profile is not needed (free app).

**Shell app (Kotlin)**
- [ ] New `android/` Gradle project: `applicationId` (for example `com.<you>.mathbee`), compileSdk 36+, **targetSdk 36**, minSdk 24–26, Kotlin + `androidx.webkit`.
- [ ] Vite `android` mode: SW disabled, `base: './'`, print bridge, back-button bridge, TTS bridge. Copy `dist/` to `app/src/main/assets/www/`.
- [ ] `WebViewAssetLoader`, file access off, external navigation blocked, release build not debuggable, render-process-gone handled.
- [ ] Manifest: no `INTERNET` (if feasible), AD_ID removed with `tools:node="remove"`, no location/camera/mic. Check the merged manifest.
- [ ] Adaptive icon, splash screen, immersive mode, orientation, `localeConfig` (en, ta), haptics, audio focus.
- [ ] Parental gate on the parent area, settings, reset, privacy link and any outbound link.
- [ ] Bundled recorded EN/TA narration (strongly recommended).
- [ ] APK Analyzer: no `lib/*.so` (16 KB not applicable). R8/minify on, with ProGuard rules for `@JavascriptInterface`.
- [ ] Release AAB signed with the upload key, and the keystore backed up.

**Quality**
- [ ] Existing vitest + Playwright suites pass on the `android` build.
- [ ] Device matrix: low-end phone, mid-range phone, 10" tablet, Android 8 through 16, and a 16 KB emulator image for regression.
- [ ] Offline (airplane mode) first launch works. Progress survives app kill and reboot. No crashes or ANRs. Pre-launch report in Play Console is clean.
- [ ] TalkBack sanity pass, touch targets of at least 48dp, colour contrast.

**Play Console: App content**
- [ ] Privacy policy URL, hosted and also bundled in the app.
- [ ] Ads: **No**.
- [ ] App access: all functionality available without login.
- [ ] Target audience: **6–8** (child-only), Families policy acknowledged.
- [ ] Data safety: **No data collected or shared**.
- [ ] IARC questionnaire: Education/Game, no interaction or purchases.
- [ ] Government apps / financial features / health: No.
- [ ] Category Education; contact email.

**Store listing**
- [ ] Icon 512, feature graphic 1024×500, at least 4 phone screenshots, at least 4 tablet screenshots (7" and 10"), optional preview video.
- [ ] Name (30 characters or fewer), short description (80 or fewer), full description (4000 or fewer). en-US, en-IN and ta-IN translations.
- [ ] No unverifiable claims ("award-winning", "#1").

**Testing and launch**
- [ ] Internal test, then closed test with **12+ testers for 14 consecutive days**, then apply for production.
- [ ] Staged rollout (for example 20% → 50% → 100%) and watch Android vitals.
- [ ] After launch: keep shipping updates (each one triggers a Teacher Approved re-review), meet each yearly target-API deadline, and re-check the Data safety and IARC answers whenever features change.

---

## Things I could not verify

- The exact text and date of the most recent Spam/Minimum Functionality "baseline functionality" update.
- The current App name (30) and full description (4000) limits, and the 2–8 screenshot count, on an official page. These are from general knowledge.
- The official Google wording for the developer verification timeline (only secondary sources).
- Who sits on the Teacher Approved review panel.
- How the US state app-store age laws currently stand in court (Texas litigation is ongoing).
- That the AAB requirement is still stated on the fetched page.
- Whether Android TTS works with no `INTERNET` permission on every OEM build. Test this on real devices.