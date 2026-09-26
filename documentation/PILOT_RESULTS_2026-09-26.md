# September 26 exploratory training

The LSTM was trained and evaluated on five recorded participants' first scored **Your first harvest** attempts. It did not outperform the training-mean baseline. This run verifies the collection-to-training pipeline; it does not establish a usable proficiency predictor.

## Protocol

The prepared input is `training/prepared/collection-2026-09-26/first-harvest.json`. Original exports, scores, input windows and cutoffs were unchanged. The one Two careful steps score was excluded because it is a different task. See [collection audit](COLLECTION_AUDIT_2026-09-26.md) for source limitations.

Five leave-one-participant-out folds each used three training participants, one separate validation participant and one test participant. Each person was tested once. Participant ordering and model initialization used fixed seed 42. Each scaler used only its fold's training data. Both learned models used the existing 8-unit architecture, Adam 0.003, L2 0.001, maximum 60 epochs and validation early stopping with patience 8. The mean baseline used the same three training participants. No seeds or cutoffs were adjusted after seeing results.

This is exploratory cross-validation, not an untouched final test cohort. The formal holdout workflow's six-participant minimum remains unchanged; that minimum is not an adequate study-size recommendation.

## Out-of-fold results

Scores range from 0 to 1. Lower RMSE and MAE are better. Category cutoffs remain provisionally 0.3 and 0.6.

| Predictor | RMSE | MAE | R-squared | Category accuracy | Three-class macro F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Training mean | 0.3296 | 0.3111 | -0.2222 | 40% | 0.1905 |
| LSTM | 0.3899 | 0.3548 | -0.7104 | 20% | 0.1111 |
| Dense neural network (MLP) | 0.3367 | 0.2880 | -0.2755 | 60% | 0.3889 |

LSTM category results:

| Reference category | Support | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: |
| Beginner | 0 | undefined | undefined | undefined |
| Intermediate | 2 | 0.25 | 0.50 | 0.3333 |
| Advanced | 3 | 0 | 0 | 0 |

Confusion matrix, rows reference and columns predicted, in the category order above:

```text
0 0 0
0 1 1
0 3 0
```

The report assigns absent classes zero when computing three-class macro F1 and retains undefined per-class metrics as null. Participant-macro RMSE equals MAE here because each participant contributes one score.

## Interpretation and next collection

The workflow uses actual gameplay inputs preceding independently scored challenge outcomes, keeps participants separate, fits normalization without test data and compares against simpler predictors. All ten saved neural models reloaded with exactly matching predictions. These are successful technical checks, not successful model performance.

Five people cannot support a stable accuracy estimate: one changed prediction moves accuracy by 20 percentage points. Several models selected epoch 1; with only three training and one validation participant, there is little evidence to select a useful fit. The LSTM's larger error does not establish that sequence models cannot work, but this experiment gives no evidence that recurrence helps.

No Beginner scores were observed. Stopped-run, loop and condition features were zero and robot count was one throughout the accepted windows. The task therefore provides limited coverage of broader algorithmic skills. Keep collecting natural first attempts on the same task and preserve other tasks separately. Do not force low scores, add invented participants, replace failures with successful retries or move category cutoffs to improve the result.

Use a fixed, recorded build and the shared-computer reset procedure for new participants. Preserve unfinished attempts without assigning zero. Keep future participants available as an untouched evaluation cohort when development decisions are settled. If rubric or task behavior changes, version it and review compatibility before pooling. Existing exports record a dirty build; that provenance cannot be repaired retroactively.

No deployed model was replaced. The pilot cannot be packaged by the production bundle command. Learning improvement still needs paired pre/post evidence; task-score prediction alone does not prove that adaptive difficulty helps.

## Local artifacts

Command used:

```powershell
npm run model -- pilot training/prepared/collection-2026-09-26/first-harvest.json training/prepared/pilot-2026-09-26
```

The ignored output directory contains the frozen pilot plan, all ten model/scaler pairs, fold histories, file hashes, source hashes, held-out predictions and `pilot-results.json`. It contains participant IDs and should remain local. The command refuses to overwrite an existing run. Keep this run as evidence; do not repeat experiments to select favorable results.

Prepared dataset SHA-256 (canonical parsed JSON): `bf8a374a4b03041a005fe75b7f3f51055652701cfa0b19439d223fd9d4a2ed6e`. Re-preparation matched all five samples and all six source hashes. Verification: 242 tests passed; 40 archived/deployed research artifacts retained their expected hashes.
