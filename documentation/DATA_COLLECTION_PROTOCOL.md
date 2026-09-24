# Gameplay collection for the next LSTM experiment

Use this protocol for task administration and the [local model workflow](MODEL_WORKFLOW.md) for the full plan, train, evaluate and bundle procedure.

Status: collection code implemented; scored-task protocol below is a draft for adviser review. No new participant results have been collected. The deployed model is unchanged. Previous datasets and experimental outputs were retired to Git history; see `training/DATA_RESET.md`.

## What was wrong with the earlier collection

- Feature sampling depended on model inference. Guided practice disabled inference, so that part of learning had no regular feature history. Model loading could also delay collection.
- Labels existed only for completed quests. Unfinished attempts were saved but excluded from training. This preferentially selects successful play.
- The old completion formula has a minimum of 0.40 for completed quests. Under the provisional 0.30/0.60 cutoffs, no completed quest can be Beginner. More players alone cannot fix that mathematical constraint.
- Formula labels reuse errors, hints and other information already in the input. Learning that formula is different from predicting independent programming performance.
- A browser-generated participant ID identifies a browser profile, not necessarily a person. Shared computers can merge students; changing browsers can split one student into several IDs.
- Stopping a program counted as an unsuccessful run. A deliberate stop of a working infinite loop is not necessarily a programming failure.
- Several legacy inputs are cumulative and saturate: errors at 10, loops at 5, conditions at 10, and elapsed time at the stage reference time. Keep their definitions for the deployed weights, but retain raw events and uncapped counters for a future feature version.

## What v4 captures

The collector runs every 5 seconds independently of model loading and DDA predictions. Browser timers are approximate; actual timestamps are recorded. Guided practice and normal gameplay are sampled. Demonstrations, hidden tabs, paused play and blocking overlays are excluded from feature sampling and recorded as context changes. Raw events have contemporaneous phase, quest and stage context.

Each snapshot includes the legacy ordered 10-feature vector, uncapped counters, editor, game speed, farm dimensions and robot count. Raw events retain DDA decisions, scheduled hazard severity, requested versus automatic hints, and individual run IDs, duration and outcomes (`completed`, `error`, `stopped`). A completed run means it ended without recorded execution errors, not that it solved the task. Stopped runs still enter the old model's legacy calculation; future features should use the richer outcome field.

Unfinished quests have an observation status, observation end time and elapsed observation duration. Leaving is censored observation, not a fabricated zero score. A score remains null unless actually measured. JSON exports include an audit with missing data, snapshot counts, gaps and proxy category counts. CSV alone is not sufficient for recurrent-model training.

The live model still uses its original inference history and scaler. Independent collection does not silently redefine its inputs. The next model must document and reproduce its chosen sampling cadence and feature transformations in both training and deployment before replacing the old model.

## Before inviting the full group

1. Have the adviser review the target, task difficulty, scoring rubric, participant procedure and category cutoffs. Freeze versions before the main collection. Do not adjust cutoffs after seeing accuracy.
2. Pilot the procedure with a few players of different prior programming experience. This is a collection check, not a statistically sufficient evaluation sample. Confirm that the tasks produce meaningful score variation without forcing errors or making students pretend to struggle.
3. Use the same build, instructions, starting farm and collection duration. Record the Git commit, date and protocol version in a separate collection log. No developer cheats, debug speed changes or manual hazard spawning during research sessions.
4. Assign a pseudonymous code such as `P001`. Keep any name-to-code list separately. On a shared computer open `http://127.0.0.1:5173/?study_participant=P001` before entering the farm. Use the same code on any other device for that person. After exporting the previous participant, fully reload the page with the new code and choose Start Game to create a fresh farm. Returning to the menu alone resumes the existing in-memory farm. Changing the code without a reload does not change an active session.
5. Confirm the displayed participant code in the DDA Research Panel. Record its session ID from the JSON export. The code persists locally; explicitly change it before the next person uses that browser. Invalid codes produce a warning and a temporary ID, which must be reconciled before using the data.
6. Let the student finish guided practice, then play independently at normal speed. Do not coach them through the scored task. Record any deviations instead of silently omitting them.
7. Collect at least 21 consecutive normal gameplay snapshots immediately before each model-target task (20 intervals, about 100 seconds; allow 110 seconds for timer alignment). This is a minimum window requirement, not a recommended total learning duration. Set the overall session length with the adviser. Pauses are allowed, but resume long enough to obtain a new uninterrupted window.
8. At the assessment start, record an ISO timestamp with timezone, pause the game, and administer the separate task. The first assessment timestamp should be within 15 seconds of the final gameplay sample. Record finish time, actual score and scoring provenance. A pause or stale window will be reported and excluded, never filled with invented observations.
9. Use **Download Dataset JSON** after each player and retain the original download. Check storage warnings. Browser storage is a checkpoint, not a server or guaranteed backup; losing power can lose changes since the last successful 30-second save. Never clear storage before verifying the downloaded file.
10. Audit each download before the player leaves. A sampling gap may be a legitimate pause; inspect context. Collect a replacement window while they are still present if the intended assessment window is unusable.

