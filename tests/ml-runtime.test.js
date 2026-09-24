import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { registerHooks } from "node:module";
import * as tf from "@tensorflow/tfjs";

globalThis.__mlTestFarm = new Map();
globalThis.__mlTestRainApplied = false;
const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/src/lib/kaplay.js")) return { format: "module", source: "export const k = {};", shortCircuit: true };
    if (url.endsWith("/src/game/game.js")) return { format: "module", source: "export const farm_grid_index = globalThis.__mlTestFarm;", shortCircuit: true };
    if (url.endsWith("/src/game/event.js")) return {
      format: "module", shortCircuit: true,
      source: "export const spawnBugEvent = () => ({type:'bug'}); export const spawnRainEvent = () => ({type:'rain',applied:globalThis.__mlTestRainApplied}); export const spawnFireEvent = () => ({applied:false}); export const canStartFireEvent = () => false;",
    };
    return nextLoad(url, context);
  },
});
const { TelemetryTracker, telemetry } = await import("../src/game/ml/telemetry.js");
const { MLDiffAgent, mlAgent } = await import("../src/game/ml/agent.js");
const { DataLogger, normalizeStoredSession } = await import("../src/game/ml/data-logger.js");
const { FEATURE_NAMES, normalizeSequence } = await import("../src/game/ml/model-input.js");
const { dda, DDA_ACTIONS } = await import("../src/game/ml/dda.js");
const { recentPolicyState, StableDifficultyPolicy } = await import("../src/game/ml/recent-policy.js");
const { EventScheduler } = await import("../src/game/ml/event-scheduler.js");
const { CropStates } = await import("../src/game/global/enum.js");
const { CONFIG, CROP_DATA } = await import("../src/game/global/global.js");
hook.deregister();

const scaler = { feature_min: Array(10).fill(0), feature_range: [1, 0.05, 1, 0.6, 1, 1, 0.3, 1, 1, 1], feature_names: FEATURE_NAMES };
const approvedPolicy = { deployment_ready: true, observed_action_counts: { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3 } };
function fakeModel(input, output, values) {
  return {
    inputs: [{ shape: [null, ...input] }], outputs: [{ shape: [null, output] }],
    predict: () => tf.tensor2d([values], [1, output]), dispose() {},
  };
}
function makeAgent({ proficiency = 0.2, policy = approvedPolicy, modelOverrides = {}, scalerValue = scaler } = {}) {
  const lstm = fakeModel([20, 10], 1, [proficiency]);
  const dqn = fakeModel([4], 5, [0, 1, 3, 2, 0]);
  Object.assign(lstm, modelOverrides.lstm);
  Object.assign(dqn, modelOverrides.dqn);
  const agent = new MLDiffAgent({
    loadModel: async path => path.includes("lstm") ? lstm : dqn,
    loadScaler: async () => scalerValue,
    loadPolicyMetadata: async () => policy,
  });
  return { agent, lstm, dqn };
}

beforeEach(() => {
  const saved = new Map();
  globalThis.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: key => saved.delete(key),
  };
  telemetry.resetSession();
  mlAgent.replayBuffer = [];
  mlAgent.resetSession();
  __mlTestFarm.clear();
  globalThis.__mlTestRainApplied = false;
});

test("normalization matches training, validates order, and does not clip extrapolation", () => {
  const sequence = Array.from({ length: 20 }, () => [0, 0.1, 0, 0.3, 0, 0, 0.6, 1, 0, 0]);
  const normalized = normalizeSequence(sequence, scaler);
  assert.equal(normalized[0][1], 2);
  assert.equal(normalized[0][3], 0.5);
  assert.equal(normalized[0][6], 2);
  assert.throws(() => normalizeSequence(sequence, { ...scaler, feature_names: [...FEATURE_NAMES].reverse() }), /feature order/);
  assert.throws(() => normalizeSequence(sequence, { ...scaler, feature_range: Array(10).fill(0) }), /positive/);
});

