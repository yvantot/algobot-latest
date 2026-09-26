import test from "node:test";
import assert from "node:assert/strict";
import { STUDY_PROTOCOL, studyProtocolFor, studySpeedAllowed, studyTaskGate, studyWindowStart } from "../src/game/ml/study-protocol.js";
import { CHALLENGES, challengeRules, challengeMaxScore } from "../src/game/challenges/catalog.js";
import { openChallenge, submitChallenge, closeChallenge, canStartChallenge, challengeWaitMessage } from "../src/game/challenges/records.js";
import { challengeSamples } from "../src/game/ml/challenge-quality.js";
import { downloadReadiness } from "../src/game/ml/download-readiness.js";
import { inspectCollection } from "../src/game/ml/collection-quality.js";
import { validateDataset } from "../scripts/training-core.js";
import { auditCollection } from "../scripts/collection-dataset.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { COLLECTION_SCHEMA } from "../src/game/ml/research-features.js";
import { registerHooks } from "node:module";

// Agent modules reach the rendering engine; stub it as the ML runtime tests do.
const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/src/lib/kaplay.js")) return { format: "module", source: "export const k = {};", shortCircuit: true };
    if (url.endsWith("/src/game/game.js")) return { format: "module", source: "export const farm_grid_index = new Map();", shortCircuit: true };
    if (url.endsWith("/src/game/event.js")) return { format: "module", shortCircuit: true,
      source: "export const spawnBugEvent=()=>({});export const spawnRainEvent=()=>({});export const spawnFireEvent=()=>({});export const canStartFireEvent=()=>false;" };
    return nextLoad(url, context);
  },
});
const { MLDiffAgent } = await import("../src/game/ml/agent.js");
const { DDA_ACTIONS, dda } = await import("../src/game/ml/dda.js");
const { telemetry } = await import("../src/game/ml/telemetry.js");
hook.deregister();

const start = Date.parse("2026-09-26T00:00:00Z");
const task = id => CHALLENGES.find(t => t.id === id);
const snapshot = (i, segment = 1) => ({ timestamp_ms: start + i * 5000, gameplay_segment: segment, stage: 1,
  vector: Array(10).fill(0), context: { phase: "gameplay", game_speed: 1, robot_count: 1 },
  counters: { errors: 0, edits: i, completed_runs: 0, failed_runs: 0, stopped_runs: 0, requested_hints: 0,
    harvested: 0, spoiled: 0, for_loops: 0, while_loops: 0, conditions: 0 } });

function tracker(protocol = STUDY_PROTOCOL, student = "R2-P001") {
  return { participantId: student, sessionId: `session-${student}`, challengeAttempts: [], collectionSnapshots: [],
    studyProtocol: protocol, getCollectionContext: () => ({ phase: "gameplay", game_speed: 1 }), _logRawEvent() {} };
}

function score(t, taskId, points, at) {
  const def = task(taskId);
  const attempt = openChallenge(t, def, true, at);
  const perCase = challengeRules(def).map((rule, i) => [rule.key, i < points]);
  submitChallenge(t, attempt, { score: points * def.cases.length, max_score: challengeMaxScore(def), passed: points === 3,
    results: def.cases.map(() => ({ checks: Object.fromEntries(perCase) })) }, "fixture program", "text", null, at + 2000);
  closeChallenge(t, attempt);
  attempt.finished_at = new Date(at + 2000).toISOString();
  return attempt;
}

function session(t, protocol = STUDY_PROTOCOL) {
  return { session_id: t.sessionId, student_id: t.participantId, source_type: "recorded", feature_names: FEATURE_NAMES,
    research_features: { schema: COLLECTION_SCHEMA }, build: { version: "1.3.9", dirty: false },
    collection: { independent_of_inference: true, participant_id_source: "researcher_assigned_code",
      study_protocol: protocol ? structuredClone(protocol) : null },
    feature_timeseries: t.collectionSnapshots, challenge_attempts: t.challengeAttempts, raw_events: [{}] };
}

