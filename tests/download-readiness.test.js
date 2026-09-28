import test from "node:test";
import assert from "node:assert/strict";
import { downloadReadiness } from "../src/game/ml/download-readiness.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { CHALLENGES, challengeRules, challengeMaxScore } from "../src/game/challenges/catalog.js";
import { openChallenge, submitChallenge } from "../src/game/challenges/records.js";
import { COLLECTION_SCHEMA } from "../src/game/ml/research-features.js";

function scoredSession(score = 0, taskId = "first-harvest-v1") {
  const now = Date.now(), task = CHALLENGES.find(t => t.id === taskId);
  const tracker = { participantId:"fixture-player", sessionId:"fixture-session", challengeAttempts:[], _logRawEvent() {} };
  tracker.collectionSnapshots = Array.from({length:21}, (_,i) => ({timestamp_ms:now-105000+i*5000,stage:1,
    context:{phase:"gameplay",game_speed:1,robot_count:1},vector:Array(10).fill(0),
    counters:{errors:0,edits:i,completed_runs:0,failed_runs:0,stopped_runs:0,requested_hints:0,harvested:0,spoiled:0,for_loops:0,while_loops:0,conditions:0}}));
  const attempt = openChallenge(tracker, task, true, now);
  submitChallenge(tracker,attempt,{score,max_score:challengeMaxScore(task),passed:score===3,
    results:task.cases.map(() => ({checks:Object.fromEntries(challengeRules(task).map((r,i) => [r.key,i<score]))}))},"fixture code","text",null,now+1000);
  return {student_id:tracker.participantId,session_id:tracker.sessionId,source_type:"recorded",feature_names:FEATURE_NAMES,
    collection:{independent_of_inference:true},feature_timeseries:tracker.collectionSnapshots,challenge_attempts:tracker.challengeAttempts};
}

test("download eligibility accepts a valid first score including zero without changing records", () => {
  for (const score of [0,1,3]) {
    const session = scoredSession(score), before = structuredClone(session);
    assert.equal(downloadReadiness(session).ready,true);
    assert.deepEqual(session,before);
  }
});

test("a usable score on another challenge does not replace Your first harvest", () => {
  const other = scoredSession(0, "careful-steps-v1");
  const status = downloadReadiness(other);
  assert.equal(status.ready,false);
  assert.match(status.message,/Your first harvest/);
});

test("download prompt rejects cleared, developer, unscored, repeated and incomplete-window records", () => {
  assert.equal(downloadReadiness(scoredSession(),{cleared:true}).ready,false);
  for (const mutate of [s=>s.source_type="developer_test",s=>s.challenge_attempts=[],
    s=>s.challenge_attempts[0].status="in_progress",s=>s.challenge_attempts[0].first_exposure=false,
    s=>s.feature_timeseries=s.feature_timeseries.slice(5)]) {
    const session=scoredSession(); mutate(session);
    assert.equal(downloadReadiness(session).ready,false);
  }
});

test("saved scores survive reload but another participant's score cannot unlock a download", () => {
  const saved = scoredSession(), current = {...saved,session_id:"new-session",challenge_attempts:[],feature_timeseries:[]};
  assert.equal(downloadReadiness(current,{sessions:[saved,current]}).ready,true);
  assert.equal(downloadReadiness({...current,student_id:"different-player"},{sessions:[saved,current]}).ready,false);
});

test("speed-aware first-harvest scores unlock downloads and older saved scores survive a schema update",()=>{
  const session=scoredSession(0);
  session.research_features={schema:COLLECTION_SCHEMA};
  for(const s of session.feature_timeseries){s.gameplay_segment=1;s.context.game_speed=2;}
  assert.equal(downloadReadiness(session).ready,true);
  const saved=scoredSession(0),current={...session,session_id:"new-schema-session",challenge_attempts:[]};
  assert.equal(downloadReadiness(current,{sessions:[saved,current]}).ready,true);
});

test("a scored retry after an abandoned first opening can be downloaded for review without relabeling", () => {
  const session = scoredSession();
  const scored = session.challenge_attempts[0];
  session.challenge_attempts.unshift({...structuredClone(scored),assessment_id:"abandoned-first",
    started_at:new Date(Date.parse(scored.started_at)-1000).toISOString(),status:"abandoned",score:null,submissions:[]});
  scored.first_exposure = false;
  const before = structuredClone(session), status = downloadReadiness(session);
  assert.equal(status.ready,false);
  assert.equal(status.canDownload,true);
  assert.ok(status.exclusion_reasons.includes("unfinished_challenge_not_a_zero_score"));
  assert.match(status.message,/first opening.*ended without a score/);
  assert.deepEqual(session,before);
});

test("practice scores and incomplete observation windows offer review downloads with an explanation", () => {
  const practice=scoredSession(); practice.challenge_attempts[0].first_exposure=false;
  assert.equal(downloadReadiness(practice).canDownload,true);
  assert.match(downloadReadiness(practice).message,/earlier opening/);
  const incomplete=scoredSession(); incomplete.feature_timeseries=incomplete.feature_timeseries.slice(5);
  assert.equal(downloadReadiness(incomplete).canDownload,true);
  assert.match(downloadReadiness(incomplete).message,/gameplay observations/);
});

test("recovery downloads preserve developer exclusions and unreadable storage, while cleared data stays blocked", () => {
  const session=scoredSession(); session.source_type="developer_test";
  const before=structuredClone(session);
  assert.equal(downloadReadiness(session).ready,false);
  assert.equal(downloadReadiness(session).canDownload,true);
  assert.deepEqual(session,before);
  const recovery=downloadReadiness(scoredSession(),{storageReadable:false});
  assert.equal(recovery.ready,false); assert.equal(recovery.canDownload,true);
  const cleared=downloadReadiness(session,{cleared:true,storageReadable:false});
  assert.equal(cleared.ready,false); assert.notEqual(cleared.canDownload,true);
});

test("unstarted and unscored first harvests do not gain a normal download", () => {
  for(const status of [null,"in_progress","abandoned"]) {
    const session=scoredSession();
    if(status) session.challenge_attempts[0].status=status;
    else session.challenge_attempts=[];
    const result=downloadReadiness(session);
    assert.equal(result.ready,false); assert.notEqual(result.canDownload,true);
  }
});

test("hours of subsequent gameplay do not expire a saved first-harvest score", () => {
  const session=scoredSession(), last=session.feature_timeseries.at(-1);
  session.feature_timeseries.push(...Array.from({length:2160},(_,i)=>({...structuredClone(last),
    timestamp_ms:last.timestamp_ms+(i+1)*5000})));
  assert.equal(downloadReadiness(session).ready,true);
});
