import { mount } from "svelte";
import "../../src/index.css";
import App from "../../src/App.svelte";
import { k } from "../../src/lib/kaplay.js";
import { persistence, assessmentTransition } from "../../src/game/persistence/runtime.svelte.js";
import { captureWorld, restoreWorld, newWorld } from "../../src/game/persistence/world.js";
import { farm_grid_index } from "../../src/game/game.js";
import { addCrop } from "../../src/game/components-kaplay/crop.js";
import { INVENTORY, PLAYER_DATA } from "../../src/game/global/global.js";
import { robots_state, Personalize, QUEST_STATE, TUTORIAL, ONBOARDING } from "../../src/components/global.svelte.js";
import { QUEST_DATA } from "../../src/game/global/quests.js";
import { telemetry } from "../../src/game/ml/telemetry.js";
import { dataLogger } from "../../src/game/ml/data-logger.js";
import { openChallenge, submitChallenge, claimChallengeReward, farmChallengeRewards } from "../../src/game/challenges/records.js";
import { CHALLENGES } from "../../src/game/challenges/catalog.js";
window.saveTesting = { get k() { return k; }, persistence, captureWorld, restoreWorld, newWorld, farm_grid_index, addCrop,
  INVENTORY, PLAYER_DATA, robots_state, Personalize, QUEST_DATA, QUEST_STATE, TUTORIAL, ONBOARDING, assessmentTransition,
  telemetry, dataLogger, openChallenge, submitChallenge, claimChallengeReward, farmChallengeRewards, CHALLENGES };
mount(App, { target: document.getElementById("app") });
