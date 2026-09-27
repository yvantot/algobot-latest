# Machine-learning workflow verification

Version 1.3.11 candidate, reviewed against 1.3.10. Scope: automatic gameplay collection, challenge targets, persistence/export/import, preparation, participant splitting, training/evaluation, candidate packaging and runtime inference. AGENTS.md's independent correctness, security and quality reviews apply to the fixes.

## Findings addressed

1. The finish prompt previously treated opening the second study challenge as completion. It now checks for a usable first-attempt label. A valid first-harvest score, including zero, still permits a partial download. An unfinished or unusable second label prompts researcher follow-up instead of claiming the study is complete.
2. Duplicate imports remembered fixed provenance for conflict detection but could discard it from the chosen record. A later export missing its study protocol could therefore bypass the fresh-window rule. The derived merged record now retains verified metadata from the supplied files; original exports are not rewritten. Finalized challenge summaries and play mode are also protected against conflicting duplicates while legitimate growing attempts remain supported.
3. Formal training candidates previously omitted the model/task identity read by the browser. New candidate scalers and bundle cards retain identity and an explicit candidate status, so later deployment cannot silently label them as the legacy model. Candidate status is not validation or permission to deploy.

## Verified behavior

| Stage | Expected behavior checked |
| --- | --- |
| Collection | Sampling runs independently of model loading. Gameplay intervals exclude pauses, hidden tabs, demonstrations and challenges. Segment boundaries prevent counter differences spanning interruptions. |
| Inputs | Current schema is 20 observed intervals with 14 features, selected from the preceding 15 minutes. Preparation and inference share the interval transformation and scaler code. |
| Targets | Inputs end before the challenge opens. The first fully evaluated submission supplies the target; Stop & Edit does not consume it. Zero is valid. Unfinished attempts have no label; later scored retries remain practice. |
| Study conditions | Assigned-code sessions use fixed speed/difficulty, ordered tasks and fresh gameplay after the earlier challenge. Separate tasks and collection protocols cannot be silently pooled. |
| Storage/export | Canonical v4 JSON includes raw observations, attempts, identities and integrity checks. Failed saves remain pending in memory; developer sessions are excluded. Checksums detect accidental changes, not authenticity. |
| Training | Participant groups do not overlap. Scaling uses training data only. Early stopping and model selection use validation; holdout evaluation is separate. Mean and MLP baselines accompany the LSTM. |
| Packaging/runtime | Shapes and scalers are validated; serialization/reloading is tested. Missing or unusable model inputs invoke the explicit rule fallback. New bundles retain model/task identity. |

The automated workflow tests actually train small temporary test fixtures, evaluate and package them, and reload their predictions. Those fabricated fixtures are software tests only and never enter the research dataset or deployed model.

Final verification: all 277 automated tests passed; production build passed with existing Svelte and bundle-size warnings; all 40 preserved research artifacts verified unchanged. All three independent post-implementation reviewers reported no blocking findings. Re-preparation after the fixes produced exactly the same recorded examples as before the fixes.

## Current recorded data

The six JSON files in `training/data/raw` import as 11 sessions from 6 recorded participant IDs. Preparation yields:

| Target | Usable participants | Category support: Beginner / Intermediate / Advanced |
| --- | ---: | --- |
| Your first harvest | 5 | 0 / 2 / 3 |
| Two careful steps | 1 | 0 / 0 / 1 |

These are the earlier unrestricted pilot sessions, not the next fixed-condition study round. Both task datasets pass structural validation and correctly fail the formal holdout minimum. Six participants is only a software floor, not an adequate sample-size claim. Derived verification files are under ignored `training/prepared/ml-review-2026-09-27`; original bytes were preserved.

## Remaining limits and collection decision

- The installed model remains the provisional 12-feature model trained on five participants. Its recorded pilot RMSE was 0.3899, versus 0.3296 for the mean baseline. Verification has not retrained or replaced it.
- The older 12-feature assessment importer permits observations up to 15 seconds old; runtime prediction conservatively requires at most 7.5 seconds. Historical inclusion rules were preserved. This is not exact eligibility parity, though transformations match. The current 14-feature path shares its active-window selector.
- There are no real fixed-condition round-two exports in the repository yet. Tests establish software behavior, not that every forthcoming participant export will be usable. Audit the first staff export and first real export before scaling up collection.
- Use one approved build/fingerprint and participant-code procedure, collect both planned tasks where possible, export and back up each student before clearing. Preserve unfinished records and report assistance or interruptions.
- Fixed-condition collection deliberately does not apply adaptive difficulty. Evaluating the eventual LSTM DDA behavior and paired pre/post learning improvement remains a separate study step.
- This verification is code, tests and recorded-file validation. It is not a complete browser/device classroom trial or evidence that challenge scores measure general programming proficiency.
