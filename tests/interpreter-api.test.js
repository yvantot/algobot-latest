import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createCommandAPI } from "../src/game/global/command-api.js";
import { createInterpreterInit } from "../src/game/global/interpreter-bindings.js";
import { createCodeRunner } from "../src/game/global/code-runner.js";

const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(new URL("../public/js-interpreter.js", import.meta.url), "utf8"), context);
const InterpreterClass = context.Interpreter;

function harness(source, methods = {}, dependencies = {}) {
  const log = { output: [], quests: [], actions: [], errors: [], greedy: [], runs: [], runDetails: [], checks: 0 };
  const robot = { grid_x: 1, grid_y: 1, bot_index: 3, executionErrorCount: 0, sayText: value => log.output.push(value), ...methods };
  const telemetry = {
    recordBotAction: action => log.actions.push(action),
    recordError: message => log.errors.push(message),
    recordGreedyChoice: choice => log.greedy.push(choice),
    recordCheckBeforeAction: () => log.checks++,
    recordCodeRun: (result, details) => { log.runs.push(result); log.runDetails.push(details); },
    recordInterpreterStep() {}, recordLoopExecution() {}, recordIfCondition() {}, recordCodeReset() {},
  };
  const api = createCommandAPI({ robot, telemetry, onQuestEvent: (...event) => log.quests.push(event), ...dependencies });
  const interpreter = new InterpreterClass(source, createInterpreterInit(api));
  function run() {
    for (let step = 0; step < 10000; step++) {
      if (interpreter.getStatus() === InterpreterClass.Status.ASYNC) return false;
      if (!interpreter.step()) return true;
    }
    assert.fail("Interpreter did not finish or yield within the test budget");
  }
  return { robot, api, log, interpreter, run, telemetry };
}

test("student code cannot call legacy telemetry hooks", () => {
  for (const source of ['__trackLoop("for");', '__trackIf(true);']) {
    const h = harness(source);
    const observations = [];
    h.telemetry.recordLoopExecution = value => observations.push(["loop", value]);
    h.telemetry.recordIfCondition = value => observations.push(["condition", value]);
    assert.throws(() => h.run(), /is not defined/, source);
    assert.deepEqual(observations, []);
    assert.deepEqual(h.log.quests, []);
  }
});

test("the runner observes actual loops and branches without student telemetry hooks", () => {
  const h = harness("");
  const loops = [], conditions = [];
  h.telemetry.recordLoopExecution = value => loops.push(value);
  h.telemetry.recordIfCondition = value => conditions.push(value);
  const states = [{ robot: h.robot }];
  const runner = createCodeRunner({ states, InterpreterClass, telemetry: h.telemetry,
    prepare: () => 'for (var i = 0; i < 2; i++) { if (i === 0) bot.say("first"); else bot.say("second"); } var j = 0; while (j < 1) { j++; }',
    init: () => createInterpreterInit(h.api), schedule: () => 1, unschedule() {},
  });
  runner.start(0);
  for (let i = 0; i < 100 && states[0].interpreter; i++) runner.step(0);
  assert.equal(states[0].interpreter, null);
  assert.deepEqual(h.log.runs, [true]);
  assert.deepEqual(h.log.output, ["first", "second"]);
  assert.deepEqual(loops, ["for", "for", "while"]);
  assert.deepEqual(conditions, [true, false]);
});

test("successful action credit waits for completion and duplicate callbacks cannot resume twice", () => {
  let completed;
  const h = harness('bot.water(); bot.say("done");', { botWater(callback) { completed = callback; return true; } });
  assert.equal(h.run(), false);
  assert.deepEqual(h.log.quests, []);
  assert.deepEqual(h.log.output, []);
  completed(true);
  completed(false);
  assert.equal(h.run(), true);
  assert.equal(h.log.quests.filter(([key, , action]) => key === "tut_2" && action === "water").length, 1);
  assert.deepEqual(h.log.output, ["done"]);
  assert.deepEqual(h.log.actions, ["water"]);
});

