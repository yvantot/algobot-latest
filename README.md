# Algobot

Algobot is a browser game for first-year computer science students. Players program farm robots using Blockly blocks or JavaScript, progressing through sequencing, conditionals and loops. Greedy decisions and state optimization are additional DDA concepts whose formal curriculum stages remain incomplete. Svelte 5 provides the interface, KAPLAY draws the farm, JS-Interpreter executes student code, and TensorFlow.js runs a saved LSTM model locally.

The audited deployment uses **LSTM proficiency estimates plus explicit difficulty rules**. The saved DQN is preserved but gated: its historical training experiences contain only the Normal action. Neither learning improvement nor a successful learned DQN policy has been demonstrated.

## Run and verify

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

[Farm lifecycles and weather](documentation/FARM_LIFECYCLES_AND_WEATHER.md) documents the decoupled soil/crop/interpreter components, persistent soil water, fire and moving rain clouds, event tuning, and the expected artwork filenames.

## Preserve the research record

- Original raw samples, processed arrays, model weights, and historical reports are tracked in Git. `npm run verify:artifacts` checks the 40 baseline artifacts; text line-ending conversion by Git is allowed, binary changes are not.
- Write corrected preparation and evaluation to **new directories**. Do not overwrite historical results or change cutoffs after inspecting predictions.
- This is a local browser prototype. It has no server database or complete farm save/restore. Export research sessions through the research tools; do not rely on browser storage as your only copy.
- Use short feature branches and separate commits for substantial changes. For example, `git switch -c codex/quest-fix`, then review `git diff`, run the checks above, and commit the intended files. Keep the lockfile; use `npm ci` for a repeatable install. Push only when ready to publish the branch to the repository.

The earlier [ML design document](documentation/ml-doc.md) describes the intended full architecture and illustrative scenarios. The audit documents take precedence for verified implementation and research claims.
