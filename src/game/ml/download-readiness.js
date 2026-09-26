import { challengeSamples } from "./challenge-quality.js";
import { RESEARCH_SCHEMA, COLLECTION_SCHEMA } from "./research-features.js";

export function downloadReadiness(session, { cleared = false, sessions = [session] } = {}) {
  if (cleared) return { ready:false, message:"Data was cleared. Reload the game before starting a new session." };
  if (session.source_type !== "recorded") return { ready:false, message:"Testing tools were used in this session. This data cannot be used for the study. Please tell your researcher." };
  const participantSessions = sessions.filter(s => s.student_id === session.student_id);
  const count = [RESEARCH_SCHEMA, COLLECTION_SCHEMA].reduce((sum, schema) =>
    sum + challengeSamples(participantSessions, "first-harvest-v1", {schema}).samples.length, 0);
  if (count) return { ready:true, message:"Your gameplay and challenge score are ready to download. Send the downloaded file to your researcher." };
  const attempts = participantSessions.flatMap(s => s.challenge_attempts ?? []).filter(a => a.task_id === "first-harvest-v1");
  if (!attempts.length) return { ready:false, reason:"first_challenge_not_started", message:'Complete "Your first harvest" in Challenges before downloading. Run your program and wait for its score. A low score is okay! If Challenges is not available yet, keep playing until it unlocks.' };
  if (attempts.some(a => a.status === "in_progress")) return { ready:false, message:'"Your first harvest" has not been scored yet. Run your program and wait for its result, then try again.' };
  if (attempts.some(a => a.status === "scored")) return { ready:false, message:'"Your first harvest" was scored, but has no usable first-attempt record. Please tell your researcher; do not clear your data.' };
  return { ready:false, message:'You left "Your first harvest" before receiving a score. Please tell your researcher; do not clear your data.' };
}
