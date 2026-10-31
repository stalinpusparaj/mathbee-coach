# Number Garden: Google Play listing (1.0)

Ready-to-paste store text for Play Console, in three listing languages: English (India) `en-IN` as the default, English (US) `en-US`, and Tamil `ta-IN`. It is based on the competitor, keyword and policy research of 2026-10-31.

**How counts were made.** Every limited field below was counted with Python `len()`, which counts Unicode code points. That matches Play Console for English. Tamil vowel signs are separate code points, so the Tamil counts here are the highest Play Console could show; it may show the same number or less. Every field is within its limit.

**Before you paste, three checks:**
1. **Name.** Decided: the app is released as **Number Garden** (see section 1). "MathBee" is Bhanzu's contest brand, so it is not used in the store listing or anywhere users see it. The listing also says the app is not affiliated with any contest.
2. **Tamil text.** All Tamil here is a developer draft. A native Tamil speaker, ideally a primary teacher, should read it before it goes live. Do not rely on Play's machine translation for Tamil; this hand-written text is what Tamil parents should see. The app's own Tamil strings are also still drafts (see `docs/KNOWN_LIMITATIONS.md`).
3. **Facts.** Every claim below is a feature that exists in the 1.0 build (README, `docs/BUILD_PLAN.md`, `src/adventure/levels.ts`, `src/flight/questions.ts`). Re-check this list if a feature is cut before release. The text also states two limits openly: the parent report and worksheets are in English, and Tamil speech needs a Tamil voice installed on the phone.

---

## 1. Title and short description

Play rules followed: the title is 30 characters or fewer and contains no "Free", "No Ads", "Best", "#1", emoji or capitals used for emphasis. The short description has no emoji or symbols and no repeated punctuation.

### Titles

**Decision (31 Oct 2026): the app ships as "Number Garden".** "MathBee" is Bhanzu's contest brand and Bhanzu's app ranks first for "mathbee", so the brand-safe name is used everywhere users see it (store, launcher label, title screen, privacy policy). The package ID `com.stalinpusparaj.mathbee` is never shown to users and stays.

| Locale | Title | Chars | Why |
|---|---|---|---|
| en-IN (default) | `Number Garden: Class 1 Maths` | 28 | "Class 1 maths" is how Indian parents search for Grade 1 (demand 4/5, medium competition, held only by textbook-answer and CBSE PDF apps, not by games). "Maths" uses the Indian spelling. |
| en-US | `Number Garden: 1st Grade Math` | 29 | "1st grade math" is the main US phrasing, with US spelling. |
| ta-IN | `எண் தோட்டம்: கணக்கு விளையாட்டு` | 30 | The app's Tamil name ("Number Garden") plus "maths game". The longer "1ஆம் வகுப்பு கணக்கு" version does not fit in 30 characters with the Tamil brand. |

**Alternates**

| Title | Chars | When to use |
|---|---|---|
| `Number Garden: Grade 1 Maths` | 28 | en-IN option that reads more easily outside India. Try it in the title experiment (section 8). |

### Short descriptions (80 characters max)

**en-IN**
```text
Class 1 maths games in English and Tamil. Offline, no ads, no in-app purchases.
```

**Characters: 79 / 80**

Rationale: "Class 1 maths games" adds the plural game phrase that the title does not carry. "English and Tamil" names the gap that no rival fills. The trust facts come at the end, which follows the Khan Academy Kids pattern. "No ads" is allowed in the short description; only the title and developer name may not use it.

**en-US**
```text
1st grade math adventure for ages 5-7: count, add, tell time. Offline, no ads.
```

**Characters: 78 / 80**

Rationale: it gives the age band ("ages 5-7", which almost no rival uses) and three real skills, then ends with trust facts. It does not repeat "Tamil", because US parents search for "offline" and "no ads".

**ta-IN**
```text
1ஆம் வகுப்பு கணக்கு விளையாட்டு தமிழில். இணையம் தேவையில்லை, விளம்பரம் இல்லை.
```

**Characters: 75 / 80**

Meaning: "Class 1 maths game in Tamil. No internet needed, no ads." It uses கணக்கு (sums), the word Tamil parents actually search for.

**en-IN alternate for the experiment:**
```text
Grade 1 maths adventure: counting, adding, clocks and shapes. Offline, no ads.
```

**Characters: 78 / 80**

---

## 2. Full descriptions (4,000 characters max)

