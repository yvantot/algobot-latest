# Manual save/load campaign — in progress

Operator: Codex. Chromium `153.0.8010.12` (headless, rendered UI, persistent
profiles). Production origin: `http://127.0.0.1:4175`. Initial tested source:
`56c74ba`, app `1.3.13`. Browser interactions use Playwright as an input tool;
quest progress is earned by dragging blocks and pressing the game's controls.

## Current progress

- Campaign A completed and claimed all 44 quests through Blockly, including
  every optional quest. Each has a real reload/Continue check. The per-quest record is
  [quest-matrix.csv](quest-matrix.csv); B and C have not started.
- During the first farming quest, till, plant, and water progress survived
  separate reloads. Continued watering grew the same wheat to harvestable.
- Reloading the introduction restored onboarding and the unchanged main farm.
- The first harvest exposed BUG-001. Fix `ba7709b` passed three independent UI
  harvest/reload/Continue retests on production build `ef8d250`.
- Starting normal farming immediately exposed BUG-002: the introduction exit
  assigns a wall-clock timestamp to the active-time scheduler, blocking saves.
- BUG-002 is fixed in `c6ff644`; three production UI/save/Continue retests passed.
- One of five complete M01 Water-the-row repetitions passed: reset, water and
  reload, remove/replant and water again, complete, reload, claim, next quest.
  Crops absorbed water and grew under protection. Completion cleared lesson
  ownership; spoilage counted down and the former lesson crop died normally
  after Continue. An ordinary tile at (1,1) also absorbed water and grew. This
  supplementary control used the text editor; all 44 quest completions used
  Blockly. Evidence includes the lifecycle and ordinary-tile snapshots.
- One M04 edit/Continue case passed: both source forms persisted, and the restored
  text remained editable and executable. Other M04 minimums remain outstanding.
- One M02 sugarcane regrowth reload passed: three dry, previously harvested
  plants retained their IDs and exact growth progress. Rewatering the restored
  plants produced three more harvests and exactly 12 coins. Other lifecycle
  states and the remaining 23 minimum reload cases are outstanding.
- One M06 browser-closure case passed after 588 seconds of real elapsed time.
  The entire stored payload stayed identical at the menu; Continue restored it
  and a subsequent harvest saved successfully. This case had no live hazards.
- M08 has one confirmed replacement and two cancellations (Cancel and Escape).
  An unfinished Move right block marked the old farm; cancellation retained it,
  while replacement reset the program, quests, economy and playthrough ID.
- Campaigns B/C, the targeted minimums, and endurance batches remain outstanding.
  None of the previously automated checks count toward those manual totals.

Authoritative case records: [journal.jsonl](journal.jsonl). Large evidence and
persistent profiles are local under `.manual-save-review/` (ignored and outside
Playwright output cleanup). The original production bundle is preserved in
`build-56c74ba/` there.

## BUG-001 — Harvesting a dry restored crop blocks saving

Severity: P1. Status: fixed in `ba7709b`; three manual retests passed.

Real-play sequence: complete introduction quests, till, reload/Continue, plant
wheat, reload/Continue, water, reload/Continue, water again until ripe, then run
Harvest crop. All commands were authored with Blockly drag-and-drop.

Observed: the crop disappears and coins reach 143, but repeated saves report
`Water belongs to a missing crop.` The last committed checkpoint stays at
110 coins, the ripe crop, and tutorial progress 3/4 (revision 274). Thus later
progress is unsaved. An isolated copy of that checkpoint reproduces the failure
by Continue followed by Start on the saved Harvest program.

Cause: `releaseUnusedWater()` returned immediately when the dose was zero,
leaving `water_crop` pointing to a crop subsequently removed by harvest. Capture
serialized the missing crop owner, so schema validation rejected the checkpoint.

Fix: clear crop ownership for an exhausted dose. Keep empty-tile drainage and
the requirement to freshly water replanted crops. Add component cases covering
harvest, removal, raw destruction, death, and replanting, plus a real-browser
save/Continue regression after a naturally grown crop is harvested.

Recovered evidence: `BUG-001-root.json`, `BUG-001-localStorage.json`, and
`BUG-001-ui.txt` under the local evidence directory. Screenshots were observed
and the failure reproduced, but their disk copies were lost in TOOLING-001.
Earlier journal paths into `test-results/manual-review/` are historical and must
not be treated as available evidence unless explicitly recovered below.

## TOOLING-001 — Automated runner cleared disposable campaign artifacts

