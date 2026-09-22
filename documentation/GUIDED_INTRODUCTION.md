# Guided introduction

The first-run experience uses a short visual demonstration followed by prepared
movement, student-authored movement, wheat farming, and loop practice. Blocks are
the default editor. Text coding opens after the hazard introduction.

## Implementation

- `tutorial.js` owns the gameplay protection policy and reusable mission rules.
- Quest state determines the active mission, prerequisites, and one-time rewards.
- Successful movement reports its destination, executing block ID, and loop
  context. Placing a block or entering an empty loop does not award movement credit.
- `OnboardingModal` is an isolated animated illustration, not a live farm run.
  It cannot change inventory, quests, or performance counters.
- `QuestHUD` shows one mission, progressive optional hints, and a mission-path link.
  The editor offers a button that opens the relevant Blockly category.
- `QuestFeedback` queues completion feedback. Introductory rewards are claimed
  automatically; subsequent quests retain explicit claiming.
- Protected practice suppresses harmful event spawning and ripe-crop spoilage.
  Growth and soil absorption continue. Ending practice resets the event cooldown.
- Required instructions and the demonstration do not count as optional hints.
  Exports identify this curriculum using `introduction_version: guided-v1`.
  Existing model features, model weights, and historical research files are unchanged.

## Verification

- 120 automated tests pass, including growth under protection and real interpreter
  loop-context propagation. Production build passes.
- All 40 preserved research artifacts match the recorded baseline hashes.
- Browser walkthrough at a 1366 x 900 viewport completed the demonstration,
  prepared movement, an authored movement block, tilling, planting, both watering
  cycles, harvesting, a loop with movement, and the hazard handoff to normal play.
- Confirmed milestone feedback, automatic introductory rewards, and text-editor
  unlocking in the walkthrough. Narrow-window overlap observed during review was
  addressed with responsive quest/editor placement.

## Boundaries

Reloading still starts a new farm and introduction. This change does not implement
full game-save restoration. Returning to the start menu within the mounted game
retains the existing state. The demonstration is intentionally time-compressed;
the playable mission explains both watering cycles.

Existing Blockly drag-and-drop accessibility, old resize handles, and mobile farm
camera framing need a separate interface pass. This is a playable desktop draft,
not a claim of complete accessibility conformance or student usability validation.