All three descriptions open with what the app is and who it is for, because many people read only the first lines. Each skill is named once, the main keywords appear two or three times at most, and there are no testimonials and no "best", "#1", "award", "Teacher Approved" or "free". None of them repeats its short description word for word. The bullet character (•) is plain text and is allowed.

### en-IN (default listing)
```text
Number Garden turns Class 1 maths into a gentle garden adventure for children aged 5 to 7. Your child helps Buzzy the bee bring a garden back to life by solving Grade 1 maths questions, with instructions spoken aloud in English or Tamil. It is made for families who want calm maths games for kids, with nothing to buy and nothing to distract.

What your child practises
• Counting, numbers and sequences to 100, plus skip counting
• Comparing sizes and lengths, making pairs and sorting
• Addition within 20, make ten (number bonds to 10) and subtraction
• Flat and solid shapes
• Telling the time: o'clock, half past and quarter past
• Days of the week and reading a calendar
• Simple word problems

Adventure mode
• 81 levels in 7 painted worlds, including 2 bonus levels
• Each level is a short set of 5 to 8 questions, and a finished level blooms 1 to 3 flowers
• Hints never cost flowers, so asking for help is always fine
• Every world ends with a party at a new friend's house
• A wrong answer gets a gentle wobble, never a buzzer or a red cross, and nothing is timed

Bee Flight
Steer Buzzy through answer gates in a calm flying game (3D where the device supports it): counting, comparing, adding, make ten, doubles, taking away, skip counting, patterns, shapes, clocks and days. There is no speed pressure.

A garden that grows
• Earn nectar to restore the garden, then look around it in 3D (or a flat view on low-memory phones)
• Collect 30 stickers and unlock hats for the bee
• Three small daily quests and one surprise gift a day, and missing a day costs nothing

For parents (behind a parent gate)
• A parent dashboard with a skill report and ideas to try at home
• Spaced review brings earlier skills back for practice, and follow-up questions adjust to your child's answers
• Printable worksheets with answer pages, and practice tests
• An optional daily play limit of 15, 20 or 30 minutes, checked only between levels
• Back up progress to a file
The parent report and worksheets are in English.

Privacy and safety
• No ads and no in-app purchases
• Works fully offline, so no internet is needed
• No account, no sign-up and no data collected, and the Android app asks for no permissions
• Speech uses your phone's own text-to-speech voices. For Tamil speech, install a Tamil voice on the phone; without one, the app shows the Tamil text.

Number Garden is an independent app. It is not affiliated with any maths competition, school board or publisher.
```

**Characters: 2488 / 4000**

### en-US
```text
Number Garden turns first grade math into a gentle garden adventure for kids aged 5 to 7, from the end of kindergarten through 1st grade. Your child helps Buzzy the bee bring a garden back to life by solving math problems, with instructions read aloud in English or Tamil. It is made for families who want calm math games for kids, with nothing to buy and nothing to distract.

What your child practices
• Counting, numbers and sequences to 100, plus skip counting
• Comparing sizes and lengths, making pairs and sorting
• Addition within 20, make ten (number bonds to 10) and subtraction
• 2D and 3D shapes
• Telling time: o'clock, half past and quarter past
• Days of the week and reading a calendar
• Simple word problems

Adventure mode
• 81 levels in 7 painted worlds, including 2 bonus levels
• Each level is a short set of 5 to 8 questions, and a finished level blooms 1 to 3 flowers
• Hints never cost flowers, so asking for help is always fine
• Every world ends with a party at a new friend's house
• A wrong answer gets a gentle wobble, never a buzzer or a red X, and nothing is timed

Bee Flight
Steer Buzzy through answer gates in a calm flying game (3D where the device supports it): counting, comparing, adding, make ten, doubles, taking away, skip counting, patterns, shapes, clocks and days. There is no speed pressure.

A garden that grows
• Earn nectar to restore the garden, then look around it in 3D (or a flat view on low-memory devices)
• Collect 30 stickers and unlock hats for the bee
• Three small daily quests and one surprise gift a day, and missing a day costs nothing

For parents (behind a parent gate)
• A parent dashboard with a skill report and ideas to try at home
• Spaced review brings earlier skills back for practice, and follow-up questions adjust to your child's answers
• Printable worksheets with answer pages, and practice tests
• An optional daily play limit of 15, 20 or 30 minutes, checked only between levels
• Back up progress to a file

Privacy and safety
• No ads and no in-app purchases
• Works fully offline, so it's fine for car trips and tablets without Wi-Fi
• No account, no sign-up and no data collected, and the Android app asks for no permissions
• Speech uses your device's own text-to-speech voices

Bilingual families: every child screen is also available in Tamil. Tamil speech needs a Tamil voice installed on the device; without one, the app shows the Tamil text. The parent report and worksheets are in English.

Number Garden is an independent app. It is not affiliated with any math competition, school or publisher.
```