## Draft independent task (10 points)

Purpose: predict performance on a short algorithmic-logic task from the gameplay immediately before it. This is a measurable task score, not a diagnosis of general ability or an emotion score.

Allow pseudocode, familiar programming syntax or drawn blocks. Use the same time allowance and assistance policy for everyone. The draft below needs review and piloting; it is not a validated instrument.

| Item | Prompt | Scoring anchors |
| --- | --- | --- |
| Sequence, 2 points | Put these steps in order: harvest a ready crop, plant a seed, prepare soil, water the seed. | 1 for prepare before plant; 1 for water after planting and harvest last. |
| Trace a loop, 3 points | Start with `x = 0`. Repeat three times: add 2 to x, then display x. Write each displayed value. | 1 each for 2, 4, 6 in the correct positions. |
| Condition in a loop, 3 points | A row has crops `[ready, not ready, ready]`. Write steps to visit each crop and harvest only ready crops. | 1 for visiting all three, 1 for checking each crop's readiness, 1 for harvesting only when ready. |
| Repair an algorithm, 2 points | `i = 0; while i < 3: display i`. Explain the problem and show a fix. | 1 for explaining that i never changes; 1 for incrementing i inside the loop so it stops. |

Use a parallel form for a later checkpoint (different numbers/order but equivalent demands), with form identity recorded. Check form comparability during the pilot; do not pool arbitrary easy and hard tests merely because both have ten points. Preserve the actual response separately so another assessor can review scoring. Ideally assessors score without seeing the game's proficiency prediction. Do not score asking for help as evidence of low skill.

One checkpoint gives a cross-player prediction target. Repeated, reviewed parallel tasks after later gameplay windows can investigate progression, with all observations from the same participant kept in one split. Scores with assistance or an interrupted assessment stay in the records with their actual status and are excluded from this initial unassisted-target pipeline.

## Pre-test and post-test are a separate question

Your objective 2 requires paired pre/post results under a consistent assessment procedure. Keep the same participant code, form, score, maximum, time and missingness reason. Do not use the final post-test as both a model-development target and untouched evidence of system effectiveness. The initial importer only accepts `purpose: "model_target"`; `pre_test` and `post_test` records are retained but excluded. A pre/post improvement by itself does not establish that DDA caused the improvement.

## Prepare and audit data

Keep downloaded JSON in a new collection directory, separate from historical artifacts and simulations. Repeated exports are deduplicated by session ID and observation completeness; conflicting participant IDs cause an error.

```powershell
npm run audit:collection -- path/to/download.json
node scripts/prepare-assessments.js path/to/exports path/to/assessments.json path/to/NEW-samples.json
npm run model -- plan path/to/NEW-samples.json path/to/NEW-plan.json
npm run model -- train path/to/NEW-samples.json path/to/NEW-plan.json training/runs/NEW-run
npm run model -- evaluate path/to/NEW-samples.json training/runs/NEW-run
npm run model -- bundle training/runs/NEW-run training/bundles/NEW-candidate
```

Copy `training/templates/assessment-template.json` to a working file and replace the placeholders with real observations. Add an entry per assessment. Use ISO timestamps including `Z` or an explicit timezone. `score: null` means unscored; actual zero is a valid score. Use `status: "scored"` only after scoring, and `assistance: "none"` only if no assistance was provided. Do not fill missing results with zero.

The importer writes accepted samples plus an exclusion report and input hashes. It refuses to overwrite an existing output. Every accepted window has 21 actual consecutive normal-speed gameplay snapshots, all strictly before assessment start, yielding 20 recent-feature intervals. The training command uses recorded independent scores only; synthetic labels derived from the old formula are not mixed into this target. At least six distinct participant IDs are required mechanically for this workflow, but that is not evidence of an adequate sample size.

The experiment splits by participant, fits normalization only on training participants, compares against the training-mean baseline, and reports regression errors plus provisional category metrics. Missing classes remain visible. Do not tune repeatedly against held-out results. Decide a realistic participant count and untouched evaluation group with your adviser before the main collection; more windows from the same three people do not replace more independent people.

The current importer is deliberately conservative and uses the versioned recent 12-feature schema. The same transformation is implemented at runtime; the old ten features remain available for the deployed legacy model. New weights are candidates only and are not automatically deployed.

Method references: [TensorFlow time-series windows](https://www.tensorflow.org/tutorials/structured_data/time_series) describes explicit input/label windows. [scikit-learn grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data) explains keeping dependent observations together. [Leakage prevention](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage) explains training-only preprocessing.
