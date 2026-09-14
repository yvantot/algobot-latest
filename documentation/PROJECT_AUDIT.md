# Algobot project and research audit

Audit date: 2026-09-14 (Asia/Taipei). Original baseline: `008bc124204c7ff47e90e051625dcbb2bba22cd4`. Work branch: `codex/research-reliability`.

## Assessment

This is a substantial working educational-game prototype, with a real saved LSTM and DQN, not just an idea or mockup. It can support a course project about implementing and evaluating RNN-assisted dynamic difficulty, provided the report states its limitations. The original implementation and saved metrics are **not sufficient evidence that the model distinguishes proficiency levels, learns an effective DQN policy, or improves students' algorithmic logic**. Course acceptance is the adviser's decision; software fixes cannot guarantee a passing grade.

No original samples, processed arrays, models or historical reports were replaced, and no model was retrained during this audit. The original 40 artifacts are recorded in `preserved-artifacts.json`; run `npm run verify:artifacts`. JSON/CSV hashes allow Git's normal CRLF/LF conversion; binaries must match exactly.

## What the project does

Players operate a farm by programming robot actions such as movement, tilling, planting, watering, inspecting and harvesting. They can use visual Blockly blocks or JavaScript text. Formal algorithm quests cover sequential execution, conditionals and iteration. Greedy selection and state optimization exist as telemetry/DDA concepts but lack formal stage-4/5 quest progression. Crops, coins, seeds, inventory, research unlocks, farm expansion and robot upgrades create game progression. KAPLAY renders sprites and layered scenery with a 2.5D presentation; it is a browser-rendered 2D game engine, not a 3D simulation.

Gameplay telemetry forms a 20-step sequence with 10 numerical features. The LSTM maps it to a continuous gameplay proficiency estimate. DDA adjusts growth/spoilage timing and event probabilities and offers hints. The stored DQN accepts proficiency, curriculum stage, frustration proxy and flow proxy, and outputs five action values. Training is offline; browser inference does not retrain weights during play.

After the audit the default mode is **hybrid: LSTM estimates plus explicit difficulty rules**. Both trained networks remain available, but DQN deployment requires metadata declaring it ready and coverage of every action. The supplied policy fails that requirement. When LSTM/scaler inference is unavailable, explicit rules provide the fallback. Research exports distinguish these modes.

| Area | Main source | Responsibility and status |
|---|---|---|
| App lifecycle | `src/App.svelte`, `src/components/Game.svelte` | Start/menu, canvas, timers, editor panels, hints and session lifecycle. |
| Programming | `src/blockly/`, `src/editor/`, `src/game/global/interpreter.js`, `code-runner.js` | Blockly and CodeMirror plus the shipped JS-Interpreter. Shared bounded execution handles results/errors. |
| Farm | `src/game/game.js`, `components-kaplay/components.js`, `global/global.js` | Scene, robots, soil/crops, resource values and unlocks. |
| Curriculum | `src/game/global/quests.js`, `src/components/global.svelte.js` | Quest dependencies, progression, milestones, rewards and active quest attempts. |
| Events | `src/game/event.js`, `src/game/ml/event-scheduler.js` | Rain/pests and assistance/challenges; respects pause/onboarding and mode. Fire is explicitly unavailable. |
| ML runtime | `src/game/ml/agent.js`, `model-input.js`, `dda*.js` | Validated model/scaler loading, LSTM inference, DQN gate, fallback rules and difficulty overrides. |
| Research telemetry | `src/game/ml/telemetry.js`, `data-logger.js`, `evaluator.js` | Features, quest attempts, replay and versioned local exports. Historical missing information remains marked missing. |
| Research UI | `DDADashboard.svelte`, `GameDevTools.svelte` | Researcher diagnostics, data export and manual developer controls. |
| Offline ML | `training/prepare_dataset.py`, `train_lstm.py`, `train_dqn.py`, `export_tfjs.py` | Preparation, training and deployment artifacts; original outputs retained. |
| Evaluation | `training/evaluate_model.py`, `model_metrics.py`, `evaluate.py` | Categorized regression diagnostic and separate gameplay-condition summaries. |
| Build/assets | `package.json`, `package-lock.json`, `vite.config.ts`, `public/` | Vite/Svelte application and local sprites, music, fonts and model shards. No backend/API/database. |

## Verified problems addressed

