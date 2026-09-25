import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {  recordExposure, challengeMaxScore } from "../src/game/challenges/catalog.js";
import { evaluateChallenge } from "../src/game/challenges/engine.js";
import { canStartChallenge, challengeAccess, openChallenge, submitChallenge, closeChallenge, claimChallengeReward, interruptChallenge } from "../src/game/challenges/records.js";
import { challengeSamples } from "../scripts/collection-dataset.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { TelemetryTracker } from "../src/game/ml/telemetry.js";

import { HISTORICAL_CHALLENGES as CHALLENGES } from "../src/game/challenges/archived-catalog.js";
const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(new URL("../public/js-interpreter.js", import.meta.url), "utf8"), context);
const solve = "for(var i=0;i<columns();i++){if(bot.is_harvestable()){bot.harvest();}if(i<columns()-1){bot.right();}}";
test('challenge access requires a fresh full gameplay window and normal-speed active play',()=>{
  const start=1700000000000;
  let phase='gameplay',speed=1;
  const snapshots=Array.from({length:21},(_,i)=>({timestamp_ms:start+i*5000,stage:1,
    context:{phase:'gameplay',game_speed:1,robot_count:1},
    counters:{errors:0,edits:i,completed_runs:0,failed_runs:0,stopped_runs:0,requested_hints:0,harvested:0,spoiled:0,for_loops:0,while_loops:0,conditions:0}}));
  const tracker={collectionSnapshots:snapshots.slice(0,20),getCollectionContext:()=>({phase,game_speed:speed})};
  const now=start+100001;
  assert.equal(canStartChallenge(tracker,now),false);
  tracker.collectionSnapshots=snapshots;
  assert.equal(canStartChallenge(tracker,now),true);
  assert.equal(canStartChallenge(tracker,start+100000),false);
  assert.equal(canStartChallenge(tracker,start+120000),false);
  for(phase of ['guided_practice','challenge','demonstration','modal','hidden','paused'])assert.equal(canStartChallenge(tracker,now),false,phase);
  phase='gameplay';speed=2;assert.equal(canStartChallenge(tracker,now),false);
  speed=1;snapshots[10].context.phase='guided_practice';assert.equal(canStartChallenge(tracker,now),false);
  snapshots[10].context.phase='gameplay';snapshots[10].timestamp_ms+=9000;assert.equal(canStartChallenge(tracker,now),false);
});
test('unlocked challenges stay visible through tab gaps and recover without consuming an attempt',()=>{
  const start=1700000000000;
  let phase='gameplay';
  const snapshot=i=>({timestamp_ms:start+i*5000,stage:1,
    context:{phase:'gameplay',game_speed:1,robot_count:1},
    counters:{errors:0,edits:i,completed_runs:0,failed_runs:0,stopped_runs:0,requested_hints:0,harvested:0,spoiled:0,for_loops:0,while_loops:0,conditions:0}});
  const tracker={collectionSnapshots:Array.from({length:20},(_,i)=>snapshot(i)),challengeAttempts:[],getCollectionContext:()=>({phase,game_speed:1})};
  let access=challengeAccess(tracker,false,true,start+95001);
  assert.deepEqual(access,{unlocked:false,ready:false});
  tracker.collectionSnapshots.push(snapshot(20));
  access=challengeAccess(tracker,access.unlocked,true,start+100001);
  assert.deepEqual(access,{unlocked:true,ready:true});
  phase='hidden';
  access=challengeAccess(tracker,access.unlocked,true,start+105001);
  assert.deepEqual(access,{unlocked:true,ready:false});
  phase='gameplay';
  for(let i=22;i<=41;i++) tracker.collectionSnapshots.push(snapshot(i));
  access=challengeAccess(tracker,access.unlocked,true,start+205001);
  assert.deepEqual(access,{unlocked:true,ready:false});
  tracker.collectionSnapshots.push(snapshot(42));
  access=challengeAccess(tracker,access.unlocked,true,start+210001);
  assert.deepEqual(access,{unlocked:true,ready:true});
  phase='modal';
  assert.deepEqual(challengeAccess(tracker,access.unlocked,true,start+210002),{unlocked:true,ready:false});
  assert.deepEqual(challengeAccess(tracker,access.unlocked,false,start+210002),{unlocked:false,ready:false});
  assert.equal(tracker.challengeAttempts.length,0);
});
function testWorld() {
  return {reset(layout) {
    const crops=layout.map(Boolean);
    return {grid_x:0,grid_y:0,is_available:true,
      botJump(x,y,done){const valid=x>=0&&x<crops.length&&y===0;if(valid)this.grid_x=x;queueMicrotask(()=>done(valid));},
      isHarvestable(done){queueMicrotask(()=>done(crops[this.grid_x]===true));},
      botHarvest(done){const ready=crops[this.grid_x]===true;if(ready)crops[this.grid_x]=null;queueMicrotask(()=>done(ready?'wheat':false));},
      sayText(){},
    };
  }};
}
const evaluate = (source, task=CHALLENGES[0], options={}) => evaluateChallenge(source, task, context.Interpreter, {world:testWorld(), yieldControl: async()=>{}, ...options});