**Characters: 2603 / 4000**

### ta-IN (Tamil, needs native review)
```text
எண் தோட்டம், 5 முதல் 7 வயது வரை உள்ள குழந்தைகளுக்கான மென்மையான கணக்கு சாகசம். Buzzy என்ற தேனீயுடன் சேர்ந்து 1ஆம் வகுப்பு கணக்குகளைத் தீர்த்து, ஒரு தோட்டத்தை மீண்டும் மலரச் செய்யலாம். வழிமுறைகள் தமிழிலும் ஆங்கிலத்திலும் குரலில் சொல்லப்படும்.

உங்கள் குழந்தை பயிற்சி செய்பவை
• எண்ணுதல், 1 முதல் 100 வரை எண்கள், தாவி எண்ணுதல்
• அளவு, நீளம் ஒப்பிடுதல், ஜோடி சேர்த்தல், வகைப்படுத்துதல்
• 20 வரை கூட்டல், பத்து சேர்த்தல் (make ten), கழித்தல்
• தட்டை வடிவங்களும் திட வடிவங்களும்
• கடிகாரத்தில் நேரம் சொல்லுதல்: 3 மணி, மூன்றரை மணி, மூன்றே கால் மணி போன்றவை
• வாரத்தின் நாட்கள், நாள்காட்டி
• எளிய கதைக் கணக்குகள்

சாகசப் பயணம்
• 7 வண்ண உலகங்களில் 81 நிலைகள் (2 சிறப்பு நிலைகள் உட்பட)
• ஒவ்வொரு நிலையிலும் 5 முதல் 8 கேள்விகள்; நிலையை முடித்தால் 1 முதல் 3 பூக்கள் மலரும்
• உதவிக் குறிப்பு பார்த்தால் பூக்கள் குறையாது
• ஒவ்வொரு உலகத்தின் முடிவிலும் ஒரு புதிய நண்பரின் வீட்டில் விருந்து
• தவறான விடைக்கு மென்மையான அசைவு மட்டும்; சத்தமோ சிவப்புக் குறியோ இல்லை, நேரக் கட்டுப்பாடும் இல்லை

தேனீ பறப்பு (Bee Flight)
Buzzy-யைச் சரியான விடை வாயில்கள் வழியாகப் பறக்கச் செய்யும் அமைதியான விளையாட்டு (ஆதரிக்கும் போன்களில் 3D): எண்ணுதல், ஒப்பிடுதல், கூட்டல், பத்து சேர்த்தல், இரட்டிப்பு, கழித்தல், தாவி எண்ணுதல், அமைப்புகள், வடிவங்கள், கடிகாரம், நாட்கள். வேகமாக விளையாட வேண்டிய அவசியம் இல்லை.

வளரும் தோட்டம்
• தேன் சேர்த்து தோட்டத்தைப் புதுப்பிக்கலாம், அதை 3D-யில் சுற்றிப் பார்க்கலாம் (நினைவகம் குறைந்த போன்களில் சாதாரணப் படமாக)
• 30 ஸ்டிக்கர்கள், தேனீக்குப் புதிய தொப்பிகள்
• தினமும் மூன்று சிறு சவால்கள், ஒரு ஆச்சரியப் பரிசு; ஒரு நாள் விளையாடாவிட்டாலும் எதுவும் இழப்பில்லை

பெற்றோருக்கு (பெற்றோர் மட்டும் திறக்கக்கூடிய பகுதி)
• திறன் அறிக்கையுடன் பெற்றோர் பக்கம், வீட்டில் செய்யக்கூடிய யோசனைகள்
• முன்பு கற்ற திறன்களுக்கு இடைவெளி விட்டு மீண்டும் பயிற்சி; குழந்தையின் விடைகளுக்கு ஏற்பத் தொடர் கேள்விகள்
• விடைகளுடன் அச்சிடக்கூடிய பயிற்சித் தாள்கள் (worksheets), மாதிரித் தேர்வுகள்
• விருப்பப்பட்டால் தினசரி விளையாட்டு நேர வரம்பு: 15, 20 அல்லது 30 நிமிடம் (நிலைகளுக்கு இடையில் மட்டுமே சரிபார்க்கப்படும்)
• முன்னேற்றத்தை ஒரு கோப்பாகச் சேமிக்கலாம்
பெற்றோர் அறிக்கையும் பயிற்சித் தாள்களும் தற்போது ஆங்கிலத்தில் உள்ளன.

பாதுகாப்பும் தனியுரிமையும்
• விளம்பரம் இல்லை, செயலிக்குள் பணம் செலுத்தி வாங்க எதுவும் இல்லை
• இணையம் இல்லாமலும் முழுமையாக இயங்கும்
• உள்நுழைவு (login), பதிவு எதுவும் தேவையில்லை; எந்தத் தகவலும் சேகரிக்கப்படுவதில்லை; Android செயலி எந்த அனுமதியும் (permission) கேட்பதில்லை
• குரல் உங்கள் போனில் உள்ள text-to-speech குரலைப் பயன்படுத்தும். தமிழில் கேட்க, போனில் தமிழ்க் குரலை நிறுவுங்கள்; தமிழ்க் குரல் இல்லையென்றால் தமிழ் எழுத்தில் மட்டும் காட்டப்படும்.

எண் தோட்டம் ஒரு சுயாதீனச் செயலி. இதற்கு எந்தக் கணிதப் போட்டி, பள்ளி வாரியம் அல்லது பதிப்பகத்துடனும் தொடர்பு இல்லை.
```