The first added browser regression used Playwright's default `test-results`
output. Its startup cleanup removed the nested manual profiles/screenshots.
The runner was stopped. The Node review session still held the exact failing
IndexedDB root and localStorage snapshot, which were recovered outside that
directory. The watering before/after checkpoint snapshots were also recovered.
User profiles were never involved. Subsequent manual artifacts live in ignored
`.manual-save-review/`; automated checks use their own separate output directory.
Profile A must be reconstructed from its preserved checkpoint; that laboratory
recovery is recorded separately and is not counted as a player-driven reload.
That reconstruction was completed as `profile-a-recovered` and subsequent
campaign progress was earned through ordinary game controls.

## Resume point

All review browsers are closed. Profile
`.manual-save-review/profiles/profile-a-recovered` is saved at the main menu,
with 1,450 coins, 1,927 EXP, and all 44 quests claimed. Seeds: wheat 12, corn 2,
rice 2, potato 3, sugarcane 1, tomato 1. The farm is four columns by three rows;
Bot 0 is at (2,0), with move duration 0.6. Lesson protection is inactive.
Production remains `c6ff644` at `http://127.0.0.1:4175/`. The saved Blockly
program visits columns 0–2, removes a crop, prepares soil, plants tomato,
waters/waits until ready, then harvests. The separate text remains `bot.water();`.

The exact final root is `.manual-save-review/batch-3-final-root.json`, revision
7646, playthrough `fd4dc4ba-de62-4270-b53a-c41e2c33347b`. All 44 claimed flags
agree with the quest matrix. Earlier batch roots are retained. Campaign A has
no remaining quests; preserve this developed profile for targeted scenarios.
Next player-track work: create a separate persistent Campaign B profile at the
same origin, use New Game, and begin onboarding. B uses text after it unlocks
and reloads completed-but-unclaimed quests where that state is reachable.

The separate `new-game-batch` profile contains a fresh replacement in its intro.
It is not campaign B or C. Remaining M08 minimums: 49 replacements and 18
cancellations. M09 endurance has not started. M01 needs four more complete
repetitions; the rest of the targeted/fault matrix remains outstanding.

## Batch 3: Campaign A completed

On unchanged production build `c6ff644`, eight more quests passed: the crop
list, pest patrol, fire patrol, and all five remaining optional crop harvests.
Each was authored or edited through Blockly and restored by reload/Continue
before execution. All nine new checkpoint pairs (eight quests plus one M02
case) were independently compared: playthrough ID, economy, quest state, and
both program sources matched. No new save/load defect was confirmed.

- The list retained wheat/corn/rice strings and its indexed lookup. Execution
  planted the three types in the intended order.
- Two practice pests retained their IDs, positions, timers, and lesson settings.
  The restored nested-loop patrol removed both and completed the quest.
- Two practice fires retained their tile locations and were extinguished by
  the restored patrol. Both hazard completions cleared lesson ownership and
  protection on all twelve tiles before reward collection.
- Ordinary corn, rice, potato, sugarcane, and tomato grew and yielded three
  harvests each after restoring the selected crop and program. Seeds were
  purchased through the shop. The game speed control was set to 400% for the
  longer runs; reload resets it to 100%, so it was selected again afterward.
- The separate M02 case retained three dry sugarcane plants at 14.2656,
  14.1324, and 14.666 seconds of regrowth. After Continue, the edited care loop
  watered and harvested those same IDs at 100% speed, earning exactly 12 coins.

The sugarcane teaching dialog paused play and resumed after Got it. Optional
quest completion returned the mission card to the main path; rewards remained
available in Mission path and were collected there. Authored disconnected
blocks were corrected through the editor before checkpoint testing.

Campaign A spans the earlier baseline and two fixes described below; it is not
a claim that all 44 quests were repeated on the final build. Historical missing
evidence from TOOLING-001 remains explicitly disclosed. The batch began with
an exact checkpoint/program/localStorage backup before replacing the prior
program. New evidence is in `.manual-save-review/`, including
`batch-3-audit.json` and `batch-3-final-menu.png`. Quest checks are not counted
again toward targeted or endurance totals. B/C and the broader review remain
unfinished. No source changes or new automated-test runs were needed here.

## Batch 2: chapters 3 through 9

Production build `c6ff644` remained fixed throughout. Added 26 completed quest
checks, each using real Blockly edits, reload/Continue, execution or purchase,
and reward collection. No new save/load defect was confirmed in this batch.
The 26 before/after snapshot pairs were independently compared again while
reconciling this report: playthrough ID, economy, quest flags, and both program
sources matched in every pair. The matrix agrees with all 36 claimed flags in
the final checkpoint. Batch journal entries span 08:55 to 10:12 UTC on
September 30; this includes tool waits and documentation work, not just play.