test("failed deferred planting and harvest never award tutorial or greedy credit", () => {
  let finish;
  const h = harness('bot.plant("wheat"); bot.harvest();', {
    botPlant(type, callback) { assert.equal(type, "wheat"); finish = callback; return true; },
    getHarvestChoice: () => true,
    botHarvest(callback) { finish = callback; return "wheat"; },
  });
  assert.equal(h.run(), false);
  finish(false);
  assert.equal(h.run(), false);
  finish(false);
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.quests, []);
  assert.deepEqual(h.log.greedy, []);
});

test("completed harvest and dead-crop cleanup use robot queries without a farm map", () => {
  const h = harness("bot.harvest(); bot.destroy();", {
    getHarvestChoice: () => false,
    botHarvest(callback) { callback("wheat"); },
    isCurrentCropDead: () => true,
    botDestroy(callback) { callback(true); },
  });
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.greedy, [false]);
  assert.deepEqual(h.log.quests, [["tut_2", 1, "harvest"], ["crop_wheat_1", 1, null], ["cs_cleanup_0", 1, null]]);
});

test("fire checks, extinguish and watering remain usable from real interpreted student code", () => {
  let fire = true;
  let watered = false;
  const h = harness('if (bot.is_fire()) bot.extinguish(); bot.water(); bot.say(bot.is_fire()); bot.say(bot.is_watered());', {
    checkFire: callback => callback(fire),
    botExtinguish(callback) { fire = false; callback(true); },
    botWater(callback) { fire = false; watered = true; callback(true); },
    checkWatered: callback => callback(watered),
  });
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.output, [false, true]);
  assert.deepEqual(h.log.actions, ["extinguish", "water"]);
  assert.equal(h.log.checks, 3);
});

test("move, wait and plant bindings preserve interpreter argument arities and updated coordinates", () => {
  const calls = [];
  const h = harness('bot.jump(2, 3); bot.left(); bot.up(); bot.down(); bot.right(); bot.wait(0.5); bot.plant("corn");', {
    botJump(x, y, callback) { calls.push(["jump", x, y]); this.grid_x = x; this.grid_y = y; callback(true); },
    botWait(seconds, callback) { calls.push(["wait", seconds]); callback(true); },
    botPlant(type, callback) { calls.push(["plant", type]); callback(true); },
  });
  assert.equal(h.run(), true);
  assert.deepEqual(calls, [["jump", 2, 3], ["jump", 1, 3], ["jump", 1, 2], ["jump", 1, 3], ["jump", 2, 3], ["wait", 0.5], ["plant", "corn"]]);
  assert.equal(h.log.quests.filter(([key]) => key === "tut_1").length, 4);
});

test("omitted async arguments still deliver their callback and cannot freeze execution", () => {
  const h = harness('bot.jump(); bot.wait(); bot.plant(); bot.say("done");', {
    botJump(x, y, callback) { assert.equal(x, undefined); assert.equal(y, undefined); callback(false); },
    botWait(seconds, callback) { assert.equal(seconds, undefined); callback(false); },
    botPlant(type, callback) { assert.equal(type, undefined); callback(false); },
  });
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.output, ["done"]);
  assert.equal(h.log.quests.filter(([key]) => key !== "intro_say").length, 0);
});

test("sync throws and unavailable methods report one error each and release interpreter", () => {
  const h = harness('bot.till(); bot.extinguish(); bot.say(bot.is_fire()); bot.say("done");', {
    botTill() { throw new Error("soil missing"); },
  });
  assert.equal(h.run(), true);
  assert.equal(h.log.errors.length, 3);
  assert.equal(h.robot.executionErrorCount, 3);
  assert.match(h.log.errors[0], /soil missing/);
  assert.deepEqual(h.log.output.slice(-2), [false, "done"]);
});