test("full timestamped feature history remains intact beyond the 20-frame inference window", () => {
  const tracker = new TelemetryTracker();
  for (let i = 0; i < 25; i++) {
    if (i === 21) tracker.setStage(2);
    tracker.recordInterpreterStep();
    tracker.sampleHistory();
  }
  const snapshots = tracker.getFeatureSnapshots();
  assert.equal(snapshots.length, 25);
  assert.equal(tracker.getLSTMInputTensor().length, 20);
  assert.equal(snapshots[0].stage, 1);
  assert.equal(snapshots[24].stage, 2);
  assert.ok(snapshots.every(snapshot => Number.isFinite(snapshot.timestamp_ms)));
  snapshots[0].vector[0] = 99;
  assert.notEqual(tracker.getFeatureSnapshots()[0].vector[0], 99);
  assert.equal(tracker.getRawEvents().filter(event => event.event === "interpreter_step").length, 25);
});

test("quest attribution can return to an existing active quest and completion is idempotent", () => {
  const tracker = new TelemetryTracker();
  tracker.recordQuestStart("first");
  tracker.setStage(2);
  tracker.recordQuestStart("second");
  tracker.recordQuestStart("first");
  tracker.recordError("failure");
  assert.equal(tracker.questAttempts.first.errors, 1);
  assert.equal(tracker.questAttempts.second.errors, 0);
  assert.equal(tracker.recordQuestComplete("first"), true);
  assert.equal(tracker.recordQuestComplete("first"), false);
  assert.equal(tracker.questAttempts.first.stage, 1);
  assert.equal(tracker.questsCompleted, 1);
  tracker.recordError("after completion");
  assert.equal(tracker.questAttempts.first.errors, 1);
});

test("session saves preserve raw events and numeric zero labels without duplicate exports", () => {
  const logger = new DataLogger();
  telemetry.setParticipantId('student,"one"');
  telemetry.recordQuestStart("quest");
  telemetry.recordQuestComplete("quest");
  telemetry.questAttempts.quest.proficiencyLabel = 0;
  telemetry.sampleHistory();
  assert.equal(logger.saveSessionLight(), true);
  assert.equal(logger.saveSessionLight(), true);
  const dataset = logger.buildDatasetExport();
  assert.equal(dataset.session_count, 1);
  assert.equal(dataset.sessions[0].quest_attempts[0].proficiency_label, 0);
  assert.ok(dataset.sessions[0].raw_events.length > 0);
  assert.equal(dataset.sessions[0].feature_timeseries.length, 1);
  assert.match(logger.buildQuestCSV(), /"student,""one"""/);
});

test("legacy stored records keep known mode and explicitly mark missing raw data", () => {
  const legacy = normalizeStoredSession({ summary: { sessionId: "old", participantId: "p1" }, agentState: { mode: "ml" },
    questAttempts: { q: { proficiencyLabel: 0, completed: true } }, rawEventCount: 123 });
  assert.equal(legacy.dda_mode, "ml");
  assert.equal(legacy.quest_attempts[0].proficiency_label, 0);
  assert.equal(legacy.data_quality.raw_events_available, false);
  assert.equal(legacy.data_quality.recorded_raw_event_count, 123);
  assert.equal(normalizeStoredSession({ summary: {} }).dda_mode, "unknown");
});

test("malformed persisted research data is not silently overwritten", () => {
  const logger = new DataLogger();
  localStorage.setItem("algobot_sessions", "{broken");
  assert.equal(logger.saveSessionLight(), false);
  assert.equal(localStorage.getItem("algobot_sessions"), "{broken");
  assert.ok(logger.lastPersistenceError);
});

test("loaded LSTM receives scaled current observation before action inference", async () => {
  let observed;
  const { agent } = makeAgent({ modelOverrides: { lstm: { predict(input) {
    observed = input.arraySync();
    return tf.tensor2d([[0.2]]);
  } } } });
  telemetry.totalInterpreterSteps = 2;
  const result = await agent.updateAndPredict(1);
  assert.equal(result.mode, "hybrid");
  assert.equal(result.action, DDA_ACTIONS.SCAFFOLD);
  assert.ok(observed[0][19][1] > 0);
  assert.equal(observed[0][19][1], Math.fround(telemetry.getFeatureSnapshots()[0].vector[1] / 0.05));
  assert.equal(telemetry.getFeatureSnapshots().length, 1);
});

