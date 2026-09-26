# September 26 collection audit

All six JSON exports in `training/data/raw` pass the canonical v4 importer and session SHA-256 checks. They contain eleven sessions belonging to six participant IDs. Originals were not edited. Participant IDs are not proof of six distinct people; confirm shared-computer clear/reset procedures in the study log.

| Task | Usable first scores | Raw scores | Status |
| --- | ---: | --- | --- |
| Your first harvest (`first-harvest-v1`) | 5 participants | 1/3, 1/3, 2/3, 3/3, 3/3 | Compatible pilot data |
| Two careful steps (`careful-steps-v1`) | 1 participant | 6/9 | Compatible pilot data |

The Two careful steps participant also has a Your first harvest score. These are different targets and must not be pooled to manufacture six participants for one task. One additional Two careful steps attempt is unfinished and correctly excluded without assigning zero. One participant never opened either scored task. Later retries remain practice; their higher scores do not replace the first evaluated score.

Every accepted input passes the training dataset validator: twenty intervals of twelve finite features, with its input window ending before the challenge opened. Gaps, short sessions and empty sessions exist, but the accepted windows pass the continuity and normal-speed checks. No padding, invented labels or altered timestamps were needed.

## Limits of this batch

- The holdout planner correctly refuses both task datasets: it requires at least six usable participant IDs for the same task. Six is only a software minimum; this batch does not support a credible LSTM accuracy claim or deployment decision.
- With provisional 0.3/0.6 cutoffs, Your first harvest has class counts **0 Beginner / 2 Intermediate / 3 Advanced**. Two careful steps has **0 / 0 / 1**. There is no evidence here for performance on the Beginner category. Do not change the cutoffs just to fill it.
- The old gameplay proxy labels are all Advanced. Those are not the training targets above. The audit now reports actual target class counts separately.
- In the five first-harvest input windows, stopped-run, loop and condition rates are always zero; robot count is always one. These values are valid observations, but this batch cannot teach the model how those features relate to ability. Preserve them and collect broader natural gameplay; do not invent activity.
- Every session records base commit `0004316103467b40bcdc2b1f227076e54db91cd7`, `dirty: true`, and no build version. The exact uncommitted changes used during collection cannot be recovered from those fields. Keep the recorded provenance and document the actual collection build if known. Do not relabel these sessions as the current version.

## Local prepared files

`training/prepared/collection-2026-09-26/` contains `first-harvest.json`, `careful-steps.json`, and `audit.json`. The datasets are separate, retain sample provenance and source-file hashes, and are ignored by Git because they contain participant-level records. Raw exports remain untouched and uncommitted.

To audit later batches, run `npm run audit:collection -- training/data/raw`. The report now includes per-task dataset compatibility, holdout-plan eligibility, actual target score/category counts, constant features and build-provenance warnings. Technical usability does not establish task validity or statistical adequacy.

For the next collection, keep one fixed build and procedure and aim for more first attempts on the same agreed task. A returning participant's practice retry cannot replace a first attempt. Save exports even when unfinished. No model was retrained or replaced during this audit.