| Original defect | Why it matters | Correction |
|---|---|---|
| LSTM trained on scaled inputs but browser passed unscaled features | The deployed prediction was not evaluated under the training transform. | Deploy the original scaler unchanged, verify feature order/dimensions and apply the exact training transform. |
| Async inference rejection escaped the fallback; updates could overlap | Failure/stale inference could stop adaptation or interleave replay. | Await and catch inference, dispose tensors, coalesce updates and invalidate work at session boundaries. |
| DQN argmax used five outputs despite training only on Normal | Unobserved actions have no comparative outcome evidence. | Gate that policy and label the LSTM-plus-rules mode explicitly. |
| Successful run counted at Start; completion counted as a reset | Training/evaluation features falsely described student behavior. | Record the execution outcome at finish/error; reserve resets for explicit reset actions. |
| Recursive interpreter stepping waited on asynchronous actions | Could hang the page or swallow errors. | Bounded stepping with async yielding and a limit for loops that do not yield. |
| Documented inventory methods mismatched bindings; bug check used wrong property | Student programs could fail despite following documentation. | Repair documented API aliases and farming condition checks. |
| Tutorial sequence could count arbitrary actions | Quest completion did not demonstrate the claimed sequence. | Track the relevant farming sequence and event conditions. |
| Rain/fire were banners without farm effects | An intervention banner could imply a change that never happened. | The initial audit enabled basic rain and gated fire. The subsequent [farm lifecycle and weather implementation](FARM_LIFECYCLES_AND_WEATHER.md) replaces that interim behavior with moving rain clouds, crop-damaging/spreading fire, and eligible DDA scheduling. |
| Async Svelte mount returned cleanup incorrectly | Timers/listeners could survive menu navigation and sessions could be missed. | Return synchronous cleanup and save/close the session on exit. |
| Incomplete lightweight archive/export schema, missing snapshot timestamps and lost zero labels | Exported data could omit events or fabricate absence/defaults. | Versioned complete sessions, explicit legacy quality flags, timestamps and null-safe labels. |
| Replay crossed sessions and repeated export files inflated counts | Offline DQN data did not represent distinct, correctly bounded transitions. | Track session/provenance, end episodes and deduplicate/validate training transitions. |
| Quest-index snapshot alignment and random sample splits | Temporal association was guessed and students could appear in multiple partitions. | Timestamp alignment where available, labeled legacy recovery and student-group split manifests for future training. |
| Metrics omitted categories and used a test-derived baseline | The saved model could look better than a properly fitted simple comparator. | Per-class metrics/support, fixed cutoffs, all-class macro averages, train-mean and majority-category baselines. |
| Empty comparison group shown as zero performance | No observations could be mistaken for poor performance. | Report absent groups as unavailable; keep hybrid/unknown conditions distinct. |

Corrections to telemetry change the data-generating process. The existing model remains trained on the legacy records; correcting runtime instrumentation does not retroactively correct its learned weights. Keep the telemetry revision in exports and disclose this distribution shift.

## What the saved evidence actually says

The historical dataset statistics report 21 examples from 3 recorded student IDs, with 14/3/4 train/validation/test rows. These rows come from repeated gameplay; they are not 21 independently tested students. All reference scores fall between 0.80 and 1.00. The raw files include 28 unique sessions across 4 recorded IDs; some have no usable labeled quest examples.

Corrected preparation was exercised in a temporary directory using the same originals. It still recovers 21 labels, but only 1–5 observed quest-end steps per sequence; remaining positions are padding. The seeded student-group split is 4 train / 11 validation / 6 test rows with one recorded student ID per partition. The split cannot approximate 70/15/15 with only three groups. This corrected dataset was not substituted into the historical model evaluation and no weights were retrained.

The exact deployed LSTM weights were evaluated again, without retraining, against the four original test rows. Full results and input/model provenance are in [legacy-model-evaluation.json](../training/results/review/legacy-model-evaluation.json).

| Diagnostic | Result | Interpretation |
|---|---:|---|
| Test examples | 4 | Far too little for stable generalization claims. |
| Accuracy at 0.3/0.6 | 100% | All four references and predictions are Advanced. |
| Weighted precision/recall/F1 | 1.000 each | Same as always predicting Advanced. |
| Macro precision/recall/F1 across three declared classes | 0.333 each | Undefined class terms contribute zero; absent-class values are separately null. |
| Beginner / Intermediate / Advanced support | 0 / 0 / 4 | First two categories are unevaluated. |
| LSTM RMSE | 0.039996 | Diagnostic agreement with a gameplay formula. |
| Training-mean baseline RMSE | 0.035571 | The simple baseline is better. |
| LSTM MAE | 0.034155 | Same legacy test split. |
| R² | -0.454290 | Negative on this very small test set. |

The old reported baseline RMSE of 0.033166 used the **test mean**, so it was not a deployable training-only baseline. Replacing that comparison with the training mean still leaves LSTM RMSE approximately 12.44% worse. The split has no saved student-disjoint provenance, and the original preprocessing contained the sequence-alignment defect. Treat all these numbers as historical diagnostics, not an independent student-level validation.

The DQN report lists 100 experiences. Deduplication leaves 40 distinct transitions, all Normal. Its loss alone cannot establish beneficial DDA. The old A/B report calls all 28 sessions Group A and has zero Group B sessions, but the original evaluator defaulted missing mode to bootstrap: only 7 raw sessions explicitly record bootstrap exposure, while 21 lack that evidence. Neither interpretation supplies a valid two-group comparison or pre/post learning improvement.

## Research objectives

