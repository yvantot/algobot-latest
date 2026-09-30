# LSTM and challenge review — September 25, 2026

Follow-up: a browser integration issue escaped the automated review below. An expiring challenge crop opened a hidden main-game tip that paused the engine. Isolated crops now suppress main-game freshness and corn-synergy tips, and the browser fixture includes the real tip popup. Before the pests has since been verified end to end in the browser (both rows, 6/6, pest ending and reward claim). The suite now has 221 passing tests.

The collection, preparation, local training and runtime paths are connected. Automated verification covers export/import, training and reload, challenge solutions using actual entity components, interruption and isolation. This establishes software behavior; it does not establish prediction accuracy or student learning improvement.

## Corrections from this review

| Problem | Correction |
| --- | --- |
| Main-farm DDA modified the crop settings used by challenges | Challenge farms receive a frozen baseline crop profile. The same crop component handles growth, water and spoilage. Main-farm settings are preserved. Both team bots receive fixed action timings. |
| A pest-planning program that only spoke earned 4/6 points | No harvested yield now earns zero points. The rule is visible to students. |
| An irrelevant loop or if statement could earn a programming-concept point | Successful crop actions must occur inside the required control structure. |
| Crop readings counted against the smaller robot-action limit | Sensor checks and robot actions have separate counters. Interpreter step limits still apply. |
| Overlapping exports could discard newer submissions or choose between crossed partial histories | Import compares events, snapshots, attempts and submissions. It rejects incompatible histories and retains developer exclusions in either file order. |
| Same rubric name could hide different tasks or assessment protocols | Training requires a single task, rubric and assessor protocol. These identities appear in plans, evaluation and the model card. |
| Inference could finish after the player opened a challenge | The runtime checks the collection phase again before applying a prediction or fallback. |

Changed rubrics have new task IDs. New assessment records use `algobot-live-cases-4.0`. Historical definitions remain readable; old and new protocols must not be pooled in one experiment.

## What feeds the next model

Normal gameplay is sampled every five seconds independently of model inference. The new input contains 20 intervals from 21 snapshots: approximately 100 seconds of normal-speed gameplay before opening the chosen challenge.

The 12 features are rates of errors, edits, completed runs, failed runs, stopped runs, requested hints, harvests, spoilage, loop iterations and conditions, plus stage and robot count. Raw command, messaging, quest, event and DDA records provide diagnostics; not every exported field is an LSTM input.

The label is the first submitted program's normalized score on one fixed challenge. Challenge execution and rewards are outside its input window. Missing submissions are missing labels, not zero scores. Retries and prior exposures are practice. Guided practice, interruptions in the observation window, accelerated gameplay and developer sessions do not become valid training examples.

This target measures performance on that task. Whether it predicts broader programming proficiency or useful main-farm difficulty decisions remains an empirical question. Challenge correctness alone cannot establish that relationship.

## Training and deployment

The local TensorFlow.js workflow separates participants across training, validation and test sets, fits the scaler on training data, selects LSTM candidates on validation data, and reports a held-out comparison against mean and MLP baselines. Regression and category metrics include class support and missing categories. The 0.3/0.6 category cutoffs remain provisional.

Tests train only temporary fixtures. No new student dataset or newly validated model exists as a result of this review. The deployed model remains the legacy ten-feature LSTM; the next workflow uses `recent-12f-v1`. Candidate bundles do not overwrite deployed weights. Runtime difficulty actions use rules informed by the LSTM and recent gameplay; DQN is not used for action selection. The current Node training path uses CPU, not the Radeon GPU.

## Collection procedure

1. Pilot one chosen challenge and freeze the build and task before collecting the cohort. The existing workflow example uses Two careful steps (`careful-steps-v1`).
2. For each participant on a shared computer, export the previous participant's JSON, clear stored data and reload. Confirm the new participant code.
3. After the tutorial, allow about 110 seconds of uninterrupted normal-speed gameplay before the first opening of the chosen challenge. Access remains available earlier, but early attempts may lack a usable input window.
4. Let the student attempt the same task under the same assistance rules. Keep unfinished sessions in the export for participation reporting.
5. Download the canonical Dataset JSON after each participant. Audit the files before clearing the only copy. Keep originals unchanged.

Twenty players do not guarantee twenty usable labels. Tutorial duration, early challenge entry, missing submissions and narrow score coverage can reduce usefulness. The small held-out group will limit the strength of accuracy claims. Pre/post test analysis for learning improvement remains separate.

See [the model workflow](MODEL_WORKFLOW.md), [collection protocol](DATA_COLLECTION_PROTOCOL.md) and [challenge behavior](ALGORITHM_CHALLENGES.md) for commands and details.

## Verification

- `npm test`: 220 passing tests, including all active challenge solutions, real component growth and pest damage, main-farm messaging, isolation, cancellation, export provenance, and fixture training/evaluation/reload.
- `npm run build`: passed; the existing large-bundle warning remains.
- `npm run verify:artifacts`: 40 retained or historical artifacts match the baseline.
- `git diff --check`: passed. This review used automated component/interpreter checks; it did not repeat the previous browser walkthrough or conduct student usability testing.
