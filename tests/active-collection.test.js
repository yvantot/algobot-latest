import test from "node:test";
import assert from "node:assert/strict";
import { TelemetryTracker } from "../src/game/ml/telemetry.js";
import { activeGameplayWindow, recentSequence, COLLECTION_SCHEMA, COLLECTION_FEATURES, ACTIVE_WINDOW_MS } from "../src/game/ml/research-features.js";
import { assessmentSamples } from "../src/game/ml/challenge-quality.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { challengeWaitMessage } from "../src/game/challenges/records.js";

const start = Date.parse("2026-09-26T00:00:00Z");
const snapshot = (i, segment = 1, speed = 1) => ({ timestamp_ms:start+i*5000, gameplay_segment:segment,
  stage:1, vector:Array(10).fill(0), context:{phase:"gameplay",game_speed:speed,robot_count:1},
  counters:{errors:0,edits:i,completed_runs:0,failed_runs:0,stopped_runs:0,requested_hints:0,
    harvested:0,spoiled:0,for_loops:0,while_loops:0,conditions:0} });

test("speed and short interruptions preserve observations without bridging counter deltas", () => {
  const snapshots = Array.from({length:11}, (_,i)=>snapshot(i,1,2));
  snapshots.push(...Array.from({length:11}, (_,i)=>snapshot(i+30,3,.3)));
  snapshots[11].counters.errors = 10;
  for (const s of snapshots.slice(12)) s.counters.errors = 10;
  const window = activeGameplayWindow(snapshots,start+200001);
  assert.equal(window.ready,true);
  assert.equal(window.x.length,20);
  assert.ok(window.x.every(row=>row.length===14 && row[0]===0 && row[1]===12));
  assert.deepEqual(window.x.map(row=>row[12]),[...Array(10).fill(2),...Array(10).fill(.3)]);
  assert.ok(window.x[9][13]-window.x[10][13]>90);
  assert.throws(()=>recentSequence(snapshots.slice(-21)),/contiguous/);
  assert.equal(activeGameplayWindow(snapshots,start+200000).ready,false);
  assert.equal(activeGameplayWindow(snapshots,start+200001+ACTIVE_WINDOW_MS).ready,false);
  assert.match(challengeWaitMessage({collectionSnapshots:snapshots.slice(0,11)},start+200001),/50 more seconds/);
});

test("a prompt between sampler ticks invalidates its interval and cannot contaminate legacy inference",()=>{
  const tracker = new TelemetryTracker();
  const context = {phase:"gameplay",game_speed:1,robot_count:1};
  tracker.setCollectionContext(context);
  const first = snapshot(0,tracker.gameplaySegment);
  tracker.setCollectionContext({...context,phase:"modal"});
  tracker.setCollectionContext(context);
  const second = snapshot(1,tracker.gameplaySegment);
  assert.equal(activeGameplayWindow([first,second],start+5001).count,0);
  const snapshots=Array.from({length:21},(_,i)=>snapshot(i,tracker.gameplaySegment));
  snapshots[0]=first;
  assert.throws(()=>recentSequence(snapshots),/contiguous/);
  tracker.setCollectionContext({...context,editor:"text"});
  assert.equal(tracker.gameplaySegment,second.gameplay_segment);
  tracker.setCollectionContext({...context,game_speed:4});
  assert.notEqual(tracker.gameplaySegment,second.gameplay_segment);
});

test("new assessment preparation matches gameplay features and excludes task-time activity",()=>{
  const observations=Array.from({length:21},(_,i)=>snapshot(i,1,4));
  const cutoff=start+101000;
  const a={assessment_id:"fixture-a",session_id:"fixture-s",student_id:"fixture-p",purpose:"model_target",status:"scored",
    assistance:"none",rubric_version:"fixture",task_id:"fixture-task",assessor_id:"fixture",score:0,max_score:3,
    started_at:new Date(cutoff).toISOString(),finished_at:new Date(cutoff+10000).toISOString()};
  const session={session_id:a.session_id,student_id:a.student_id,source_type:"recorded",feature_names:FEATURE_NAMES,
    collection:{independent_of_inference:true},feature_timeseries:[...observations,{...snapshot(22),context:{phase:"challenge"}}]};
  const result=assessmentSamples([session],[a],{schema:COLLECTION_SCHEMA});
  assert.equal(result.samples.length,1,JSON.stringify(result.excluded));
  assert.equal(result.samples[0].y,0);
  assert.deepEqual(result.samples[0].x,activeGameplayWindow(observations,cutoff).x);
  assert.deepEqual(result.feature_names,COLLECTION_FEATURES);
  for(const s of observations) delete s.gameplay_segment;
  assert.equal(assessmentSamples([session],[a],{schema:COLLECTION_SCHEMA}).samples.length,0);
});
