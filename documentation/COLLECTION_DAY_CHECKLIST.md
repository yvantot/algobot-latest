# Next collection checklist

Use **Your first harvest** (`first-harvest-v1`) as the shared primary task for the next round, continuing the five usable pilot samples. Students may do other challenges too; keep their scores as separate targets. Nobody needs to finish the whole game.

The current collection build is **1.3.6**. Tutorials and missions use the main farm; scored challenges use an isolated farm. The active LSTM is the provisional 12-feature model introduced in 1.3.3. It has not demonstrated reliable proficiency prediction. Its identity is recorded in exports.

Players can click **Finish & Download Data** beside Start Menu. The prompt allows download once the current participant has a usable first scored challenge, including a valid zero score or a saved score from before a reload. It uses the training validator, explains not-ready states, and never clears data or sends it automatically. Students must send the saved JSON to the researcher. The researcher can still export unfinished or excluded sessions from Dev Console; those records remain useful for participation reporting even without a training label. The button does not automatically end the session or return to the menu.

## Before the session

1. Restart the development server after the final commit, or serve a fresh production build. Do not edit game files while students play. Version, Git commit, dirty status and a SHA-256 fingerprint of source/assets are captured at server/build startup. The fingerprint identifies content; it cannot reconstruct missing files. Keep the exact build.
2. Use one fixed build, normal game speed and the same assistance rules for everyone. Record that the model and early missions changed since the earlier pilot. Keep round folders separate for review before pooling.
3. Confirm Download Dataset JSON works on each collection computer. Keep a backup location available.
4. Run a disposable staff practice session, then export it separately. Clear Stored Data and reload before the first student. Never mix staff fixtures or developer-test sessions into the student dataset.

## Per student on a shared computer

1. Confirm the previous student's JSON was downloaded and backed up. Only then use **Clear Stored Data** and reload.
2. Confirm a fresh participant code in Dev Console. Keep that code with their pre/post test record. A returning student must retain their original research identity and prior-exposure history; clearing storage does not make them a new participant.
3. Let the student finish the tutorial through First Steps in Farming normally. Do not use tutorial-skip, resource grants, speed changes or forced events: developer gameplay actions exclude the session from training. Opening Dev Console, Check Collection and exporting are read-only research actions.
4. Allow roughly **110 seconds of uninterrupted normal-speed gameplay after the tutorial**. Tutorial and demonstration time do not fill this window. Use **Check Collection** and look for “Gameplay window ready for a first challenge attempt.” A long pause or tab switch can require a fresh window. Once unlocked, the Challenges button stays visible.
5. Ask the student to attempt **Your first harvest**. Stop & Edit is allowed within the same attempt. The first fully evaluated submission is the score, including failure or zero; later scored retries are practice. Leaving before any evaluated submission gives no label. Do not replace a low score with a better retry or call unfinished work zero.
6. After returning to the farm, use **Check Collection**. Your first harvest should show a **usable training label**. If it does not, export anyway and keep the stated reason.
7. Download the single **Dataset JSON**, confirm the file exists, and back it up before clearing. Export unfinished sessions too. Browser storage has limited capacity and is not a server backup.

Ten minutes may not be enough for every student to reach a scored challenge. Record participation and unfinished sessions honestly; do not count them as failures or generate replacement scores.

## Audit each batch

Keep original JSON files unchanged. Use a separate folder for this collection round. The importer also supports all-round folders, but review build/model cohorts before combining them.

```powershell
npm run audit:collection -- training/data/raw
node scripts/prepare-challenges.js training/data/raw training/prepared/next-round-first-harvest.json first-harvest-v1
```

The output path must be new. Inspect usable participant counts, exclusions, score distribution, build fingerprints and model cohorts after the practice run and the first few students. A usable label passes technical validation; it does not validate the task as a general skill assessment.

Use [MODEL_WORKFLOW.md](MODEL_WORKFLOW.md) for participant-separated training and evaluation. More data does not guarantee the LSTM beats the baseline. Keep future evaluation participants untouched during model selection, and keep paired pre/post learning outcomes separate.

See [the readiness review](COLLECTION_READINESS_2026-09-26.md) for checks and remaining limits.