test("promise completion and rejection resume async commands exactly once", async () => {
  const h = harness('bot.water(); bot.extinguish(); bot.say("done");', {
    botWater(callback) { callback(true); return Promise.resolve(false); },
    botExtinguish: () => Promise.reject(new Error("fire service failed")),
  });
  assert.equal(h.run(), false);
  await Promise.resolve();
  assert.equal(h.run(), true);
  assert.equal(h.log.errors.length, 1);
  assert.equal(h.log.quests.filter(([, , action]) => action === "water").length, 1);
  assert.equal(h.log.output.at(-1), "done");
});

test("a rejected promise marks the owning code run failed after the interpreter resumes", async () => {
  const h = harness("", { botWater: () => Promise.reject(new Error("water service failed")) });
  const states = [{ robot: h.robot }];
  const runner = createCodeRunner({ states, InterpreterClass, telemetry: h.telemetry,
    prepare: () => "bot.water();", init: () => createInterpreterInit(h.api), schedule: () => 1, unschedule() {},
  });
  runner.start(0);
  for (let i = 0; i < 10; i++) runner.step(0);
  assert.deepEqual(h.log.runs, []);
  await Promise.resolve();
  for (let i = 0; i < 20 && states[0].interpreter; i++) runner.step(0);
  assert.equal(states[0].interpreter, null);
  assert.deepEqual(h.log.runs, [false]);
  assert.equal(h.log.runDetails[0].outcome, "error");
});

test("stopping a program is distinguishable from an interpreter error in research records", () => {
  const h = harness("");
  const states = [{ robot: h.robot }];
  const runner = createCodeRunner({ states, InterpreterClass, telemetry: h.telemetry,
    prepare: () => "while (true) { bot.say('working'); }", init: () => createInterpreterInit(h.api),
    schedule: () => 1, unschedule() {} });
  runner.start(0);
  runner.start(0);
  assert.deepEqual(h.log.runs, [false]);
  assert.equal(h.log.runDetails[0].outcome, "stopped");
  assert.equal(h.log.runDetails[0].reason, "manual_stop");
  assert.ok(h.log.runDetails[0].run_id);
  assert.ok(h.log.runDetails[0].duration_ms >= 0);
});

test("locked async actions and checks resume with false without invoking the robot", () => {
  const h = harness('bot.jump(0, 0); bot.say(bot.is_fire()); bot.extinguish();', {}, {
    isUnlocked: (category, key) => !["jump", "is_fire", "extinguish"].includes(key),
  });
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.actions, []);
  assert.equal(h.log.checks, 0);
  assert.equal(h.log.errors.length, 3);
  assert.equal(h.robot.executionErrorCount, 3);
  assert.ok(h.log.output.includes(false));
});

test("a locked operation marks its completed code run failed without invoking the robot", () => {
  for (const source of ["bot.jump(0, 0);", "bot.is_fire();", "columns();", "shop.buy_row();"]) {
    const h = harness("", {
      botJump() { assert.fail("locked robot action was invoked"); },
      checkFire() { assert.fail("locked robot sensor was invoked"); },
    }, { isUnlocked: () => false });
    const states = [{ robot: h.robot }];
    const runner = createCodeRunner({ states, InterpreterClass, telemetry: h.telemetry,
      prepare: () => source, init: () => createInterpreterInit(h.api), schedule: () => 1, unschedule() {},
    });
    runner.start(0);
    for (let i = 0; i < 20 && states[0].interpreter; i++) runner.step(0);
    assert.equal(states[0].interpreter, null);
    assert.deepEqual(h.log.runs, [false], source);
    assert.equal(h.log.errors.length, 1, source);
    assert.equal(h.robot.executionErrorCount, 1, source);
    assert.deepEqual(h.log.quests, [], source);
  }
});

