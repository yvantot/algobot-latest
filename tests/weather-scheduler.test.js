import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import { canStartFireEvent } from "../src/game/events/simulation.js";

globalThis.__weatherFarm = new Map();
globalThis.__weatherAgent = { mode: "hybrid", lastAction: 2 };
globalThis.__weatherRecorded = [];
const hook = registerHooks({
  load(url, context, nextLoad) {
    let source;
    if (url.endsWith("/src/lib/kaplay.js")) source = "export const k = {}";
    if (url.endsWith("/src/game/game.js")) source = "export const farm_grid_index = globalThis.__weatherFarm";
    if (url.endsWith("/src/game/ml/agent.js")) source = "export const mlAgent = globalThis.__weatherAgent";
    if (url.endsWith("/src/game/ml/telemetry.js")) source = "export const telemetry = { recordScheduledEvent: (...args) => globalThis.__weatherRecorded.push(args) }";
    if (url.endsWith("/src/game/ml/dda.js")) source = "export const DDA_ACTIONS = { NORMAL:0, SCAFFOLD:1, CHALLENGE:2, GREEDY_GUIDE:3, STATE_OPTIMIZE:4 }";
    if (url.endsWith("/src/game/event.js")) source = "export const spawnBugEvent = () => {}; export const spawnRainEvent = () => {}; export const spawnFireEvent = () => {}; export const canStartFireEvent = () => false";
    return source ? { source, format: "module", shortCircuit: true } : nextLoad(url, context);
  },
});
const { EventScheduler } = await import("../src/game/ml/event-scheduler.js");
const { CONFIG, PLAYER_DATA } = await import("../src/game/global/global.js");
const { CropStates } = await import("../src/game/global/enum.js");
hook.deregister();

beforeEach(() => {
  __weatherFarm.clear();
  __weatherRecorded.length = 0;
  __weatherAgent.mode = "hybrid";
  __weatherAgent.lastAction = 2;
  CONFIG.FARM.rows = CONFIG.FARM.columns = 3;
  PLAYER_DATA.level = 1;
  for (let i = 0; i < 9; i++) __weatherFarm.set(`${Math.floor(i / 3)}-${i % 3}`, { soil: {} });
});

function plant(count, state = CropStates.YOUNG) {
  [...__weatherFarm.values()].slice(0, count).forEach(tile => { tile.crop = { crop_state: state }; });
}

function scheduler(random = () => 0, applied = true) {
  const calls = [];
  const events = { canStartFire: canStartFireEvent };
  for (const type of ["fire", "rain", "bug"]) events[type] = (grid, points) => {
    calls.push({ type, grid, points });
    return { type, applied, reason: applied ? undefined : "no_targets" };
  };
  return { scheduler: new EventScheduler({ random, events }), calls };
}

test("challenge triggers fire at two-thirds planting without requiring ripe crops", () => {
  plant(5);
  const { scheduler: s, calls } = scheduler();
  assert.equal(s.forceCheck().reason, "precondition");
  plant(6);
  assert.equal(s.forceCheck().reason, "fire");
  assert.deepEqual(calls.map(call => call.type), ["fire"]);
  assert.equal(calls[0].points, s.eventSeverity());
  assert.equal(s.eventsTriggered, 1);
  assert.equal(s.forceCheck().reason, "cooldown");
  assert.equal(__weatherRecorded[0][0], "fire");
});

test("challenge can choose pests or fire when both are eligible", () => {
  plant(6, CropStates.HARVESTABLE);
  assert.equal(scheduler(() => 0).scheduler.forceCheck().reason, "bug");
  assert.equal(scheduler(() => 0.99).scheduler.forceCheck().reason, "fire");
});

test("scaffold always chooses rain and forwards severity even on an empty farm", () => {
  __weatherAgent.lastAction = 1;
  PLAYER_DATA.level = 10;
  const { scheduler: s, calls } = scheduler();
  assert.equal(s.forceCheck().reason, "rain");
  assert.equal(calls[0].points, 1100);
  assert.equal(calls[0].grid, __weatherFarm);
});

test("failed events consume neither cooldown nor telemetry counts", () => {
  plant(6);
  const { scheduler: s } = scheduler(() => 0, false);
  assert.equal(s.forceCheck().reason, "no_targets");
  assert.equal(s.lastEventTime, 0);
  assert.equal(s.eventsTriggered, 0);
  assert.equal(__weatherRecorded.length, 0);
});

test("normal mode and paused gameplay do not introduce challenge events", () => {
  plant(9);
  const { scheduler: s, calls } = scheduler();
  __weatherAgent.lastAction = 0;
  assert.equal(s.forceCheck().reason, "no_event_for_action");
  __weatherAgent.lastAction = 2;
  s.shouldRun = () => false;
  assert.equal(s._check().reason, "gameplay_paused");
  assert.equal(calls.length, 0);
});
