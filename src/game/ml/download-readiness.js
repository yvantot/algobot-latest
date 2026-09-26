import { CHALLENGES } from "../challenges/catalog.js";
import { challengeSamples } from "./challenge-quality.js";

export function downloadReadiness(session, { cleared = false, sessions = [session] } = {}) {
  if (cleared) return { ready:false, message:"Data was cleared. Reload the game before starting a new session." };
  if (session.source_type !== "recorded") return { ready:false, message:"Testing tools were used in this session. This data cannot be used for the study. Please tell your researcher." };
  const participantSessions = sessions.filter(s => s.student_id === session.student_id);
  const reports = CHALLENGES.map(task => challengeSamples(participantSessions, task.id));
  const count = reports.reduce((sum, report) => sum + report.samples.length, 0);
  if (count) return { ready:true, message:"Your gameplay and challenge score are ready to download. Send the downloaded file to your researcher." };
  const attempts = session.challenge_attempts ?? [];
  if (!attempts.length) return { ready:false, message:"Complete the tutorial, keep playing until Challenges unlocks, then submit a challenge program. A low score is okay!" };
  if (attempts.some(a => a.status === "in_progress")) return { ready:false, message:"Your challenge has not been scored yet. Run your program and wait for its result, then try again." };
  if (attempts.some(a => a.status === "scored")) return { ready:false, message:"A challenge was scored, but this session has no usable first-attempt record. Please tell your researcher; do not clear your data." };
  return { ready:false, message:"You left a challenge before receiving a score. Try a different challenge you have not opened before, or ask your researcher for help." };
}
