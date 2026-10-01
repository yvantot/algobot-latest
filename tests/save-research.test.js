import test from "node:test";
import assert from "node:assert/strict";
import { emptyDatabase } from "../src/game/persistence/storage.js";
import { recordTransition, interruptAssessments, clearResearch, importResearch, saveResearchSession, projectResearch } from "../src/game/persistence/research.js";

function opened() {
  const research = emptyDatabase().research;
  const assessment = { assessment_id: "assessment-a", session_id: "session-a", student_id: "A", status: "in_progress", started_at: "2026-09-30T00:00:00.000Z", reward_claimed: false };
  const session = { session_id: "session-a", student_id: "A", challenge_attempts: [assessment], raw_events: [] };
  recordTransition(research, { id: "opened:a", kind: "opened", assessment, session, playthroughId: "farm-a", revision: 1, exposureKey: '["A","task"]' });
  return { research, assessment, session };
}

test("opening a new challenge merges into an already saved gameplay session", () => {
  const research = emptyDatabase().research;
  const session = { session_id: "session-a", student_id: "A", challenge_attempts: [], raw_events: [] };
  saveResearchSession(research, session);
  const assessment = { assessment_id: "first", session_id: "session-a", student_id: "A", status: "in_progress", submissions: [], reward_claimed: false };
  session.challenge_attempts.push(assessment);
  recordTransition(research, { id: "opened:first:0", kind: "opened", assessment, session, playthroughId: "farm-a", revision: 2 });
  assert.deepEqual(research.sessions[session.session_id].challenge_attempts, [assessment]);
  assessment.submissions.push({ status: "stopped" });
  assert.equal(research.sessions[session.session_id].challenge_attempts[0].submissions.length, 0);
  const second = { ...assessment, assessment_id: "second", submissions: [] };
  session.challenge_attempts.push(second);
  recordTransition(research, { id: "opened:second:0", kind: "opened", assessment: second, session, playthroughId: "farm-a", revision: 3 });
  assert.deepEqual(research.sessions[session.session_id].challenge_attempts.map(a => a.assessment_id), ["first", "second"]);
  assert.doesNotThrow(() => structuredClone(research));
});
test("RESEARCH-2 reload interrupts the original assessment only once without scoring", () => {
  const { research } = opened();
  interruptAssessments(research, "farm-a", 1000);
  const first = structuredClone(research);
  interruptAssessments(research, "farm-a", 100000);
  assert.deepEqual(research, first);
  assert.equal(research.assessments["assessment-a"].status, "abandoned");
  assert.equal(research.assessments["assessment-a"].reward_claimed, false);
  assert.equal(research.sessions["session-a"].student_id, "A");
});
test("RESEARCH-3 stale logger upserts cannot undo a paid reward", () => {
  const { research, assessment, session } = opened();
  recordTransition(research, { id: "reward:a", kind: "reward", assessment: { ...assessment, status: "scored", reward_claimed: true }, session, playthroughId: "farm-a", revision: 2 });
  const revision = research.sessions[session.session_id].upload_revision;
  saveResearchSession(research, session);
  assert.equal(research.sessions[session.session_id].upload_revision, revision);
  assert.equal(research.sessions["session-a"].challenge_attempts[0].reward_claimed, true);
  assert.equal(recordTransition(research, { id: "reward:a", assessment }), false);
});

test("reload preserves stopped submissions saved after the assessment opened", () => {
  const { research, assessment, session } = opened();
  assessment.submissions = [{ status: "stopped", source: "bot.moveRight();", submitted_at: "2026-09-30T00:01:00.000Z" }];
  saveResearchSession(research, session);
  assert.equal(research.assessments[assessment.assessment_id].submissions, undefined);
  interruptAssessments(research, "farm-a");
  assert.deepEqual(research.sessions[session.session_id].challenge_attempts[0].submissions, assessment.submissions);
  assert.deepEqual(research.assessments[assessment.assessment_id].submissions, assessment.submissions);
  const recovered = structuredClone(research);
  interruptAssessments(research, "farm-a");
  assert.deepEqual(research, recovered);
});

test("interruption recovery refuses a mismatched session owner", () => {
  const { research, session } = opened();
  research.sessions[session.session_id].challenge_attempts[0].student_id = "B";
  assert.throws(() => interruptAssessments(research, "farm-a"), { code: "owner" });
});
test("RESEARCH-4/6 tombstones survive reload and prevent delivery or legacy reimport", async () => {
  const { research, session } = opened();
  clearResearch(research);
  importResearch(research, [session], {});
  saveResearchSession(research, session);
  assert.deepEqual(research.sessions, {});
  assert.equal(research.exposures['["A","task"]'], true);
  const values = new Map(), storage = { setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const root = { research: structuredClone(research) };
  await projectResearch(root, storage, { request: (_key, fn) => fn() });
  assert.deepEqual(JSON.parse(values.get("algobot_sessions")), []);
  await projectResearch(root, { setItem() { assert.fail("Mirror requires Web Locks"); } }, null);
});


test("repeated saves preserve identical events rather than collapsing their positions",()=>{
 const {research,session}=opened();const event={t:10,event:'code_edit'};
 session.raw_events=[event,event,{t:11,event:'code_edit'}];
 saveResearchSession(research,session);saveResearchSession(research,session);
 assert.deepEqual(research.sessions[session.session_id].raw_events,session.raw_events);
 session.raw_events.push({t:12,event:'code_run'});saveResearchSession(research,session);
 assert.deepEqual(research.sessions[session.session_id].raw_events,session.raw_events);
});

test("full localStorage mirror does not fail a committed IndexedDB research save",async()=>{
 const {research}=opened(),before=structuredClone(research),values=new Map([['algobot_sessions','old mirror']]);
 const storage={setItem(k,v){if(k==='algobot_sessions')throw Object.assign(Error('full'),{name:'QuotaExceededError'});values.set(k,v);},removeItem:k=>values.delete(k)};
 assert.equal(await projectResearch({research},storage,{request:(_k,fn)=>fn()}),true);
 assert.equal(values.has('algobot_sessions'),false);
 assert.equal(values.has('algobot_challenge_exposure_v1'),true);
 assert.deepEqual(research,before);
});
