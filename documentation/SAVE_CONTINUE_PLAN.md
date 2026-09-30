# New Game and Continue implementation plan

Status: proposed implementation, September 30, 2026. This document specifies
the feature and its required tests; it does not claim persistence is implemented.

The player must be able to reload, choose Continue, and recover a consistent
farm, quest progress, and programs. Saving must never leave money, rewards,
crops, and quest flags from different points in time.

## Confirmed behavior

- One playthrough per browser profile and site origin. No account or cloud sync
  in this version. Keep one previous valid checkpoint for recovery, not a second
  selectable playthrough.
- Everything pauses while closed: growth, spoilage, weather, pests, cooldowns,
  and gameplay time. Store remaining simulation time rather than subtracting
  elapsed wall-clock time on Continue.
- New Game replaces the playthrough only after explicit confirmation. Cancel
  leaves both the current farm and stored save untouched.
- Continue displays the farm name, current chapter, and last successful save.
  No save means Continue is unavailable. A storage/read error must not be
  presented as an empty save slot.
- Programs and editor contents persist. Programs resume stopped, with no
  interpreter stack or pending callback restored. The UI explains this once
  on Continue. Players press Start to run again.
- Research exports, participant identity/exposure records, audio settings, and
  graphics preferences remain separate. New Game must not clear browser storage
  wholesale or erase research records.

## Findings in the current code

| Area | Current behavior and required change |
| --- | --- |
| `src/App.svelte` | `hasStartedGame` only remembers the current page lifetime. Replace this with explicit new, continue, and in-memory resume transitions. |
| `src/components/StartMenu.svelte` | Only Start Game exists. Add Continue, New Game, overwrite confirmation, and loading/recovery states. |
| `src/game/game.js` | `game()` initializes KAPLAY, assets, a blank farm, and a default bot together. Separate engine initialization from constructing a new or restored farm. |
| `src/components/Game.svelte` | Existing periodic/unload saving calls the research DataLogger. It does not save the playable farm. Mounting also resets telemetry and ML session state. Separate playthrough lifecycle from UI mounting and research-session lifecycle. |
| `src/components/global.svelte.js` and `src/game/global/global.js` | Mutable singleton stores hold quests, unlocks, money, dimensions, and tutorial state. Add explicit fresh-state factories and restore/reset operations. |
| Soil and crop components | Water ownership uses an object reference; ripe crops use a remaining spoilage timer; harvest rewards commit in a delayed callback. Restore these relationships and normalize unfinished actions deliberately. |
| `QuestHUD.svelte` and `quest-setup.js` | HUD mounting/quest changes can release protection, and setup can replace practice crops. Restoration needs a barrier and saved lesson ownership to avoid resetting restored tiles. |
| `bot-messages.js` | Inboxes live in a WeakMap and currently reset on reload. Add plain-data snapshot/restore support if preserving playthrough messages, as proposed here. |
| `challenges/records.js` | The challenge reward ledger is an in-memory Set. Persist it so reloading cannot award the same reward again. |
| Challenges and demonstrations | Temporary scenes share engine infrastructure. Their objects must never become the main-farm save. |

## KAPLAY documentation and serialization decision

The lockfile and installed package resolve to KAPLAY `4000.0.0-alpha.27`.
Pin this exact version for the persistence work; do not combine this change
with an engine upgrade.

