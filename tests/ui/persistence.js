import { mount } from "svelte";
import "../../src/index.css";
import App from "../../src/App.svelte";
import { k } from "../../src/lib/kaplay.js";
import { persistence, assessmentTransition } from "../../src/game/persistence/runtime.svelte.js";
import { captureWorld, restoreWorld, newWorld } from "../../src/game/persistence/world.js";
import { farm_grid_index } from "../../src/game/game.js";
import { addCrop } from "../../src/game/components-kaplay/crop.js";
import { INVENTORY, PLAYER_DATA } from "../../src/game/global/global.js";
import { robots_state, Personalize, QUEST_STATE, QUEST_FEEDBACK, TUTORIAL, ONBOARDING } from "../../src/components/global.svelte.js";
import { QUEST_DATA } from "../../src/game/global/quests.js";
import { telemetry } from "../../src/game/ml/telemetry.js";
import { dataLogger } from "../../src/game/ml/data-logger.js";
import { openChallenge, submitChallenge, interruptChallenge, claimChallengeReward, farmChallengeRewards } from "../../src/game/challenges/records.js";
import { mlAgent } from "../../src/game/ml/agent.js";
import { wasExposed } from "../../src/game/persistence/runtime.svelte.js";
import { CHALLENGES } from "../../src/game/challenges/catalog.js";
import { eventScheduler } from "../../src/game/ml/event-scheduler.js";
window.saveTesting = { get k() { return k; }, persistence, captureWorld, restoreWorld, newWorld, farm_grid_index, addCrop,
  INVENTORY, PLAYER_DATA, robots_state, Personalize, QUEST_DATA, QUEST_STATE, QUEST_FEEDBACK, TUTORIAL, ONBOARDING, assessmentTransition,
  telemetry, dataLogger, openChallenge, submitChallenge, interruptChallenge, claimChallengeReward, farmChallengeRewards, CHALLENGES, mlAgent, wasExposed, eventScheduler };
mount(App, { target: document.getElementById("app") });
