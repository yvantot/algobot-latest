# New Game and Continue implementation plan

Status: revised after design review, September 30, 2026. This document specifies
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
The envelope also contains immutable participant/study ownership, simulation
time, versioned gameplay RNG state, and a recovery generation. Action receipts
and research transitions use unique operation IDs that are never reused after
recovery or New Game.

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
| Normal hazards | Full simulation clocks, stable fuel/cloud/event references, pest reservations, event aggregates, and remaining delays as specified below. Preserve gameplay effects, rebuild renderers. |
| Difficulty and timing | Farm-affecting difficulty/profile settings and event cooldown remaining. Reinitialize model runtime; never serialize tensors or training buffers. Study protocol restrictions still take precedence. |
| Integrity metadata | Developer-action taint, immutable owner/context, playthrough/research linkage, and recovery exclusions. Continue must not turn a cheated or recovered farm into an apparently clean research session. |

Do not save DOM nodes, listeners, WebGL resources, texture objects, display
objects, timer handles, functions, interpreter state, cached ASTs, transient
speech/effects/reward flights, or temporary demonstration/challenge entities.
Validation must bound payload size, text lengths, dimensions, counts, coordinates,
enums, finite numeric ranges, IDs, and references. Reject unknown future versions
without modifying the stored bytes. Migrate known older versions explicitly.

### Participant and study ownership

Bind a playthrough to `{ participantId, identityKind, studyProtocolVersion }` at
creation. `identityKind` distinguishes a researcher-assigned study code from a
browser-local ordinary-play identity. Match the effective context, not merely
the presence of a URL parameter: an absent parameter with the same stored study
identity is still the same owner. A changed code, cleared identity, ordinary/study
mode change, or incompatible protocol version is an ownership mismatch.

Resolve identity without writing participant storage before inspecting the save.
The current `resolveParticipant` writes immediately, so split identity lookup
from adoption. A mismatch blocks Continue and backup recovery before hydration,
telemetry initialization, or participant-key changes. Explain that the player
must restore the matching identity or confirm New Game for the requested owner.
Never adopt the saved owner automatically, relabel past records, or quietly
continue as another participant. This prevents accidental research mixing; it
is not authentication of a locally editable participant code.

New Game records its intended owner in the same transaction as the replacement.
Participant localStorage keys are a retryable projection of that decision; if
their update fails, retain a visible identity-sync error and block study activity
until reconciled. An explicit URL code still takes precedence during preflight
and cannot be overwritten by reconciliation. Persist an identity-adoption intent
with the confirmed replacement, including the expected prior identity. On reload
it can finish that specific interrupted adoption only if the browser identity
still matches the expected prior value and no URL requests a conflicting owner;
otherwise show the mismatch. Retire the intent after successful adoption. If
neither an explicit identity nor a persisted local identity is available, ask
for the matching study code or
offer confirmed New Game; do not infer ownership from the farm alone. A temporary
fallback identity may only create an explicitly research-excluded playthrough.

### Hazard clocks and references

Persist logical state separately from KAPLAY timers and rendering callbacks:

- Simulation: fixed-step `accumulator`, entity `sequence`, ordered entity lists,
  active gameplay time, and the gameplay RNG algorithm version/state. Preserve
  update order because rain impacts run before fire damage/spread. Route gameplay
  randomness through a saved seeded stream, including hazard selection/spread,
  pest movement, and seed-drop rolls; cosmetic randomness uses a separate stream.
- Fire: stable ID/tile, fuel `cropId`, settings, `stage`, `age`, `damageClock`,
  `spreadClock`, `matureAge`, and `matureDamage`. Resolve the original fuel by ID;
  a replacement crop must never inherit its fire. Reject inconsistent live-fire
  references rather than silently binding to whatever crop occupies the tile.
- Rain: event ID/settings, watered tile-ID set and extinguished-fire count;
  cloud ID/tile/side, phase, `phaseAge`, `dropClock`, travel/rain/exit/drop durations;
  each drop's ID, cloud ID, target tile, age and duration. Derive render progress
  from the saved phase/age. Replace `recordImpact`'s closure-only aggregate with
  explicit event data and rebuild the callback around that record.
- Pests: ID, settings/health, logical origin and reserved destination, movement
  phase and remaining jump time, next attack/move delay, and active exposure age.
  Off-farm spawning positions are valid within explicit bounds. Rebuild each
  reservation exactly once and retain its remaining movement time; do not apply
  the bot's stopped-action normalization to autonomous pests. Omit pests already
  logically removed while their death animation finishes.
