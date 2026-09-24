# Algobot

Algobot is a browser game for first-year computer science students. Players program farm robots using Blockly blocks or JavaScript, progressing through sequencing, conditionals and loops. Greedy decisions and state optimization are additional DDA concepts whose formal curriculum stages remain incomplete. Svelte 5 provides the interface, KAPLAY draws the farm, JS-Interpreter executes student code, and TensorFlow.js runs a saved LSTM model locally.

The deployment uses **LSTM proficiency estimates plus explicit difficulty rules**. DQN has been removed from live inference and the research dashboard. Its original artifacts remain only to preserve the research record. Neither student learning improvement nor reliable three-category proficiency discrimination has been demonstrated.

The previous datasets and experimental outputs have been [removed for a fresh collection](training/DATA_RESET.md), with a Git recovery checkpoint. The [September 24 experiment report](documentation/LSTM_IMPROVEMENT.md) remains a historical account. Neither candidate beat the mean baseline, so deployed weights remain unchanged. Rule decisions use recent gameplay and confirmation before increasing difficulty; the trained LSTM's feature definitions remain unchanged.

## Run and verify

Before collecting more players, follow the [collection and scored-task protocol](documentation/DATA_COLLECTION_PROTOCOL.md). Version 3 exports sample gameplay independently of DDA, retain unfinished attempts and distinguish stopped programs from errors. The protocol includes assigned participant codes, a draft independent assessment, export audits and a separate training path for scored-task labels.

From the repository root, with a Node version supported by the installed Vite package:

```powershell
npm ci
npm test
npm run verify:artifacts
npm run build
npm run dev
```

The audit was run with Node 24.19.0 and npm 11.17.0. Python is optional for playing the game. Use a working Python environment with NumPy for dataset auditing; training additionally needs TensorFlow and the packages in `training/requirements.txt`.

See [the project audit](documentation/PROJECT_AUDIT.md) for architecture, verified defects, data limitations, research objectives and remaining work. [Research evaluation](documentation/RESEARCH_EVALUATION.md) explains how to evaluate the preserved model and plan the upcoming paired pre/post assessment. [Setup guide](SETUP_GUIDE.md) provides Windows installation instructions.

[Farm lifecycles and weather](documentation/FARM_LIFECYCLES_AND_WEATHER.md) documents the decoupled soil/crop/interpreter components, soil water lifecycles, fire and moving rain clouds, event tuning, and the expected artwork filenames.

## Preserve the research record

- Retired samples, processed arrays and evaluation outputs are recoverable from Git history. `npm run verify:artifacts` checks retired baseline artifacts in history and retained legacy models in the working tree. This requires the original baseline commit to be available locally.
- Write corrected preparation and evaluation to **new directories**. Do not overwrite historical results or change cutoffs after inspecting predictions.
- This is a local browser prototype. It has no server database or complete farm save/restore. Export research sessions through the research tools; do not rely on browser storage as your only copy.
- Use short feature branches and separate commits for substantial changes. For example, `git switch -c codex/quest-fix`, then review `git diff`, run the checks above, and commit the intended files. Keep the lockfile; use `npm ci` for a repeatable install. Push only when ready to publish the branch to the repository.

The earlier [ML design document](documentation/ml-doc.md) describes the intended full architecture and illustrative scenarios. The audit documents take precedence for verified implementation and research claims.
