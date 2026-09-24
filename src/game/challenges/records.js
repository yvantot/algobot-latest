import { recentSequence } from "../ml/research-features.js";

// Like the main farm, this survives a trip to the start menu but not a page reload.
export const farmChallengeRewards = new Set();

export function challengeWindowReady(tracker, now = Date.now()) {
  const snapshots = tracker.collectionSnapshots?.slice(-21) ?? [];
  try {
    recentSequence(snapshots);
    return now - snapshots.at(-1).timestamp_ms < 15000;
  } catch { return false; }
}

export function openChallenge(tracker, task, firstExposure, now = Date.now()) {
  const attempt = {
    assessment_id: crypto.randomUUID(), student_id: tracker.participantId, session_id: tracker.sessionId,
    task_id: task.id, rubric_version: task.rubric, assessor_id: "algobot-fixed-cases-1.0",
    first_exposure: firstExposure, started_at: new Date(now).toISOString(), finished_at: null,
    purpose: "practice", status: "in_progress", assistance: "unconfirmed", score: null, max_score: task.cases.length * 3,
    input_window_ready: challengeWindowReady(tracker, now), submissions: [], reward_claimed: false,
  };
  tracker.challengeAttempts.push(attempt);
  tracker._logRawEvent("challenge_opened", { assessment_id: attempt.assessment_id, task_id: task.id });
  return attempt;
}

export function submitChallenge(tracker, attempt, result, source, editor, independent, now = Date.now()) {
  const submission = { submitted_at: new Date(now).toISOString(), score: result.score, max_score: result.max_score,
    passed: result.passed, source, editor, assistance: independent ? "none" : "reported_or_unconfirmed",
    cases: result.results.map(({ checks, error, mistakes }) => ({ checks, error, mistakes })) };
  attempt.submissions.push(submission);
  if (attempt.submissions.length === 1) {
    Object.assign(attempt, { finished_at: submission.submitted_at, status: "scored", score: result.score,
      assistance: submission.assistance, purpose: attempt.first_exposure && independent ? "model_target" : "practice" });
  }
  tracker._logRawEvent("challenge_submitted", { assessment_id: attempt.assessment_id, submission: attempt.submissions.length, score: result.score });
  return submission;
}

export function closeChallenge(tracker, attempt) {
  if (attempt.status === "in_progress") { attempt.status = "abandoned"; attempt.finished_at = new Date().toISOString(); }
  tracker._logRawEvent("challenge_closed", { assessment_id: attempt.assessment_id });
}

export function claimChallengeReward(tracker, attempt, grant, rewardLedger = new Set()) {
  if (rewardLedger.has(attempt.task_id) || !attempt.submissions.some(s => s.passed) || tracker.challengeAttempts.some(a => a.task_id === attempt.task_id && a.reward_claimed)) return false;
  rewardLedger.add(attempt.task_id);
  attempt.reward_claimed = true;
  grant();
  tracker._logRawEvent("challenge_reward", { assessment_id: attempt.assessment_id, task_id: attempt.task_id });
  return true;
}