**Characters: 2677 / 4000**

Notes on the Tamil wording:
- கணக்கு (sums) is the everyday parent word and the search term, so it is used throughout. The more formal கணிதம் is used only in "கணிதப் போட்டி" (maths competition).
- கூட்டல் (addition), கழித்தல் (subtraction), எண்கள் (numbers), வடிவங்கள் (shapes), கடிகாரம் (clock), வாரத்தின் நாட்கள் (days of the week) and நாள்காட்டி (calendar) are the Samacheer-style terms from the keyword research.
- "தாவி எண்ணுதல்" for skip counting and "பத்து சேர்த்தல்" for make ten are the reviewer's call. Some teachers say "இடைவிட்டு எண்ணுதல்" for skip counting. Use whatever the reviewer prefers, and use the same word in the app.
- English terms a parent may know from school (worksheets, make ten, Bee Flight, text-to-speech) are given in brackets or left in Latin script.

---

## 3. Category and tags

**App or game:** App. **Category:** Education.

Why Education and not Games > Educational: parents looking for learning apps browse Education, and Google's own description of the Education category lists "educational games". The app's rivals for "class 1 maths" and "1st grade math" are learning apps. The parent dashboard, worksheets and curriculum coverage also fit Education. Games > Educational would put the app up against arcade-style games and offer a different set of tags.

**Tags** (Play Console > Grow users > Store presence > Store settings > Manage tags). These come from the Education tag list. Play Console's live list is the final word, so confirm them there.

| # | Tag | Reason |
|---|---|---|
| 1 | Mathematics | Every level is maths. This is the tag anyone would agree with straight away. |
| 2 | Primary education | Grade 1 / Class 1 is primary school, and the app covers that year's topics (clocks, calendar, number to 100, word problems). |
| 3 | Early childhood education | Ages 5 to 7 include the last year before Class 1. The counting, comparing and shapes levels are early-years skills. |
| 4 | Education | The broad parent tag, matching the category. |
| 5 | *(leave empty)* or a kids/children tag only if Console offers one | Do **not** use "Test preparation". Practice tests are a small, parent-gated feature, and Play asks for tags most obviously tied to the app. Do not use "Language education": the app is not for learning a language, and that tag could also affect Teacher Approved review, which excludes language-learning apps. |