| Objective | Current status | Remaining evidence |
|---|---|---|
| 1. 2.5D learning environment and recurrent adaptation | Implemented as a prototype, with LSTM plus explicit rules; trained DQN retained experimentally. | Full curriculum acceptance run, classroom-device check and adviser agreement on accurate DQN scope. |
| 2. Improvement in first-year algorithmic-logic skills | **Unevaluated.** Paired pre/post testing is planned. | Reviewed programming/algorithm test items, fixed scoring rubric, paired student scores and analysis. |
| 3. Accuracy, precision, recall, F1 | Diagnostic implementation and saved-model report added. | Fixed/approved cutoffs and a clearly limited report; current data cannot validate all categories. |
| 4. Selected ISO/IEC 25010 qualities | Specific runtime defects and regression checks addressed. | A recorded evaluation of functionality, performance, interaction and reliability on the final study build. |

See [RESEARCH_EVALUATION.md](RESEARCH_EVALUATION.md) for the minimal defensible analysis and study protocol. Categorizing the regression is acceptable as a defined evaluation procedure; it does not add missing category examples or establish that the proxy measures the intended educational construct.

## Git readiness

The repository started clean on `codex/research-reliability`, at the same commit as `main` and `origin/main`. `git fsck --full` found no corrupt/missing objects; dangling objects are recoverable unreachable history, not corruption. Commit identity is configured. `origin` points to the expected GitHub repository, and a read-only remote query succeeded with matching `main` plus `improve_quest`.

Each major change is committed separately on the research branch. Local commits, remote reads, and `git push --dry-run origin HEAD:refs/heads/codex/research-reliability` succeeded. The dry run reached GitHub's receive endpoint and proposed the new branch without publishing it. No branch was actually pushed or merged, so final server-side write policies have not been tested by publishing a change. Network and Git metadata access required sandbox escalation in this environment; that was an execution restriction rather than repository corruption. Use `git log --oneline`, `git status --short --branch`, `git diff --check` and the automated checks before further commits.

## Remaining limits before student use

- Complete farm/player/editor persistence across a page refresh is not implemented. Research logs are separate from a resumable game save. Decide whether the fixed study is one uninterrupted session or requires save/restore before recruiting participants.
- Browser local storage is finite and device-specific. Export and verify each study session; a shared browser needs deliberate participant/session handling. No centralized researcher portal exists.
- Full end-to-end completion of every curriculum stage and all shop/unlock combinations has not been verified by this audit. Automated checks and a startup/editor smoke test cannot establish exhaustive correctness.
- Formal stage-4/5 activities and automatic progression to them are absent. Existing crops generally retain growth/spoilage timers captured at planting; difficulty changes affect newly created crop timing rather than rescheduling every crop already growing. Fire remains unavailable.
- The legacy telemetry features are cumulative and saturate. Repeated early errors/resets can keep the frustration proxy high for the remainder of a session. Changing those definitions requires a versioned model/data compatibility decision; this audit preserves them for the supplied weights.
- Svelte accessibility warnings and a large production JavaScript bundle remain. Do not mark interaction capability or performance efficiency complete without testing the actual classroom devices and students.
- The legacy labels are formula-derived, highly skewed, and based on telemetry bugs now corrected. Retraining on corrected extraction of the same samples is possible as a separate experiment, but cannot recover missing timestamps, missing categories or unobserved DQN actions.
- The browser code and developer tools permit manual changes to gameplay. Freeze the study build and control the study procedure so developer interventions are not mistaken for ordinary student performance.
- A validated DQN contribution, broad skill classification, psychological flow, and causal learning improvement remain unsupported claims. Keep them out of the conclusions unless separate evidence is gathered.

## Verification record

- `npm test`: **39/39 pass** (14 gameplay, 23 ML runtime, 2 real artifact checks). Includes the shipped interpreter and actual deployed TFJS weights; runtime fault tests use isolated engine/storage stubs.
- `python -m unittest discover -s training -p test_pipeline.py`: **22/22 pass**, using the bundled working Python with NumPy. `python -m compileall -q training` also passes.
- `npm run verify:artifacts`: **40/40 original artifacts unchanged**, with text line-ending tolerance.
- `npm run build`: passes; JavaScript bundle approximately 2.72 MB uncompressed / 787 KB gzip. This is bundle size, not measured classroom startup latency. Existing accessibility/CSS warnings remain.
- Production browser smoke at a separate local test origin: startup/onboarding, Blockly greeting completes its quest, switch to text editor, text greeting completes, invalid function call remains handled, dashboard records **2 runs / 1 error / 0 resets / 50% success**, hybrid policy disclosure visible, menu return/re-entry preserves in-page quest progress, and no unhandled browser console errors in these flows.
- `git diff --check`: passes. Local Git commits and remote branch reads work.

TensorFlow training and Python-to-TFJS export execution were not run: the existing `.venv` references a missing Python installation, and the working bundled Python has no TensorFlow. The exporter contract is tested, and existing deployed artifacts load and predict successfully, but new export numerical parity still needs checking when retraining is undertaken.
