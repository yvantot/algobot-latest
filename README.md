# Algobot

Algobot is a browser game for first-year computer science students. Players use Blockly blocks or JavaScript to move farm robots, plant and water crops, harvest produce, and respond to pests and fire. Guided quests introduce programming concepts through tasks on the farm.

[Play Algobot](https://algobot.fun)

## Gameplay

- Follow 44 quests: 38 required quests, an optional return-value lesson, and five optional crop quests.
- Practice commands, loops, conditions, variables, comparisons, functions, and lists in either editor.
- Use lesson practice tiles and progressive hints to retry a program and understand what went wrong.
- Earn coins and experience, unlock crops, expand the farm, and program multiple robots.
- Manage crop growth, soil moisture, spoilage, weather, and hazards.

The [quest guide](documentation/QUEST_PATH_V2.md) describes the curriculum, completion rules, hints, and lesson protection. The [farm systems guide](documentation/FARM_LIFECYCLES_AND_WEATHER.md) covers crop and weather behavior.

## New Game and Continue

Algobot automatically saves one playthrough in the browser. Continue restores the farm, quests, inventory, robots, and editor programs after a reload or browser restart. New Game asks for confirmation before replacing an existing playthrough.

Growth, spoilage, hazards, and other simulation timers pause while the game is closed. Restored programs remain stopped until the player runs them again.

Saves belong to the browser profile and site address where the game was played. They do not transfer between devices or domains. Clearing site data removes local progress. Research uploads are separate archives for the study; they do not provide cloud saves or restore a farm on another device.

## Run locally

Use Node.js compatible with Vite 7 and npm. Development has been verified with Node 24.19.0 and npm 11.17.0. Chromium is the supported browser target.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. To build and preview the production bundle:

```sh
npm run build
npm run preview
```

Python is only needed for the research data and training tools. See [Windows setup](SETUP_GUIDE.md) and the [model workflow](documentation/MODEL_WORKFLOW.md) for those dependencies.

## Tests

```sh
# Unit and regression tests
npm test

# Install the browser once, then run the Chromium suite
npx playwright install chromium
npm run test:e2e:chromium

# Browser uploads through local workerd and disposable local R2 storage
npm run test:upload:integration

# Check preserved research artifacts; requires the historical Git commits
npm run verify:artifacts
```

The [save/load verification record](documentation/SAVE_CONTINUE_VALIDATION.md) documents automated checks. The [manual campaign record](documentation/save-load-manual-review/STATUS.md) tracks three completed 44-quest playthroughs and the remaining fault and endurance cases. It also records an open canvas-resize issue; reloading restores the layout after enlarging a small viewport.

## Deploy to Cloudflare

The game frontend and the upload Worker are separate deployments.

### Test online without pushing

Open [the test game](https://algobot-test.jidalman-work.workers.dev). From a terminal in this repository, update it with:

```sh
npm run deploy:staging
```

This builds your current local files and deploys the test game and test upload Worker through Wrangler. No Git push is required. The test game uses `algobot-data-test` in R2, under `testing/`; production uses `algobot-data`. Test saves are separate because the game runs at a different address. The test URL is public; its browser tab says **Algobot TEST**.

To run locally with uploads to the same test storage:

```sh
npm run dev:staging
```

Use `http://localhost:5173`. The command refuses to use a different port because the test upload Worker only permits the listed origins. Plain `npm run dev` retains its existing configuration.

Test credentials are already configured on the setup computer in the ignored `.env.staging.local` and `cloudflare/test/.secrets.local` files. They are separate from production credentials. On another computer, restore these files securely and authenticate Wrangler before deploying. See [test environment setup](cloudflare/test/README.md). `npm run deploy:staging:check` builds and checks packaging without deploying.

### Game frontend

The production branch is `main`. Configure these in the game project's **Build variables and secrets** before building:

| Variable | Value |
| --- | --- |
| `VITE_UPLOAD_URL` | `https://upload.algobot.fun` |
| `VITE_UPLOAD_TOKEN` | The upload Worker's `STUDY_TOKEN` value |

Set the Cloudflare build command to:

```sh
npm run build && npm run verify:upload-build
```

Keep the frontend deployment configured to publish `dist`. The verification command fails if the built JavaScript is missing the upload configuration. Vite embeds these variables at build time, so changing them requires a new build.

Merge the intended changes into `main`, then check Cloudflare's build history and production deployment before sharing the updated game. A successful Git merge alone does not confirm that the new frontend is live.

### Upload Worker

From the repository root, using a Cloudflare account with access to the Worker and bucket:

```sh
npx wrangler deploy --config upload-worker/wrangler.toml
```

The Worker serves `upload.algobot.fun` and stores archives in the `algobot-data` R2 bucket. It requires the `STUDY_TOKEN` and `ADMIN_TOKEN` secrets. Keep existing values when redeploying; see the [upload setup guide](upload-worker/README.md) for initial configuration, limits, and verification.

The browser upload token is public in the built JavaScript. `ADMIN_TOKEN` is for researcher downloads only and must never be placed in a `VITE_` variable.

## Research data and adaptive difficulty

Algobot records gameplay for research and uses a browser-based LSTM with explicit difficulty rules. The current model predicts a first-harvest task score from recent gameplay. It is provisional and has not been validated as a reliable measure of general programming proficiency. DQN is not used in live inference. The [model card](public/models/lstm/model-card.json) and [deployment record](documentation/MODEL_DEPLOYMENT_2026-09-26.md) describe the active model and its limitations.

With uploads configured, the game sends compressed research archives periodically and when Finish opens or the player returns to the menu. Players can also download their data. Wait for upload confirmation or save the download before closing the game; browser closure does not guarantee that an upload finishes.

Researchers can retrieve a collection round with:

```sh
npm run pull-data -- round3
```

Configure the administrator credentials as described in the [upload guide](upload-worker/README.md). Downloads go to the ignored `training/raw/round3` directory. Keep participant exports and credentials out of Git, preserve historical experiment outputs, and write new analyses to separate directories.

For study preparation and analysis, see the [collection protocol](documentation/DATA_COLLECTION_PROTOCOL.md), [collection checklist](documentation/COLLECTION_DAY_CHECKLIST.md), and [model workflow](documentation/MODEL_WORKFLOW.md). Check the recorded version and study conditions before reusing an earlier collection protocol.

## Project structure

| Path | Contents |
| --- | --- |
| `src/components/` | Svelte interface, editors, menus, and research controls |
| `src/game/` | KAPLAY game systems, quests, persistence, and ML runtime |
| `public/` | Game assets and browser model files |
| `upload-worker/` | Cloudflare upload service and deployment configuration |
| `tests/` | Unit tests, Chromium scenarios, and upload integration tests |
| `training/` | Research preparation and model training tools |
| `documentation/` | System guides, protocols, and verification records |

The interface uses Svelte 5, the farm uses KAPLAY, and TensorFlow.js runs the model locally. Both editors execute student programs through the game's interpreter.