**Families setup to match this listing:** set the Target audience to the age groups that cover 5 to 7 (Play's bands are "5 and under" and "6-8"). Set Data safety to "No data collected" (true for this build: no permissions, no SDKs that send data, no `AD_ID`). Complete the IARC content rating. Add the privacy policy URL (the GitHub Pages copy of `public/privacy.html`). Before publishing, change the policy's age line, which currently says the app is "designed for children aged 6–8", to "5 to 7" so it matches this listing and the Target audience answer; Play compares them. Set the developer name in Play Console to GEM CREATORS, the name the policy uses. Do not mention "Teacher Approved" anywhere. Review happens automatically after publishing, and only the English listing counts for it.

---

## 4. Screenshots and feature graphic

Eight phone screenshots, 1080 × 1920, with real app screens and no device frames. Caption overlays cover less than 20% of each image. Use a clean status bar. Make a separate Tamil-captioned set for `ta-IN`, with the app set to Tamil. Supply at least 4 tablet screenshots (768 × 1024 layout) as well. The existing art in `docs/store/` (`screenshot-bg-1080x1920.jpg`) can be the caption band background.

| # | Screen to capture | EN caption | TA caption |
|---|---|---|---|
| 1 | Welcome screen with Buzzy, Play and Continue | Grade 1 maths in a bee garden (7 words, 29 chars) | தேனீ தோட்டத்தில் 1ஆம் வகுப்பு கணக்கு (5 words, 36 chars) |
| 2 | Adventure: the 7 world cards | 7 worlds, 81 gentle levels (5 words, 26 chars) | 7 உலகங்கள், 81 நிலைகள் (4 words, 22 chars) |
| 3 | One world's winding map of flower buds | Every finished level blooms flowers (5 words, 35 chars) | ஒவ்வொரு நிலையும் பூக்களாக மலரும் (4 words, 32 chars) |
| 4 | A question (e.g. make ten or a clock) with the celebration burst | Count, add, subtract and tell time (6 words, 34 chars) | எண்ணு, கூட்டு, கழி, நேரம் பார் (5 words, 30 chars) |
| 5 | Bee Flight mid-run with answer gates | Fly Buzzy through the right answer (6 words, 34 chars) | சரியான விடை வழியே பறந்திடு (4 words, 26 chars) |
| 6 | 3D garden with friends round the pond | Restore your own 3D garden (5 words, 26 chars) | உன் 3D தோட்டத்தை மலரச் செய் (5 words, 27 chars) |
| 7 | Sticker book page and the bee hat picker | Collect stickers and bee hats (5 words, 29 chars) | ஸ்டிக்கர்களும் தேனீத் தொப்பிகளும் சேர் (4 words, 38 chars) |
| 8 | Parent dashboard skill report (after the gate) | Skill report for parents. No ads. (6 words, 33 chars) | பெற்றோருக்கு திறன் அறிக்கை. விளம்பரம் இல்லை. (5 words, 44 chars) |

Order notes:
- Frames 1 to 3 show real UI and the strongest promise, because most people see only the first three.
- Frame 4 should show a skill that parents recognise as school work. Use a clock to quarter past, or a make-ten question, caught at the moment the celebration burst plays.
- Frame 8 is the trust frame. "No ads." is a plain fact, so it is allowed. Do not add "Free", "Download now", "New", "Best" or "#1" to any frame.
- For the en-US set, change frame 1 to "Grade 1 math in a bee garden" (7 words, 28 chars). The other EN captions work as they are.

**Feature graphic** (1024 × 500). The current file, `docs/store/feature-graphic-1024x500.png`, has no text. If you add an overlay, keep it in the centre and away from the edges, which may be cropped:

| Option | Text | Chars |
|---|---|---|
| EN, recommended | `Grade 1 maths in a bee garden` | 29 |
| EN, alternate | `Count, add and tell time with Buzzy` | 35 |
| TA | `தேனீ தோட்டத்தில் 1ஆம் வகுப்பு கணக்கு` | 36 |

Leaving it without text is also fine and avoids making a Tamil version.

Feature graphic alt text (140 characters max, must not start with "image of"):
```text
Buzzy the bee flies over a flower garden where a rabbit, frog, squirrel, penguin, hedgehog and owl wave hello
```

**Characters: 109 / 140**

---

## 5. What's new (release notes, 500 characters max)

**en-IN and en-US**
```text
First release. 81 levels across 7 garden worlds, the Bee Flight mini-game, a 3D garden to restore, stickers, bee hats, daily quests and a parent area with a skill report and printable worksheets. Plays in English and Tamil, fully offline.
```

**Characters: 238 / 500**

**ta-IN**
```text
முதல் வெளியீடு. 7 தோட்ட உலகங்களில் 81 நிலைகள், Bee Flight பறக்கும் விளையாட்டு, புதுப்பிக்க 3D தோட்டம், ஸ்டிக்கர்கள், தேனீத் தொப்பிகள், தினசரி சவால்கள், திறன் அறிக்கையும் அச்சிடும் பயிற்சித் தாள்களும் கொண்ட பெற்றோர் பகுதி. தமிழிலும் ஆங்கிலத்திலும், இணையம் இல்லாமலும் இயங்கும்.
```

**Characters: 275 / 500**

---

## 6. Keyword map

| Keyword | Locale | Title | Short desc. | Full desc. | Other |
|---|---|---|---|---|---|
| Number Garden (brand) | all | yes | — | opening + closing line | icon, feature graphic |
| Class 1 maths | en-IN | yes | yes ("Class 1 maths games") | opening sentence | experiment variant |
| Grade 1 maths | en-IN | alternate | alternate short | opening paragraph | screenshot 1, feature graphic |
| maths games for kids / math games for kids | en-IN / en-US | — | "maths games" (en-IN) | opening paragraph, once | YouTube/Instagram captions |
| 1st grade math / first grade math | en-US | yes | yes | opening sentence | — |
| kindergarten | en-US | — | — | opening sentence, once | — |
| ages 5-7 / aged 5 to 7 | all | — | en-US | opening sentence | — |
| English and Tamil / Tamil | en-IN, en-US | — | en-IN | opening + bilingual note | screenshot set for ta-IN |
| offline / no internet | all | — | all three | privacy section | screenshot 8 option |
| no ads / no in-app purchases | all | never (policy) | all three | privacy section | screenshot 8 |
| counting, numbers to 100, skip counting | all | — | en-US ("count") | skills list + Bee Flight | screenshot 4 |
| addition within 20, subtraction | all | — | en-US ("add") | skills list | screenshot 4 |
| make ten / number bonds to 10 | all | — | — | skills list | — |
| telling time / clocks, half past, quarter past | all | — | en-US ("tell time") | skills list | screenshot 4, feature graphic alternate |
| shapes (2D, 3D, flat, solid) | all | — | en-IN alternate | skills list | — |
| days of the week, calendar | all | — | — | skills list | — |
| word problems | all | — | — | skills list | — |
| worksheets / printable | all | — | — | parents section | — |
| practice tests | all | — | — | parents section, once | never "olympiad" or "MathBee-style" |
| parent dashboard, skill report, daily limit | all | — | — | parents section | screenshot 8 |
| 1ஆம் வகுப்பு கணக்கு | ta-IN | yes | yes | opening paragraph | feature graphic TA, screenshot 1 TA |
| கணக்கு விளையாட்டு | ta-IN | alternate | yes | — | — |
| கூட்டல், கழித்தல் | ta-IN | — | — | skills list, Bee Flight | screenshot 4 TA (as verbs) |
| எண்கள் 1 முதல் 100 | ta-IN | — | — | skills list | — |
| வடிவங்கள், கடிகாரம், வாரத்தின் நாட்கள், நாள்காட்டி | ta-IN | — | — | skills list | — |
| இணையம் தேவையில்லை, விளம்பரம் இல்லை | ta-IN | — | yes | privacy section | screenshot 8 TA |

Deliberately left out of the listing: "olympiad", "IMO", "SOF", "CBSE", "NCERT", "Samacheer", "Ennum Ezhuthum" and "MathBee-style". The app has no affiliation with any of them, and naming them would be a misleading claim under the Families and metadata policies. "Free", "best", "#1" and "Teacher Approved" are also left out.

---

## 7. Promo hashtags (YouTube Shorts, Instagram, WhatsApp only, never in the Play listing)

Play has no hashtag field, and a `#` in listing text does nothing and can count as keyword stuffing. Use these only on social posts that link to the Play page.

**YouTube Shorts.** Use 3 to 5 per video, and put the first three in the description so they show above the title. Turn off monetisation on the video used as the Play preview.
- EN: `#MathsForKids` `#Grade1Maths` `#Class1Maths` `#KidsLearning` `#LearnMaths`
- US variant: `#MathForKids` `#1stGradeMath` `#KindergartenMath` `#HomeschoolMath`
- TA: `#தமிழ்குழந்தைகள்` `#கணக்கு` `#1ஆம்வகுப்பு` `#TamilKids` `#TamilMaths`

**Instagram Reels.** At most 5 hashtags per post (Instagram's cap since December 2025). Write the caption itself in plain searchable words, for example "Class 1 maths game in Tamil and English, works offline".
- EN set: `#MathsForKids` `#Class1Maths` `#KidsLearningApp` `#HomeschoolIndia` `#TamilKids`
- TA set: `#தமிழ்குழந்தைகள்` `#கணக்குவிளையாட்டு` `#1ஆம்வகுப்பு` `#TamilParents` `#TamilKids`
- Topic posts: add one of `#TellingTime`, `#SkipCounting`, `#NumberBonds` or `#ShapesForKids` in place of a general tag.

**WhatsApp** (status and parent groups). Hashtags do nothing there. Use one plain line and the link instead:
- EN: "A calm Class 1 maths game in English and Tamil. Offline, no ads. [Play link]"
- TA: "தமிழிலும் ஆங்கிலத்திலும் 1ஆம் வகுப்பு கணக்கு விளையாட்டு. இணையம் தேவையில்லை, விளம்பரம் இல்லை. [Play link]"
- For Tamil Nadu parent groups, share a custom store listing URL (see section 8) so you can count those installs separately.

Video rules: only post videos of the app or of the developer. Do not film identifiable children without the parent's written consent. If a video is aimed at children, set it to "Made for Kids" on YouTube.

---

## 8. Store listing experiments to run after launch

Play Console > Grow users > Store listing experiments. Test one asset at a time and measure by install clicks. A new app has little traffic, so expect "More data needed" for a while. Run each test for at least 2 to 4 weeks, or until Console reports a result. Run localised experiments (up to 5 at once) on en-IN first, because that is where most traffic is expected.

| Order | What to test | A (current) | B | What it tells you |
|---|---|---|---|---|
| 1 | App icon | Current bee icon | Same bee, close-up face with a brighter flower background | Whether the icon stands out next to the bright RV AppStudios icons |
| 2 | First screenshot | Welcome screen ("Grade 1 maths in a bee garden") | A question with its celebration ("Count, add, subtract and tell time") | Whether parents want to see the setting first or the learning first |
| 3 | Short description (en-IN) | `Class 1 maths games… Offline, no ads…` | `Grade 1 maths adventure: counting, adding, clocks and shapes. Offline, no ads.` | Whether "Class 1" or "Grade 1" plus a skill list does better with Indian parents |
| 4 | Trust message placement | Trust facts at the end of the short description | Trust facts first: `No ads, no purchases, works offline. Class 1 maths in English and Tamil.` (72 chars) | Whether "no ads / offline" is the main reason to install, as it is for Khan Kids |
| 5 | Screenshot 8 | Parent report + "No ads." | A "promise" frame: "Offline. No ads. No purchases." over the 3D garden | Whether the parent proof or the plain promise converts better |
| 6 | Title (en-IN, only after 1 to 5) | `Number Garden: Class 1 Maths` | `Number Garden: Grade 1 Maths` | Title tests change search ranking too, so run this last and keep it short |
| 7 | ta-IN feature graphic | No text | Tamil overlay `தேனீ தோட்டத்தில் 1ஆம் வகுப்பு கணக்கு` | Whether Tamil text on the graphic helps Tamil-language visitors |

Also set up, outside experiments:
- **Custom store listing, keyword-targeted** ("tamil maths for kids", "கணக்கு விளையாட்டு", "1st std maths"). Lead with the Tamil voice and the Tamil screenshots.
- **Custom store listing, unique URL**, for Tamil Nadu parent groups and school WhatsApp groups, so those installs can be counted.
- **Launch timing.** India's school year starts in April (CBSE) and early June (Tamil Nadu), so late May to June is a good window to publish and post the promo videos. Exam-time interest is likely around Sep to Oct, Dec and Mar. This is an estimate from autocomplete patterns, because Google Trends was blocked during research.

Never test claims that are not true of the build, such as "olympiad", "#1", "Free" or "Teacher Approved", even in an experiment variant. Experiments are subject to the same metadata policy.

---

## Review notes (policy review, 2026-10-31)

Checked every field against Google Play's metadata policy and the Families policy, recounted every limited field with Python `len()`, and checked the privacy claims against the manifest, the merged release manifest and the source.

**Claims verified, no change needed**
- "No permissions": the source manifest and the merged release manifest (`android/app/build/intermediates/merged_manifests/release/`) declare no `uses-permission`. `AD_ID` and the core-ktx receiver permission are removed with `tools:node="remove"`.
- "Offline": there is no INTERNET permission. The game is served from the APK through WebViewAssetLoader (`https://appassets.androidplatform.net` is a local virtual host, not a network call). No `fetch` or XHR calls to remote hosts were found in `src/`. The service worker is turned off in the Android build.
- "No ads, no in-app purchases": the only Android dependencies are core-ktx, activity-ktx, webkit and core-splashscreen. There is no ads SDK, no billing library and no analytics SDK. WebView metrics are opted out in the manifest.
- "No data collected": progress stays on the device, and export or share happens only when a parent chooses it. Android Auto Backup (`allowBackup=true`) goes to the user's own Google account backup and does not count as developer collection for Data safety.
- Feature facts: 81 levels, 7 worlds plus 2 bonus levels, 30 stickers (counted in `src/learning/gamification.ts`), bee hats, 3 daily quests plus a daily gift, Bee Flight topics (`src/flight/questions.ts`), quarter past (`C12.halfQuarter`), the parent gate, the play limit, worksheets and practice tests.
- Titles contain no "free", "best", "#1", emoji or capitals used for emphasis. The short descriptions contain no emoji or repeated punctuation. Each keyword appears 1 to 3 times per description, which is not keyword stuffing.

**Changed**
1. Removed "made by one developer" (en-IN, en-US, ta-IN). The privacy policy names GEM CREATORS as the developer, so the claim could not be shown to be true.
2. Removed "real" from "real Grade 1 maths" and "real math problems". It was an unverifiable quality claim, and the curriculum is inferred from worksheet photos, not a published syllabus.
3. "Spaced review brings skills back at the right time, and practice adapts to your child" became "brings earlier skills back for practice, and follow-up questions adjust to your child's answers". `docs/KNOWN_LIMITATIONS.md` says the review intervals are not validated, so "at the right time" was an outcome claim.
4. 3D claims are now qualified. The garden uses OrbitControls with panning off, so "walk around" became "look around". Low-memory phones get a flat 2D view on Automatic (many mid-range phones do), and Bee Flight has a 2D fallback too, so the listing now says so.
5. Tamil fixes:
   - "கணக்கு, பதிவு எதுவும் தேவையில்லை" was ambiguous: in a maths app, கணக்கு reads as "sums", not "account". It now says "உள்நுழைவு (login), பதிவு…".
   - The clock line "மணி, அரை மணி, கால் மணி" meant "an hour, half an hour, quarter of an hour", which are durations, not "half past" and "quarter past". It now reads "3 மணி, மூன்றரை மணி, மூன்றே கால் மணி போன்றவை".
   - "தனிப்பட்ட" (personal or private) became "சுயாதீன" (independent).
   - "பெற்றோர் பூட்டுக்குப் பின்னால்" was a literal calque. It became "பெற்றோர் மட்டும் திறக்கக்கூடிய பகுதி".
   - "ஆப்" became "செயலி" so the word is the same throughout.
   - The Tamil description now uses the app's installed Tamil name, "எண் தோட்டம்" (`values-ta/strings.xml`).
6. The feature graphic alt text dropped the redundant "friendly animal friends" and now names the six animals actually shown in `feature-graphic-1024x500.png`.
7. Updated the Families setup note. The privacy placeholders are already filled in (GEM CREATORS). The policy's age range (6–8) does not match the listing (5 to 7).
8. Softened the unverifiable note that Play "does not machine-translate Tamil".
9. Recounted all counts: en-IN 2488, en-US 2603, ta-IN 2677 (out of 4000), alt text 109 (out of 140). The titles (26 to 29 out of 30), short descriptions (75 to 79 out of 80) and release notes (238 and 275 out of 500) are unchanged and within their limits.

**Remaining risks (not fixable in this file)**
- **Brand and IP (highest).** The README says the app was built "for a Grade 1 child preparing for a MathBee-style competition" from photos of that workbook (Q1 to Q50). "MathBee" is also Bhanzu's contest brand, and Bhanzu's app ranks first for that search. Play may treat a "MathBee" title as impersonation or as implying an affiliation, and it can act on an IP complaint. Questions copied exactly from a third-party workbook are a separate copyright risk. Clear the trademark first. If in doubt, ship as "Number Garden" and rewrite any exactly copied workbook items.
- **Age mismatch.** `public/privacy.html` says 6–8, but the listing says 5 to 7. Fix the policy before submission.
- **Category signal.** The manifest says `android:appCategory="game"`, but the Play category is Education. This is harmless to Play review, but it is inconsistent. It only affects Android's own app grouping.
- **Tamil copy** is still a developer draft. A native-speaker review of the description, screenshots 1 to 8 (TA) and the release notes is still required.
- **Untested on real devices.** The app has only been run on an emulator, so the 3D, TTS and offline claims hold for that build but have not been confirmed on physical phones (`docs/KNOWN_LIMITATIONS.md`).
- The social-media notes in section 7 (for example, Instagram's 5-hashtag cap) are not listing text and were not verified.

