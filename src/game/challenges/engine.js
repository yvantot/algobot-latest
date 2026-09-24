// Only this small world is exposed to JS-Interpreter; no live farm objects enter it.
export async function evaluateChallenge(source, task, Interpreter, { signal, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  if (typeof Interpreter !== "function") throw Error("The code runner is still loading. Please try again.");
  if (typeof source !== "string" || source.length > 12000) throw Error("Please keep your program below 12,000 characters.");
  const results = [];
  for (const layout of task.cases) {
    signal?.throwIfAborted();
    const crops = layout.map(ready => ready ? "ready" : "young");
    const visited = new Set([0]), harvested = new Set();
    let position = 0, mistakes = 0, actions = 0, error = null;
    const trace = [{ position, crops: [...crops], message: "Ready to run" }];
    const frame = message => {
      if (++actions > 120) throw Error("Too many actions. Try a shorter loop.");
      trace.push({ position, crops: [...crops], message });
    };
    const move = direction => {
      const next = position + direction;
      if (next < 0 || next >= crops.length) { mistakes++; frame("The bot reached the edge"); return; }
      position = next; visited.add(position); frame(direction > 0 ? "bot.right()" : "bot.left()");
    };
    const methods = {
      right: () => move(1), left: () => move(-1),
      is_harvestable: () => { const ready = crops[position] === "ready"; frame(`is_harvestable() → ${ready}`); return ready; },
      harvest: () => {
        if (crops[position] === "ready") { crops[position] = "empty"; harvested.add(position); frame("Ready wheat harvested!"); }
        else { mistakes++; frame("This tile has no ready crop"); }
      },
      say: value => frame(String(value).slice(0, 120)),
    };
    try {
      const interpreter = new Interpreter(source, (runner, scope) => {
        const bot = runner.nativeToPseudo({});
        runner.setProperty(scope, "bot", bot);
        for (const [name, fn] of Object.entries(methods)) runner.setProperty(bot, name, runner.createNativeFunction(fn));
        runner.setProperty(scope, "columns", runner.createNativeFunction(() => crops.length));
        runner.setProperty(scope, "rows", runner.createNativeFunction(() => 1));
        // Fixed challenges must not vary with random numbers or wall-clock time.
        runner.setProperty(scope, "Date", runner.UNDEFINED);
        runner.setProperty(runner.getProperty(scope, "Math"), "random", runner.createNativeFunction(() => { throw Error("Use a repeatable program without random numbers."); }));
      });
      let finished = false;
      for (let steps = 0; steps < 20000; steps++) {
        if (steps % 500 === 0) { signal?.throwIfAborted(); await yieldControl(); }
        if (!interpreter.step()) { finished = true; break; }
      }
      if (!finished) throw Error("The program ran too long. Check your loop.");
    } catch (caught) {
      if (signal?.aborted) throw caught;
      error = caught.message || String(caught);
    }
    const checks = {
      visited_every_tile: visited.size === crops.length,
      harvested_all_ready: harvested.size === layout.filter(Boolean).length,
      safe_and_finished: !error && mistakes === 0,
    };
    results.push({ checks, passed: Object.values(checks).every(Boolean), error, mistakes, trace });
  }
  return { score: results.reduce((sum, r) => sum + Object.values(r.checks).filter(Boolean).length, 0),
    max_score: task.cases.length * 3, passed: results.every(r => r.passed), results };
}
