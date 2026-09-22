# Guided introduction

The first-run experience retains the original three-slide onboarding, then offers
a teacher-led live farm introduction followed by prepared
movement, student-authored movement, wheat farming, and loop practice. Blocks are
the default editor. Text coding opens after the hazard introduction.

## Implementation

- `tutorial.js` owns the gameplay protection policy and reusable mission rules.
- Quest state determines the active mission, prerequisites, and one-time rewards.
- Successful movement reports its destination, executing block ID, and loop
  context. Placing a block or entering an empty loop does not award movement credit.
- `OnboardingModal` retains the original three illustrated slides, navigation and
  hide-on-start preference. Its final button leads to `FarmIntroduction`.
- `FarmIntroduction` runs eleven self-paced scenes with teacher dialogue and
  highlighted example code: purpose, movement, planting, watering, earnings,
  spoilage, multiple bots, rain, fire, pests and the first mission.
- Each scene holds until Continue. Action timings are deliberately slower; demo
  crop growth and spoilage use shortened, local durations. The farm pauses while
  the learner reads. Entrance/exit curtains conceal scene setup and restoration.
- `live-demonstration.js` owns a private farm and disposes its crops, bots, pests
  and weather when skipped or finished. Player entities and simulation speed are
  restored. No demo action spends seeds, awards player rewards, completes quests,
  or records spoilage/event-response telemetry. Bot IDs are ordinary 0 and 1.
- The mission HUD has no demonstration replay link.
- Inventory has a reserved column beside the mission HUD. Mission panels use the
  Help & Game Guide gray/slate styling, with green accents. Rewards scale/slide
  in and out; completed missions leave before the new mission enters.
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

- 125 automated tests pass, including growth under protection and real interpreter
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

### Teacher-led introduction verification (2026-09-22)

The full eleven-scene browser walkthrough completed, including both robots,
visible cloud/rainfall, fresh-to-rotten wheat with green gas, extinguishing fire,
and removing a pest. The closing transition returned to 50 coins, 5 wheat seeds,
Bot 0 and zero first-mission progress. The scripted pest's movement loop is stopped
after component startup so it stays on the tile described by the teacher.

### Reward presentation and replay

Milestones and ordinary rewards use global Svelte transitions so nested branch
changes animate both ways. Reward display lasts 5.8 seconds (milestones wait for
Continue). Syntax badges hold before a 2.8-second flight and stay invisible during
their staggered delay. The current quest leaves over 450 ms and the next enters
over 650 ms. Help & Game Guide can replay the introduction; active code runs stop
first. The DDA notice expires after 6.5 seconds and only reappears on a new message.

`tests/ui/feedback.html` is a development-only browser fixture for ordinary rewards,
milestones, quest changes, syntax flights and the transient notice. It is not a
production entry point and does not call quest telemetry or claim player rewards.
