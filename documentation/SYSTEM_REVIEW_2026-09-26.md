# System review: 1.3.10 candidate

Reviewed the 1.3.9 system and prepared narrow fixes for 1.3.10. The review covered game commands and execution, tutorial/mission credit, challenge evaluation and isolation, telemetry, exports, training, deployed-model compatibility, and collection instructions. Three independent reviewers examined the fixes for correctness, security and quality. This is a source/test/build review, not a complete manual playthrough of every screen or a claim that no defects remain.

## Confirmed problems fixed

| Priority | Problem | Resolution |
| --- | --- | --- |
| P2 | Movement missions accepted unrelated directions, separate-run moves, or one loop trip when two were requested. | Direction and same-run return-trip checks; execution events include direction, coordinates and run identity. |
| P2 | Student code could call obsolete `__trackLoop` / `__trackIf` globals to invent research observations. | Removed the hooks. Actual interpreter AST execution still records loops and branches. Shipped-interpreter tests cover both cases. |
| P2 | Duplicate exports could silently disagree about build, feature definitions or study protocol. | Reject contradictory known provenance across all exports, including three-file chains with missing legacy metadata. Legitimate growing histories and evolving model/reward states remain supported. |
| P2 | The prediction diagnostic required ten features and an obsolete shard filename despite the deployed twelve-feature model. | Read input dimensions and weight paths from the selected model. Reject wrong-shaped input and preserve exclusive output creation. Historical bundles can be selected explicitly. |
| P3 | Shop documentation offered nonexistent `shop.buy_plants`. | Changed the example to `shop.buy_seed` and tested the reference through the actual command API. |
| P3 | Collection guides contradicted each other about accepting dirty builds. | Require one lead-approved release/fingerprint; a dirty flag is no longer automatically accepted merely because deployment uses Cloudflare. |
| P2 | npm audit reported 11 affected packages (8 high, 2 moderate, 1 low). | Applied compatible updates without forced major upgrades or install lifecycle scripts. Vite is now 7.3.6, Svelte 5.57.1 and PostCSS 8.5.28; audit reports zero known vulnerabilities. Package advisory severity does not establish an exploitable path in this game. |

No collected student records, challenge scoring rubrics, deployed weights or historical model artifacts were changed. Mission behavior changed, so record the new build and keep collection conditions consistent rather than silently switching computers mid-round.

## Main remaining research limitations

1. **The available cohort is still a pilot.** The raw folder imports 11 sessions from 6 recorded participant IDs. It yields 5 usable first-harvest scores and 1 careful-steps score. First harvest has category support 0 Beginner, 2 Intermediate and 3 Advanced at the provisional cutoffs. The formal holdout gate correctly refuses the first-harvest cohort. Browser IDs alone are not proof of unique people.
2. **The deployed LSTM remains provisional.** It uses the previous twelve-feature schema; new collection supplies fourteen-feature windows. Compatibility and fallback are explicit, but supporting the new schema does not mean the deployed model has learned from it. The recorded pilot did not establish LSTM superiority over simpler baselines. Retrain only after auditing the next task-specific cohort; retain participant separation, train-only scaling and untouched test evaluation.
3. **Fixed study mode does not evaluate active DDA.** Researcher-assigned sessions use 100% speed, Normal difficulty and no scheduled hazards. Model proposals are logged but not applied. This can collect consistent model-training examples. A later evaluation must separately test the trained adaptive behavior and the thesis's paired pre/post learning objective.
4. **Challenge scores are specific task outcomes.** First harvest is a narrow task, not a validated measure of all algorithmic skill. Keep different task targets separate. Define rubric-based proficiency cutoffs before evaluating performance; do not change them to balance results. Preserve zero scores and unfinished records distinctly.
5. **Local persistence remains a collection risk.** There is no server receipt confirming a participant file arrived. Export each participant, verify the download and upload, then clear for the next student. Reload/exposure rules intentionally do not manufacture a fresh first attempt. An interrupted challenge may remain unlabelled.

## Improvements to prioritize

1. **Before collection:** freeze the release and source fingerprint, use unique assigned codes, run one disposable staff session through both study tasks and the downloaded-file audit, and confirm the lead/member guides agree. Keep staff files separate. This local candidate is not automatically deployed.
2. **Automate browser journeys:** add repeatable tests for the tutorial-to-challenge path, Stop & Edit, closing without a score, reload, hidden tabs, Help demonstrations, and download readiness. The Node suite exercises many underlying rules but does not replace full browser lifecycle coverage.
3. **Reduce startup cost:** the production JavaScript bundle is about 2.93 MB minified / 871 KB gzip. Consider loading Blockly, text editing and ML modules on demand; measure on the actual classroom computers before changing startup behavior.
4. **Resolve accessibility/build warnings:** label the Help slide buttons, support keyboard resizing, and investigate the ChallengeFarm binding warning. Some warnings are intentional initial-state captures or unused CSS; do not suppress them indiscriminately.
5. **Separate responsibilities gradually:** extract collection/session coordination from Game.svelte and shared editor/modal lifecycle handling from large components. Preserve regression coverage and avoid a broad refactor immediately before a collection round.
6. **Make historical tooling unmistakable:** the Python proxy-training scripts are retained historical work and do not enforce all current developer-session exclusions. New exports must use the documented JavaScript challenge workflow. The historical evaluation document now points to that workflow explicitly.
7. **Bound audit cost for longer sessions:** collection inspection repeatedly scans snapshot prefixes. Current short-session data is manageable, but a single-pass or rolling-window implementation would avoid quadratic work as sessions grow.

## Verification and limits

- All 272 automated tests pass, covering the new movement, telemetry, duplicate-export and prediction regressions plus the existing challenge and ML workflow suites.
- Production build succeeds. Existing Svelte accessibility/state/CSS warnings and the large-bundle warning remain documented above.
- All 40 preserved research artifacts verify unchanged.
- Tests and production build were repeated after dependency updates. The package audit reports zero known vulnerabilities at review time; this is not a guarantee against undiscovered issues.
- Current raw exports still import with the same usable-score counts.
- Independent post-fix review caught an additional three-export provenance edge case. It was fixed and re-reviewed with permutation tests.
- No confirmed browser sandbox escape or DOM injection was found in the inspected paths. Checksums detect corruption; they do not authenticate that a record came from a real student.
- A complete browser/device soak test and measured ISO/IEC 25010 evaluation remain outside this source review. Passing these checks does not establish model accuracy or learning improvement.
