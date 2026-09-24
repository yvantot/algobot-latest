# Local model workflow

This is the recommended workflow for the next collection. It replaces the legacy experiment command for new data. The model target is the first submitted program's score on a fixed Challenge Farm task, divided by its maximum. The game scores actual behavior on predefined test rows and includes the score in the dataset automatically. The old gameplay completion formula is retained only as historical/proxy telemetry, not as the target for this workflow.

There is no new real training dataset yet. The workflow has been exercised with temporary automated-test fixtures, which are not research results. Deployed weights remain the original model until a candidate is separately reviewed and installed.

## One collection export

In Dev Console, open the research controls and use **Download Dataset JSON**. That one v4 file contains participant/session identities, timestamps, gameplay snapshots, uncapped counters, quest attempts including unfinished attempts, challenge attempts and submitted programs, raw events, hints, DDA decisions and event severity. It includes build provenance, collection-quality checks, an export ID, and SHA-256 checksums for each session.

The separate Quest CSV and replay-buffer download buttons were removed. DQN replay is not needed for the new supervised target. New sessions omit the replay-buffer payload; DDA decision logs remain. Old stored records are preserved as originally recorded. The developer diagnostics download is for debugging the game, not another training dataset.

Checksums detect accidental modification; they are not signatures or proof that a record represents a real student. The importer verifies the manifest, rejects unreadable-storage recovery exports for training, and detects conflicting overlapping histories. It deduplicates repeated session downloads without making extra students or samples.

Browser persistence remains localStorage with 30-second checkpoints. This release does not add a backend or make browser storage unlimited. Download after each participant and check storage warnings. Keep original JSON files unchanged. **Clear Stored Data** prevents the current in-memory session from returning through autosave or export, removes the saved participant ID and removes `study_participant` from the current URL. Reload to generate a fresh ID, or open a URL with the next researcher's assigned participant code. Ordinary reloads without clearing retain the participant ID for repeat sessions.

For spreadsheet analysis, derive a summary from the JSON later:

```powershell
node scripts/export-quest-csv.js training/data/raw NEW-quests.csv
```

The CSV is a summary, not the input for training. Keep the JSON.

## Collect observations and independent scores

Follow [the collection protocol](DATA_COLLECTION_PROTOCOL.md) for participant codes, task administration and the draft rubric. Have the adviser review the task and rubric before the main collection. Record normal-speed independent gameplay immediately before the task. Use the same build and procedure; mark deviations. Restart the development server after a code change so its build provenance reflects the new version.

The new features require **21 snapshots for 20 observed intervals**, approximately 100 seconds at five-second sampling. Allow 110 seconds of uninterrupted independent play for timer alignment. Guided practice is excluded from these assessment windows. A long pause requires a fresh window. Challenge access is NOT gated on collection readiness: it records readiness for audit but allows early entry. The researcher must allow the gameplay window before the first opening. The opening timestamp is the cutoff and the main farm is paused. Challenge editing, execution and rewards never enter that pre-task input window. Do not invent scores for unfinished work.

The ten recent rate features are errors, edits, completed runs, failed runs, stopped runs, requested hints, harvests, spoiled crops, loop iterations and condition evaluations per minute. Stage and robot count are context features. Rates use differences between uncapped counters and the actual interval duration. They do not remain high merely because the student made mistakes earlier. The schema is `recent-12f-v1`.

These features are an engineering hypothesis to test, not a validated measurement of skill or emotion. A completed program is not necessarily a correct solution; a stopped loop is not necessarily an error. Automatic DDA hints remain in raw records but do not count as student-requested hints. Features, task validity and opportunity to practice still affect model quality.

The legacy ten-feature vector is still exported for traceability and retained for the deployed legacy model. New models use the shared recent-feature implementation in both preparation and runtime. Missing data, counter resets, malformed features and unsuitable intervals are rejected instead of padded into fictitious observations.

## Prepare the dataset

Place new downloads in `training/data/raw/`. No manual score sheet is needed for Challenge Farm. Use the primary task, `ready-row-v3`, for the initial experiment; prepare the harder `changing-row-v3` separately. Do not pool the two tasks just because both have nine points. A score of zero is valid; null means unscored. Pre/post tests are separate from the model-target importer.

From the repository root:

```powershell
npm run audit:collection -- training/data/raw
node scripts/prepare-challenges.js training/data/raw training/samples-v1.json
```

Read the exclusion report and participation counts in `samples-v1.json`. The importer retains one first-exposure, first-submission score per participant for the chosen task, accepts standard_in_game conditions from the live assessor, excludes reported/unconfirmed assistance, and never substitutes a better retry. Closing before submitting is unfinished, not zero. Browser exposure history prevents a reload from becoming another first exposure; the importer also checks across exported sessions. Keep the same participant code across devices and record any prior exposure that browser storage cannot detect. Preparation does not certify task validity. New output files must not already exist.

