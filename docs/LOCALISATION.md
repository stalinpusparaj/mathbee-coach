# Localisation

| Language | Question content | Child screens | Parent area | Review status |
|---|---|---|---|---|
| English | complete | complete | complete | written by the developer |
| Tamil (தமிழ்) | complete (every key used by all 126 templates — enforced by `tests/unit/i18n.test.ts`) | complete for play screens, feedback, category and skill names | **falls back to English** (keys `p.*`, `s.*`, `sub.*`, `tag.*`, `kind.*`, `conf.*`, `next.*`) | **draft — not yet reviewed by a native Tamil-speaking teacher** |

- Files: `src/i18n/en-content.ts`, `en-ui.ts`, `ta-content.ts`, `ta-ui.ts`. Messages are structured (`{ k, p }`) so wording is never assembled in code.
- The resolver supports nested messages, list joining, English ordinals (`{d|ord}` → 15th) and plural choices (`{n?one|other}`).
- Any missing Tamil key falls back to English text, never to a raw key.
- Numerals are written 0–9 in both languages. Tamil number words are used only for the worksheet-style "answer in words" addition question.
- The translation status is shown to grown-ups in Settings, never in child gameplay.

## Narration

Narration uses the browser's built-in speech synthesis — no audio files or online services. On each device the app looks for an English or Tamil voice (preferring `-IN` voices). If no voice exists for the chosen language (common for Tamil), the "Hear again" button is disabled with a tooltip and the visible text is used; the app never claims narration that is not available. Settings shows whether a Tamil voice exists on the device.

Replaying narration is never counted as a mathematical hint. Time spent speaking is excluded from response-time measurements.

## Before real use

1. Ask a Tamil-speaking primary teacher to review `ta-content.ts` and `ta-ui.ts` (especially the word problems and the clock/calendar explanations), then update the status in `src/i18n/i18n.ts` (`TRANSLATION_STATUS`) and this file.
2. Translate the parent area if the parent prefers Tamil.
3. Optionally add reviewed recorded narration via a new manifest entry; the app currently has none.