test("LSTM uses rules regardless of legacy policy metadata", async () => {
  const { agent, dqn } = makeAgent({ policy: { deployment_ready: false, observed_action_counts: { 0: 40 }, reason: "only Normal observed" } });
  dqn.predict = () => { throw new Error("Unsupported DQN must not run"); };
  const result = await agent.updateAndPredict(1);
  assert.equal(result.mode, "hybrid");
  assert.equal(result.action, DDA_ACTIONS.SCAFFOLD);
  assert.equal(result.proficiencySource, "lstm");
  assert.equal(agent.getAgentState().policySource, "rules");
  assert.equal(telemetry.ddaActionsLog[0].mode, "hybrid");
  assert.equal(agent.fallbackReason, null);
});

test("legacy deployment metadata cannot enable a removed DQN", async () => {
  const { agent } = makeAgent({ policy: { deployment_ready: true, observed_action_counts: { 0: 40 } } });
  await agent.init();
  assert.equal(agent.mode, "hybrid");
  assert.equal(agent.dqnModel, undefined);
});

test("missing scaler falls back to deterministic rules", async () => {
  const { agent } = makeAgent({ scalerValue: null });
  const result = await agent.updateAndPredict();
  assert.equal(result.mode, "bootstrap");
  assert.equal(result.proficiency, null);
  assert.equal(agent.lastAction, DDA_ACTIONS.NORMAL);
});

test("async inference failure disposes tensors and applies an actual fallback action", async () => {
  const { agent } = makeAgent({ modelOverrides: { lstm: { predict() {
    const tensor = tf.tensor2d([[0.2]]);
    tensor.data = async () => { throw new Error("backend read failed"); };
    return tensor;
  } } } });
  await agent.init();
  const before = tf.memory().numTensors;
  dda.applyAction(DDA_ACTIONS.CHALLENGE);
  const result = await agent.updateAndPredict(1);
  assert.equal(result.mode, "bootstrap");
  assert.equal(dda.currentAction, result.action);
  assert.equal(dda.currentAction, DDA_ACTIONS.NORMAL);
  assert.equal(tf.memory().numTensors, before);
});

test("concurrent prediction requests coalesce and session end cancels in-flight decisions", async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const { agent } = makeAgent({ modelOverrides: { lstm: { predict() {
    const tensor = tf.tensor2d([[0.2]]);
    tensor.data = async () => { await blocked; return new Float32Array([0.2]); };
    return tensor;
  } } } });
  await agent.init();
  const first = agent.updateAndPredict(1);
  const second = agent.updateAndPredict(1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(telemetry.getFeatureSnapshots().length, 1);
  agent.endSession();
  release();
  assert.equal(await first, null);
  assert.equal(await second, null);
  assert.equal(telemetry.ddaActionsLog.length, 0);
});

test("replay assigns completion to the pending action, marks terminal, and isolates sessions", () => {
  const { agent } = makeAgent();
  agent.mode = "hybrid";
  agent._recordExperience([0.4, 0.2, 0, 0.5], 1, 1);
  agent.addQuestCompletionReward();
  agent._recordExperience([0.4, 0.4, 0, 0.5], 0, 2);
  assert.equal(agent.replayBuffer[0].reward, 1);
  assert.equal(agent.replayBuffer[0].stage, 1);
  assert.equal(agent.replayBuffer[0].action, 1);
  agent.endSession();
  agent.endSession();
  assert.equal(agent.replayBuffer.length, 2);
  assert.equal(agent.replayBuffer[1].done, true);
  const oldSessionId = agent.sessionId;
  telemetry.resetSession();
  agent.resetSession();
  agent._recordExperience([0.5, 0.2, 0, 0.5], 0, 1);
  assert.equal(agent.replayBuffer.length, 2);
  assert.notEqual(agent.sessionId, oldSessionId);
  assert.equal(agent.getReplayBuffer({ sessionOnly: true }).length, 0);
});

test("invalid action IDs restore all crop defaults and expose Normal consistently", () => {
  dda.applyAction(DDA_ACTIONS.SCAFFOLD);
  dda.applyAction(-1);
  assert.equal(dda.currentAction, DDA_ACTIONS.NORMAL);
  for (const [key, base] of Object.entries(dda.baseCropStats)) {
    assert.equal(CROP_DATA[key].duration, base.duration);
    assert.equal(CROP_DATA[key].spoilage_time, base.spoilage_time);
  }
});

