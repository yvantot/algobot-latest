# Synthetic augmentation experiment

This experiment checks whether modest variations of recorded training examples help predict challenge scores. It does not create evidence from additional students, and it does not alter the normal recorded-data training workflow.

## Fixed design

Use the existing round-two, fixed-condition datasets and their frozen participant splits. Prepare first-exposure eligibility across all recorded sessions before selecting the fixed-condition cohort. Train first-harvest and careful-steps models separately.

For each task, generate 90 explicitly synthetic sequences: 30 per provisional score category, with seed 20260929. Select donors only from the real training partition. Retain each donor's challenge score and temporal ordering; slightly perturb nonzero gameplay rate features. Preserve zeros and stage, robot count, game speed and observation ages. These are feature augmentations, not recordings of simulated game sessions or independently scored students.

Each synthetic record must identify its donor assessment and synthetic origin. A missing training category is an error; do not invent unsupported targets or draw donors from validation or test participants. In this cohort each task has only one low-score training donor. Thirty variations of that donor still represent one observed player.

Fit the scaler on real training data only. Use the same LSTM and MLP architectures, seeds 42/43, maximum 60 epochs, and validation-only early stopping as the original run. Each epoch combines all real training examples with an equal number of deterministically selected synthetic examples. Choose checkpoints and candidates using only real validation scores. Evaluate the selected models only on the original real test participants.

Include a donor-resampling control with the same extra examples, category balance and training schedule, but unchanged donor features. Compare it with the jittered synthetic arm and the original real-only run. This helps distinguish the effect of feature variation from repeatedly sampling or reweighting existing observations.

The earlier test results have already been viewed. This comparison is exploratory and cannot be presented as another untouched test or used to claim confirmed improvement. Do not tune augmentation settings or change the split in response to these results.

## Files and safeguards

- Real exports remain in `training/raw`, unchanged.
- Synthetic records go in `training/synthetic/round2-2026-09-29`, excluded from Git.
- Experiment outputs go in a new directory under `training/prepared`, also excluded from Git.
- Save settings and hashes before fitting; refuse to overwrite existing outputs.
- Keep the deployed model unchanged. Experimental models need separate review before deployment.
- Report real and synthetic counts separately, alongside the real-only model and mean baseline.

Results measure the recorded challenge score under this collection protocol. They do not independently establish general programming expertise, learning improvement, or DDA effectiveness.

## Results: 29 September 2026

Generated 180 labeled synthetic records across the two tasks. The LSTM did not improve on the real test participants with this augmentation method. RMSE is measured on normalized scores (0 to 1); lower is better.

| Task | Real test players | Real-only LSTM | Real + synthetic LSTM | Donor-resampling LSTM | Mean baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| First harvest | 3 | 0.4925 | 0.4931 | 0.4931 | 0.4753 |
| Two careful steps | 2 | 0.0385 | 0.1528 | 0.1558 | 0.0604 |

The augmentation and donor-resampling results are similar. This experiment provides no convincing benefit from synthetic feature variation. First-harvest validation selected epoch 1, so its selected augmented LSTM had seen only 11 of the 90 generated sequences. The careful-steps selected augmented LSTM used epoch 36 and had seen all 90.

Category accuracy remains 0% for first-harvest LSTM and 100% for careful-steps LSTM. The latter test contains only two middle-category players; even the constant-mean baseline reaches 100%. These figures do not establish proficiency-category discrimination. Each task has just one low-score training donor, and the collection spans multiple recorded builds. Keep these limitations alongside the results.

Validation: 287 automated tests passed, all three independent code reviews found no blocking issues, all 16 experimental candidates passed artifact/scaler checks, and selected models reproduced saved predictions after reloading. The 70 snapshotted raw, baseline and deployed files remained unchanged; all 40 preserved research artifacts passed verification. Models remain experimental and undeployed.

### Reproduction

The prepared data and frozen plans are local research artifacts. They must be available before these commands can run. Output paths must be new; reruns require different output filenames/directories and must not be selected for better test results.

```powershell
node scripts/synthetic-experiment.js training/prepared/round2-2026-09-29/first-harvest-v1-fixed.json training/prepared/round2-2026-09-29/first-harvest-v1-plan.json training/prepared/round2-2026-09-29/first-harvest-run training/synthetic/round2-2026-09-29/first-harvest-synthetic.json training/prepared/synthetic-round2-2026-09-29/first-harvest-run
node scripts/synthetic-experiment.js training/prepared/round2-2026-09-29/careful-steps-v1-fixed.json training/prepared/round2-2026-09-29/careful-steps-v1-plan.json training/prepared/round2-2026-09-29/careful-steps-run training/synthetic/round2-2026-09-29/careful-steps-synthetic.json training/prepared/synthetic-round2-2026-09-29/careful-steps-run
```

The full local report, per-class precision/recall/F1, predictions and verification hashes are under `training/prepared/synthetic-round2-2026-09-29`.
