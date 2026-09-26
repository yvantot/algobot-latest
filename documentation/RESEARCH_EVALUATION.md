# Research evaluation protocol

Historical protocol: the current challenge-score workflow is in [MODEL_WORKFLOW.md](MODEL_WORKFLOW.md). The Python scripts below train/evaluate the retired gameplay proxy and must not be used for new collection exports. The deployed model has since changed; reproducing the historical diagnostic requires a separately restored historical model bundle, passed explicitly with `--model path/to/historical/model.json`.

This document separates three questions: whether the software works, whether its LSTM agrees with gameplay proxy labels, and whether students improve on an independent algorithmic-logic assessment. None is a substitute for the others.

## Existing data: what can be recovered without collecting again

Keep the original files and trained models. The historical processed dataset contains 21 labeled examples from 3 recorded student IDs, split into 14 training, 3 validation, and 4 test examples. The raw exports contain 28 distinct sessions across 4 recorded IDs. Sessions and sliding windows are not independent students, and a recorded browser participant ID is not proof of a distinct person.

The legacy extractor guessed the association between quests and snapshots by quest index. The old snapshots have no timestamps, so their exact timing cannot now be reconstructed. Corrected preparation uses timestamped snapshots when available and explicitly marks conservative quest-end-vector recovery for old sessions. It does not invent missing observations. New exports timestamp the snapshots. Do not silently combine the old and corrected telemetry definitions in a new training run.

