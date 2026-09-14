import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createCodeRunner } from "../src/game/global/code-runner.js";
import { isPurchaseAmount, expansionTiles, waterRainTiles } from "../src/game/global/farm-rules.js";
import { SoilStates, CropStates } from "../src/game/global/enum.js";
import { preferences } from "../src/game/utils/preferences.js";

const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(new URL("../public/js-interpreter.js", import.meta.url), "utf8"), context);
const InterpreterClass = context.Interpreter;

function harness(code, init = () => {}) {
  const records = { runs: [], resets: 0, errors: [], branches: [], loops: [], cancelled: 0, quests: [] };
  const telemetry = {
    errorCount: 0,
    recordCodeRun(success) { records.runs.push(success); },
    recordCodeReset() { records.resets++; },
    recordError(message) { this.errorCount++; records.errors.push(message); },
    recordIfCondition(value) { records.branches.push(value); },
    recordLoopExecution(type) { records.loops.push(type); },
  };
  const states = [{ robot: { is_available: true, sayText() {} }, onQuestEvent(key) { records.quests.push(key); } }];
  const runner = createCodeRunner({ states, InterpreterClass, telemetry, prepare: () => code, init: () => init, schedule: () => 1, unschedule: () => records.cancelled++ });
  function complete() {
    for (let n = 0; states[0].interpreter && n < 110000; n++) runner.step(0);
    assert.equal(states[0].interpreter, null, "run must terminate within its step limit");
  }
  return { runner, states, records, complete };
}

test("normal completion is one success, not a reset, and releases its interval", () => {
  const h = harness("var a = 1 + 2;");
  h.runner.start(0);
  assert.deepEqual(h.records.runs, [], "Start does not assume success");
  h.complete();
  assert.deepEqual(h.records.runs, [true]);
  assert.equal(h.records.resets, 0);
  assert.equal(h.records.cancelled, 1);
});

test("syntax and runtime errors are visible failures with no uncaught exception", () => {
  for (const source of ["var = ;", "missingFunction();"]) {
    const h = harness(source);
    h.runner.start(0);
    h.complete();
    assert.equal(h.records.errors.length, 1);
    assert.deepEqual(h.records.runs, [false]);
    assert.equal(h.records.resets, 0);
  }
});

test("condition telemetry records real true/false results once per evaluation", () => {
  const h = harness("var x = 0; if (false) x = 1; else x = 2; if (true) x = 3; if (false) x = 4;");
  h.runner.start(0); h.complete();
  assert.deepEqual(h.records.branches, [false, true, false]);
  assert.equal(h.records.quests.filter(key => key === "cs_if_0").length, 3);
});

test("loop telemetry counts executed iterations, including zero-iteration and nested branches", () => {
  const h = harness("for (var i = 0; i < 3; i++) { if (i === 1) continue; } for (var j = 0; j < 0; j++) {} while (j < 2) j++; do { j++; } while (false);");
  h.runner.start(0); h.complete();
  assert.deepEqual(h.records.loops, ["for", "for", "for", "while", "while", "while"]);
  assert.deepEqual(h.records.branches, [false, true, false]);
});

test("async actions yield until their callback and do not recurse or finish early", () => {
  let resume;
  const h = harness("wait(); var done = true;", (interpreter, globalObject) => {
    interpreter.setProperty(globalObject, "wait", interpreter.createAsyncFunction((callback) => { resume = callback; }));
  });
  h.runner.start(0);
  while (!resume) h.runner.step(0);
  for (let n = 0; n < 20; n++) h.runner.step(0);
  assert.deepEqual(h.records.runs, []);
  assert.equal(h.states[0].is_running, true);
  resume(); h.complete();
  assert.deepEqual(h.records.runs, [true]);
});

test("Stop does not construct a second run; explicit Reset alone increments reset telemetry", () => {
  const h = harness("var a = 2;");
  h.runner.start(0); h.runner.start(0);
  assert.deepEqual(h.records.runs, [false]);
  assert.equal(h.records.resets, 0);
  h.runner.reset(0);
  assert.equal(h.records.resets, 1);
  assert.deepEqual(h.records.runs, [false]);
});

test("one robot's rejected action cannot mark another robot's clean run as failed", () => {
  const results = [];
  const states = [0, 1].map(() => ({ robot: { is_available: true, executionErrorCount: 0, sayText() {} } }));
  const telemetry = {
    errorCount: 0,
    recordCodeRun(value) { results.push(value); },
    recordError() { this.errorCount++; },
    recordCodeReset() {}, recordIfCondition() {}, recordLoopExecution() {},
  };
  const runner = createCodeRunner({ states, InterpreterClass, telemetry,
    prepare: index => index === 0 ? "var clean = 1;" : "rejectAction();",
    init: index => (interpreter, globalObject) => {
      interpreter.setProperty(globalObject, "rejectAction", interpreter.createNativeFunction(() => {
        states[index].robot.executionErrorCount++;
        telemetry.recordError();
      }));
    }, schedule: () => 1, unschedule() {},
  });
  runner.start(0); runner.start(1);
  while (states[1].interpreter) runner.step(1);
  while (states[0].interpreter) runner.step(0);
  assert.deepEqual(results, [false, true]);
});

