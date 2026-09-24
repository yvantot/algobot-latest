// One bounded execution controller shared by both editors. Dependencies are
// injected so the same behavior can be tested with the shipped interpreter.
export function stopCodeRuns(states, telemetry) {
  for (const state of states) {
    clearInterval(state.interval);
    state.interval = null;
    state.is_running = false;
    state.interpreter = null;
    if (state.runPending) telemetry.recordCodeRun(false, { outcome: "stopped", reason: "session_exit",
      run_id: state.researchRunId, duration_ms: Date.now() - state.runStartedAt });
    state.runPending = false;
  }
}

export function createCodeRunner({ states, InterpreterClass, telemetry, prepare, init, highlight = () => {}, canStep = () => true, schedule = setInterval, unschedule = clearInterval }) {
  function finish(index, success = null, reason = "manual_stop") {
    const state = states[index];
    if (!state) return;
    if (state.interval != null) unschedule(state.interval);
    state.interval = null;
    state.interpreter = null;
    state.is_running = false;
    if (state.robot) state.robot.executingLoop = false;
    if (state.runPending) {
      const passed = success === true && (state.robot?.executionErrorCount || 0) === state.runErrorBaseline;
      telemetry.recordCodeRun(passed, { outcome: success === null ? "stopped" : passed ? "completed" : "error",
        reason, robot_index: index, run_id: state.researchRunId, duration_ms: Date.now() - state.runStartedAt });
      state.runPending = false;
    }
    highlight(index, null);
  }

  function fail(index, error) {
    telemetry.recordError(error.message || String(error));
    states[index]?.robot?.sayText(`Code error: ${error.message || error}`);
    finish(index, false, "interpreter_error");
  }

  function begin(index) {
    const state = states[index];
    state.runPending = true;
    state.runStartedAt = Date.now();
    state.researchRunId = crypto.randomUUID();
    telemetry._logRawEvent?.("code_run_start", { run_id: state.researchRunId, robot_index: index });
    state.runErrorBaseline = state.robot?.executionErrorCount || 0;
    state.branchVisits = new WeakSet();
    state.stepsWithoutYield = 0;
    try {
      state.interpreter = new InterpreterClass(prepare(index), init(index));
      return true;
    } catch (error) {
      fail(index, error);
      return false;
    }
  }

  function step(index) {
    const state = states[index];
    if (!state || !canStep() || state.robot?.is_available === false) return;
    if (!state.interpreter && !begin(index)) return;
    const interpreter = state.interpreter;
    try {
      // Yield to the browser and Kaplay timers; never recurse while an async
      // bot action is pending, and never let a pure infinite loop freeze the UI.
      for (let count = 0; count < 200; count++) {
        if (interpreter.getStatus() === InterpreterClass.Status.ASYNC) {
          state.stepsWithoutYield = 0;
          return;
        }
        if (++state.stepsWithoutYield > 100000) throw new Error("Too many steps without a bot action. Check your loop condition.");
        const before = interpreter.getStateStack().at(-1);
        if (state.robot) state.robot.executingLoop = interpreter.getStateStack().some(frame =>
          ["ForStatement", "ForInStatement", "WhileStatement", "DoWhileStatement"].includes(frame.node?.type));
        const result = interpreter.step();
        const after = interpreter.getStateStack().at(-1);
        const node = before?.node;
        if (node?.type === "IfStatement" && after !== before && after?.node !== node.test && !state.branchVisits.has(before)) {
          state.branchVisits.add(before);
          telemetry.recordIfCondition(!!before.value);
          state.onQuestEvent?.("cs_if_0", 1);
        }
        if (["ForStatement", "ForInStatement", "WhileStatement", "DoWhileStatement"].includes(node?.type) && after !== before && after?.node === node.body) {
          telemetry.recordLoopExecution(node.type.startsWith("For") ? "for" : "while");
          state.onQuestEvent?.("cs_loop_0", 1);
        }
        if (!result) {
          finish(index, true, "program_end");
          return;
        }
        if (after !== before && after?.node && (after.node.type.endsWith("Statement") || after.node.type === "VariableDeclaration") && after.node.type !== "BlockStatement") {
          highlight(index, after.node);
          return;
        }
      }
    } catch (error) {
      fail(index, error);
    }
  }

  return {
    step,
    start(index) {
      if (states[index]?.is_running) { finish(index, null); return; }
      if (!states[index]?.interpreter && !begin(index)) return;
      states[index].is_running = true;
      states[index].interval = schedule(() => step(index), 16);
    },
    reset(index) { finish(index, null, "reset"); telemetry.recordCodeReset(); },
    dispose() { states.forEach((_, index) => finish(index, null, "editor_closed")); },
  };
}