test("study conditions apply only to researcher-assigned codes and fix speed at 100%", () => {
  assert.equal(studyProtocolFor("researcher_assigned_code"), STUDY_PROTOCOL);
  assert.equal(studyProtocolFor("browser_local_pseudonym"), null);
  assert.deepEqual([0, .3, .7, 1, 2, 4].map(speed => studySpeedAllowed(STUDY_PROTOCOL, speed)), [true, false, false, true, false, false]);
  assert.ok([.3, .7, 1, 2, 4].every(speed => studySpeedAllowed(null, speed)));
});

test("study task order: first harvest, then careful steps, then optional practice", () => {
  assert.equal(studyTaskGate(STUDY_PROTOCOL, "careful-steps-v1", []).allowed, false);
  assert.match(studyTaskGate(STUDY_PROTOCOL, "careful-steps-v1", []).reason, /Your first harvest/);
  assert.equal(studyTaskGate(STUDY_PROTOCOL, "return-home-v1", ["first-harvest-v1"]).allowed, false);
  assert.equal(studyTaskGate(STUDY_PROTOCOL, "first-harvest-v1", []).allowed, true);
  assert.equal(studyTaskGate(STUDY_PROTOCOL, "careful-steps-v1", ["first-harvest-v1"]).allowed, true);
  assert.equal(studyTaskGate(STUDY_PROTOCOL, "return-home-v1", ["first-harvest-v1", "careful-steps-v1"]).allowed, true);
  assert.equal(studyTaskGate(null, "return-home-v1", []).allowed, true);
});

test("the second study task needs twenty fresh intervals after the first challenge", () => {
  const t = tracker();
  t.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i)));
  assert.equal(canStartChallenge(t, start + 101000), true);
  score(t, "first-harvest-v1", 2, start + 101000);
  // Earlier gameplay no longer fills the window for the next task.
  assert.equal(canStartChallenge(t, start + 110000), false);
  assert.match(challengeWaitMessage(t, start + 110000), /100% speed/);
  t.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i + 30, 2)));
  const next = start + 30 * 5000 + 101000;
  assert.equal(canStartChallenge(t, next), true);
  assert.match(challengeWaitMessage(t, next), /Two careful steps/);
  // Ordinary play keeps the original shared window.
  const free = tracker(null);
  free.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i)));
  score(free, "first-harvest-v1", 2, start + 101000);
  assert.equal(canStartChallenge(free, start + 110000), true);
});

test("preparation uses the fresh window, records the protocol and rejects out-of-order or pooled data", () => {
  const t = tracker();
  t.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i)));
  score(t, "first-harvest-v1", 1, start + 101000);
  t.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i + 30, 2)));
  const secondAt = start + 30 * 5000 + 101000;
  score(t, "careful-steps-v1", 2, secondAt);
  const s = session(t);
  const first = challengeSamples([s], "first-harvest-v1"), second = challengeSamples([s], "careful-steps-v1");
  assert.equal(first.samples.length, 1, JSON.stringify(first.excluded));
  assert.equal(second.samples.length, 1, JSON.stringify(second.excluded));
  assert.equal(second.samples[0].collection_protocol, STUDY_PROTOCOL.id);
  assert.ok(second.samples[0].input_start_ms > Date.parse(t.challengeAttempts[0].finished_at));
  assert.equal(second.samples[0].y, 2 / 3);

  // Without fresh gameplay, the second task has no usable input window.
  const stale = tracker(STUDY_PROTOCOL, "R2-P002");
  stale.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i)));
  score(stale, "first-harvest-v1", 1, start + 101000);
  score(stale, "careful-steps-v1", 1, start + 110000);
  assert.equal(challengeSamples([session(stale)], "careful-steps-v1").samples.length, 0);

  // A careful-steps attempt before first harvest is excluded under the protocol.
  const reversed = tracker(STUDY_PROTOCOL, "R2-P003");
  reversed.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i)));
  score(reversed, "careful-steps-v1", 3, start + 101000);
  const report = challengeSamples([session(reversed)], "careful-steps-v1");
  assert.equal(report.samples.length, 0);
  assert.deepEqual(report.excluded.map(e => e.reason), ["study_task_order_not_followed"]);

  // Fixed-condition and earlier free-condition samples cannot share one experiment.
  const legacy = { ...first.samples[0], assessment_id: "legacy", session_id: "legacy-session", student_id: "legacy-player",
    input_start_ms: first.samples[0].input_start_ms - 1, collection_protocol: undefined };
  assert.throws(() => validateDataset({ ...first, samples: [first.samples[0], legacy] }), /collection protocol/);
  assert.doesNotThrow(() => validateDataset(first));
});