test("one real program passes every layout and variable-length row", async () => {
  for (const task of CHALLENGES.filter(task=>!task.kind)) {
    const code=solve+(task.returnHome?"for(var x=1;x<columns();x++){bot.left();}":"");
    const result = await evaluate(code, task);
    assert.equal(result.score, challengeMaxScore(task)); assert.equal(result.passed, true);
    assert.equal(result.results.length, task.cases.length);
    for (const row of result.results) assert.ok(row.trace.length >= 4);
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
  submitChallenge(tracker, attempt, await evaluate(solve), solve, "text", null, start+130000);
  const session = {session_id:tracker.sessionId,student_id:tracker.participantId,source_type:"recorded",collection:{independent_of_inference:true},feature_names:FEATURE_NAMES,
    feature_timeseries:[...tracker.collectionSnapshots, {timestamp_ms:start+110000,vector:Array(10).fill(999),context:{phase:"challenge"}}],challenge_attempts:tracker.challengeAttempts};
  const prepared = challengeSamples([session]);
  assert.equal(prepared.samples.length, 1, JSON.stringify(prepared.excluded));
  assert.equal(prepared.samples[0].input_end_ms,start+100000);
  assert.equal(prepared.samples[0].y,1);
  assert.equal(prepared.participation.participants_with_usable_first_score,1);
  assert.equal(attempt.assistance,"standard_in_game");
  attempt.submissions[0].cases[0].checks.visited_every_tile = false;
  assert.equal(challengeSamples([session]).excluded[0].reason,"challenge_rubric_or_case_score_mismatch");
  attempt.submissions[0].cases[0].checks.visited_every_tile = true;
  attempt.max_score = 10;
  assert.equal(challengeSamples([session]).samples.length,0);
  attempt.max_score = 9;
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
  session.challenge_attempts.push({assessment_id:"a",task_id:"ready-row-v3",first_exposure:true,status:"abandoned",started_at:"2026-09-24T00:00:00Z"});
  report = challengeSamples([session]);
  assert.equal(report.samples.length,0);
  assert.equal(report.participation.unfinished_attempts,1);
  assert.equal(report.excluded[0].reason,"unfinished_challenge_not_a_zero_score");
  const withDebug=challengeSamples([session,{...session,student_id:"qa",session_id:"debug",source_type:"developer_test"}]);
  assert.equal(withDebug.participation.developer_sessions_excluded,1);
  assert.equal(withDebug.participation.participants_in_exports,1);
});

import { isolateScene } from '../src/game/challenges/scene-session.js';
test('isolated farm restores exact visibility, pause state, camera and speed only once',()=>{
  const objects=[{hidden:false,paused:false},{hidden:true,paused:true},{layer:'grass_bg',hidden:false,paused:false},{sceneryBackground:true,hidden:false,paused:false}].map(object=>({...object,exists:()=>true}));
  const before=objects.map(object=>({...object}));let camera={x:12,y:34},zoom={x:.7,y:.7};
  const engine={get:()=>objects,getCamPos:()=>camera,getCamScale:()=>zoom,setCamPos:value=>camera=value,setCamScale:value=>zoom=value,debug:{timeScale:2}};
  const restore=isolateScene(engine);
  assert.equal(objects[0].paused,true);assert.equal(objects[0].hidden,true);assert.equal(objects[2].hidden,false);assert.equal(objects[3].paused,false);
  camera={x:999,y:999};zoom={x:1,y:1};restore();
  assert.deepEqual(objects,before);assert.deepEqual(camera,{x:12,y:34});assert.deepEqual(zoom,{x:.7,y:.7});assert.equal(engine.debug.timeScale,2);
  engine.debug.timeScale=3;restore();assert.equal(engine.debug.timeScale,3);
});

test('runaway movement and tight loops stop within a small execution budget',async()=>{
 let actions=0,yields=0;
 const result=await evaluate('while(true){bot.right();bot.left();}',CHALLENGES[0],{onAction:()=>actions++,yieldControl:async()=>{yields++;}});
 assert.equal(result.passed,false);
 assert.ok(actions<=30,`${actions} actions before detection`);
 assert.ok(result.results.every(row=>row.error.includes('repeated')));
 yields=0;
 await evaluate('while(true){}',CHALLENGES[0],{yieldControl:async()=>{yields++;}});
 assert.ok(yields<=24,`${yields} render yields before detection`);
});

test('return-trip challenges explicitly require returning to the starting tile',async()=>{
 const task=CHALLENGES.find(task=>task.returnHome);
 const result=await evaluate(solve,task);
 assert.equal(result.passed,false);
 assert.ok(result.results.every(row=>row.checks.harvested_all_ready&&!row.checks.returned_home));
 assert.equal(result.max_score,12);
});

test('legacy stopped-first-run records keep their original practice-only interpretation',async()=>{
 const tracker=new TelemetryTracker(),attempt=openChallenge(tracker,CHALLENGES[0],true);
 attempt.assessor_id='algobot-live-cases-4.0';
 interruptChallenge(tracker,attempt,'while(true){}','text');
 submitChallenge(tracker,attempt,await evaluate(solve),solve,'text');
 assert.equal(attempt.score,null);assert.equal(attempt.status,'abandoned');assert.equal(attempt.purpose,'practice');
 assert.equal(attempt.submissions[0].status,'stopped');
 assert.equal(claimChallengeReward(tracker,attempt,()=>{}),true);
});

test('Stop & Edit preserves the attempt and freezes the first evaluated score even when it fails',async()=>{
 const tracker=new TelemetryTracker(),attempt=openChallenge(tracker,CHALLENGES[0],true);
 const started=attempt.started_at;
 interruptChallenge(tracker,attempt,'while(true){}','text');
 interruptChallenge(tracker,attempt,'bot.right();','blocks');
 assert.equal(attempt.status,'in_progress');assert.equal(attempt.score,null);
 const failed=await evaluate('bot.left();');
 submitChallenge(tracker,attempt,failed,'bot.left();','text');
 assert.equal(attempt.purpose,'model_target');assert.equal(attempt.status,'scored');
 assert.equal(attempt.score,failed.score);assert.equal(attempt.started_at,started);
 const finished=attempt.finished_at;
 submitChallenge(tracker,attempt,await evaluate(solve),solve,'text');
 assert.equal(attempt.score,failed.score);assert.equal(attempt.finished_at,finished);
 assert.equal(attempt.submissions.filter(s=>s.status==='stopped').length,2);
 const unfinished=openChallenge(tracker,CHALLENGES[1],true);
 interruptChallenge(tracker,unfinished,'bot.right();','text');closeChallenge(tracker,unfinished);
 assert.equal(unfinished.status,'abandoned');assert.equal(unfinished.score,null);
});