- Conditional branches, NOT/AND, comparison operators, random-number bounds,
  and nested loops retained their connections and executed after Continue.
- Buying a column retained the 100-coin deduction and expanded the farm from
  nine to twelve tiles. A subsequent dimension-based loop used all four columns.
  A 50-coin Move Speed upgrade retained the 0.7-to-0.6 duration change.
- Variable IDs, numeric/string values, and getters survived. A conditional
  harvest counter harvested three restored crops and saved successfully.
- A growing wheat crop retained its identity and exact committed growth time
  (1.8166 of 8 seconds). The restored waiting loop observed it become ready and
  exited. The earlier attempt had already reached ripeness before reload and
  was not used as the growing-crop check.
- Nested row/column loops watered all twelve tiles. A named function, a disabled
  block tree, a reused function call, a crop parameter added through the mutator,
  and a Boolean return value all survived reload and remained executable.
- Optional Return an answer restored both selected quest and lesson ownership.
  After execution, the UI returned to the main path while the optional reward
  remained ready in Mission path; it was collected there exactly once.

Some first attempts contained disconnected blocks or omitted a quest-required
readiness guard. The same authored mistakes were present before and after
reload. They were corrected through the UI and the successful runs have their
own evidence files; they are not reported as save defects. Teaching dialogs
paused the combined-condition and corn-parameter runs, which resumed normally
after dismissal. These quest checks are not added again to targeted/endurance
totals. B/C and all previously outstanding targeted minimums remain open.

### TOOLING-002: controller timeout during function reuse

A Node controller call hit its 30-second execution limit while waiting for a
long full-farm run and reset the browser-control kernel. The same persistent
Chromium profile reopened normally. Its checkpoint retained the program, twelve
planted crops, the last settled bot tile, and an uncompleted quest. Continue
left execution stopped. No storage was injected or reconstructed.

The interrupted attempt was not counted as a quest pass. After resetting the
practice farm through the UI, a new reload/Continue and complete run passed;
`A-fn_reuse_0-retest-*` holds its evidence. The interrupted root is retained as
`A-fn_reuse_0-interrupted-root.json`. Subsequent waits were kept shorter than the
controller limit. This is recorded as a tooling interruption, not a game bug.

## BUG-002 — Starting normal farming blocks every later checkpoint

Severity: P1. Fixed in `c6ff644`; three manual retests passed. Discovered on
`ef8d250` through ordinary UI progression, immediately
after the third BUG-001 retest. Start farming followed by Clear/Shop reports
`Invalid scheduler clocks.` Retry repeats the failure. The previous checkpoint
is preserved, but new progress cannot be saved.

Cause: `QuestFeedback.startFarming()` assigns `Date.now()` to `lastEventTime`.
The scheduler now uses elapsed active gameplay milliseconds; the epoch timestamp
exceeds save validation's bound and also makes its cooldown effectively endless.
The transition must begin cooldown using the scheduler's own clock.

Evidence: `.manual-save-review/BUG-002-root.json`, `BUG-002-ui.txt`, `BUG-002.png`.
The root contains the last valid checkpoint, not the rejected in-memory state.
Regression coverage checks the actual Start farming UI/save/Continue transition
and cooldown expiration after restored active gameplay, including paused time.

## Test environment and validation

The production play sessions after both fixes used `c6ff644` (app 1.3.13).
`2b96322` changes only test timeout and Vite watcher exclusions. Unit tests:
394 passed. The production build passed with existing bundle-size warnings.
The two new Chromium regressions passed separately. A broader run initially
failed because Vite tried to watch a locked Chromium Cookies file in the manual
profile directory. Excluding `.manual-save-review` fixed that server crash.

The next run passed 31/32; its first cold-start test exceeded 60 seconds, and
repeated that timeout in isolation. The same case passed with a 120-second
budget in about one minute. Its timeout was updated accordingly. The final
`2b96322` Chromium save suite passed all 32 cases in 2.3 minutes. Log:
`.manual-save-review/2b96322-save-suite.txt`. These automated checks are separate
from the manual quest and scenario counts.

Unrelated in-progress additions to package.json/package-lock.json (Wrangler)
were preserved and excluded from review commits. Manual journal timestamps span
multiple hours and include tool/test waits; they are not an estimate of active
player time or of the remaining complete campaign.
