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
  const results = [RESEARCH_SCHEMA, COLLECTION_SCHEMA].map(schema =>
    challengeSamples(participantSessions, "first-harvest-v1", {schema}));
  const count = results.reduce((sum, result) => sum + result.samples.length, 0);
  if (count) {
    const protocol = session.collection?.study_protocol;
    for (const taskId of protocol?.task_order ?? []) {
      const usable = [RESEARCH_SCHEMA, COLLECTION_SCHEMA].some(schema =>
        challengeSamples(participantSessions, taskId, { schema }).samples.length > 0);
      if (usable) continue;
      const attempts = participantSessions.flatMap(s => s.challenge_attempts ?? []).filter(a => a.task_id === taskId);
      if (!attempts.length) return { ready:true, next_task:taskId, message:`Your first harvest is saved. Next, keep farming for about two minutes at 100% speed, then try "${studyTaskTitle(taskId)}" in Challenges. You can download now, but your researcher will download again after that challenge.` };
      return { ready:true, message:`Your first harvest is saved and you can download now. "${studyTaskTitle(taskId)}" has no usable first-attempt score yet. Please tell your researcher before ending the study; do not clear your data. Repeating the challenge cannot replace its first-attempt record.` };
    }
    return { ready:true, message:"Your gameplay and challenge score are ready to download. Send the downloaded file to your researcher." };
  }
  const attempts = participantSessions.flatMap(s => s.challenge_attempts ?? []).filter(a => a.task_id === "first-harvest-v1");
  if (!attempts.length) return { ready:false, reason:"first_challenge_not_started", message:'Complete "Your first harvest" in Challenges before downloading. Run your program and wait for its score. A low score is okay! If Challenges is not available yet, keep playing until it unlocks.' };
  if (attempts.some(a => a.status === "scored")) {
    const reasons = [...new Set(results.flatMap(result => result.excluded.map(item => item.reason)))];
    return recovery(exclusionExplanation(reasons), reasons);
  }
  if (attempts.some(a => a.status === "in_progress")) return { ready:false, message:'"Your first harvest" has not been scored yet. Run your program and wait for its result, then try again.' };
  return { ready:false, message:'You left "Your first harvest" before receiving a score. Please tell your researcher; do not clear your data.' };
}
