import test from "node:test";
import assert from "node:assert/strict";
import { downloadReadiness } from "../src/game/ml/download-readiness.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { CHALLENGES, challengeRules, challengeMaxScore } from "../src/game/challenges/catalog.js";
import { openChallenge, submitChallenge } from "../src/game/challenges/records.js";

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
