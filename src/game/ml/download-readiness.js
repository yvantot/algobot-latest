import { challengeSamples } from "./challenge-quality.js";
import { RESEARCH_SCHEMA, COLLECTION_SCHEMA } from "./research-features.js";
import { studyTaskTitle } from "./study-protocol.js";

function recovery(message, exclusionReasons = []) {
  return { ready:false, canDownload:true, exclusion_reasons:exclusionReasons,
    message:`${message} You can download your data for researcher review. This does not make the record eligible for the study. Do not clear your data.` };
}

function exclusionExplanation(reasons) {
  if (reasons.includes("unfinished_challenge_not_a_zero_score")) return 'Your first opening of "Your first harvest" ended without a score. Later attempts cannot replace that first record.';
  if (reasons.includes("previously_exposed_to_task")) return 'Your saved challenge history shows an earlier opening of "Your first harvest", so this score is marked as practice.';
  if (reasons.includes("freestyle_practice_only")) return 'Your first opening of "Your first harvest" used freestyle mode, so its score is marked as practice.';
  if (reasons.some(reason => /intervals|snapshots|Recent features|counter|context/.test(reason))) return 'Your first score is saved, but the gameplay observations recorded before that challenge do not meet the study requirements.';
  return '"Your first harvest" was scored, but its first-attempt record does not meet the study requirements.';
}

export function downloadReadiness(session, { cleared = false, sessions = [session], storageReadable = true } = {}) {
  if (cleared) return { ready:false, message:"Data was cleared. Reload the game before starting a new session." };
  if (!storageReadable) return recovery("Some saved data could not be read. The download includes any available recovery records.");
  if (session.source_type !== "recorded") return recovery("Testing tools were used in this session. This data cannot be used for the study.");
  const participantSessions = sessions.filter(s => s.student_id === session.student_id);
  // Study players download only after every study task has a score. The first task keeps its own messages below.
  const protocol = session.collection?.study_protocol;
  const taskAttempts = taskId => participantSessions.flatMap(s => s.challenge_attempts ?? []).filter(a => a.task_id === taskId);
  const pending = protocol?.task_order?.find(taskId => !taskAttempts(taskId).some(a => a.status === "scored"));
  if (pending && pending !== protocol.task_order[0]) {
    const title = studyTaskTitle(pending), opened = taskAttempts(pending);
    if (!opened.length) return { ready:false, reason:"study_task_not_started", next_task:pending,
      message:`Almost done! Keep farming, then complete "${title}" in Challenges. You can download after it is scored.` };
    // An attempt left open by an earlier page session can only be resumed by reopening the challenge.
    if (opened.some(a => a.status === "in_progress" && a.session_id === session.session_id)) return { ready:false, next_task:pending,
      message:`"${title}" has not been scored yet. Run your program and wait for its score, then download.` };
    return { ready:false, next_task:pending,
      message:`You left "${title}" before it was scored. Open it again in Challenges and run your program until it is scored, then download. Do not clear your data.` };
  }
  const results = [RESEARCH_SCHEMA, COLLECTION_SCHEMA].map(schema =>
    challengeSamples(participantSessions, "first-harvest-v1", {schema}));
  const count = results.reduce((sum, result) => sum + result.samples.length, 0);
  if (count) {
    for (const taskId of protocol?.task_order ?? []) {
      const usable = [RESEARCH_SCHEMA, COLLECTION_SCHEMA].some(schema =>
        challengeSamples(participantSessions, taskId, { schema }).samples.length > 0);
      if (usable) continue;
      return { ready:true, message:`Your first harvest is saved and you can download now. "${studyTaskTitle(taskId)}" has no usable first-attempt score. Please tell your researcher before ending the study; do not clear your data. Repeating the challenge cannot replace its first-attempt record.` };
    }
    return { ready:true, message:"Your gameplay and challenge score are ready to download. Send the downloaded file to your researcher." };
  }
  const attempts = taskAttempts("first-harvest-v1");
  if (!attempts.length) return { ready:false, reason:"first_challenge_not_started", message:'Complete "Your first harvest" in Challenges before downloading. Run your program and wait for its score. A low score is okay! If Challenges is not available yet, keep playing until it unlocks.' };
  if (attempts.some(a => a.status === "scored")) {
    const reasons = [...new Set(results.flatMap(result => result.excluded.map(item => item.reason)))];
    return recovery(exclusionExplanation(reasons), reasons);
  }
  if (attempts.some(a => a.status === "in_progress")) return { ready:false, message:'"Your first harvest" has not been scored yet. Run your program and wait for its result, then try again.' };
  return recovery('You left "Your first harvest" before receiving a score. Please tell your researcher.', ["unfinished_challenge_not_a_zero_score"]);
}