Prepare into a new directory. The corrected split keeps each known student ID in one partition and saves its sample/split manifest. Group separation is needed when one subject contributes multiple observations ([scikit-learn cross-validation guidance](https://scikit-learn.org/0.24/modules/cross_validation.html)). With only three labeled IDs, a three-way student split leaves just one ID per partition; it is exploratory and cannot provide a stable population estimate.

Re-preparing a dataset does **not** make the already trained model independent of the new test partition. A defensible grouped evaluation would require a separate retraining run on the existing samples, retaining the old model and all old results. Do not report the old model's predictions on the new split as an untouched holdout. No new samples or retraining are needed merely to reproduce the historical model's predictions.

## Objective 3: categorized regression

The LSTM remains a regression model. Apply the same predefined cutoffs to reference scores and predictions:

| Category | Score interval |
|---|---|
| Beginner | 0 <= p < 0.3 |
| Intermediate | 0.3 <= p < 0.6 |
| Advanced | 0.6 <= p <= 1 |

These cutoffs are **provisional**, not approved or empirically validated. Keep them fixed for this evaluation; do not move them to manufacture balanced classes. The reference score comes from a hand-written gameplay formula involving completion, errors, retries and hints. It is a proxy, not an independent expert assessment of algorithmic reasoning. The model's inputs overlap with the quantities used in the formula, so this is agreement with that formula rather than independent validation of student skill.

Report accuracy, precision, recall, F1, per-class support, the confusion matrix, macro averages across all three declared classes, and weighted averages. Explicitly identify absent classes and the convention used for undefined values. A weighted average can obscure missing classes; macro averages treat each class equally ([scikit-learn classification report](https://scikit-learn.org/1.0/modules/generated/sklearn.metrics.classification_report.html)). Also report RMSE/MAE and compare with a predictor that always uses the **training-set mean**, plus a majority-category baseline.

All historical labels are 0.80–1.00, so there are **zero Beginner and Intermediate examples**. Even perfect accuracy on these data cannot establish three-category discrimination. Do not synthesize missing student responses or label synthetic gameplay as collected student evidence.

### Evaluate the preserved deployed model

Run from the repository root using a working Python with NumPy. Use new filenames if outputs already exist; the tools refuse to overwrite results.

```powershell
python training/evaluate_model.py --data training/data/processed --export-inputs logs/legacy-inputs.json
node scripts/predict-deployed-model.js --input logs/legacy-inputs.json --output logs/legacy-predictions.json --model path/to/historical/model.json
python training/evaluate_model.py --data training/data/processed --predictions logs/legacy-predictions.json --output training/results/review/legacy-model-evaluation.json
```

The checked report already occupies that final path in this repository. For a repeat run choose a new report name (and new logs filenames if necessary). Regression tests can be run with `python -m unittest discover -s training -p test_pipeline.py`.

This runs the exact browser topology and weights with TensorFlow.js on CPU. Processed inputs are already normalized and are not scaled twice. The prediction file records artifact hashes. The output should be labeled a historical diagnostic, because the original split lacks saved student-disjoint provenance and the test set contains only four examples. CPU artifact tests do not measure classroom-device browser latency.

## DQN and the abstract

The stored DQN training count of 100 includes repeated exported experiences. Deduplication leaves 40 unique transitions, all for action 0 (Normal). This supplies no empirical comparison of Scaffold, Challenge, Greedy Guide, or State Optimize. A decreasing training loss does not establish policy quality. Offline Q-learning can fail when estimating actions absent from the training distribution ([Fujimoto et al., ICML 2019](https://proceedings.mlr.press/v97/fujimoto19a.html)).

For this code revision, retain the DQN as an experimental component and use the labeled LSTM-plus-rules deployment. If the approved scope requires a validated DQN policy, discuss that requirement with the adviser: the existing replay cannot establish it. If RNN-based DDA is sufficient under objective 1, the abstract can state:

> Algobot is a 2.5D farming game in which first-year Computer Science students program robot helpers using blocks or scripts. An LSTM recurrent neural network estimates a gameplay proficiency proxy, and explicit difficulty rules adjust assistance and challenges. A DQN policy was implemented experimentally but was not deployed because the existing replay data lacked coverage of alternative actions. The system is intended to support algorithmic-logic practice; learning improvement will be evaluated using paired pre-test and post-test scores.

Use future tense for the planned study and past tense only after activities actually occur. Rain/pest interventions are game mechanics; the computed flow and frustration values are behavioral proxies, not validated measurements of psychological flow or emotion.

## Objective 2: upcoming paired assessment

Status: **not yet evaluated**. The planned programming/algorithm questions can be suitable if their content and scoring match the intended skills; their existence alone does not establish validity.

Before student testing, freeze the study build and record its Git commit, model hashes, gameplay mode, duration, task sequence, item set, total possible score, scoring rubric and category thresholds. Have the adviser or subject experts review the assessment coverage. Include tracing/sequencing, conditionals, loops, and whichever later concepts students will actually encounter during the fixed session. Avoid claiming coverage of late stages if the session only reaches sequencing.

Use an anonymous study ID to pair each student's pre-test and post-test. Keep a private mapping if needed; the device-generated participant ID alone does not ensure correct pairing across shared machines. Record pre-score, post-score, maximum possible score, assessment version, completion status, session duration, system commit and actual DDA mode. Use equivalent difficulty and a fixed rubric. A repeated identical test has a practice effect that must be reported; parallel forms need comparable content/difficulty.

Analyze one paired change per student: post minus pre, along with pre/post summaries and a confidence interval for the average change. Decide the paired statistical method with the adviser before examining results, considering the distribution of within-student differences and the sample size. Report effect size and uncertainty rather than only whether a p-value crosses a threshold. Define handling of missing or incomplete pairs beforehand; never replace missing scores with zero.

A one-group pre/post study can show an observed improvement after use. It cannot by itself establish that the RNN or DDA caused the improvement, since practice, teaching and other factors may contribute. The existing A/B gameplay report is not this assessment and contains no ML comparison group.

## Objective 4: ISO/IEC 25010 evaluation

Use the edition named in the protocol consistently. ISO/IEC 25010:2023 supplies a quality model for specifying and evaluating product properties; it is not automatic certification of this project ([official ISO description](https://www.iso.org/standard/78176.html)). The user's selected dimensions should be operationalized with evidence:

| Dimension | Evidence to gather on the frozen build |
|---|---|
| Functional suitability | Expected/actual results for robot commands, both editors, quests, inventory/shop, rain/pests, difficulty settings and research export. Include failed as well as successful code runs. |
| Performance efficiency | On the actual classroom computers: startup/model-load time, frame responsiveness, inference duration, and memory over a full session. Record hardware/browser, sample size, measurement method, medians and slow cases. |
| Interaction capability | Student observations and a reviewed questionnaire covering understanding instructions, navigating editors, error feedback, reading hints and completing tasks. Test keyboard access and intended viewport size. |
| Reliability | Recovery from invalid code, infinite loops, missing model/scaler, storage failure, menu/re-entry and page close; verify exported data. Document that complete farm restoration across refresh is absent. |

Set acceptance criteria with the adviser before testing. Automated checks support specific behaviors; a successful build alone does not mean all four dimensions have been evaluated.
