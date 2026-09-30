# Live manual review, 1 October 2026

Target: https://algobot.fun, production release `2db0fa7`.
Participant: `QA_MANUAL_LIVE_20261001` (synthetic review activity).

## Plan

1. Start a QA farm through the public interface. Play the opening quests using the editor, shop and quest controls. Check instructions, rewards, water absorption and growth.
2. Open challenges, attempt an interrupted run and a scored run, claim rewards, and check the second challenge's eligibility messages.
3. Return to the menu and Continue repeatedly, reload with meaningful progress, and confirm stopped programs and preserved farm/quest/challenge state.
4. Exercise documentation, settings and smaller-window controls. Check visible errors and browser error logs.
5. Upload through the game and read back only this QA participant's cloud archive. Confirm challenge provenance and one-file-per-player behavior. Remove only this review's synthetic cloud object afterward.
6. Reproduce any product defect, add a focused regression check, fix it, and verify through the interface. Commit important fixes and publish after validation. Record limitations explicitly; automated checks do not substitute for observed gameplay.

## Observations

- The in-app browser had an existing disposable QA save. A different participant cannot Continue it, and the menu explains the mismatch. New Game presents replacement confirmation.
- Browser click coordinates initially disagreed with the displayed screenshot. Keyboard activation opened the expected controls; this is being treated as an automation issue, not a game defect.

## Results

- Played all seven introduction scenes, then completed movement, Say, the connected movement sequence, first farming steps, and the wheat shop purchase through the public controls. The wheat absorbed two watering cycles and became harvestable. Quest rewards and progression worked.
- Continued the saved opening quest after a browser restart. Restored programs were stopped and the next mission was preserved.
- Confirmed a canvas resize defect: a farm opened at 504 × 672 stayed that size after expanding to 1366 × 768, leaving black space. Removed startup-only fixed KAPLAY dimensions and made the canvas fill its container. A Chromium regression now passes expansion and contraction.
- Confirmed that Reset lesson tiles could stay disabled after stopping during an action. KAPLAY robot availability is not a Svelte reactive property. The control now refreshes availability on the HUD's existing one-second tick. A focused Chromium regression passes the busy-to-available transition without another program-state change.
- Played two-tile planting, movement loops, row planting, reset-and-water, row harvesting and crop-check lessons. Watered lesson crops visibly grew and their soil dried. Unready harvesting and walking off the row displayed errors without crashing the game.
- First challenge: an unsupported command scored 0/3 with an explicit error; a stopped valid attempt retained its source and no score; the corrected attempt scored 3/3 and paid its reward once. The second challenge correctly required a fresh farming observation interval.
- Initial production readback verified one QA archive containing four sessions and all three first-challenge submissions. Its first score remained zero even after the successful retry, while the reward was recorded. Archive checksums passed.
- Documentation search for water returned both matching commands; command details explained water absorption and drainage.
- Validation: 42-test Chromium suite passed after canvas changes; the additional lesson-reset regression passed after its fix. Production build passed.

- Completed Two careful steps with 9/9 across all three rows and claimed its reward. Finish & Send Data displayed Data sent. Final authenticated readback found both scored challenges, both rewards, all submitted source and four sessions in one 17,164-byte compressed archive; checksums passed.

## Scope and visual review

This was a played route through the introduction, twelve opening missions (through the crop-check mission), and both collection challenges. It was not a manual completion of every optional quest or all ten challenges. Existing automated coverage supplements this route.

Anti Slop review scope: the canvas sizing and lesson-reset control fixes. The existing farm artwork, wood controls, Quicksand typography and slate panels are retained. No new visual assets or marketing copy were added.

- Hard gate PASS for changed surfaces: responsive canvas dimensions verified at 504, 800 and 1366 pixels; the reset control has a working, tested action. No new colors, claims, links or copy.
- Purpose gate PASS: canvas fills the viewport so resizing does not hide usable farm space; availability refresh keeps the reset control truthful.
- Liveliness PASS: existing farm identity and motion are retained; ENERGY 2 / RHYTHM 2 / MOTION 2 remain appropriate for the instructional game.
- Craftsmanship PASS for changed behavior: build and Chromium checks pass; resets remain blocked while a robot is busy and become available afterward.

Remaining release checks: visual fix verification, publication and QA-object cleanup.
