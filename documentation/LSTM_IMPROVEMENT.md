# LSTM experiments and runtime changes — September 24, 2026

## Outcome

DQN no longer loads, predicts, or selects actions. The dashboard no longer displays Q-values. Old DQN files, training scripts and replay exports remain historical artifacts; they are not part of the active policy. The existing replay export format remains readable and records difficulty transitions for compatibility, not online reinforcement learning.

The deployed LSTM is unchanged. Two alternative LSTMs were trained and evaluated, but neither earned promotion. The backend/server is deferred.

## Data and experiment

Run from the repository root with installed Node dependencies:

```powershell
node scripts/train-lstm-experiment.js training/experiments/new-run-name
```

The command rejects an existing output directory. It runs entirely with the installed TensorFlow.js package; the project's old Python virtual environment points to a missing Python installation.

- Deduplicated the raw exports into 28 sessions and recovered 21 labeled examples from three recorded participant IDs. IDs do not prove distinct people.
- Used only observations at or before a quest's completion. Untimestamped snapshots were not assigned invented times. Legacy examples use recorded quest-end vectors.
- Observed sequence lengths: 10 examples have one step, six have two, three have three, one has four, and one has five. Remaining positions are zero padding, not observations.
- Generated 240 reproducible **synthetic** counter-based scenarios for experimental pretraining. Each carries source type, scenario ID, generator version and label provenance. These approximate command errors, resets, hints and successful runs; they are not a full game simulator or student behavior model. Synthetic rows are rejected by the real-data evaluation splitter.
- Preserved the ten-feature contract and original artifacts. No independent skill labels were invented.
- Compared a compact LSTM(4) with L2 regularization against the same architecture pretrained for eight epochs on simulated scenarios. Both use a sigmoid output, Adam, fixed initialization seeds, training-only scaling and validation-based early stopping with best-weight restoration.
- For each of three outer folds, held out one participant ID, reserved another ID for validation, and trained on the remaining ID. This is extremely small exploratory evaluation, not a reliable population estimate. No synthetic samples enter validation or testing.

## Results

Lower RMSE and MAE are better. These results use recovered sequences and new folds; they are not directly comparable to the old four-example test report.

| Predictor | Pooled held-out RMSE | MAE |
| --- | ---: | ---: |
| Training-participant mean | 0.07087 | 0.05775 |
| Compact LSTM | 0.07331 | 0.06244 |
| Simulation-pretrained LSTM | 0.08803 | 0.06965 |

All real reference labels still fall in Advanced under the provisional 0.3/0.6 cutoffs. All three predictors achieve 100% category accuracy; none establishes discrimination of Beginner or Intermediate. Per-class support and undefined metrics are included in the JSON report. Macro F1 uses all three categories, treating undefined contributions as zero.

Final candidate artifacts are refitted using all recorded samples and the median validation-selected epoch count. Outer-fold metrics belong to separately trained fold models, not an untouched holdout for the final refit. No candidate was selected for deployment based on these test results. Do not repeatedly tune against this report and then describe it as independent confirmation.

Outputs: `training/experiments/2026-09-24-lstm/` contains recovered data/source hashes, synthetic training data, fold membership, predictions, learning curves, evaluation, and browser-compatible weights/scalers for both candidates. Keep each model with its matching scaler.

## Runtime improvements

The LSTM's historical inputs are unchanged. A separate rule-policy window uses the last three minutes of gameplay, so earlier mistakes do not permanently trigger assistance. Its success-rate indicator is behavioral evidence, not a measurement of psychological flow.

- Assistance can begin immediately.
- Challenge requires at least three successful recent code runs as well as the existing score thresholds.
- Other changes require two consistent recommendations and at least 60 seconds since the previous change.
- Exported decisions identify `recent-window-v1` and the recent measurements used.

These are engineering defaults, not empirically optimized educational thresholds. A low LSTM prediction can still request assistance; this work does not make the model accurate outside its observed training coverage.

## Research wording and next evidence

Suggested architecture description: “Algobot uses an LSTM recurrent neural network to estimate gameplay proficiency from performance sequences. An explicit rule controller combines this estimate with recent gameplay indicators to adjust farming conditions.” Remove claims that a deployed DQN learns the optimal intervention.

The training labels remain gameplay-formula proxies. Future pre/post scores should be paired by participant and scored using a consistent rubric, separately from model training labels. Once independently collected gameplay covers a wider skill range, use participant-separated validation and freeze the chosen model before final assessment. No server or participant collection workflow was added in this change.

## Verification

169 JavaScript tests pass, including candidate artifact loading, source separation, no-future-observation recovery, scaler isolation, DQN removal and policy recovery/stability. The 40 preserved research artifacts pass checksum verification. Production build passes with existing accessibility/bundle warnings.