test("fixed Normal difficulty ignores the model's proposed action but logs it", () => {
  const agent = new MLDiffAgent({ loadModel: async () => { throw Error("unused"); }, loadScaler: async () => { throw Error("unused"); } });
  agent.setFixedDifficulty(DDA_ACTIONS.NORMAL);
  const before = telemetry.ddaActionsLog.length;
  agent._applyDecision([0.9, 0.2, 0, 1], DDA_ACTIONS.CHALLENGE, 1);
  assert.equal(agent.lastAction, DDA_ACTIONS.NORMAL);
  assert.equal(dda.currentAction, DDA_ACTIONS.NORMAL);
  const logged = telemetry.ddaActionsLog.at(-1);
  assert.equal(telemetry.ddaActionsLog.length, before + 1);
  assert.equal(logged.actionId, DDA_ACTIONS.NORMAL);
  assert.equal(logged.proposedAction, DDA_ACTIONS.CHALLENGE);
  assert.equal(logged.fixedDifficulty, true);
  assert.equal(agent.getAgentState().fixedDifficulty, true);
  agent.setFixedDifficulty(null);
  agent._applyDecision([0.9, 0.2, 0, 1], DDA_ACTIONS.SCAFFOLD, 1);
  assert.equal(dda.currentAction, DDA_ACTIONS.SCAFFOLD);
  assert.throws(() => agent.setFixedDifficulty(99));
  dda.applyAction(DDA_ACTIONS.NORMAL);
});

test("finish prompt points to the second study task; audit flags missing study conditions", () => {
  const t = tracker();
  t.collectionSnapshots.push(...Array.from({ length: 21 }, (_, i) => snapshot(i)));
  score(t, "first-harvest-v1", 0, start + 101000);
  const status = downloadReadiness(session(t));
  assert.equal(status.ready, true);
  assert.equal(status.next_task, "careful-steps-v1");
  assert.match(status.message, /Two careful steps/);
  assert.equal(downloadReadiness(session(t, null)).next_task, undefined);

  const free = session(t, null);
  free.collection.participant_id_source = "browser_local_pseudonym";
  free.build = { version: "1.3.9", dirty: true };
  const issues = inspectCollection(free).issues;
  for (const issue of ["no_assigned_participant_code", "no_fixed_study_protocol", "uncommitted_build_changes"]) assert.ok(issues.includes(issue), issue);
  assert.ok(!inspectCollection(session(t)).issues.some(i => ["no_assigned_participant_code", "no_fixed_study_protocol", "uncommitted_build_changes"].includes(i)));
  const other = tracker(null, "free-player");
  const audit = auditCollection([session(t), session(other, null)]);
  assert.deepEqual(audit.collection_protocols.map(p => [p.protocol_id, p.sessions]).sort(), [["fixed-conditions-v1", 1], ["none", 1]]);
});

test("study window start ignores attempts at or after the cutoff", () => {
  const attempts = [{ started_at: new Date(start).toISOString(), finished_at: new Date(start + 5000).toISOString() },
    { started_at: new Date(start + 9000).toISOString(), finished_at: null }];
  assert.equal(studyWindowStart(STUDY_PROTOCOL, attempts, start + 9000), start + 5000);
  assert.equal(studyWindowStart(STUDY_PROTOCOL, attempts, start + 20000), start + 9000);
  assert.equal(studyWindowStart(null, attempts, start + 20000), -Infinity);
});