- Scheduler: remaining check/event cooldowns and relevant event counters. A
  restore-aware start must not reset restored values as today's `start()` does.

Refactor timer-owned gameplay state into inspectable clocks before adding the
adapters. Store original wall-clock spawn timestamps only as provenance; response
telemetry uses accumulated active exposure time, never `Date.now() - spawned_at`.
Closed time, loading, menus, and suspended main-farm scenes do not advance those
clocks. Continuing a hazard must not log another spawn or replay prior damage,
rain impacts, or telemetry. Keep the originating event/session IDs when recording
a response in a later research session.

## Consistent checkpoints and interrupted actions

Capture one detached snapshot synchronously at a defined simulation boundary,
then persist it asynchronously. Never read half the snapshot, await a write,
and read the rest from a now-changed farm.

Audit every command's mutation point before wiring autosave:

- Plant, till, water, destroy, purchases, and upgrades commit applied world,
  economy, and eligible simple-action quest credit together, using the receipt
  protocol below. An animation finishing later is not a second action to replay.
- Movement restores the last committed tile and its matching occupancy; discard
  unfinished jump visuals. Do not restore a robot between cells.
- An unfinished harvest restores the pre-commit ripe crop with its remaining
  freshness and no reward. A finished harvest saves crop removal or sugarcane
  regrowth, EXP, coins, seed drops, and reward flags together. Restore must not
  run the original reward callback. Move the seed-drop RNG draw to this commit
  boundary so an abandoned harvest consumes no reward roll.
- In-flight programs lose uncommitted run evidence and resume stopped. Do not
  award a concept quest merely because a partially executed program was saved.
- Quest completion and claim are separate persisted states. Claiming commits
  the claim flag and every reward/unlock in one snapshot; loading replays neither.
- Timed pest/fire/rain mutations checkpoint after a simulation step. Old
  callbacks must be canceled or fenced by playthrough generation before reset.

Each command gets an operation ID and a receipt containing its bot, action,
target IDs, logical result, and eligible simple-action observations. A synchronous
commit path applies the world mutation, receipt, and quest observation before
any snapshot can be captured. For example, a successful wheat plant records the
`tut_2` plant action when the crop and seed deduction commit, even if its animation
is still running. Failed/no-op actions get no successful-action credit. Harvest
observations commit only when the crop transition and rewards settle together.

Refactor `command-api.js`'s current delayed tutorial observation into that commit
path; do not infer past success from the restored tile or call command callbacks
on load. Animation completion only releases the bot and advances the interpreter.
A late/duplicate callback for an applied receipt cannot award anything twice.
Keep completed-program evidence separate: partial execution can retain legitimate
simple-action credit but cannot satisfy a concept quest requiring a successful
whole run. Fence receipts/callbacks by generation, and retain deduplication state
until their callbacks are retired and the relevant checkpoint has committed;
restoration itself never replays receipts. Durable research delivery uses its
separate operation ledger below.

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

**Continue:** read and validate the save and its ownership before mutating the
active farm or initializing a research session. Pause updates, commands, event
scheduling, lesson auto-setup, and autosave. Initialize
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
the deliberately replaced farm. Pending research delivery for the old playthrough
survives replacement with its original owner/session IDs; it never targets the
new farm or its research session. The replacement transaction also closes any
still-open old assessment as abandoned under its original identity. Failure
commits neither the replacement nor that lifecycle transition.

**Recovery:** distinguish no save, valid save, corrupt payload, unsupported future
version, unavailable storage, quota exceeded, and a blocked database upgrade.
Offer an eligible previous valid checkpoint when available and export of the
damaged save for diagnosis. Preserve the damaged record until recovery succeeds or the
player explicitly replaces it. No silent reset or fallback that claims to save.
Recovery checks the owner and the research recovery floor described below. If
the backup predates that floor, offer export or confirmed New Game, not an unsafe
rollback. Record successful rollback under a new recovery generation and exclude
the resumed playthrough from study analysis; retained observations still describe
the original timeline and must not be rewritten as if rollback never happened.

