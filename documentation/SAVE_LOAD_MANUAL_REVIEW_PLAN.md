# Save/load manual play-review plan

Status: planned, not executed. Operator: Codex. Browser scope: Chromium only.
Initial baseline: `fc9bc3f`; record the actual tested commit and build before
starting. This campaign supplements the automated tests recorded in
[SAVE_CONTINUE_VALIDATION.md](SAVE_CONTINUE_VALIDATION.md).

## What counts as manual review

I will play through the rendered game: build programs in its editors, press
Start, buy items, prepare crops, finish quests, claim rewards, leave, reload,
and choose Continue. I will inspect the restored game and actually use it before
marking a checkpoint passed. Repeating a browser script without examining the
outcome does not count as a completed manual-review case.

Browser interaction tools may perform clicks, typing, dragging, and navigation.
Read-only storage inspection and diagnostic exports may verify observations.
Calling `restoreWorld`, assigning inventory or quest flags, importing a finished
farm, or invoking the existing test suite does not count as playing a quest.

There are two separately reported tracks:

- **Player track:** real progression through normal controls, without completing
  quests or provisioning resources through developer tools.
- **Fault laboratory:** disposable saves, explicitly recorded developer setup,
  and controlled storage faults for cases that ordinary play cannot reliably
  produce. These cases never stand in for player-track coverage.

This document plans the work; no play sessions or passes are claimed yet.

## Environment and evidence

1. Build once and serve the production build from one fixed local origin. Record
   commit, dirty state, app version, Chromium version, viewport, and origin.
   Keep the development fixture out of the player track. Do not edit/rebuild
   underneath a play session.
2. Use dedicated persistent Chromium profiles for this campaign. Keep each
   profile's storage between launches, and restart that same profile when testing
   a browser restart. A new incognito context or a changed port is a different
   storage environment, not a failed Continue.
3. Keep ordinary play separate from study-identity tests. Use synthetic identities
   such as `QA_SAVE_A` and `QA_SAVE_B` in the fault laboratory. Do not touch the
   user's browser profile, saved farm, or collected participant records.
4. Keep three independent player profiles, plus expendable fault profiles. A
   backup used for diagnosis must include the authoritative IndexedDB root and
   relevant localStorage, not just a screenshot or a browser cookie export.
   Diagnostic downloads are evidence, not a supported game import feature.
5. Record each run in a durable journal under
   `documentation/save-load-manual-review/`, with large screenshots, traces,
   downloads, and test profiles under ignored `.manual-save-review/`, outside
   Playwright's output directories (which it clears before running). Do not
   commit browser profiles or raw participant data.

Each journal row contains: case ID, profile, build, starting quest/farm state,
exact UI actions, exit method, last committed playthrough/revision, expected
result, observed result, evidence paths, elapsed time, and status. Status is
`not run`, `pass`, `fail`, `blocked`, or `not applicable` with a reason. Keep a
separate bug list with minimal reproduction steps and affected cases.

## The comparison at every checkpoint

Record the relevant visible values and, where needed, a read-only copy of the
last committed checkpoint. A stale "Farm saved" label by itself is not proof
that the most recent action committed: confirm the revision advanced and that
the intended change is present before calling a checkpoint durable.

After Continue, check:

- Same farm, playthrough owner, dimensions, coins, seeds, experience, quest
  progress/claim state, unlocks, bot count/upgrades, and relevant crop state.
- Exact program contents, including deliberately unfinished text and Blockly
  variables/functions; correct editor and selected bot. Programs start stopped.
- No extra payout, deduction, duplicate entity, second reward, or automatic quest
  completion merely from loading. An action must not be half-applied.
- Water ownership still works. Restored crops absorb water, empty/dead tiles
  drain as intended, and removing/replanting cannot inherit an old crop's dose.
- Gameplay still responds: run another command and save again. A restored-looking
  but frozen farm is a failure.
- Closed time is excluded from simulation. Measure the stored remaining clocks
  and account separately for visible time after Continue; do not require moving
  animations to match a screenshot pixel for pixel.

Use two interruption expectations. **After a confirmed commit**, the saved
logical state must survive. **Before a commit or during forced interruption**,
the last complete transaction is acceptable; a partial transaction, duplicate
gain, damaged save, or false recovery is not. Browser unload is best effort.
For save-and-return, require the requested checkpoint to succeed before leaving.

## Campaign A–C: three complete playthroughs

Include all 44 current quests, including optional crop quests and the optional
return-value quest. Maintain a per-quest matrix rather than just a chapter count.
If the catalog changes, enumerate it again and record the new count.

