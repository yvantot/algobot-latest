# LSTM collection review, 24 September 2026

## Decision for the next session

Use the next approximately 20 students as a supervised collection pilot. The code can collect gameplay and automatically scored challenge responses, export them, prepare sequences and train a browser-compatible LSTM. It cannot guarantee that a ten-minute visit yields a training sample or that this cohort will establish model accuracy. No new participant model was trained during this review.

The current model predicts an old gameplay proxy. The proposed model predicts **first-submission performance on one fixed programming challenge**, not a validated general ability score. DDA combines the LSTM estimate with rules and recent gameplay. There is no active DQN policy. Pre/post learning improvement remains a separate evaluation.

## Collection bugs repaired

- The Dev Console export button marked the session `developer_test` before downloading. That would exclude genuine students merely for exporting. Exports and scheduler inspection now leave eligibility unchanged; developer changes still exclude the session.
- Blockly program edits were never counted. Creation, deletion, field changes and connections now contribute edit events. Loading saved programs, switching robots, selecting blocks and dragging unconnected blocks around the workspace do not count as program edits. Text and Blockly editing events are still different units; use a consistent editor for the initial pilot and retain editor context.
- The capture audit counted 20 snapshots although the new features need 21. It now reports the correct minimum, developer exclusions and linked scored challenges. The CLI audit also runs actual task preparation for every task, showing usable first scores and exclusion reasons instead of only legacy proxy categories.
- Challenge preparation now verifies the task's rubric, maximum, case count and Boolean checks against the recorded score. Export checksums alone do not validate a scoring rubric.
- Instructions incorrectly claimed that early challenge entry was blocked and pointed to the old Quests location. They now describe the actual flow.

The export records telemetry revision `v4-blockly-edits-export-fix`. Freeze one build for collection; do not silently pool earlier missing-edit captures with this revision.

## What is collected and used

| Data | Use in the new workflow |
| --- | --- |
| Every five seconds: cumulative errors, edits, completed/failed/stopped runs, requested hints, fresh harvests, spoilage, loop iterations and condition evaluations | Differences between 21 snapshots become 20 rows of ten rates per minute. |
| Stage and robot count | Two context features per row, making the LSTM input 20 by 12. |
| Participant code, session ID, timestamps, phase, speed | Link scores to the right player, reject unsuitable windows and separate participants between splits. |
| First submitted program, per-case checks, score and maximum, task/rubric, first-exposure status | Automatically measured training target: first score divided by maximum. Only gameplay before task opening is input. |
| Raw events, quest history, DDA decisions, hazards, editor and farm size | Audit, debugging and later analysis. These are not all direct LSTM inputs. |
| Legacy ten-feature vectors and quest formula labels | Compatibility and historical diagnostics, not the new target. |
| Retries, stopped or abandoned challenges | Participation/practice records. Never substitute a better retry or invent a zero for missing work. |

Collection starts independently of model loading. Guided practice is recorded but excluded from the new training windows. Demonstration and challenge worlds are isolated from normal farm telemetry. Sampling skips hidden tabs, pause and blocking overlays. Browser timing is approximate, and phase checks do not establish that a student was attentive or independently authoring every action. Very brief changes between sampling ticks can be missed; record interruptions in the collection log.

## Shared-computer checklist

1. Freeze this build and run one staff pilot all the way through export and audit before the students arrive. Keep staff files separate from participant files.
2. Assign unique codes P001 through P020 across all computers. For a returning student, reuse their code and record prior challenge exposure.
3. After backing up the previous player's JSON, use **Clear Stored Data**, then fully reload with `?study_participant=P001` (change the code for each student). Clearing does not itself restart the farm. Never let two students share an active session. Do not use multiple active tabs for one browser profile.
4. Start a fresh farm. Let the student finish the tutorial normally. Do not use Finish tutorial, free coins, speed changes or other developer actions in participant sessions. Opening the console and downloading data are safe; gameplay cheats exclude the whole session.
5. After tutorial completion, allow **110 seconds of normal-speed, uninterrupted main-farm play** before any opening of the target challenge. After a pause, demonstration or another challenge, obtain a fresh window. Do not open the target to inspect it early.
6. Open **Challenges > Pick the ready crops**. Use the same task order, instructions and assistance policy for everyone. Let them submit their own attempt, including imperfect solutions. They do not need to pass or finish every challenge. Do not give the solution. Record outside help separately.
7. Download **Dataset JSON** from the Dev Console DDA tab after the attempt. Keep the original file unchanged in a backed-up collection folder. Check the participant code, source type and audit before clearing. Keep other analysis files out of that folder.
8. Run `npm run audit:collection -- "path/to/download.json"`. Under `challenge_targets`, find `ready-row-v3`: check `participants_with_usable_first_score`, developer exclusions and exclusion reasons. A file with many snapshots is not automatically a usable labelled sample.
9. Record code, computer, session duration, tutorial completion, task attempted/submitted, assistance/interruption and export filename. Keep incomplete sessions too. Then export/verify/clear/reload for the next student.

