# Manual save/load campaign — in progress

Operator: Codex. Chromium `153.0.8010.12` (headless, rendered UI, persistent
profiles). Production origin: `http://127.0.0.1:4175`. Initial tested source:
`56c74ba`, app `1.3.13`. Browser interactions use Playwright as an input tool;
quest progress is earned by dragging blocks and pressing the game's controls.

## Current progress

- Campaign A completed the four Chapter 1 quests through Blockly, with a real
  reload/Continue before running each authored program.
- During the first farming quest, till, plant, and water progress survived
  separate reloads. Continued watering grew the same wheat to harvestable.
- Reloading the introduction restored onboarding and the unchanged main farm.
- The first harvest exposed BUG-001, blocking further save progress on this
  baseline. Evidence was preserved and the failure reproduced in a separately
  labeled fault profile. Fix and manual retests are in progress.
- Campaigns B/C, the targeted minimums, and endurance batches remain outstanding.
  None of the previously automated checks count toward those manual totals.

Authoritative case records: [journal.jsonl](journal.jsonl). Large evidence and
persistent profiles are local under `.manual-save-review/` (ignored and outside
Playwright output cleanup). The original production bundle is preserved in
`build-56c74ba/` there.

## BUG-001 — Harvesting a dry restored crop blocks saving

Severity: P1. Status: reproduced; fix under validation.

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

## Resume point

Both persistent profiles were closed before rebuilding. Profile A's recovered durable
checkpoint is immediately before harvest; its later failed-save state is in the
screenshots. Reopen `profile-a` at the same origin on the fixed build, Continue,
and harvest again. Verify crop removal, tutorial completion, reward, a successful
checkpoint, reload, and the next shop quest. Repeat the smallest reproduction
three times in the isolated fault profile, recording the tested build explicitly.
