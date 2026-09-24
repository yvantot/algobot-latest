import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CHALLENGES, recordExposure } from "../src/game/challenges/catalog.js";
import { evaluateChallenge } from "../src/game/challenges/engine.js";
import { openChallenge, submitChallenge, closeChallenge, claimChallengeReward } from "../src/game/challenges/records.js";
import { challengeSamples } from "../scripts/collection-dataset.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { TelemetryTracker } from "../src/game/ml/telemetry.js";

const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(new URL("../public/js-interpreter.js", import.meta.url), "utf8"), context);
const solve = "for(var i=0;i<columns();i++){if(bot.is_harvestable()){bot.harvest();}if(i<columns()-1){bot.right();}}";
const evaluate = (source, task=CHALLENGES[0], options={}) => evaluateChallenge(source, task, context.Interpreter, {yieldControl: async()=>{}, ...options});

test("one real program passes every layout and variable-length row", async () => {
  for (const task of CHALLENGES) {
    const result = await evaluate(solve, task);
    assert.equal(result.score, 9); assert.equal(result.passed, true);
    assert.equal(result.results.length, 3);
    for (const row of result.results) assert.ok(row.trace.length > 5);
  }
});
test("blind harvesting, missing last tile, and fixed-length solutions fail", async () => {
  assert.equal((await evaluate("for(var i=0;i<4;i++){bot.harvest();bot.right();}")).passed, false);
  assert.equal((await evaluate("if(bot.is_harvestable())bot.harvest();")).passed, false);
  assert.equal((await evaluate(solve.replaceAll("columns()", "4"), CHALLENGES[1])).passed, false);
});
test("bounded interpreter handles infinite loops, excess actions, bad syntax and host access", async () => {
  for (const code of ["while(true){}", "while(true){bot.right();}", "if(", "window.localStorage.clear()", "Math.random()", "new Date()"]) {
    const result = await evaluate(code);
    assert.equal(result.passed, false, code);
    assert.ok(result.results.every(row => row.error), code);
  }
});
test("evaluation cancels without recording a fabricated score", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(evaluate(solve, CHALLENGES[0], {signal: controller.signal}), {name:"AbortError"});
});
test("first exposure survives session changes and is participant-specific", () => {
  const data = new Map(), storage = {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  assert.equal(recordExposure(storage, "p1", "t1"), true);
  assert.equal(recordExposure(storage, "p1", "t1"), false);
  assert.equal(recordExposure(storage, "p2", "t1"), true);
});
test("retry feedback cannot replace the first score; rewards only once per farm", async () => {
  const tracker = new TelemetryTracker();
  const attempt = openChallenge(tracker, CHALLENGES[0], true);
  const bad = await evaluate("bot.right();"), good = await evaluate(solve);
  submitChallenge(tracker, attempt, bad, "bot.right();", "text", true);
  submitChallenge(tracker, attempt, good, solve, "blocks", true);
  assert.equal(attempt.score, bad.score);
  assert.equal(attempt.purpose, "model_target");
  let rewards = 0;
  assert.equal(claimChallengeReward(tracker, attempt, () => rewards++), true);
  assert.equal(claimChallengeReward(tracker, attempt, () => rewards++), false);
  const repeat = openChallenge(tracker, CHALLENGES[0], false);
  submitChallenge(tracker, repeat, good, solve, "text", true);
  assert.equal(claimChallengeReward(tracker, repeat, () => rewards++), false);
  assert.equal(rewards, 1);
  const abandoned = openChallenge(tracker, CHALLENGES[1], true);
  closeChallenge(tracker, abandoned);
  assert.equal(abandoned.status, "abandoned"); assert.equal(abandoned.score, null);
});
test("returning to the start menu does not reset the farm's reward ledger", async () => {
  const tracker = new TelemetryTracker(), ledger = new Set();
  const passed = await evaluate(solve);
  for (let session=0;session<2;session++) {
    tracker.resetSession();
    const attempt=openChallenge(tracker,CHALLENGES[0],session===0);
    submitChallenge(tracker,attempt,passed,solve,"text",true);
    assert.equal(claimChallengeReward(tracker,attempt,()=>{},ledger),session===0);
  }
});
test("automatic task dataset uses only gameplay before opening; retries and assisted work excluded", async () => {
  const tracker = new TelemetryTracker(); tracker.participantId="p_test";
  const start = Date.parse("2026-09-24T00:00:00Z");
  tracker.collectionSnapshots = Array.from({length:21}, (_,i)=>({timestamp_ms:start+i*5000, vector:Array(10).fill(0.2), stage:2,
    context:{phase:"gameplay",game_speed:1,robot_count:1}, counters:{errors:0,edits:i,completed_runs:i,failed_runs:0,stopped_runs:0,requested_hints:0,harvested:i,spoiled:0,for_loops:0,while_loops:0,conditions:i}}));
  const attempt = openChallenge(tracker, CHALLENGES[0], true, start+102000);
  submitChallenge(tracker, attempt, await evaluate(solve), solve, "text", true, start+130000);
  const session = {session_id:tracker.sessionId,student_id:tracker.participantId,source_type:"recorded",collection:{independent_of_inference:true},feature_names:FEATURE_NAMES,
    feature_timeseries:[...tracker.collectionSnapshots, {timestamp_ms:start+110000,vector:Array(10).fill(999),context:{phase:"challenge"}}],challenge_attempts:tracker.challengeAttempts};
  const prepared = challengeSamples([session]);
  assert.equal(prepared.samples.length, 1, JSON.stringify(prepared.excluded));
  assert.equal(prepared.samples[0].input_end_ms,start+100000);
  assert.equal(prepared.samples[0].y,1);
  assert.equal(prepared.participation.participants_with_usable_first_score,1);
  attempt.first_exposure=false;
  assert.equal(challengeSamples([session]).samples.length,0);
  attempt.first_exposure=true; attempt.assistance="reported_or_unconfirmed";attempt.submissions[0].assistance=attempt.assistance;
  assert.equal(challengeSamples([session]).samples.length,0);
});

test("unreached and abandoned challenges are reported without made-up labels", () => {
  const session = {session_id:"s",student_id:"p",challenge_attempts:[],quest_attempts:[]};
  let report = challengeSamples([session]);
  assert.equal(report.participation.participants_without_submission,1);
  assert.equal(report.participation.participants_opened_task,0);
  session.challenge_attempts.push({assessment_id:"a",task_id:"ready-row-v1",first_exposure:true,status:"abandoned",started_at:"2026-09-24T00:00:00Z"});
  report = challengeSamples([session]);
  assert.equal(report.samples.length,0);
  assert.equal(report.participation.unfinished_attempts,1);
  assert.equal(report.excluded[0].reason,"unfinished_challenge_not_a_zero_score");
  const withDebug=challengeSamples([session,{...session,student_id:"qa",session_id:"debug",source_type:"developer_test"}]);
  assert.equal(withDebug.participation.developer_sessions_excluded,1);
  assert.equal(withDebug.participation.participants_in_exports,1);
});
