# Assessment protocol 5: gameplay gate and Stop & Edit

New attempts record `assessor_id: algobot-live-cases-5.0`. The task IDs and rubric points remain unchanged; the administration protocol changed. Training already rejects mixed assessor protocols, so earlier data cannot silently acquire this interpretation.

> Superseded detail: the normal-speed window requirement below was replaced in 1.3.8 by twenty observed intervals at any regular speed, and round 2 study sessions (1.3.9) fix speed at 100% and require fresh gameplay between the two study tasks. See [COLLECTION_DAY_CHECKLIST.md](COLLECTION_DAY_CHECKLIST.md). The scoring rules in this document are unchanged and still apply.

Before entry, Challenge navigation and invitations require tutorial completion and a fresh 21-snapshot normal-gameplay window. An entry check repeats immediately before exposure is recorded. Snapshot times must precede the opening timestamp. Long pauses, speed changes, guided practice and missing observations prevent entry until the window is usable again. An already open challenge is not closed when gameplay sampling stops.

Within one open attempt, Stop & Edit records the source, editor mode and timestamp without assigning a score or abandoning the attempt. The first run evaluated across all task cases fixes the target, including errors, failed rules or a zero. Subsequent scored retries cannot replace it, although a later pass can still earn the game reward. Closing without an evaluated run leaves a null score. Reopening is a repeat exposure, not a new first attempt.

Gameplay features always stop before the original opening time; stopping or editing does not move that cutoff. Prepared protocol-5 samples include `stopped_runs_before_score` for review. It is metadata, not an LSTM input, because it occurs after the prediction cutoff. Raw exports retain all stops and retries.

Interpretation: performance on a fixed task with stopped-run feedback and editing permitted. This is not an untouched first-try score or automatically a validated general proficiency measurement. Apply the same instructions and assistance policy to all students.

Verification covers readiness before/after 21 observations, pauses, speed changes and gaps; stop/edit followed by failure, successful retries, unfinished attempts and historical protocol behavior. The recorder-to-CLI integration test now includes a stop before each of six fixture participants' first scores, preserving every label and stop count. The local training/evaluation/reload tests remain separate fixture checks, not research accuracy results.