KAPLAY documents object serialization through prefabs, `serialize()`, and
`addPrefab()`. Custom components need a JSON-returning serializer and a
deserialization factory. This is not automatic persistence of arbitrary game
objects, closures, or application stores. See the official
[prefab guide](https://v4000.kaplayjs.com/docs/guides/prefabs/) and
[serialized object format](https://v4000.kaplayjs.com/docs/api/SerializedGameObj/).

The installed source map confirms that object serialization visits components
with a `serialize` method and recursively serializes children. Components
without that method are omitted. Its prefab deserializer also ignores unknown
component factories. The guide names `registerFactory`, while the installed
source uses `registerPrefabFactory` internally and the public declaration file
does not expose either name. Do not base a save implementation on that example
without proving the supported API on the pinned build.

The installed implementation of `getData`/`setData` is a localStorage JSON
wrapper. `getData` catches read/parse failures and can write a supplied default;
it therefore cannot distinguish a missing save from corruption or denied access
for our recovery UI. Do not call it with a new-farm default when probing saves.

**Recommendation:** maintain an application-owned, versioned plain-data schema.
Read explicit fields from entities, then rebuild entities through `addSoilToGrid`,
`addCrop`, and `addFarmbot` plus dedicated restore methods. Recreate visual child
objects through component lifecycle hooks. Do not JSON.stringify live KAPLAY
objects, blindly serialize the entire scene tree, or persist Svelte proxies.
This follows the documented serialize/reconstruct separation while avoiding
dependence on incomplete custom-prefab support in the installed alpha.

Use IndexedDB behind an injected storage interface. A readwrite transaction can
update the active checkpoint, prior checkpoint, and metadata together. It also
allows revision checks inside the transaction. Report success only on transaction
completion, and handle abort/quota errors explicitly. These are application
design choices supported by the browser's
[transaction model](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction),
not extra durability guarantees from KAPLAY.

## Save contract

Every save has `schemaVersion`, `questPathVersion`, `gameVersion`, `playthroughId`,
monotonic `revision`, `savedAt`, and a validated payload. Use stable application
IDs for crops, bots, and hazards; never use runtime object IDs as permanent keys.

| Saved data | Restore rule |
| --- | --- |
| Player and economy | Farm name, avatar, EXP, coins, seed counts, reward ledgers, purchases, bot upgrades. Derive level/UI values from authoritative data. |
| Farm geometry | Rows, columns, logical tile coordinates. Recompute camera/grid origin and scenery for the current viewport. |
| Soil | Tillage and water amount, plus the ID of the living crop that owns the water. Restore crops before linking ownership and rebuilding water visuals. Empty/dead tiles must not acquire a usable water dose. |
| Crops | Type, lifecycle state, health, growth progress, applicable duration/profile, spoilage remaining. Restore finite data; encode intentional unbounded timers with an explicit tagged value, never JSON Infinity. |
| Robots | Stable ID, committed logical position, upgrades, inbox contents and message sequence. Rebuild occupancy/stack order and inbox references once. Restore availability as idle after action normalization. |
| Programs | Per-bot Blockly XML, text source, selected editor/bot. Preserve Blockly variable/function IDs; regenerate generated JavaScript through the current generator. Never execute saved source during loading. |
| Quests | Progress, completed/claimed flags, per-quest action history where required, optional selection, unlock state and ledgers. Restore state directly without calling reward-granting APIs. |
| Introduction | Actual tutorial phase, pending milestone acknowledgement, Start farming boundary, completed demonstrations, and relevant seen tips. Restore semantic steps, not animation progress. |
| Lesson ownership | Prepared quest ID, owned tile IDs and practice hazards. Reconcile with current quest/completion state; do not preserve stale protection on a completed quest. |
| Normal hazards | Fire stage/age/health settings; pests' logical positions and next attack/move delay; rain clouds/drops and remaining event lifetime using logical or normalized coordinates. Preserve gameplay effects, rebuild renderers. |
| Difficulty and timing | Farm-affecting difficulty/profile settings and event cooldown remaining. Reinitialize model runtime; never serialize tensors or training buffers. Study protocol restrictions still take precedence. |
| Integrity metadata | Developer-action taint and playthrough/research linkage. Continue must not turn a cheated farm into an apparently clean research session. |

Do not save DOM nodes, listeners, WebGL resources, texture objects, display
objects, timer handles, functions, interpreter state, cached ASTs, transient
speech/effects/reward flights, or temporary demonstration/challenge entities.
Validation must bound payload size, text lengths, dimensions, counts, coordinates,
enums, finite numeric ranges, IDs, and references. Reject unknown future versions
without modifying the stored bytes. Migrate known older versions explicitly.

## Consistent checkpoints and interrupted actions

Capture one detached snapshot synchronously at a defined simulation boundary,
then persist it asynchronously. Never read half the snapshot, await a write,
and read the rest from a now-changed farm.

Audit every command's mutation point before wiring autosave:

- Plant, till, water, destroy, purchases, and upgrades save their applied world
  and economy changes together. An animation finishing later is not a second
  action to replay on restore.
- Movement restores the last committed tile and its matching occupancy; discard
  unfinished jump visuals. Do not restore a robot between cells.
- An unfinished harvest restores the pre-commit ripe crop with its remaining
  freshness and no reward. A finished harvest saves crop removal or sugarcane
  regrowth, EXP, coins, seed drops, and reward flags together. Restore must not
  run the original reward callback.
- In-flight programs lose uncommitted run evidence and resume stopped. Do not
  award a concept quest merely because a partially executed program was saved.
- Quest completion and claim are separate persisted states. Claiming commits
  the claim flag and every reward/unlock in one snapshot; loading replays neither.
- Timed pest/fire/rain mutations checkpoint after a simulation step. Old
  callbacks must be canceled or fenced by playthrough generation before reset.

Autosave immediately after committed economy, reward, quest, and world actions;
coalesce saves within one frame. Debounce editor changes at 500 ms with a two
second maximum wait, and checkpoint evolving world timers at least every two
seconds. Keep at most one transaction in flight and one newer pending snapshot.
Expose Saving, Saved, or Save failed with the last committed timestamp.

Return to Menu waits for a successful flush or an explicit player decision to
leave without saving. Hidden/pagehide events request a best-effort checkpoint,
but cannot be the primary save mechanism: browser lifecycle events are not
guaranteed, especially on mobile. See
[pagehide guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event).
Abrupt process termination can lose changes after the last successful commit;
the plan does not promise zero loss during an uncommitted write.

## New Game and Continue orchestration

Use an explicit controller with menu, loading, restoring, playing, saving, and
recoverable-error states. Buttons cannot trigger overlapping transitions.

**Continue:** read and validate the save before mutating the active farm. Pause
updates, commands, event scheduling, lesson auto-setup, and autosave. Initialize
the engine/assets once; clear the prior farm's owned entities and callbacks;
restore stores and dimensions, soils, crops, water links, robots/inboxes/programs,
hazards, lesson/tutorial policy, then UI. Validate world invariants. Only after
the whole restore succeeds enable gameplay and saving. Failed hydration leaves
the save intact and offers recovery; it must not autosave a half-built farm.

Mounting QuestHUD must not release restored protection or seed new practice
crops before restoration completes. Move lesson lifecycle ownership to the
playthrough controller, or give the HUD an explicit validated resume path.
Completion and optional switching must still release protection. Returning to
the menu pauses the playthrough; permanent teardown cleans its engine objects.
Keep the existing protection integration fixture and extend it for these cases.

**New Game:** ask confirmation with the existing farm name and save time. Build
and validate a fresh candidate from immutable defaults. Freeze the old generation
and retain its checkpoint while initializing the replacement. Switch the active
save only after the new farm is ready; failed initialization/storage commit
restores the old playthrough or leaves it available to Continue. Reset every
gameplay singleton, map, inbox, program, reward ledger, and lesson marker. Start
one bot on the default farm and restart per-playthrough onboarding even if an
older playthrough completed it. Once replacement succeeds, recovery generations
must belong to the new playthrough, so recovery cannot unexpectedly resurrect
the deliberately replaced farm.

**Recovery:** distinguish no save, valid save, corrupt payload, unsupported future
version, unavailable storage, quota exceeded, and a blocked database upgrade.
Offer the previous valid checkpoint when available and export of the damaged
save for diagnosis. Preserve the damaged record until recovery succeeds or the
player explicitly replaces it. No silent reset or fallback that claims to save.

**Two tabs:** coordinate a single active writer, preferably with
[Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), and
check playthrough ID/revision in every database transaction. Use a transactional
lease/fencing token if Web Locks is unavailable. A stale tab must pause and
reload rather than overwrite newer progress, particularly after New Game.

## Research and temporary scenes

Keep the playable checkpoint independent of `algobot_sessions`. Start a new
research session on a page reload and link it to the same playthrough; do not
fabricate offline activity or merge sessions by rewriting prior observations.
Returning to the menu in the same page should not accidentally create duplicate
session endings or reward records. Preserve participant-level first-exposure
records across New Game.

Checkpoint the main farm before opening a challenge or demonstration. While a
temporary scene is active, keep that main-farm checkpoint authoritative. A reload
returns to the farm with an explanation that the temporary activity was
interrupted. Mark an unfinished assessment interrupted/abandoned exactly once;
never score it or grant a reward automatically. Persist challenge editor drafts
separately if needed. Completed challenge rewards must update the farm ledger
and economy atomically even if the reward is earned in an isolated scene.

## Implementation and commit sequence

1. **State contract and fixtures.** Inventory every mutable owner, pin KAPLAY,
   define the schema/default factories/action-normalization table, and add
   representative saves plus invalid/corrupt fixtures. Commit before UI work.
2. **Storage and recovery.** Implement IndexedDB adapter, validation/migration,
   active/prior checkpoint transactions, revision fencing, and typed failure
   results. Fault-injection tests must pass before integrating the engine.
3. **Farm capture and restore.** Implement entity adapters and staged hydration;
   reuse actual component harnesses. Prove water ownership, action normalization,
   rewards, and teardown invariants without relying on the menu.
4. **Progress and lifecycle integration.** Persist editors, quests, unlocks,
   tutorial/lesson ownership, hazards, difficulty, and reward ledgers. Integrate
   autosave, temporary scenes, and research boundaries.
5. **Menu and recovery UI.** Add New Game, Continue, confirmation, save status,
   error/recovery flows, and revised return-menu copy. Preserve the existing
   visual direction; perform the chosen review-afterward UI audit.
6. **Browser and endurance verification.** Add automated browser tests, exercise
   real reloads and multiple tabs, run failure injection and randomized runs,
   document limits, and commit the verified feature. Keep risky behavior behind
   a feature flag until all release gates pass.

## Required test matrix

Proposed code boundaries:

- `src/game/persistence/schema.js`: validation, canonicalization, versions.
- `src/game/persistence/defaults.js`: fresh gameplay state without shared mutable defaults.
- `src/game/persistence/storage.js`: database transactions, recovery and writer fencing.
- `src/game/persistence/snapshot.js`: detached capture and pending-action normalization.
- `src/game/persistence/restore.js`: ordered reconstruction and invariant checks.
- `src/game/persistence/controller.js`: autosave and playthrough transitions.
- `tests/save-schema.test.js`, `tests/save-storage.test.js`, and
  `tests/save-lifecycles.test.js`: unit, fault-injection and component coverage.
- `tests/e2e/save-continue.spec.js` and dedicated browser fixtures: actual
  reload, menu, IndexedDB, multi-tab, and interruption coverage.

Use Node tests for pure state/storage logic and the existing actual-component
harness for gameplay. Add a maintained browser test runner for real Svelte,
KAPLAY, IndexedDB, editors, and reloads; manual fixture checks supplement it.
Use deterministic clocks/RNG and assert state, never just screenshot appearance.

| Suite | Required cases and assertions |
| --- | --- |
| Schema and migrations | Missing/extra fields, every enum, negative/fractional counts, oversized input, unknown IDs, duplicate IDs, dangling references, bad versions, nonfinite timers, truncated JSON export, migration failure. Unknown versions stay untouched. |
| Storage faults | Read denial, failed open, quota, blocked upgrade, transaction abort before/after each request, close during pending write, stale revision, corrupted current/previous records, recovery failure. Prior committed state survives; no false Saved status. |
| Round trips | For every valid fixture, capture -> encode/decode -> restore -> capture equals canonical data except declared derived/transient fields. Test fresh and developed farms, dimensions, bots, upgrades, optional selections, both editors, and all unlocked crops. |
| Crop and soil | Every one of six crop types across young/growing/ripe/dead, dry/partly wet/full, multiple growth offsets, low health and near-spoilage. Continue absorbs water immediately; empty/dead soil drains; removing/replanting cannot inherit the old dose; sugarcane regrows and corn adjacency still works. |
| Every quest | For all 44 quests, reload incomplete, completed-unclaimed, and claimed states; reload with prepared lesson tiles and after reset; verify optional selection, progress, program requirements, unlocks, and no repeat rewards. Test every crop type on restored practice tiles. |
| Protection | Reload protected/unprotected farms; finish a restored quest; return from optional practice; claim then prepare next lesson; pause in menu; Continue repeatedly. Growth runs while spoilage is protected, stale protection clears, practice hazards are owned/cleaned, Start farming ends tutorial protection. |
| Action boundaries | Reload before mutation, after mutation/before callback, and after completion for each command. Especially harvest/seed drops, purchase/upgrade, movement, message send/receive, two bots on one tile, quest claim, challenge reward. Compare inventory and world state with the defined commit point. |
| Editors and bots | Multiple bots, stacked bots, stable IDs and upgrades; Blockly variables/functions/mutators and disconnected blocks; exact text contents including syntax errors; empty programs; editor switches; unsaved debounce edge. No code executes or awards progress on load. |
| Events and offline time | Save each fire stage, pest movement/attack phase, cloud/drop phase, cooldown boundary, and simultaneous events. Advance wall clock by minutes/days before Continue: simulation timers remain unchanged. Test resize and different pixel density during restore. |
| Temporary scenes | Reload during demo, challenge execution, scoring, reward claim, and return transition. Only main-farm objects persist; interrupted assessments are not scored; claimed rewards cannot repeat. |
| New Game | Cancel, confirm, double click, initialization failure, write failure, reload during replacement, second-tab writes, old delayed callback after reset. Defaults restored; exactly one farm/bot set; old save retained on failure; settings/research preserved. |
| Continue and recovery UI | Absent/valid/corrupt/future save, valid backup, all storage unavailable; keyboard focus and confirmation dismissal; rapid clicks; load error then retry; refresh at each transition. No blank or partially restored playable screen. |
| Research | Reload creates correct session linkage without offline gameplay; cheat taint persists; New Game preserves prior sessions and exposure records; persistence hooks do not duplicate telemetry or contaminate challenge labels. |
| Concurrency | Two tabs Continue; second tab New Game; first tab resumes from suspension; writer crashes; lease expires; out-of-order writes. Stale writers never replace a newer playthrough. |
| Endurance | At least 100 load/menu/resume cycles and 50 New Game cycles with object, timer, listener, bot, and scheduler counts checked. Seeded randomized actions plus reloads across at least 100 seeds, recording failing seed and minimal sequence. |

Storage mocks must inject faults at operation boundaries. Run the IndexedDB
transaction and browser lifecycle cases in real browsers too; a fake store alone
cannot establish persistence safety. The existing crop harness already covers
real component methods and should remain part of the release suite.

## Release gates

- Existing 350 automated tests remain green, with any intentional lifecycle
  changes explained and equivalent protection guarantees retained.
- All matrix rows have executable coverage and a traceable assertion. No test
  may pass merely because Restore throws or silently starts a fresh farm.
- Run Chromium, Firefox, and WebKit browser suites, including a mobile-size
  viewport and restricted-storage cases. Investigate platform differences.
- Production build passes. Repeat smoke tests against the production preview,
  not only the Vite development server.
- Round-trip equality and uninterrupted-versus-restored deterministic scenarios
  pass under the declared stopped-program and pending-action normalization rules.
- Failure injection preserves the last committed checkpoint. Reward, purchase,
  and claim tests show no duplicated gains or partially applied deductions.
- A 20 by 20 farm with 20 bots and substantial editor content remains responsive.
  Initial target: snapshot capture/validation below 16 ms on the agreed reference
  machine; measure save size, transaction latency, and frame stalls. This is a
  target to validate, not a claimed benchmark or a new gameplay limit.
- Corrupt saves, unsupported versions, storage denial, and multi-tab conflicts
  all provide a recoverable user-visible outcome.
- Final report lists actual test counts, browsers, failure-injection results,
  persistence limits, and commit hashes. No claim that saves survive cleared
  site data, a different device/origin, or every OS-level crash.
