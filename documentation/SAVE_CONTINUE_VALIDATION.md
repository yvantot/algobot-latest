# New Game / Continue verification

September 30, 2026. Windows development host; KAPLAY pinned to
`4000.0.0-alpha.27`. Implemented on `codex/farm-lifecycles-weather`; not deployed.

## Behavior implemented

- One saved playthrough in IndexedDB, plus a previous checkpoint. Continue
  reconstructs entities from validated plain data, preserving crop-water
  ownership, quests, economy, unlocks, programs, inboxes, pests, weather clocks,
  lesson ownership, and the gameplay RNG. No interpreter or animation closure
  is serialized. Programs return stopped.
- Closed time does not advance simulation. New Game uses explicit overwrite
  confirmation, creates a fresh playthrough, and preserves research records,
  first-exposure history, and preferences.
- Autosave runs every two seconds, with a short coalescing delay for commands,
  economy mutations, and editor interactions. Returning to the menu awaits a
  checkpoint. Unload saving is best effort; the last completed transaction is
  the durability boundary, not the last rendered frame.
- Web Locks and an IndexedDB lease/revision check prevent competing writers.
  Storage failures remain visible; Retry, explicit recovery, diagnostic export,
  and leaving without saving are available. Recovery cannot cross an assessment
  boundary, and it marks the restored playthrough as recovered research data.
- Assessment opening, scoring, closing, and rewards write the farm and research
  transition together. Interrupted assessments retain their original participant
  and session. Research deletion uses tombstones; compatibility export uses an
  idempotent outbox and Web Lock.

KAPLAY's prefab documentation and the installed implementation informed the
serialize/reconstruct choice. The source links and API limitations are recorded
in [the plan](SAVE_CONTINUE_PLAN.md#kaplay-documentation-and-serialization-decision).

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` | **378 passed**, zero failed/skipped. Baseline was 350. |
| `npm run test:e2e:chromium` | **18 passed**, including actual IndexedDB and real page reloads. |
| Production preview, Chromium | **6 passed**: reload/Continue, confirmed replacement/cancellation, foreign participant, competing tab, mobile keyboard flow, denied storage. |
| `npm run build` | Passed. Existing Svelte/accessibility and bundle-size warnings remain; this is not an app-wide accessibility audit. |
| Actual engine quest reconstruction | All **44 quests × 3 states = 132** restores; no reward replay. |
| Actual engine endurance | **100 restores + 50 new farms**; bot, soil, and root entity counts bounded. This does not measure every browser listener or timer. |
| Randomized controller/storage sequences | **100 seeds × 12 mutations/reloads**, with failing seed and shortest failing prefix in assertion messages. These are logical mutations, not 100 full-browser play sessions. |
| Water the row regression | Restored practice crop consumes water; completed quest releases lesson protection. |
| Offline behavior | All six crop types retain ownership and remain young after reload with the clock advanced two days. |
| Hazard parity | Deterministic uninterrupted-versus-restored fire/rain scenarios at eight offsets, lesson fire timing, substituted fuel rejection; browser pest clock/reservation round trip. |

Additional executable assertions cover invalid schemas/catalogs/references,
future versions, duplicate IDs, owner mismatch, transaction aborts and quota
failure, stale revisions, recovery floors, reward rollback/retry/deduplication,
simultaneous assessment requests, interruption deduplication, tombstones,
asynchronous research retries, multiple bots, Blockly XML, inboxes, and stopped
program state. See `tests/save-*.test.js`, `tests/ml-runtime.test.js`,
`tests/entity-lifecycles.test.js`, and `tests/e2e/save-continue.spec.js`.

The browser test fixture mounts the real App and exposes its actual module
instances. It is not included in the production bundle. Tests use a dedicated
Vite server on port 5174 with hot reload disabled. Earlier runs on the ordinary
development server suffered unrelated page reloads; the final isolated run
passed all 18 tests.

### Measured large-farm case

20 × 20 tiles, 20 bots, approximately 220 KB of text programs:

- Capture plus schema validation, 10 samples: **3.1–6.6 ms**.
- Capture/checkpoint transaction: **58.5 ms** end to end.
- Serialized checkpoint: **303,888 bytes**.

These are local Chromium development measurements, not a device-independent
performance guarantee. Frame stalls, low-end phones, and large accumulated
research histories have not been benchmarked.

## Review and corrections

The implementation review found and corrected:

1. A second assessment request could roll back an in-flight transition. Reject
   concurrent transitions before taking rollback snapshots or mutating state.
2. Failed challenge closing could dispose the temporary farm before the
   assessment was durable. Retain the challenge and allow another close attempt.
3. A successful transaction followed by a failed verification read could be
   mistaken for a failed commit. Obtain the committed root from transaction
   completion; no extra read determines write success.
4. Asynchronous logger retries could omit an earlier failed session after a
   telemetry reset. Retry every pending immutable session snapshot.
5. Corrupt unlock/crop catalogs could reach restore before failing. Validate
   catalog shape and numeric values before reconstructing any scene.

Anti Slop review used the user's **review afterward** preference and retained
the existing illustrated cover and wood-button style. New controls fit the
390 × 844 viewport; keyboard Enter, initial Cancel focus, Escape cancellation,
and focus return pass in the production build. Normal button text contrast is
approximately **5.27:1** (`#fff6e5` on `#945926`); hover is approximately 5.44:1.
The confirmation names the replaced farm and explains what is retained.
Screenshots of the menu and confirmation were inspected. No remaining
actionable finding was identified in these new controls; existing Settings,
About, and in-game UI were not comprehensively audited.

## Remaining release gates and limits

- **Firefox is unverified:** installed Playwright Firefox fails to launch on
  this host with `spawn UNKNOWN`.
- **WebKit is unverified:** this Windows runner fails when importing KAPLAY
  with `ReferenceError: Can't find variable: AudioBuffer`, before App mounts.
  No audio stub was substituted to manufacture a passing result. Run the suite
  on a supported WebKit host and a working Firefox runner before broad release.
- The feature is enabled in this development branch. The plan's production
  rollout flag is not implemented; this branch should not be treated as an
  approved production rollout while cross-browser gates remain open.
- The full design matrix is broader than the executed suite: exhaustive
  browser action/claim/purchase boundary combinations, all animation offsets,
  listener/timer leak instrumentation, and low-end performance still need
  release-level coverage. Existing action lifecycle tests remain green.
- IndexedDB currently stores the farm and research data in one atomic root.
  This makes assessment transactions straightforward, but large research
  histories increase cloning and write cost. No unlimited-history claim is made.
- There is no cross-device/cloud sync. Clearing site data removes local saves.
  Abrupt process/OS termination can lose work since the last committed save.
  Without Web Locks, revision/lease protection remains, but the compatibility
  localStorage research projection is withheld; canonical IndexedDB export
  remains available.

## Reproduce

```powershell
npm test
npm run test:e2e:chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

With preview running, in another terminal:

```powershell
$env:SAVE_TEST_URL='http://127.0.0.1:4173'
npm run test:e2e:chromium -- --grep 'New Game saves|New Game cancel|OWNER-1|second tab|menu and confirmation|denied IndexedDB' --output=test-results-production
```

Install the matching Playwright browsers once with `npx playwright install` if
they are absent. `tests/e2e/browser-probe.mjs` provides a small launch/import
diagnostic for a named browser.

Implementation milestones: `cde0949` (save contract and storage), `44a87ce`
(logical commits and clocks), `ba1b372` (world, UI, and research integration).
The subsequent verification commit contains this report and the browser suite.