The older `prepare-assessments.js` and manual template remain available only for a separately administered, reviewed task protocol. They are not required for the built-in challenges.

## Freeze a participant split

```powershell
npm run model -- plan training/samples-v1.json training/plan-v1.json
```

The seeded split keeps every observation from a participant in one partition. Approximately 60% of participant IDs train, 20% validate and 20% test, with at least two IDs in each. Six IDs are the software minimum, not an adequate sample-size recommendation. Decide recruitment and an evaluation cohort with your adviser before collecting the full study. More windows from the same people do not replace more participants.

The plan binds the exact prepared dataset by hash. It records the target, rubric, feature schema, split, seeds, training limit and category cutoffs. Defaults are seed 42, two initializations, 60 maximum epochs, and provisional 0.3/0.6 category cutoffs. Review settings before training. Freeze cutoffs based on the assessment rubric, not on whichever values maximize accuracy. Do not regenerate splits until you get favorable results. If the dataset changes, use a new version and document why.

## Train locally

```powershell
npm run model -- train training/samples-v1.json training/plan-v1.json training/runs/run-v1
```

This uses installed Node and TensorFlow.js on the CPU. It does not require Python, Colab, a GPU or a server. Dependencies come from the repository lockfile. CPU speed is suitable for the deliberately small candidates; do not assume GPU-like speed for much larger datasets.

The workflow compares a training-mean predictor, an 8-unit LSTM, and an 8-unit dense model using the mean of each sequence's features. The dense model tests whether recurrence adds value over a simpler summary. Two fixed initializations are tried for each learned model. Training-only standardization, L2 regularization and validation early stopping limit avoidable overfitting. Each model family selects its seed by participant-macro validation RMSE, so people with more assessment windows do not dominate selection. Training loss itself remains sample-weighted; record uneven assessment counts and keep a consistent protocol.

`development.json` records architecture results, training curves, selected epochs, runtime versions, file hashes and baseline comparisons. Test metrics are not produced during training. The saved candidates are the validation-selected checkpoints, not models silently refitted on the full dataset. The recommended LSTM output stays within 0..1 using a sigmoid, but that is a score estimate, not a calibrated probability.

## Evaluate once after development decisions

```powershell
npm run model -- evaluate training/samples-v1.json training/runs/run-v1
```

This evaluates the fixed LSTM and dense-model choices and the mean baseline on the held-out participants. It writes `evaluation.json` and a readable `evaluation.md`: RMSE, MAE, R-squared, participant-level errors, accuracy, precision, recall, F1 and the confusion matrix. Undefined class metrics are null; absent classes contribute zero to the reported three-class macro F1 and are listed explicitly. Regression metrics remain necessary even when scores are categorized.

The command refuses repeated evaluation of the same run and records when test access began. This is a workflow guard, not a guarantee against researchers inspecting test data manually or creating new runs after seeing the results. Do not tune against this cohort after opening it. Use a new untouched cohort for a later confirmatory evaluation.

If evaluation crashes, preserve `evaluation-started.json` and the error log. Investigate the technical failure before retrying. The marker must be deliberately removed to retry; do not remove a successful evaluation to tune again. Incomplete training runs must use a new output directory. Nothing silently overwrites old evidence.

## Package a candidate, then review deployment

```powershell
npm run model -- bundle training/runs/run-v1 training/bundles/candidate-v1
```

The bundle contains browser-compatible `model.json`, weights, the matching scaler, and a model card with hashes and evaluation provenance. It never writes to `public/models`. `deployment_ready` remains false because running the commands does not establish that the model is suitable.

Before installation, review whether the LSTM improves on both baselines, whether the held-out scores cover the intended categories, whether task forms and scoring are defensible, and whether the cohort is large enough to support the claims. Poor results should be reported and investigated, not concealed by new cutoffs. A successful model prediction also does not prove that DDA improves learning.

The browser now understands both legacy and recent schemas. A recent-schema model waits for a valid 21-snapshot window and uses rules while observations are insufficient or stale. The same feature and scaling functions are used in training and runtime. Model and scaler must be installed together in a separate reviewed Git change. Difficulty thresholds and score interpretation must be reviewed with that change; a programming-task score is a different target from the old gameplay formula.

No backend was added. Paired pre/post learning outcomes remain separate from model development and require their own analysis.

References: [TensorFlow.js model save/load](https://www.tensorflow.org/js/guide/save_load), [scikit-learn data-leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage), and [grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data).