| Campaign | How I will play | Main interruption pattern |
| --- | --- | --- |
| A: beginner / Blockly | Fresh profile; follow onboarding, build and revise blocks, make ordinary mistakes, buy resources, and complete the quest path without developer shortcuts. | Reload with each quest active, preferably after partial progress. Continue and finish it using the preserved program. |
| B: text and economy | Fresh profile; complete required onboarding, use text when unlocked, deliberately save syntax errors and unfinished edits, buy land/bots/upgrades, and complete all quests. | Reload after completion but before claiming wherever that state is reachable. Claim once afterward and verify the exact reward. |
| C: mixed editors and recovery | Fresh profile; alternate editors when available, switch bots, interleave optional quests, and use both desktop and phone-sized viewports. | Claim rewards, confirm the checkpoint, then alternate reload, tab reopen, and persistent-browser restart. Continue into the next quest. |

At least one real reload or reopen is required per quest in each campaign: a
minimum of **132 player-track continuity checks**. Auto-claimed rewards do not
have a reachable completed-unclaimed state; mark that matrix cell not applicable
and test immediately after the automatic award instead. A one-step quest may
also lack meaningful partial progress; use its prepared active state and record
the limitation. Do not manufacture either state and count it as manual play.

At each chapter boundary, also verify the saved program can be edited and run,
the next lesson is usable, and the previous chapter's reward/unlocks survived.
Do not skip a progression blocker with a developer quest-completion control;
record it, preserve the profile, and continue an independent campaign if possible.

## Targeted play sessions

These supplement the full playthroughs. Use naturally unlocked farms from those
campaigns when possible; mark developer-prepared cases separately.

| ID | What I will repeatedly do | Minimum coverage and success condition |
| --- | --- | --- |
| M01 — Water the row | Reset lesson tiles, water, reload, remove/replant, water again, complete and claim, then continue to another lesson. | Five complete repetitions. Inspect absorption on practice and ordinary tiles. Growth continues under protection; protection and lesson hazards end at the intended transition and stay ended after reload. |
| M02 — Crop lifecycles | Grow each of wheat, corn, rice, potato, sugarcane, and tomato; save dry/wet and young/growing/ripe/dead cases that are reachable. | Every crop in every reachable lifecycle state; include partly consumed water, corn adjacency, sugarcane regrowth, and removal/replanting. At least 24 reload cases, without pretending every cross-product combination was covered. |
| M03 — Action interruption | Interrupt till, plant, water, ordinary harvest, sugarcane harvest, seed purchase, land purchase, and bot/upgrade purchase. | Three observed timing windows per action: before completion, during visible transition, and after confirmed save; repeat each twice, at least 48 cases. Inventory, crop state, rewards, and quest credit must agree. Label exact timing unknown when it cannot be observed. |
| M04 — Programs and multiple bots | Edit both languages; create variables/functions, disconnected Blockly blocks and text errors; switch selected bots; run movement and messages with multiple bots. | At least 12 reloads including immediate edits, settled edits, stopped programs, in-flight movement, and stacked bots. Preserved source remains editable; no old program or callback starts itself after Continue. |
| M05 — Hazards | Play with fire, rain, and pests; reload with active hazards, a pest moving between tiles, rainfall in flight, and overlapping hazards. | At least 12 cases, three per hazard plus three overlaps. Verify actual subsequent damage/water/movement and cleanup, not just restored sprites. Use a labeled developer-assisted farm where natural spawns cannot provide a phase. |
| M06 — Offline and menu time | Leave a mixed farm by menu, tab closure, and full isolated-browser closure; return after real elapsed time. | At least six cases, including 1-, 5-, and 15-minute absences. Check young and ripe crops, water, pests, weather, and scheduler cooldowns. Do other review work in a separate profile while waiting. Synthetic multi-day clock tests remain separately labeled automated evidence. |
| M07 — Demonstrations and challenges | Reload in a demo, an open challenge, a stopped submission, scored-but-unclaimed results, claimed reward, and challenge exit. | At least 12 cases, two per state. Main farm stays authoritative; interrupted attempts are not fabricated scores; submissions retain original session ownership; rewards pay once. Respect real eligibility/waiting gates in the player track. |
| M08 — New Game | Cancel, press Escape, confirm, double-click, reload during replacement, and replace again after Continue. | 50 confirmed replacement cycles plus 20 cancellations. Give the old farm a visible unique marker through normal controls; verify default state/new playthrough after confirmation and unchanged state after cancel. Research/settings persist. |
| M09 — Continue endurance | Repeatedly play a small action, confirm saving, return/reload/reopen, Continue, and play another action. | 100 cycles on an evolving farm, including at least 20 tab reopens, 10 full persistent-browser restarts, and 10 navigation-away/browser-Back cases. Record whether Back restores a cached page or loads a fresh menu. Inspect every cycle; take detailed state/performance samples every tenth cycle. No accumulating bots, tiles, duplicated input, growing stalls, or stuck programs. |
| M10 — Ownership and tabs | Use two tabs in the same test profile; continue/replace from the second, close the owner, retry, and change synthetic participant identity. | At least 12 cases. Include a stale empty menu and a confirmation left open while the other tab changes the save. No unconfirmed replacement, cross-owner load, or stale-writer overwrite. |
| M11 — Developed-farm stress | Use a 20 × 20 farm with 20 bots, long programs, crops, and active hazards; edit programs, switch bots, save, and Continue. | At least 10 continuity cycles and 10 minutes of live interaction. Developer preparation is allowed only as a labeled stress case. Record save/Continue latency, input responsiveness, entity counts, and visible stalls before and after. Measurements apply to this host, not all Chromium devices. |

