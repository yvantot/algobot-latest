import test from "node:test";
import assert from "node:assert/strict";
import { QUEST_DATA, QUEST_PATH_VERSION } from "../src/game/global/quests.js";
import { activeQuest } from "../src/game/global/tutorial.js";
import { TelemetryTracker } from "../src/game/ml/telemetry.js";

test("the full path is reachable without completing optional quests", () => {
  const states = {}, visited = [];
  for (let key; (key = activeQuest(QUEST_DATA, states));) {
    assert.ok(!visited.includes(key));
    visited.push(key);
    states[key] = { is_completed: true, is_claimed: true };
  }
  assert.equal(visited.length, 38);
  assert.equal(visited.at(-1), "hazard_fire_0");
  assert.ok(visited.indexOf("shop_seed_0") < visited.indexOf("intro_loop"));
  assert.ok(visited.indexOf("if_ready_0") < visited.indexOf("cs_if_0"));
  assert.ok(visited.indexOf("cs_wait_0") < visited.indexOf("fn_define_0"));
  for (const [key, quest] of Object.entries(QUEST_DATA)) {
    assert.ok(quest.prereq.every(id => QUEST_DATA[id]), key);
    if (quest.optional) assert.ok(quest.prereq.every(id => states[id]?.is_claimed), key);
  }
});

test("crop side quests cannot block chapter crop rewards", () => {
  for (const [crop, key] of Object.entries({ corn:"cs_cleanup_0", rice:"shop_upgrade_0", potato:"var_crop_0", sugarcane:"cs_jump_0", tomato:"loop_farm_0" })) {
    assert.ok(QUEST_DATA[key].rewards.unlocks.includes(crop));
    assert.equal(QUEST_DATA["crop_" + crop + "_1"].optional, true);
    assert.equal(QUEST_DATA["crop_" + crop + "_1"].goal, 3);
  }
});

test("new collection exports identify the new path", () => {
  assert.equal(QUEST_PATH_VERSION, "guided-v2");
  const tracker = new TelemetryTracker();
  assert.equal(tracker.getSessionSummary().introductionVersion, QUEST_PATH_VERSION);
});