test("scaffolding rain can help an unripe farm and forceCheck returns actual event result", () => {
  const scheduler = new EventScheduler();
  mlAgent.mode = "hybrid";
  mlAgent.lastAction = DDA_ACTIONS.SCAFFOLD;
  assert.equal(scheduler.forceCheck().reason, "no_waterable_tiles");
  globalThis.__mlTestRainApplied = true;
  const result = scheduler.forceCheck();
  assert.equal(result.triggered, true);
  assert.equal(result.reason, "rain");
  assert.equal(scheduler.forceCheck().reason, "cooldown");
  assert.equal(scheduler.eventsTriggered, 1);
  assert.equal(telemetry.rawEvents.at(-1).event, "scheduled_event");
});

test("pest precondition is strictly greater than one third of the farm", () => {
  const scheduler = new EventScheduler();
  const rows = CONFIG.FARM.rows;
  const columns = CONFIG.FARM.columns;
  try {
    CONFIG.FARM.rows = 3;
    CONFIG.FARM.columns = 3;
    for (let i = 0; i < 3; i++) __mlTestFarm.set(i, { crop: { crop_state: CropStates.HARVESTABLE } });
    assert.equal(scheduler.checkPrecondition(), false);
    __mlTestFarm.set(3, { crop: { crop_state: CropStates.HARVESTABLE } });
    assert.equal(scheduler.checkPrecondition(), true);
  } finally {
    CONFIG.FARM.rows = rows;
    CONFIG.FARM.columns = columns;
  }
});

test("current-session export survives corrupt or inaccessible storage and discloses partial archive", () => {
  const logger = new DataLogger();
  localStorage.setItem("algobot_sessions", "{broken");
  const recovered = logger.buildDatasetExport();
  assert.equal(recovered.session_count, 1);
  assert.equal(recovered.data_quality.stored_sessions_fully_readable, false);
  assert.equal(recovered.unparsed_stored_sessions_backup, "{broken");
  assert.equal(localStorage.getItem("algobot_sessions"), "{broken");
  globalThis.localStorage.getItem = () => { throw new Error("Access denied"); };
  const restricted = logger.buildDatasetExport();
  assert.equal(restricted.session_count, 1);
  assert.match(restricted.data_quality.storage_read_errors[0], /Access denied/);
});

test("untracked quest completion cannot fabricate a perfect proficiency label", () => {
  const tracker = new TelemetryTracker();
  tracker.recordQuestComplete("missed-start");
  assert.equal(tracker.questAttempts["missed-start"].startTimeInferred, true);
  assert.equal(tracker.questAttempts["missed-start"].proficiencyLabel, null);
});

test("unavailable model artifacts still initialize a functioning deterministic controller", async () => {
  const agent = new MLDiffAgent({
    loadModel: async () => { throw new Error("404 unavailable"); },
    loadScaler: async () => scaler,
    loadPolicyMetadata: async () => { throw new Error("metadata unavailable"); },
  });
  for(let i=0;i<7;i++) telemetry.recordError("test");
  for(let i=0;i<4;i++) telemetry.recordCodeReset();
  const result = await agent.updateAndPredict();
  assert.equal(agent.isInitialized, true);
  assert.equal(result.mode, "bootstrap");
  assert.equal(result.action, DDA_ACTIONS.SCAFFOLD);
  assert.match(agent.fallbackReason, /404 unavailable/);
});

test("policy metadata is no longer fetched", async () => {
  const { agent } = makeAgent();
  agent._loadPolicyMetadata = async () => { throw new Error("metadata missing"); };
  const result = await agent.updateAndPredict();
  assert.equal(result.mode, "hybrid");
  assert.equal(agent.dqnModel, undefined);
  assert.equal(agent.fallbackReason, null);
});