**Two tabs:** coordinate a single active writer, preferably with
[Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), and
check playthrough ID/revision in every gameplay database transaction. Use a transactional
lease/fencing token if Web Locks is unavailable. A stale tab must pause and
reload rather than overwrite newer progress, particularly after New Game.
Research delivery checks its own revision/operation ownership, so an old
playthrough's pending entries can finish without modifying the active farm.

## Research and temporary scenes

Keep the playable checkpoint independent of the `algobot_sessions` projection.
Start a new research session on a page reload and link it to the same playthrough; do not
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

### Transactional research delivery

IndexedDB and localStorage cannot participate in a single transaction. Treat
IndexedDB as authoritative for persistence-related research transitions, using
separate stores for assessment lifecycle records, pending research operations
(an outbox), originating session context, delivery acknowledgements, and deletion
tombstones. Operations must contain enough committed data to reconstruct their
records if the first localStorage write never happened. Route DataLogger session
saves through the same IndexedDB research adapter and import legacy records
without deleting the originals. Commit import markers with imported records;
honor deletion tombstones before import so retained legacy bytes cannot reappear
after clearing. Corrupt legacy records remain exportable for diagnosis and are
not treated as an empty dataset. Research views/exports read the authoritative
store; localStorage becomes a compatibility projection. These records are not
additional playable slots or temporary-scene object snapshots.

1. Before entering an assessment, commit the main-farm checkpoint, assessment ID,
   original participant/session IDs, task ID, status, last active time, and an
   `opened` operation together. Commit first-exposure ownership in this same
   durable research domain; mirror the existing exposure key idempotently. If
   this transaction fails, do not enter the assessment. Import existing exposure
   records once without clearing them; study gating must consult authoritative
   exposure state even if the legacy localStorage mirror is behind.
2. Scoring, closing, and claiming each use a unique operation ID and an expected
   assessment state. A claim transaction updates the main-farm economy/reward
   ledger, assessment reward flag, and immutable outbox entry together. Publish
   success to the UI only after commit; on abort restore the tentative in-memory
   change under the transition barrier. Stage lifecycle telemetry with the
   operation too; do not let today's immediate logging publish an aborted claim.
   Never grant game rewards when delivering
   an outbox entry. Duplicate claim requests return the recorded result.
3. Project pending entries to their original session/assessment in localStorage,
   writing the applied-operation IDs and resulting record in the same `setItem`.
   Track delivery per destination key, including summary/raw/exposure projections;
   separate `setItem` calls are not atomic as a group. Only then acknowledge each
   delivery in IndexedDB. A crash before acknowledgment causes a harmless retry
   because the destination already contains the ID.
   Refactor DataLogger's whole-session upserts to merge by event/operation ID
   under the shared writer lock; stale queued session snapshots must not erase
   projected transitions or their deduplication markers. Fence every write path,
   including menus, exports that flush data, and research clearing.
   Without Web Locks, use transaction fencing for the authoritative IndexedDB
   adapter and disable legacy mirror writes: an expiring lease cannot fence a
   delayed localStorage write. Research reads/exports still work from IndexedDB.
4. On reload, close a durably `in_progress` assessment with the stable operation
   ID `interrupted:<assessmentId>` in one conditional transaction. Preserve its
   original session; record recovery time separately from last active time.
   An already scored/closed assessment is not abandoned or scored again. Drain
   the outbox without initializing the original session as the current session.
5. A localStorage quota/permission failure leaves durable operations pending and
   shows research-sync failure separately from farm-save status. Exports merge
   authoritative pending operations into a detached view or explicitly fail;
   never silently export an incomplete session as complete. Bound outbox growth:
   if further durable writes cannot commit, block new assessment transitions and
   report the storage error rather than drop records or grant unrecorded rewards.
6. App-requested research deletion first commits durable per-session tombstones
   (or a collection epoch for clearing all sessions), then clears the projection.
   Delivery and pending DataLogger snapshots honor these markers across reloads
   and tabs, so old outbox entries cannot resurrect deleted research. If the
   tombstone cannot commit, report deletion failure. Keep first-exposure records
   unless the user separately requests their deletion. New Game neither deletes
   this research metadata nor retags undelivered entries.

