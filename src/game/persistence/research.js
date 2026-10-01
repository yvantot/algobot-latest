import { extendEventHistory, eventPrefix } from "../ml/event-history.js";
import { SaveError } from "./schema.js";

const copy = value => JSON.parse(JSON.stringify(value));
export function mergeSession(previous, incoming) {
  if (!previous) return copy(incoming);
  const result = { ...previous, ...copy(incoming) };
  if (previous.upload_revision || incoming.upload_revision) result.upload_revision = Math.max(previous.upload_revision ?? 0, incoming.upload_revision ?? 0);
  const attempts = new Map((previous.challenge_attempts ?? []).map(a => [a.assessment_id, a]));
  for (const attempt of incoming.challenge_attempts ?? []) {
    const old = attempts.get(attempt.assessment_id);
    const preservePrevious = old && (old.reward_claimed && !attempt.reward_claimed || old.status !== "in_progress" && attempt.status === "in_progress");
    attempts.set(attempt.assessment_id, preservePrevious ? old : copy(attempt));
  }
  result.challenge_attempts = [...attempts.values()];
  const before = previous.raw_events ?? [], after = incoming.raw_events ?? [];
  const retained = extendEventHistory(before, after);
  if (retained) { result.raw_events = copy(retained); return result; }
  if (eventPrefix(after, before)) { result.raw_events = copy(before); return result; }
  const events = new Map();
  for (const event of [...(previous.raw_events ?? []), ...(incoming.raw_events ?? [])]) events.set(event.operation_id ?? JSON.stringify(event), event);
  result.raw_events = [...events.values()];
  return result;
}
export function saveResearchSession(research, session) {
  if (research.tombstones[session.session_id]) return;
  research.sessions[session.session_id] = mergeSession(research.sessions[session.session_id], session);
}
export function recordTransition(research, { id, assessment, session, playthroughId, revision, recoveryGeneration = 0, kind, exposureKey = null }) {
  if (research.operations[id]) return false;
  if (research.tombstones[assessment.session_id]) throw new SaveError("research_deleted", "This research session was cleared. Start a new session before opening assessments.");
  const previous = research.assessments[assessment.assessment_id];
  if (previous && (previous.student_id !== assessment.student_id || previous.session_id !== assessment.session_id)) throw new SaveError("owner", "Assessment ownership changed.");
  if (kind === "reward" && previous?.reward_claimed) return false;
  saveResearchSession(research, session);
  research.assessments[assessment.assessment_id] = copy({ ...assessment, playthroughId });
  const stored = research.sessions[assessment.session_id];
  stored.challenge_attempts ??= [];
  const index = stored.challenge_attempts.findIndex(a => a.assessment_id === assessment.assessment_id);
  if (index < 0) stored.challenge_attempts.push(copy(assessment)); else stored.challenge_attempts[index] = copy(assessment);
  stored.upload_revision = (stored.upload_revision ?? 0) + 1;
  research.operations[id] = { id, kind, participantId: assessment.student_id, sessionId: assessment.session_id, assessmentId: assessment.assessment_id, playthroughId, revision, recoveryGeneration, delivered: false };
  if (exposureKey) research.exposures[exposureKey] = true;
  return true;
}
export function interruptAssessments(research, playthroughId, now = Date.now()) {
  for (const assessment of Object.values(research.assessments)) {
    if (assessment.playthroughId !== playthroughId || assessment.status !== "in_progress") continue;
    const id = `interrupted:${assessment.assessment_id}`;
    if (research.operations[id] || research.tombstones[assessment.session_id]) continue;
    const latest = research.sessions[assessment.session_id]?.challenge_attempts?.find(attempt => attempt.assessment_id === assessment.assessment_id);
    if (latest) {
      if (latest.student_id !== assessment.student_id || latest.session_id !== assessment.session_id) throw new SaveError("owner", "Assessment ownership changed.");
      Object.assign(assessment, copy(latest));
    }
    if (assessment.status !== "in_progress") continue;
    assessment.status = "abandoned";
    assessment.recovered_at = new Date(now).toISOString();
    assessment.finished_at = assessment.last_active_at ?? assessment.started_at;
    recordTransition(research, { id, assessment, session: research.sessions[assessment.session_id], playthroughId, revision: assessment.revision ?? 0, kind: "interrupted" });
  }
}
export function clearResearch(research, sessionIds = Object.keys(research.sessions)) {
  for (const id of sessionIds) { research.tombstones[id] = true; delete research.sessions[id]; }
  for (const [id, operation] of Object.entries(research.operations)) if (research.tombstones[operation.sessionId]) delete research.operations[id];
  for (const [id, assessment] of Object.entries(research.assessments)) if (research.tombstones[assessment.session_id]) delete research.assessments[id];
  research.epoch++;
  research.rawCleared = true;
  research.legacyBackups = [];
}
export function importResearch(research, sessions, exposures) {
  if (research.imported) return;
  for (const session of sessions) if (session.session_id) saveResearchSession(research, session);
  Object.assign(research.exposures, exposures);
  research.imported = true;
}

export async function projectResearch(root, storage, locks = globalThis.navigator?.locks) {
  if (!locks) return false;
  await locks.request("algobot-research-projection", async () => {
    const sessions = Object.values(root.research.sessions).filter(session => !root.research.tombstones[session.session_id]).map(session => ({ ...session,
      persistence_operations: Object.values(root.research.operations).filter(operation => operation.sessionId === session.session_id).map(operation => operation.id) }));
    try { storage.setItem("algobot_sessions", JSON.stringify(sessions)); }
    catch (error) {
      if (error.name !== "QuotaExceededError") throw error;
      // IndexedDB already committed these records; this legacy mirror is optional.
      storage.removeItem("algobot_sessions");
    }
    storage.setItem("algobot_challenge_exposure_v1", JSON.stringify(root.research.exposures));
    if (root.research.rawCleared) {
      storage.removeItem("algobot_raw_sessions");
      storage.removeItem("algobot_replay_buffer");
    }
  });
  return true;
}