test("scheduled events respect the gameplay pause predicate while explicit developer force remains available", () => {
  const scheduler = new EventScheduler();
  mlAgent.mode = "hybrid";
  mlAgent.lastAction = DDA_ACTIONS.SCAFFOLD;
  globalThis.__mlTestRainApplied = true;
  scheduler.start({ shouldRun: () => false });
  try {
    assert.equal(scheduler._check().reason, "gameplay_paused");
    assert.equal(scheduler.eventsTriggered, 0);
    assert.equal(scheduler.forceCheck().triggered, true);
  } finally {
    scheduler.stop();
  }
});

test("a failed save survives telemetry reset and is exported and retried with the next session", () => {
  const logger = new DataLogger();
  const realSetItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("Storage quota exceeded"); };
  telemetry.setParticipantId("student-a");
  telemetry.recordError("retain this raw event");
  const sessionA = telemetry.getSessionId();
  assert.equal(logger.saveSessionLight(), false);
  telemetry.resetSession();
  mlAgent.resetSession();
  telemetry.setParticipantId("student-b");
  const dataset = logger.buildDatasetExport();
  assert.equal(dataset.session_count, 2);
  const prior = dataset.sessions.find(session => session.session_id === sessionA);
  assert.equal(prior.student_id, "student-a");
  assert.equal(prior.raw_events[0].message, "retain this raw event");
  assert.equal(dataset.data_quality.pending_unpersisted_session_count, 1);
  assert.equal(logger.getSessionCount(), 1);
  localStorage.setItem = realSetItem;
  assert.equal(logger.saveSessionLight(), true);
  assert.equal(logger.pendingSessions.size, 0);
  assert.equal(JSON.parse(localStorage.getItem("algobot_sessions")).length, 2);
  assert.equal(logger.buildDatasetExport().session_count, 2);
});

test("pending sessions are retained alongside corrupt storage recovery without overwriting original bytes", () => {
  const logger = new DataLogger();
  localStorage.setItem("algobot_sessions", "{broken");
  const sessionA = telemetry.getSessionId();
  assert.equal(logger.saveSessionLight(), false);
  telemetry.resetSession();
  mlAgent.resetSession();
  const exportData = logger.buildDatasetExport();
  assert.equal(exportData.session_count, 2);
  assert.ok(exportData.sessions.some(session => session.session_id === sessionA));
  assert.equal(exportData.unparsed_stored_sessions_backup, "{broken");
  assert.equal(localStorage.getItem("algobot_sessions"), "{broken");
});

test("rule window forgets old mistakes without changing LSTM features", () => {
  const events = [...Array.from({length:7},()=>({t:0,event:'error'})),...Array.from({length:4},()=>({t:0,event:'code_reset'}))];
  assert.ok(recentPolicyState(events,1000).frustrationScore>.5);
  assert.equal(recentPolicyState(events,181000).frustrationScore,0);
});

test("difficulty recovers after confirmed improvement and does not immediately escalate", () => {
  const policy=new StableDifficultyPolicy();
  const struggling={errorCount:7,resetCount:4,frustrationScore:.6,flowScore:.2,successfulRuns:0};
  const recovered={errorCount:0,resetCount:0,frustrationScore:0,flowScore:.5,successfulRuns:1};
  assert.equal(policy.decide(struggling,1,.5,0),DDA_ACTIONS.SCAFFOLD);
  assert.equal(policy.decide(recovered,1,.5,10000),DDA_ACTIONS.SCAFFOLD);
  assert.equal(policy.decide(recovered,1,.5,61000),DDA_ACTIONS.NORMAL);
  const strong={...recovered,flowScore:1,successfulRuns:3};
  assert.equal(policy.decide(strong,1,.9,70000),DDA_ACTIONS.NORMAL);
  assert.equal(policy.decide(strong,1,.9,122000),DDA_ACTIONS.CHALLENGE);
});

test("agent fetches only LSTM and scaler, with no DQN or policy metadata",async()=>{
  const paths=[];
  const agent=new MLDiffAgent({loadModel:async p=>{paths.push(p);return fakeModel([20,10],1,[.8]);},loadScaler:async()=>scaler,
    loadPolicyMetadata:async()=>{throw Error('Must not fetch legacy metadata');}});
  await agent.init();
  assert.deepEqual(paths,['/models/lstm/model.json']);
  assert.equal(agent.mode,'hybrid');
  assert.equal(agent.fallbackReason,null);
});