Do not inflate totals: a single action can satisfy several assertions, but each
actual reload/reopen/replacement is counted only once. Report full-path runs,
targeted scenarios, endurance cycles, and fault cases separately.

## Fault laboratory

Run each recoverable failure twice: once to establish preservation, then once to
exercise recovery and normal play afterward. Inject faults only into labeled
test profiles; preserve the before-fault root first. Manipulating storage is
acceptable here because it is the subject of the test, not a way to finish quests.

| Fault | Required player-visible and durable result |
| --- | --- |
| Initial save read fails, then succeeds | New Game stays disabled while the slot is unknown. Retry reveals the existing farm. Replacement still requires confirmation; Continue remains usable. |
| IndexedDB unavailable / quota / aborted write | Clear failure, previous committed farm intact, Retry cannot falsely claim success. Save-and-return keeps the farm open; explicit leave-without-saving returns to the last durable state. |
| Commit succeeds, identity projection fails | Menu refreshes to show the committed farm; Continue reconciles the allowed identity. Another New Game requires confirmation. |
| Active checkpoint corrupt / future schema | No silent reset or overwritten bytes. Export works. Eligible backup recovery works; foreign or pre-research-boundary backups are rejected. |
| Corruption after challenge reward | Recovery cannot erase the durable claim or make a reward claimable twice. Recovery exclusions and generation remain recorded. |
| Malformed legacy sessions / exposure history | Export preserves original bytes. Explicit backup-and-continue restores farming; unreadable exposure history does not become a false first exposure. |
| Clear Data before first session save / with pending writes | Current and pending research cannot reappear through assessment saves, autosave, reload, or export. Exposure history follows the documented retention rule; farm integrity is preserved. |
| Ten-minute suspension / owner tab termination | Same writer can renew and save after returning. A superseded writer cannot overwrite the newer farm. Distinguish a timer simulation from a real suspended process in the report. |

Precise IndexedDB transaction offsets and deterministic next-step RNG/hazard
parity require instrumentation. Retain the automated regressions for those
proofs; do not describe a visually timed reload as proof of an exact transaction
boundary. The manual question is whether real play exposes a bad user outcome.

## Failure handling and repetition

On a failure, preserve the affected profile and checkpoint before attempting
New Game, cleanup, or another save that could rotate away evidence. Record the
console error and visible behavior. Reproduce in a fresh isolated profile and
reduce the action sequence where possible; one-off failures remain findings,
not silently discarded runs.

Keep fixes separate from the failing baseline. If implementation work is
undertaken, commit the fix and regression test, rebuild, and record the new
version. Re-run the smallest failing case three times, then its affected batch
and a basic New Game → play → save → reload → Continue smoke test. A changed build
does not inherit a clean full-campaign result without stating what was retested.

## Completion gate and handoff

The heavy-review campaign is complete only when:

1. All three quest-path campaigns are finished, including optional quests, with
   per-quest evidence and honest treatment of unreachable states.
2. All targeted minimums and both runs of each fault-laboratory case are recorded.
   There are no unreported skipped, blocked, or unreviewed rows.
3. No unresolved loss of a confirmed save, unconfirmed replacement, duplicated
   reward, mixed-owner data, revived deleted records, progression blocker, or
   nonfunctional restored farm remains. Lesser issues are listed with severity.
4. The final tested build passes the automated regression suite and production
   smoke checks. These results are reported separately from manual play counts.
5. The report includes tested commits, actual time, profile/build mapping,
   completed counts, evidence links, discovered issues, fixes/retests, and limits.

This is a substantial multi-session campaign. After each batch I will update the
journal with the exact next action and preserved profile so work can resume
without replaying or inventing earlier results. Estimate remaining time from the
first completed playthrough rather than promising an unsupported duration.
Commit the plan and important review reports; keep large traces and disposable
profile data outside Git. The user is not responsible for performing the cases.