Every research transition links its playthrough, revision, and recovery generation.
Advance a nondecreasing recovery-floor revision when committing assessment entry,
score, close, or reward. In the same transaction set both active and recovery
checkpoint to the resulting main-farm state. Subsequent ordinary saves may rotate
the prior checkpoint normally, but neither backup nor automatic migration may
cross that floor. This deliberately gives up one older fallback at each research
boundary, preventing recovery from rolling back an already recorded claim or
assessment lifecycle. Validate the floor independently of the damaged payload.
If that metadata is missing or corrupt, refuse backup recovery rather than guess.
Closing an old assessment as part of New Game applies to the old playthrough's
research record; the new playthrough starts its own revision/floor lineage.
Research metadata and old-playthrough outbox entries are never restored from a
farm backup. Retained raw observations stay immutable; append recovery/exclusion
metadata rather than manufacturing or removing actions to fit the restored farm.

## Implementation and commit sequence

1. **State contract and fixtures.** Inventory every mutable owner, pin KAPLAY,
   define the schema/default factories, ownership rules, action receipts, full
   hazard clock inventory, and research transaction/recovery contract; add
   representative saves plus invalid/corrupt fixtures. Commit before UI work.
2. **Storage and recovery.** Implement IndexedDB adapter, validation/migration,
   active/prior checkpoint transactions, assessment/outbox/tombstone stores,
   recovery floors, revision fencing, identity preflight, and typed failure
   results. Fault-injection tests must pass before integrating the engine.
3. **Farm capture and restore.** Implement entity adapters and staged hydration;
   reuse actual component harnesses. Refactor logical action commits and gameplay
   clocks/RNG. Prove water ownership, action receipts, hazard next-step parity,
   rewards, and teardown invariants without relying on the menu.
4. **Progress and lifecycle integration.** Persist editors, quests, unlocks,
   tutorial/lesson ownership, hazards, difficulty, and reward ledgers. Integrate
   autosave, temporary scenes, idempotent research projection, and deletion paths.
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
- `src/game/persistence/ownership.js`: read-only identity lookup and save-owner checks.
- `src/game/persistence/actions.js`: logical commits, receipts and simple-action credit.
- `src/game/persistence/hazards.js`: clocks, RNG state and reference reconstruction.
- `src/game/persistence/research-outbox.js`: lifecycle transactions, projection and deletion.
- `src/game/persistence/snapshot.js`: detached capture and pending-action normalization.
- `src/game/persistence/restore.js`: ordered reconstruction and invariant checks.
- `src/game/persistence/controller.js`: autosave and playthrough transitions.
- `tests/save-schema.test.js`, `tests/save-storage.test.js`, and
  `tests/save-lifecycles.test.js`: unit, fault-injection and component coverage.
- `tests/save-ownership.test.js`, `tests/save-actions.test.js`,
  `tests/save-hazards.test.js`, and `tests/save-research.test.js`: the four review
  regression suites detailed below.
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

### Review regression cases

These named cases supplement the matrix and must become executable tests, not
manual checklist items. Test each durable boundary with a real browser reload
as well as unit fault injection.