test("inventory aliases, shop, live farm dimensions, unlocks and random source are injected", () => {
  const inventory = { crops: { wheat: 2 }, coins: 60 };
  const size = { rows: 2, columns: 3 };
  const purchases = [];
  const h = harness('shop.buy_seed("wheat", 4); shop.buy_row(); shop.buy_column(); shop.upgrade_bot_move(); shop.upgrade_bot_check(1); shop.upgrade_bot_action(2); bot.say(inventory.seed("wheat")); bot.say(inventory.coins()); bot.say(rows()); bot.say(columns()); bot.say(randint(2, 6)); bot.say(randfloat(2, 6));', {}, {
    inventory, farmSize: () => size, random: () => 0.5,
    shop: {
      buyPlants(type, amount) { purchases.push([type, amount]); inventory.crops[type] += amount; },
      buyLand(direction) { size[direction === "row" ? "rows" : "columns"]++; },
      buyUpgrade: (type, index) => purchases.push([type, index]),
    },
  });
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.output, [6, 60, 3, 4, 4, 4]);
  assert.deepEqual(purchases, [["wheat", 4], ["move_speed", 3], ["check_speed", 1], ["action_speed", 2]]);
});

test("telemetry and quest observer failures cannot strand pending commands", () => {
  const h = harness('bot.water(); bot.say("done");', { botWater(callback) { callback(true); } }, {
    telemetry: { recordBotAction() { throw new Error("observer failed"); } },
    onQuestEvent() { throw new Error("quest panel closed"); },
  });
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.output, ["done"]);
});

test("invalid random bounds fail visibly with a finite fallback", () => {
  const h = harness('bot.say(randint(3, 1)); bot.say(randfloat(0, Infinity)); bot.say(randint(0.1, 0.2));');
  assert.equal(h.run(), true);
  assert.equal(h.log.errors.length, 3);
  assert.deepEqual(h.log.output.filter(value => typeof value === "number"), [0, 0, 0]);
});

test("unknown inventory keys cannot expose native object properties to student code", () => {
  const h = harness('bot.say(inventory.seed("toString")); bot.say(inventory.seeds("constructor")); bot.say(inventory.seed("missing"));');
  assert.equal(h.run(), true);
  assert.deepEqual(h.log.output, [0, 0, 0]);
});

test("an observer or continuation disposed during completion does not cause an unhandled rejection", async () => {
  const h = harness("", { botWater: () => Promise.resolve(true) });
  h.api.bot.water(() => { throw new Error("editor disposed"); });
  await Promise.resolve();
  assert.equal(h.log.errors.length, 1);
  assert.match(h.log.errors[0], /editor disposed/);
  const interpreter = new InterpreterClass('highlightBlock("old-block"); bot.say("done");', createInterpreterInit(h.api, {
    highlightBlock() { throw new Error("workspace disposed"); },
  }));
  while (interpreter.step()) { /* synchronous fixture */ }
  assert.equal(h.log.output.at(-1), "done");
});

test("farm size lesson requires displaying the size, not just reading it", () => {
  const h = harness('rows(); bot.say("Hello!"); bot.say(rows());', {}, {farmSize:()=>({rows:3,columns:3})});
  assert.equal(h.run(), true);
  assert.equal(h.log.quests.filter(([key])=>key==="cs_grid_0").length,1);
});

test("crop presence lesson displays both boolean results after the sensor finishes", () => {
  for (const value of [false, true]) {
    let complete;
    const h = harness('bot.say(bot.is_planted());', {
      checkPlanted(callback) { complete = callback; },
    });
    assert.equal(h.run(), false);
    assert.deepEqual(h.log.output, []);
    assert.deepEqual(h.log.quests, []);
    complete(value);
    assert.equal(h.run(), true);
    assert.deepEqual(h.log.output, [value]);
    assert.equal(h.log.quests.filter(([key]) => key === "cs_check_0").length, 1);
  }
});

test("crop presence lesson needs a displayed sensor result, including no credit on errors", () => {
  for (const source of ['bot.say(false);', 'bot.is_planted();', 'bot.is_planted(); bot.say("false");']) {
    const h = harness(source, { checkPlanted: callback => callback(false) });
    assert.equal(h.run(), true);
    assert.equal(h.log.quests.some(([key]) => key === "cs_check_0"), false);
  }
  const h = harness('bot.say(bot.is_planted());', { checkPlanted() { throw new Error("unavailable"); } });
  assert.equal(h.run(), true);
  assert.equal(h.log.quests.some(([key]) => key === "cs_check_0"), false);
});
