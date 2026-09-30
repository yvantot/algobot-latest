# Collection readiness review, 1 October 2026

Reviewed gameplay/upload source: `9b82683`, published through PR #2 at `9ec025d`.
The production smoke test confirmed browser uploads and caught a deployment
provenance problem: with no root Wrangler configuration, automatic Vite setup
modified `package.json`, `package-lock.json` and `vite.config.ts`, then rebuilt
after the upload verifier ran. A committed assets-only `wrangler.jsonc` now makes
deployment publish the already-verified `dist` files without changing source.
The final production smoke test must confirm the recorded build is clean.

## Checks completed

- **427 Node tests passed:** participant ownership, fixed study conditions,
  independent sampling, score eligibility, participant-level dataset splits,
  train-only scaling, model reload, stale inference, and upload safeguards.
- **All 41 Chromium tests passed:** all 44 quest states, interrupted challenges,
  reward rollback/retry, Continue with floating effects, 150 world reconstructions,
  storage failures, simultaneous tabs, 400 tiles with 20 bots, and upload fallback.
- **Chromium/workerd integration passed:** CORS, gzip, concurrent R2 conditional
  writes, multiple sessions in one file, stale retries and authenticated readback.
- **Live Cloudflare readback passed in both buckets:** four synthetic browser
  exports produced one player file with two sessions. Challenge score, submitted
  source, claimed reward and session checksums survived. These are transport
  fixtures, not student observations or evidence of model accuracy.
- **Collection-to-training round trip passed:** six fixture participants went
  through recording, persistence, participant-filtered upload, archive decoding and
  the actual preparation CLI. Labels and feature sequences matched local exports.
- Production build and upload-configuration verification passed. All 40 preserved
  research/model artifacts matched their recorded checksums.

## Findings and fixes

Continue stalled when bot destruction removed a floating icon or speech bubble
after KAPLAY had snapshotted the scene's root children. Cleanup now occurs before
that snapshot. Tests reproduce the former stall and verify repeated restoration,
including tilled soil at `[1,1]` in the seed shop quest.

Uploads use `round/participant/data.json.gz`. They retain sessions missing from a
later browser upload. Revisions and conditional writes protect concurrent updates
and late retries. Updates cannot drop history, challenge submissions, recorded
first scores, paid rewards or QA exclusions. Other participants' sessions are
filtered out. Local downloads still preserve whole-browser recovery data.
The combined archive retains the 16 MiB decompressed limit; an oversized update
fails without replacing existing data. Growth follows recorded activity rather
than repeated copies of overlapping snapshots.

The current model remains **provisional**, trained on five participants for one
refit epoch without an untouched final evaluation. Its pilot LSTM RMSE (about
0.390) was worse than the mean baseline (about 0.330). It is not a validated measure
of general programming skill. No model was retrained or replaced in this review.
Assigned-participant study sessions use fixed normal difficulty and disable
difficulty-scheduled hazards. Sampling is independent of model availability.
Ordinary farm weather is unchanged.

## Tomorrow's procedure

1. Assign a unique link to each student, for example
   `https://algobot.fun/?study_participant=P001`. Reuse their code when resuming.
   The plain site uses ordinary play conditions, not the fixed study protocol.
2. Use Chromium and fresh participant contexts. New Game preserves research and
   challenge exposure history; do not reuse practice codes for students.
3. Complete **Your first harvest**, then **Two careful steps**, allowing the fresh
   gameplay observation window between them. Wait for actual scores. Stopped and
   abandoned attempts remain recorded; they are not silently counted as zero.
4. Use **Finish / Download data** and wait for **Data sent ✓** before closing.
   Background uploads run every three minutes; closing the tab is not a confirmed
   final upload. On failure, retry or retain a local JSON download for review.
5. Download using `npm run pull-data -- round3`, then run
   `node scripts/audit-collection.js <folder>`. Prepare each task separately with
   `node scripts/prepare-challenges.js <folder> <new-output.json> first-harvest-v1 active-14f-v2`
   and separately `careful-steps-v1`. Do not pool different collection protocols,
   task rubrics or assessors.
6. Freeze participant splits before training, scale using training data only, and
   compare LSTM with mean and MLP baselines. The six-participant holdout gate is a
   software minimum, not a claim about sufficient study size.

## Test-data cleanup

At 2026-09-30 18:28 UTC, user-authorized cleanup removed **23 production objects**
and **55 test objects**. Both buckets were verified empty. This includes the old
retained QA records and this review's upload fixtures. The temporary backup was
discarded at the user's request.

Cloud deletion does not clear browser-local history. An old test browser can
upload its history again. Use fresh participant contexts for collection.
Detailed logs and metadata-only verification receipts are in the ignored
`.manual-save-review/` folder. Test exports are not committed or published.
