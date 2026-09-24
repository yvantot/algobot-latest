import { FEATURE_NAMES } from "./model-input.js";

export function inspectCollection(session) {
  const issues = [];
  const snapshots = session.feature_timeseries ?? [];
  const attempts = session.quest_attempts ?? [];
  if (!session.student_id || /^(anonymous|unknown)$/i.test(session.student_id)) issues.push("missing_participant_id");
  if (!session.session_id) issues.push("missing_session_id");
  if (!session.collection?.independent_of_inference) issues.push("legacy_or_prediction_dependent_sampling");
  if (JSON.stringify(session.feature_names) !== JSON.stringify(FEATURE_NAMES)) issues.push("unverified_feature_order");
  if (!Array.isArray(session.raw_events) || !session.raw_events.length) issues.push("no_raw_events");
  if (snapshots.length < 20) issues.push("fewer_than_20_snapshots");
  let previous = -Infinity, gaps = 0, invalid = 0;
  for (const snapshot of snapshots) {
    if (!Number.isFinite(snapshot.timestamp_ms) || snapshot.timestamp_ms <= previous ||
        !Array.isArray(snapshot.vector) || snapshot.vector.length !== 10 || !snapshot.vector.every(Number.isFinite)) invalid++;
    if (Number.isFinite(previous) && snapshot.timestamp_ms - previous > 7500) gaps++;
    previous = snapshot.timestamp_ms;
  }
  if (invalid) issues.push("invalid_or_unordered_snapshots");
  if (gaps) issues.push("sampling_gaps_check_pause_context");
  if (attempts.some(a => a.start_time_inferred)) issues.push("inferred_quest_start");
  const support = [0, 0, 0];
  for (const attempt of attempts) {
    const y = attempt.proficiency_label;
    if (Number.isFinite(y)) support[y < .3 ? 0 : y < .6 ? 1 : 2]++;
  }
  return { issues, snapshot_count: snapshots.length, sampling_gaps: gaps,
    unfinished_attempts: attempts.filter(a => !a.completed).length,
    proxy_category_support: support,
    independent_assessment_linked: false };
}
