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
  saveResearchSession(research, session);
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
