# Collection readiness: 1.3.8

This build is ready for a supervised collection round using [the collection checklist](COLLECTION_DAY_CHECKLIST.md). The checks below cover the collection and training workflow and representative browser paths. They do not establish model accuracy or guarantee every device and student program will be trouble-free.

## Blocker fixed

Previously, challenge access and training both required about 110 seconds of contiguous 100%-speed gameplay. Speed changes, pauses and prompts could restart the wait. This was too restrictive for students using the game's regular controls.

New exports use `active-14f-v2`: ten gameplay rates, stage, robot count, game speed and observation age. Twenty valid intervals within fifteen minutes unlock first attempts. Earlier observations survive short interruptions. A speed/phase change invalidates only intervals crossing that boundary; hidden-tab, tutorial, demonstration and challenge time cannot fill the window. Very long breaks can age observations out. Missing intervals are never invented. Export readiness explains the wait.

The installed twelve-feature LSTM remains unchanged. It requires its original normal-speed inputs and uses the rule policy when they are unavailable. The browser supports a future fourteen-feature model, and the local pipeline can train, evaluate and package one. No new research model was trained or deployed in this review.

Keep the next round separate from the earlier pilot. Older samples still prepare under `recent-12f-v1`; their missing segment history cannot be reconstructed into the new schema. Speed and age are candidate explanatory features, not proof that speed-related differences have been statistically resolved. Collecting data at different speeds makes that test possible.

## Evidence

- All **256 automated tests** passed. These cover all ten current challenges in the component test harness, bounded loops, main-farm isolation, scene restoration, crop timing, bot messages, first exposure, Stop & Edit, first evaluated score, zero scores, unscored exits and practice retries.
- The actual recorder, autosave, checksummed JSON exporter and preparation CLI were exercised with six explicitly fabricated software-test participants at the five supported player speeds. Test records are not research data and are not placed in the student dataset.
- Separate fourteen-feature fixtures completed participant-separated training, validation selection, held-out evaluation, baseline comparisons, bundle creation and reloaded prediction. Runtime receives the same feature values as offline preparation. Existing twelve-feature tests still pass. Scaling uses training participants only; held-out evaluation remains a separate operation.
- Storage tests cover corrupt/unavailable storage, preservation of failed saves, duplicate exports, identity clearing/reload and prior-score eligibility across schema upgrades. Original export checksums detect changed records.
- Browser checks on a separate local origin confirmed Challenges unlock at **200%**. Switching to **30%**, opening and closing the Finish prompt, and returning to the challenge board preserved access. Your first harvest executed on real entities, scored **3/3**, granted **90 coins / 80 EXP**, and restored the main farm at 30% with its inventory intact.
- Before the pests displayed its real soil and pest objects. A tight infinite loop stopped with explicit errors and **0/6**, including both pest endings; the interface stayed responsive. No browser console errors were reported. Browser sessions used developer setup and were excluded from research data, as intended.
- Production build passed with existing accessibility and bundle-size warnings. All **40 historical artifact checks** passed. Six original downloads passed integrity checks; the **five first-harvest input arrays and scores are unchanged** from the preceding preparation.

## Collection procedure

Use a fresh production build or restart the development server after the final commit. The build stamp is captured at startup. Do not edit files during collection.

For each new student: clear the previous participant only after backing up their export, reload, finish the tutorial normally, allow roughly two minutes of gameplay at any regular speed, complete a scored attempt at **Your first harvest**, then use **Finish & Download Data**. A low or zero score is valid. Extra challenges are optional separate targets. Never replace a first score with a better retry.

For an unfinished or excluded session, the researcher should still export from Dev Console and keep the exclusion reason. Do not manufacture a score. Returning students retain their participant identity and exposure history. Browser storage remains local and finite; download and back up every participant.

The current pilot is small and the LSTM has not beaten its baseline reliably. This release prepares collection; it does not validate general programming proficiency, demonstrate DDA effectiveness, or supply the study's separate paired pre/post learning evidence.