| ID | Required regression and oracle |
| --- | --- |
| ACTION-1 | For till, plant, water, and harvest, interrupt before logical commit, after commit/before animation callback, and after callback. World/economy state and `tut_2` action history either both reflect the successful commit or neither do. Reloaded lesson progression remains achievable without undoing a successful action. |
| ACTION-2 | Deliver the same callback twice, deliver it after restore/New Game, fail an action, and stop a program after one successful step. No duplicate credit/reward; failed actions award nothing; partial runs never satisfy whole-program concept requirements. Include auto-claimed tutorial rewards in the same snapshot assertion. |
| ACTION-3 | Interrupt ordinary and sugarcane harvest before and after reward commit. Pre-commit restoration is ripe with no payout or consumed reward RNG draw; post-commit state includes every reward and crop transition exactly once. |
| OWNER-1 | Save under study participant A; request B, clear identity, use ordinary mode, or change protocol version. Continue and backup recovery are blocked before world/telemetry mutation, leaving stored save and identity untouched. Same stored A with the URL parameter removed succeeds. |
| OWNER-2 | Cancel/confirm New Game for B; fail its database write; fail identity projection; reload between successful replacement and identity adoption. Old farm remains on aborted replacement; committed B farm remains owned by B; reconciliation never overwrites an explicit conflicting code. Pending A research stays attributed to A. |
| RESEARCH-1 | Crash/abort at every open, score, close, claim transaction request and on both sides of each destination `setItem`/acknowledgment. Either no transition commits or all authoritative state does; retries yield one operation, one reward, and one assessment transition. Test summary/raw destinations independently. |
| RESEARCH-2 | Reload an open assessment repeatedly, including failure during interruption recording. Exactly one interrupted operation updates the original assessment/session; no score or reward appears. Repeat with scored, closed, and rewarded attempts and verify their outcomes stay unchanged. |
| RESEARCH-3 | Delay projection across New Game, participant change, stale DataLogger flush, and a second tab; fail localStorage while IndexedDB works. IDs/owner remain original, projections cannot revert newer state, exports include committed transitions, and sync failure does not falsely report farm failure. Disable Web Locks and verify the IndexedDB-only path. |
| RESEARCH-4 | Clear research with pending operations, crash after tombstone commit/before projection removal, reload, then retry delivery. Deleted records never reappear in UI, exports, or storage after cleanup. Failed tombstone commit reports failure; explicitly retained exposure records survive. |
| RESEARCH-5 | Corrupt the active checkpoint immediately after a claimed reward and after later normal saves. An eligible backup retains the committed claim; a pre-floor or foreign-owner backup is rejected. Recovery adds exclusion metadata without deleting original observations; New Game cannot recover its predecessor. |
| RESEARCH-6 | Import legacy sessions/exposure records; interrupt migration, retry, then delete imported research with legacy bytes still present. No duplicate or resurrected records. Corrupt legacy bytes are preserved for diagnostic export. Replace a playthrough with an open assessment and assert atomic abandonment/replacement, including transaction failure. |
| HAZARD-1 | Save one fixed step before fire damage, stage transition, spread, and fuel exhaustion, with nonzero accumulator/clocks; restore and advance the identical dt/RNG sequence. Assert identical health, fuel IDs, spread targets, fire removal, entity order/sequence and event counts. Reject dangling or substituted fuel IDs. |
| HAZARD-2 | Save rain just before emission, impact, and cloud removal; save pests off-farm, between cells with a reserved destination, and immediately before attack/death. Compare the next step and a multi-step trace with uninterrupted simulation: no lost/double impact, reset delay, duplicate reservation, or repeated death. |
| HAZARD-3 | Advance wall clock by minutes/days during closure and vary viewport/pixel density. Active timers, cooldowns, exposure age, and response-duration telemetry exclude closed time; old events gain no second spawn record. Include paused menus and temporary scenes. |

For next-step parity, branch one captured state into uninterrupted and restored
worlds, inject identical dt inputs, and compare state plus emitted logical events.
Apply the documented stopped-program/pending-bot-action normalization to both
branches before comparison; autonomous hazard clocks receive no normalization.
Round-trip equality alone cannot prove that restored clocks or callbacks work.

Storage mocks must inject faults at operation boundaries. Run the IndexedDB
transaction and browser lifecycle cases in real browsers too; a fake store alone
cannot establish persistence safety. The existing crop harness already covers
real component methods and should remain part of the release suite.

## Release gates

- Existing 350 automated tests remain green, with any intentional lifecycle
  changes explained and equivalent protection guarantees retained.
- All matrix rows have executable coverage and a traceable assertion. No test
  may pass merely because Restore throws or silently starts a fresh farm.
- Every ACTION, OWNER, RESEARCH, and HAZARD regression above passes, including
  real transaction/reload boundaries. Bind the test report to these IDs.
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

## Follow-up design review

The four original findings are addressed in the specification:

| Finding | Resolution | Required evidence before shipping |
| --- | --- | --- |
| Interrupted actions can strand tutorial credit | World mutation and simple-action observation share a logical commit/receipt; completed-run evidence remains separate. | ACTION-1 through ACTION-3 |
| Continue can mix participants | Immutable save ownership and read-only identity preflight block mismatches, including recovery. | OWNER-1 and OWNER-2 |
| Farm and research stores can disagree after a crash | Authoritative IndexedDB transactions, idempotent projections, interruption IDs, durable deletion markers, and a recovery floor. | RESEARCH-1 through RESEARCH-6 |
| Restored hazards can change behavior or count offline time | Full clocks/references, explicit aggregates, saved gameplay RNG and active-time response measurements. | HAZARD-1 through HAZARD-3 |

Review scope: consistency with the current command, quest, participant, challenge,
DataLogger, event simulation, and scheduler code; transition ordering; rollback;
and testability. No blocking design finding remains from this review. This is a
document review only: implementation, browser validation, and all new tests are
still pending. The recovery-floor tradeoff and legacy storage migration must be
explained in the eventual implementation report.