test("pure infinite loops fail within the budget and leave the editor stoppable", () => {
  const h = harness("while (true) {}");
  h.runner.start(0); h.complete();
  assert.deepEqual(h.records.runs, [false]);
  assert.match(h.records.errors[0], /loop condition/);
  assert.equal(h.states[0].is_running, false);
});

test("purchases reject negative, fractional, nonnumeric and unsafe quantities", () => {
  for (const value of [-1, 0, 0.5, NaN, Infinity, "2", Number.MAX_SAFE_INTEGER + 1]) assert.equal(isPurchaseAmount(value), false);
  assert.equal(isPurchaseAmount(2), true);
});

test("buying multiple rows or columns creates every new grid position", () => {
  assert.deepEqual(expansionTiles(2, 2, "row", 2), [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }]);
  assert.deepEqual(expansionTiles(2, 2, "column", 2), [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 0 }, { x: 3, y: 1 }]);
});

test("rain waters prepared growing tiles without watering untilled or dead crops", () => {
  const tile = (state, cropState) => ({ soil: { soil_state: state, setSoilState(next) { this.soil_state = next; } }, crop: cropState ? { crop_state: cropState } : null });
  const farm = new Map([
    ["0", tile(SoilStates.READY)],
    ["1", tile(SoilStates.READY, CropStates.YOUNG)],
    ["2", tile(SoilStates.INITIAL)],
    ["3", tile(SoilStates.READY, CropStates.DEAD)],
    ["4", tile(SoilStates.READY, CropStates.HARVESTABLE)],
  ]);
  assert.equal(waterRainTiles(farm), 2);
  assert.equal(farm.get("1").soil.soil_state, SoilStates.WATERED);
  assert.equal(farm.get("2").soil.soil_state, SoilStates.INITIAL);
  assert.equal(farm.get("3").soil.soil_state, SoilStates.READY);
  assert.equal(waterRainTiles(farm), 0);
});

test("documented inventory and pest checks work in the actual interpreter bindings", () => {
  const output = [];
  const checks = [];
  const bindingContext = vm.createContext({
    CONFIG: { FARM: { rows: 2, columns: 2 } },
    INVENTORY: { crops: { wheat: 5 }, coins: 50 },
    DOCUMENT_DATA: {}, CropStates,
    telemetry: { recordInterpreterStep() {}, recordCheckBeforeAction() {}, recordBotAction() {}, recordLoopExecution() {}, recordIfCondition() {} },
    farm_grid_index: new Map(),
    buyLand() {}, buyUpgrade() {}, buyPlants() {},
  });
  const source = fs.readFileSync(new URL("../src/game/global/interpreter.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export function createInit", "function createInit");
  vm.runInContext(source, bindingContext);
  const robot = { sayText(value) { output.push(value); }, isBug(cb) { checks.push("bug"); cb(true); } };
  const interpreter = new InterpreterClass('bot.say(inventory.seed("wheat")); bot.say(inventory.coin()); bot.say(inventory.seeds("wheat")); bot.say(bot.is_bug()); console.log("ready");', bindingContext.createInit(robot));
  while (interpreter.step()) { /* all fixture callbacks complete synchronously */ }
  assert.deepEqual(output, [5, 50, 5, true, "ready"]);
  assert.deepEqual(checks, ["bug"]);
});

test("farming tutorial cannot be completed by repeating the same action", () => {
  const completions = [];
  const questContext = vm.createContext({
    $state: value => value,
    AvatarTypes: { FARMER: "farmer" }, ModalTypes: {},
    QUEST_DATA: { tut_2: { goal: 4, prereq: [] } },
    PLAYER_DATA: {}, INVENTORY: {}, DOCUMENT_DATA: {}, SHOP_DATA: {}, CROP_DATA: {},
    CS1_STAGES: { SEQUENTIAL: 1, CONDITIONAL: 2, LOOPING: 3 },
    telemetry: { currentStage: 1, setStage() {}, recordQuestStart() {}, recordQuestComplete(key) { completions.push(key); return true; } },
    mlAgent: { updateAndPredict: async () => {}, addQuestCompletionReward() {} },
  });
  const source = fs.readFileSync(new URL("../src/components/global.svelte.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replaceAll("export ", "");
  vm.runInContext(source, questContext);
  for (let n = 0; n < 5; n++) questContext.trackQuest("tut_2", 1, "till");
  assert.deepEqual(completions, []);
  for (const action of ["plant", "water", "harvest"]) questContext.trackQuest("tut_2", 1, action);
  assert.deepEqual(completions, ["tut_2"]);
  questContext.trackQuest("tut_2", 1, "harvest");
  assert.deepEqual(completions, ["tut_2"]);
});

test("optional preferences tolerate inaccessible browser storage", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage blocked"); } });
  try {
    assert.equal(preferences.getItem("setting"), null);
    assert.equal(preferences.setItem("setting", "value"), false);
    assert.equal(preferences.removeItem("setting"), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
