# Round 2 collection checklist (version 1.3.9)

This is the **only** document to follow on collection day. Where another document disagrees, this one wins. Background and training steps are in [MODEL_WORKFLOW.md](MODEL_WORKFLOW.md).

## Study decisions (agreed with adviser, 26 September 2026)

| Decision | What it means on the day |
| --- | --- |
| Two tasks in a fixed order | Every student does **Your first harvest** (`first-harvest-v1`), then about two minutes of farming, then **Two careful steps** (`careful-steps-v1`). Each task is a separate training target; never pool their scores. |
| Speed fixed at 100% | Study sessions lock the game at 100%. Pause still works. |
| Difficulty fixed at Normal | The adaptive difficulty system does not change crop timing, pests, fire or hints during study sessions. The model's proposed action is still logged for later analysis. Scheduled hazard events are off. |
| Sample size | Aim for **at least 30 usable first scores per task**. This is a planning target, not a power calculation. The frozen holdout split sets aside about 20% of participants as the untouched test group. |
| New round, new data | Round 2 cannot be combined with the September 26 pilot: the feature schema and collection conditions differ. The training pipeline refuses to mix them. |
| Known input limitation | The ~100-second gameplay window carries little skill signal (loops, conditions and stopped runs are usually zero). Accepted for this round and reported as a limitation. Raw events are kept so a second feature version can be defined later (see MODEL_WORKFLOW.md). |

## How the game enforces this

Study conditions switch on automatically when the game is opened with a researcher-assigned code (`?study_participant=CODE`). Without a code the game behaves normally and the session is **not** usable for this round. In study mode:

- Speed buttons other than pause/play are disabled.
- Difficulty stays at Normal; no scheduled hazards.
- Challenges must be opened in order: Your first harvest, then Two careful steps. Other challenges unlock only after both have been opened.
- Two careful steps needs 20 fresh gameplay intervals **after** Your first harvest closes (about two minutes of farming). Earlier gameplay does not count.
- Exports record `study_protocol: fixed-conditions-v1`. Preparation rejects out-of-order attempts and refuses to mix study and non-study data in one experiment.

## Before the session

1. **Commit and push everything**, and let the deployed site (https://algobot-latest.jidalman-work.workers.dev/) rebuild. For a local run, restart `npm run dev` instead. Do not edit or redeploy while students play. Collection members follow [COLLECTION_MEMBER_GUIDE.md](COLLECTION_MEMBER_GUIDE.md).
2. Open Dev Console → **Check Collection**. It must show **Build 1.3.9, committed**. If it says *uncommitted changes*, the export's `build.dirty_files` lists which served files differed from the commit; fix that, rebuild and reload. Untracked data files and logs no longer count. Every pilot session was recorded as uncommitted, so its exact code cannot be recovered.
3. Create a new folder for this round, e.g. `training/data/round2-2026-09/`. Do not put round 2 files in `training/data/raw` (that folder holds the pilot).
4. Confirm **Download Dataset JSON** works on each computer and a backup location is ready.
5. Run one disposable staff practice session with a code like `STAFF-TEST`, export it to a separate folder, then Clear Stored Data and reload. Never mix staff sessions into the student folder, and never use a real student code (such as `R2-P001`) for a staff test: that code was used for the 26 September staff test and is retired.

## Per student

1. Confirm the previous student's JSON is downloaded **and** backed up. Only then use **Clear Stored Data**.
2. Open `https://algobot-latest.jidalman-work.workers.dev/?study_participant=CODE` with the next unused code from your assigned block (see the member guide). Open this URL directly after clearing, before choosing Start Game, so no code-less session is created. The `R2-` prefix keeps round 2 codes distinct from any earlier codes. Keep the name-to-code list separately, and reuse the same code for that person's pre/post tests.
3. Choose Start Game for a fresh farm. In Dev Console → Check Collection, confirm the participant code and **Study conditions: fixed-conditions-v1**. If it says *No study conditions*, reload with the code before the student plays.
4. The student finishes the tutorial normally. No tutorial skip, resource grants, developer speed controls or forced events: developer actions exclude the session.
5. About **two minutes of farming**. Check Collection shows "Gameplay window ready" when ready.
6. Student opens **Challenges → Your first harvest**. Stop & Edit is allowed. The first fully evaluated run is the score, including a failure or zero. Later retries are practice.
7. Back on the farm: about **two more minutes of farming**. The game waits for fresh gameplay before the second task opens.
8. Student opens **Challenges → Two careful steps**, same rules.
9. Check Collection: both tasks should show **usable training label**. If not, export anyway and note the reason shown.
10. **You** download the Dataset JSON from Dev Console, confirm the file exists in the round folder, and back it up. The student's **Finish & Download Data** button is a convenience only; do not rely on students sending files. Export unfinished sessions too.

Students do not need to finish the game or any other challenge. If a student leaves before scoring, record the reason; never enter a zero or substitute a retry.

## Audit each batch

```powershell
npm run audit:collection -- training/data/round2-2026-09
node scripts/prepare-challenges.js training/data/round2-2026-09 training/prepared/round2-first-harvest.json first-harvest-v1
node scripts/prepare-challenges.js training/data/round2-2026-09 training/prepared/round2-careful-steps.json careful-steps-v1
```

Output paths must be new. In the audit, check:

- `collection_protocols` shows only `fixed-conditions-v1`. Sessions under `none` were not started with a code.
- `build_provenance` shows `dirty_sessions: 0` and version `1.3.9`.
- Per-session issues `no_assigned_participant_code`, `no_fixed_study_protocol` or `uncommitted_build_changes` mean the session was not collected under the agreed conditions.
- The score distribution. **After the first 5–8 students, if nearly all Your first harvest scores are 3/3, pause and review the task choice with your adviser** before collecting more.

Then follow [MODEL_WORKFLOW.md](MODEL_WORKFLOW.md) for the frozen split, training and one-time evaluation. Keep paired pre/post learning outcomes separate.
