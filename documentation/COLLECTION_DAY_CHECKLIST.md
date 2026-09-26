# Before students play

Use one fixed build and one agreed challenge for this collection. The current preparation examples use **Two careful steps** (`careful-steps-v1`). Students do not need to finish the game or every challenge. Different challenges are different targets; their scores must not be pooled simply because they are normalized.

Restart the development server after the final commit so exported build metadata reflects the code being used. Do one practice collection yourself, verify its downloaded JSON, then clear stored data and reload before the first real participant. Do not mix that practice file into the student folder.

## Per student on a shared computer

1. Confirm the previous student's Dataset JSON has downloaded and is backed up. Only then use **Clear Stored Data** and reload.
2. Confirm the new participant code in Dev Console. Use the same code for that student's separate pre/post tests. Never reuse one code for different students.
3. Let the student complete the tutorial normally (version 1.1 ends practice after the first harvest; loops and conditions are later missions). Do not use tutorial-skip, resource grants, forced events or other developer gameplay controls: they mark the session as a developer test, excluded from training. Opening Dev Console, Check Collection and downloading JSON are read-only research actions.
4. After the tutorial, challenges appear only after a usable gameplay window is ready: roughly **110 seconds of uninterrupted normal-speed gameplay**. Once unlocked during a game session, the Challenges button stays visible. A long pause, hidden tab or speed change can require another observation window before entry; the invitation and menu explain the wait instead of disappearing. In Dev Console's DDA / Research Data area, press **Check Collection**. Look for “Gameplay window ready for a first challenge attempt.” This is a snapshot; recheck if conditions change.
5. Select **Recommended** and have the student attempt the agreed challenge using the same assistance rules as everyone else. Freestyle is exported as practice and excluded from training targets because it offers different tools; opening it also counts as exposure to that task. Students may Stop & Edit within the same attempt. Every stop is retained. The first fully evaluated submission is the target, including failure or zero; later evaluated retries cannot replace it. Closing before a scored submission leaves no usable target for this task. Previously opened tasks can reopen immediately for practice without waiting for a new gameplay window. Do not mark unfinished work as zero or reset exposure history to manufacture a new first attempt.
6. After the challenge closes, press **Check Collection** again. The chosen task should show **usable training label**. If it does not, keep the export and read its reason; do not overwrite or “repair” the student's outcome.
7. Press **Download Dataset JSON**. Confirm the file exists before clearing or reloading. Keep original files unchanged in a backed-up folder. Export even if the student did not submit: their gameplay and participation still matter, although they may not contribute a supervised training example.

The Check Collection panel checks the current session. It uses the same label validator as preparation. The folder audit below also detects problems across sessions and overlapping exports. A usable label means it passes technical validation, not that the task or proficiency cutoffs have been scientifically validated.

## Audit the downloads

From the repository root, with student JSON files in `training/data/raw/`:

```powershell
npm run audit:collection -- training/data/raw
node scripts/prepare-challenges.js training/data/raw training/samples-collection-1.json careful-steps-v1
```

Use a new output filename each time. Check the usable sample count, excluded reasons, participant counts and score distribution. Do this after the practice run and the first few students, rather than discovering missing targets at the end of collection.

Once the files are collected, follow [MODEL_WORKFLOW.md](MODEL_WORKFLOW.md). The plan freezes participant-separated splits; preprocessing uses training participants only. Local training compares the LSTM with mean and MLP baselines. Evaluation reports regression and provisional category metrics. Candidate weights are reviewed separately before deployment.

## Final verification for this build

- 228 automated tests passed, including all ten challenges, failure paths, farm/tip isolation, collection clearing and storage failures, feature parity, and local training/evaluation/model reload.
- A new integration test drove the real recorder, autosave and canonical download for six explicitly fabricated test participants. The actual preparation CLI retained all six first evaluated scores after Stop & Edit, including zeros, and produced a valid participant-separated plan. Temporary files were removed; this is not a research dataset or accuracy result.
- The 40 retained/historical research artifacts match their baseline. The deployed weights remain the older ten-feature model. New collection prepares the recent 12-feature model; no new model was trained on students during this review.
- Twenty students, especially with ten-minute sessions, may yield fewer than twenty usable labels. A narrow score range or a very small test group still limits what model performance can establish. Pre/post learning improvement remains a separate analysis.
