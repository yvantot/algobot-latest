import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TelemetryTracker } from "../src/game/ml/telemetry.js";
import { startCollection } from "../src/game/ml/collection.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { assessmentSamples, readCollection, auditCollection } from "../scripts/collection-dataset.js";
import { resolveParticipant, clearParticipant } from "../src/game/ml/participant.js";

test("assigned participant codes persist across sessions and can change between players", () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  assert.equal(resolveParticipant("?study_participant=P001", storage).id, "P001");
  assert.equal(resolveParticipant("", storage).id, "P001");
  assert.equal(resolveParticipant("?study_participant=P002", storage).id, "P002");
  assert.throws(() => resolveParticipant("?study_participant=", storage), /participant code/);
  assert.equal(values.get("algobot_participant_id"), "P002");
});

test("clearing participant identity removes saved and URL codes while preserving unrelated settings", () => {
  const values = new Map([["unrelated_preference", "keep"]]);
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  resolveParticipant("?study_participant=P001", storage);
  const browser = { location: { href: "http://localhost:5173/?study_participant=P001&view=farm#help" },
    history: { state: { retained: true }, replaceState(state, title, url) { assert.deepEqual(state, { retained: true }); browser.location.href = url; } } };
  clearParticipant(storage, browser);
  assert.equal(storage.getItem("algobot_participant_id"), undefined);
  assert.equal(storage.getItem("algobot_participant_id_source"), undefined);
  assert.equal(storage.getItem("unrelated_preference"), "keep");
  assert.equal(browser.location.href, "http://localhost:5173/?view=farm#help");
  const next = resolveParticipant(new URL(browser.location.href).search, storage, () => "p_new");
  assert.deepEqual(next, { id: "p_new", source: "browser_local_pseudonym" });
  assert.equal(resolveParticipant("", storage, () => "must_not_change").id, "p_new");
});

test("collection includes practice without inference, excludes demos and pauses, and stops its timer", () => {
  const tracker = new TelemetryTracker();
  let tick, phase = "guided_practice", cancelled;
  const stop = startCollection({ tracker, getContext: () => ({ phase }), schedule: fn => { tick = fn; return 7; }, cancel: id => cancelled = id });
  assert.equal(tracker.getFeatureSnapshots().length, 1);
  assert.equal(tracker.historyBuffer.length, 0);
  phase = "demonstration"; tick();
  phase = "hidden"; tick();
  assert.equal(tracker.getFeatureSnapshots().length, 1);
  phase = "gameplay";
  tracker.recordError("bad command");
  assert.equal(tracker.rawEvents.at(-1).context.phase, "gameplay");
  tick();
  assert.equal(tracker.getFeatureSnapshots().at(-1).counters.errors, 1);
  tracker.sampleHistory();
  tracker.sampleHistory();
  assert.equal(tracker.getFeatureSnapshots().length, 2);
  stop(); assert.equal(cancelled, 7);
});

const start = Date.parse("2026-09-24T01:00:00Z");
function fixture() {
  const session = { session_id: "session-1", student_id: "P01", source_type: "recorded",
    collection: { independent_of_inference: true }, feature_names: FEATURE_NAMES,
    raw_events: [{ event: "quest_start" }], quest_attempts: [{ completed: false, proficiency_label: null }],
    feature_timeseries: Array.from({ length: 21 }, (_, i) => ({ timestamp_ms: start + i * 5000,
      vector: Array(10).fill(i / 21), context: { phase: "gameplay", game_speed: 1 } })) };
  const assessment = { assessment_id: "A01", session_id: "session-1", student_id: "P01", purpose: "model_target",
    status: "scored", assistance: "none", rubric_version: "draft-v1", task_id: "task-A", assessor_id: "R01",
    score: 0, max_score: 10, started_at: new Date(start + 100000).toISOString(), finished_at: new Date(start + 200000).toISOString() };
  return { session, assessment };
}

test("assessment window excludes assessment-time data, preserves zero score, and never invents labels for unfinished quests", () => {
  const { session, assessment } = fixture();
  const result = assessmentSamples([session], [assessment]);
  assert.equal(result.samples.length, 1);
  assert.equal(result.samples[0].y, 0);
  assert.equal(result.samples[0].input_end_ms, start + 95000);
  assert.equal(result.samples[0].real_timesteps, 20);
  const audit = auditCollection([session]);
  assert.equal(audit.reports[0].unfinished_attempts, 1);
  assert.deepEqual(audit.proxy_category_support, [0, 0, 0]);
});

test("assessment import rejects assisted, mismatched, invalid, gapped, practice, and short observations", () => {
  for (const mutate of [
    ({assessment:a}) => a.student_id = "P02",
    ({assessment:a}) => a.score = 11,
    ({assessment:a}) => a.assistance = "hint",
    ({assessment:a}) => a.purpose = "post_test",
    ({assessment:a}) => a.started_at = "2026-09-24T01:01:40",
    ({session:s}) => s.source_type = "synthetic",
    ({session:s}) => s.feature_timeseries[10].timestamp_ms += 9000,
    ({session:s}) => s.feature_timeseries[10].context.phase = "guided_practice",
    ({session:s}) => s.feature_timeseries[10].context.game_speed = 2,
    ({session:s}) => s.feature_timeseries = s.feature_timeseries.slice(5),
  ]) {
    const f = fixture(); mutate(f);
    const result = assessmentSamples([f.session], [f.assessment]);
    assert.equal(result.samples.length, 0);
    assert.equal(result.excluded.length, 1);
  }
  const f = fixture();
  assert.throws(() => assessmentSamples([f.session], [f.assessment, f.assessment]), /duplicate/);
});

test("overlapping exports keep more observations even without additional completed quests", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "algobot-collection-"));
  try {
    const { session } = fixture();
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify({ sessions: [{ ...session, feature_timeseries: session.feature_timeseries.slice(0, 3) }] }));
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify({ sessions: [session] }));
    const read = readCollection(dir);
    assert.equal(read.sessions.length, 1);
    assert.equal(read.sessions[0].feature_timeseries.length, 21);
    assert.equal(Object.keys(read.source_sha256).length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("overlapping exports retain new challenge submissions and developer exclusions in either order",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"algobot-export-merge-"));
  try {
    const old=fixture().session;
    old.challenge_attempts=[{assessment_id:"challenge-1",started_at:"2026-09-24T01:02:00Z",task_id:"task",rubric_version:"1",first_exposure:true,submissions:[]}];
    old.source_type="developer_test";old.research_exclusion_reasons=["developer_console"];
    const newer=structuredClone(old);newer.source_type="recorded";delete newer.research_exclusion_reasons;
    newer.challenge_attempts[0].submissions.push({score:2});
    for(const records of [[old,newer],[newer,old]]){
      records.forEach((record,i)=>fs.writeFileSync(path.join(dir,`${i}.json`),JSON.stringify({sessions:[record]})));
      const merged=readCollection(dir).sessions[0];
      assert.equal(merged.challenge_attempts[0].submissions.length,1);
      assert.equal(merged.source_type,"developer_test");
      assert.deepEqual(merged.research_exclusion_reasons,["developer_console"]);
    }
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test("crossed partial exports are rejected instead of discarding one history",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"algobot-export-conflict-"));
  try {
    const first=fixture().session,second=structuredClone(first);
    first.raw_events.push({event:"code_run"});first.feature_timeseries=first.feature_timeseries.slice(0,3);
    [first,second].forEach((record,i)=>fs.writeFileSync(path.join(dir,`${i}.json`),JSON.stringify({sessions:[record]})));
    assert.throws(()=>readCollection(dir),/neither export contains the other/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
