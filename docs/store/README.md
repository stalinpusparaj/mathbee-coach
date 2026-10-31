# Play Store art

Generated with Google Flow (Nano Banana 2.1) on 2026-10-31, using the game's own bee, friends and garden painting as style references so the store art matches the app.

| File | Use | Size |
|---|---|---|
| `play-icon-512.png` | Play Console → App icon | 512×512 |
| `feature-graphic-1024x500.png` | Play Console → Feature graphic (no text; add the title in Console if wanted) | 1024×500 |
| `screenshot-bg-1080x1920.jpg` | Background for framed phone screenshots | 1080×1920 |

The same icon art is the Android launcher icon (`android/app/src/main/res/drawable-nodpi/ic_launcher_art.png`, adaptive background layer; the monochrome vector stays for themed icons).

In-game art from the same session (bee poses `bee_celebrate`, `bee_think`, `bee_point`, `bee_sleep`, and the seven `world_*` Adventure backdrops) lives in `public/assets/generated/` and is listed in `src/assets/generated.json`. Raw downloads stay in the git-ignored `art-generated/raw/`; re-run `python3 tools/process_generated.py` (needs pillow, numpy, scipy) to rebuild them.

Note: AI-generated images carry Google's invisible SynthID watermark, which processing keeps. Sprite cut-outs keep only the character, so the small visible corner sparkle falls outside them; backgrounds and store images are not edited to remove it. No image contains numbers, letters or answers, so the maths in the game never depends on generated art.
