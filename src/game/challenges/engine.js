import { createCommandAPI } from "../global/command-api.js";
import { createInterpreterInit } from "../global/interpreter-bindings.js";

export async function evaluateChallenge(source, task, Interpreter, { world, signal, onCase = () => {}, onAction = () => {}, yieldControl = () => new Promise(resolve => setTimeout(resolve, 16)) } = {}) {
  if (typeof Interpreter !== "function") throw Error("The code runner is still loading. Try again in a moment.");
  if (!world) throw Error("The challenge farm is not ready.");
  if (typeof source !== "string" || source.length > 12000) throw Error("That program is huge! Keep it below 12,000 characters.");
  const results = [];
  for (const [index, layout] of task.cases.entries()) {
    signal?.throwIfAborted();
    const robot = world.reset(layout);
    onCase(index);
    const visited = new Set([0]), harvested = new Set(), trace = [];
    let mistakes = 0, actions = 0, error = null, fatal = null;
    const api = createCommandAPI({ robot, farmSize: () => ({ columns: layout.length, rows: 1 }) });
    const commands = {};
    for (const name of ["right", "left", "harvest", "is_harvestable"]) {
      commands[name] = callback => {
        if (++actions > 120) { fatal = "Your bot is going in circles! Check the loop."; callback(false); return; }
        const x = robot.grid_x;
        api.bot[name](value => {
          if (signal?.aborted) return;
          if (name !== "is_harvestable" && !value) mistakes++;
          if (name === "harvest" && value) harvested.add(x);
          visited.add(robot.grid_x);
          const event = { command: name, value, position: robot.grid_x };
          trace.push(event); onAction(event); callback(value);
        });
      };
    }
    commands.say = value => {
      if (++actions > 120) throw Error("Even robots need a breath. Shorten that loop!");
      api.bot.say(String(value).slice(0,120));
    };
    const init = createInterpreterInit({ bot: commands, globals: { columns: api.globals.columns, rows: api.globals.rows }, hooks: {}, shop: {}, inventory: {}, console: {} });
    try {
      while (!robot.is_available) { signal?.throwIfAborted(); await yieldControl(); }
      const interpreter = new Interpreter(source, (runner, scope) => {
        init(runner, scope);
        runner.setProperty(scope, "Date", runner.UNDEFINED);
        runner.setProperty(runner.getProperty(scope, "Math"), "random", runner.createNativeFunction(() => { throw Error("Let's use the same plan each time; no random numbers here."); }));
      });
      let steps = 0;
      while (true) {
        signal?.throwIfAborted();
        if (fatal) throw Error(fatal);
        if (interpreter.getStatus() === Interpreter.Status.ASYNC) { await yieldControl(); continue; }
        if (++steps > 20000) throw Error("Your loop needs an exit. The robot could be here all day!");
        if (!interpreter.step()) break;
        if (steps % 200 === 0) await yieldControl();
      }
    } catch (caught) {
      if (signal?.aborted) throw caught;
      error = caught.message || String(caught);
    }
    const checks = { visited_every_tile: visited.size === layout.length,
      harvested_all_ready: harvested.size === layout.filter(Boolean).length, safe_and_finished: !error && mistakes === 0 };
    results.push({ checks, passed: Object.values(checks).every(Boolean), error, mistakes, trace });
  }
  return { score: results.reduce((sum, row) => sum + Object.values(row.checks).filter(Boolean).length, 0), max_score: task.cases.length * 3, passed: results.every(row => row.passed), results };
}