Ten minutes is a minimum opportunity, not a proven sufficient duration. The tutorial, 110-second input window and challenge all take time. If the staff pilot or first students cannot reach the task, extend the session consistently and document it. Do not remove slower students or use cheats to make the dataset look complete. The existing requirement to unlock challenges through tutorial progress is preserved.

## Training and deployment findings

The tested workflow in MODEL_WORKFLOW.md prepares one task at a time, deduplicates exports and splits by participant. Scaling is fitted only on training participants. It compares a training-mean baseline, an eight-unit LSTM and an eight-unit dense model using sequence averages. Two fixed seeds, validation-selected checkpoints and early stopping are implemented. Test evaluation is a separate guarded step; bundles do not overwrite deployed weights.

With 20 usable first scores, the default split is 12 training, 4 validation and 4 test students. One test student's category changes accuracy by 25 percentage points. Thousands of recorded timesteps do not turn into thousands of independent labelled students. Treat metrics as preliminary, report all category counts and exclusions, and review collection coverage before deciding the final evaluation design. Grouped development cross-validation is a possible later improvement; it is not implemented in the current holdout command. Never tune against the held-out test group.

The default 0.3/0.6 cutoffs are provisional. In the nine-point primary task they mean 0–2, 3–5 and 6–9 points. A safe but unproductive program can earn 3 safety points, so the rubric and categories need adviser review. A perfect code path or varied rewards do not validate the assessment. Different tasks must not be pooled simply because their scores can be normalized.

The deployed model and scaler are still the original pair; no accuracy claim about a new model is available. The runtime accepts the new schema and waits for a fresh valid window, using rules when it cannot obtain a prediction. Model quality, DDA usefulness and pre/post learning improvement are three different questions. Before replacement, review the score-to-difficulty thresholds, fallback behavior and whether predictions improve on both baselines.

## Remaining limitations

- Mission-gated access, first submission and first exposure can exclude slower players and stopped attempts. Report participation for all students. Do not repair missing labels with successful retries.
- The primary task is not automatically selected, and readiness is recorded rather than enforced. Researcher supervision is needed for the procedure above.
- Local browser storage is limited, has 30-second checkpoints and no server backup. Export after every participant. Submitted source code is included in exports; keep collection files private.
- Legacy replay-buffer collection still exists internally even though it is not used for supervised training or action selection. It is bounded to 500 entries and omitted from new session payloads; removing that dead subsystem can be a separate cleanup after collection.
- The recent rule policy still sees recent tutorial events, and the old model can influence the initial collection's gameplay. Record the build and DDA logs; do not describe the pilot as a fixed-difficulty control group. A later model should be tested for behavior under its own policy.
- The features and task need empirical evaluation. Stage/robot count can reflect progress and opportunity, not just skill; compare ablations later. A model trained on only one category cannot demonstrate discrimination of the missing categories.

Method references: [participant/group separation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data) and [training-only preprocessing](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage).

## Verification

- All 201 automated tests passed, including temporary-fixture training, held-out evaluation, bundle integrity and reloading the saved model for inference. Fixtures are software tests, not participant results.
- Production build passed. Existing bundle-size warnings remain.
- The artifact verifier confirmed 40 protected historical/model artifacts against its baseline; deployed weights were not replaced.
- Browser check on `QA_LSTM_AUDIT`: dragged one bot.right block, ran it and downloaded through the real Dev Console button. The checksum-verified JSON contained 19 guided-practice snapshots, one edit and one completed run, with source `recorded` and no export-induced developer exclusion. The audit correctly found no usable target because this staff check had not reached the challenge. A later developer action marked the active QA session as test-only. Keep QA downloads out of the participant collection folder.
- The full suite exposed a stale weather assertion expecting linear departure after the earlier change to eased cloud departure. Its continuity bound now matches the intended easing; weather implementation was not changed.
- No menu layout, artwork or styling changes were made in this review.
