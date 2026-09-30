# Readiness review for the next collection

Version 1.3.5 is technically ready for another supervised collection round using the checklist below. This is a bounded code, automated-test and browser review, not a guarantee that every device or possible student program is free of bugs. The provisional LSTM remains an experimental predictor whose pilot performance was below the mean baseline.

## Changes from this review

- Fixed the collection checklist and model documentation: Your first harvest is the primary target continuing the existing pilot, and the active model is the provisional 12-feature LSTM, not the archived 10-feature model.
- Added a SHA-256 fingerprint of served source/assets at server/build startup. The previous dirty Git flag could not identify uncommitted content. The dirty flag remains truthful; unrelated dataset files do not alter the source fingerprint. Keep the actual build because a hash cannot reconstruct it.
- Prepared samples retain build/model metadata separately from features and scores. Folder audits list model cohorts, versions and fingerprints. This helps review the changed model and mission conditions before combining rounds. No old metadata, labels or raw exports were rewritten.

## Verification

All 246 automated tests passed. Coverage includes:

- New participant identity after Clear Stored Data and reload, URL identity removal, and prevention of cleared records returning through autosave.
- Autosave/export retention after storage failures, overlapping-export deduplication, conflicting-history rejection and SHA-256 checksums.
- Real recorder-to-export-to-preparation CLI integration for six explicitly fabricated test participants. These fixtures are not student data and are not used for training research models.
- Challenge entry only after a fresh normal-gameplay window, persistent navigation after tab switches, first exposure, Stop & Edit, failed/zero scores, practice retries, unfinished attempts and developer exclusions.
- All ten current challenges using real component logic in the entity test harness, plus failure paths, scene restoration, hidden-tip isolation, bounded execution, growth/water behavior and bot messages. The harness uses simulated engine time; it is not a substitute for browser animation checks.
- Runtime feature/normalization parity, current model loading, warm-up fallback, stale asynchronous inference protection, model identity logging, participant-separated train/validation/test splits, and training-only scaling.
- Source fingerprint changes for code/weights and remains unchanged when participant files are added; metadata cannot become an input feature or target.

Browser checks used a separate local origin and the existing isolated Challenge Farm fixture, which saves no participant research data. Your first harvest completed with real actions and scored 3/3; reward UI showed +90 coins and +80 EXP. Exiting a challenge restored the menu and another challenge could open. Before the pests displayed all soil tiles, completed both test rows and pest endings, and correctly reported a failed row (3/6 total for the tested program). A tight infinite loop returned 0/6 with stopping-condition errors; the UI remained usable. No browser console errors were reported during these checks. Full participant export/reset behavior was exercised by automated integration tests, not manually through a complete student playthrough in this review.

The production build passed with existing accessibility and chunk-size warnings. All 40 historical research-artifact checks passed. Six original student exports still pass integrity checks; the five first-harvest inputs/scores and one careful-steps sample remain compatible. The original file hashes and the five first-harvest input arrays/scores match the preceding audit.

## Limits that still matter

- The first-harvest pilot has five participants and no Beginner-category reference scores. More collection is needed; no accuracy or learning-improvement claim is justified by this review.
- The old round used different game/model conditions. The task rubric and feature schema can remain compatible while the input distribution changes. Review cohorts before pooling; preserve earlier task IDs/rubrics and do not replace first scores with retries.
- A ten-minute session may end before a student completes the tutorial, the approximately 110-second observation window and a challenge. Keep unfinished exports without inventing scores.
- Browser storage is local and finite. Download and back up each participant before clearing. A server and multi-device identity/exposure synchronization have not been added.
- The primary task measures limited in-game performance. Other tasks remain useful as separate targets. Paired pre/post evidence is still required for the learning-improvement objective.

Follow [COLLECTION_DAY_CHECKLIST.md](COLLECTION_DAY_CHECKLIST.md). Restart the server or build after the final commit, keep one fixed build throughout the round, and inspect the first few exports immediately.
