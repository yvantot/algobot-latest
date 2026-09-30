# Manual save/load campaign — in progress

Operator: Codex. Chromium `153.0.8010.12` (headless, rendered UI, persistent
profiles). Production origin: `http://127.0.0.1:4175`. Initial tested source:
`56c74ba`, app `1.3.13`. Browser interactions use Playwright as an input tool;
quest progress is earned by dragging blocks and pressing the game's controls.

## Current progress

- Campaign A completed and claimed 10 of 44 quests through Blockly, through
  `loop_water_0`. Each has a real reload/Continue check. The per-quest record is
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
  supplementary control used the text editor; all ten quest completions used
  Blockly. Evidence includes the lifecycle and ordinary-tile snapshots.
- One M04 edit/Continue case passed: both source forms persisted, and the restored
  text remained editable and executable. Other M04 minimums remain outstanding.
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
with 293 coins and ten claimed quests. Current quest: `crop_wheat_1`, Harvest
three wheat crops. Its three practice tiles were reset to ripe crops before
save-and-return. Bot 0's saved settled position is (1,1), with a single Harvest
crop block; returning to the menu interrupted the reset jump. Resume at
`http://127.0.0.1:4175/` on the same production build `c6ff644`, Continue, press
Reset lesson tiles and wait for Bot 0 to land at (0,0). Then build repeat 2
{ Harvest crop; Move right }, followed by a final Harvest crop.
Confirm its save, reload, run, and claim. The exact final root is preserved in
`.manual-save-review/batch-1-final-root.json`.
An ordinary control crop at (1,1) is now dead; this is expected after its
unprotected spoilage countdown. The saved text program is `bot.water();`; the
selected editor is Blockly, whose single Harvest crop block remains intact.

The separate `new-game-batch` profile contains a fresh replacement in its intro.
It is not campaign B or C. Remaining M08 minimums: 49 replacements and 18
cancellations. M09 endurance has not started. M01 needs four more complete
repetitions; the rest of the targeted/fault matrix remains outstanding.

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
