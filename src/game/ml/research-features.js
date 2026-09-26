export const RESEARCH_SCHEMA = "recent-12f-v1";
export const RESEARCH_FEATURES = ["errors_per_minute", "edits_per_minute", "completed_runs_per_minute",
  "failed_runs_per_minute", "stopped_runs_per_minute", "requested_hints_per_minute",
  "harvests_per_minute", "spoilage_per_minute", "loop_iterations_per_minute",
  "conditions_per_minute", "stage_fraction", "robot_count"];
export const COLLECTION_SCHEMA = "active-14f-v2";
export const COLLECTION_FEATURES = [...RESEARCH_FEATURES, "game_speed", "observation_age_seconds"];
export const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
export const researchFeatureNames = schema => schema === RESEARCH_SCHEMA ? RESEARCH_FEATURES
  : schema === COLLECTION_SCHEMA ? COLLECTION_FEATURES : null;
const counters = ["errors", "edits", "completed_runs", "failed_runs", "stopped_runs", "requested_hints",
  "harvested", "spoiled", "loop_iterations", "conditions"];

function intervalFeatures(previous, s) {
  const dt = s.timestamp_ms - previous.timestamp_ms;
  const read = (snapshot, key) => key === "loop_iterations" ? snapshot.counters?.for_loops + snapshot.counters?.while_loops : snapshot.counters?.[key];
  if (!Number.isFinite(dt) || dt < 2500 || dt > 7500 ||
      [previous, s].some(p => p.context?.phase !== "gameplay")) throw Error("Requires observed gameplay intervals");
  const values = counters.map(key => {
    const a = read(previous, key), b = read(s, key);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) throw Error(`Invalid counter ${key}`);
    return (b - a) * 60000 / dt;
  });
  if (!Number.isInteger(s.stage) || s.stage < 1 || s.stage > 5 || !Number.isInteger(s.context.robot_count) || s.context.robot_count < 0) {
    throw Error("Missing stage or robot context");
  }
  return [...values, s.stage / 5, s.context.robot_count];
}

export function recentSequence(snapshots) {
  if (snapshots.length !== 21) throw Error("Recent features require 21 snapshots for 20 observed intervals");
  return snapshots.slice(1).map((s, i) => {
    const previous = snapshots[i], dt = s.timestamp_ms - previous.timestamp_ms;
    if (!Number.isFinite(dt) || dt < 2500 || dt > 7500 ||
        [previous, s].some(p => p.context?.phase !== "gameplay" || p.context?.game_speed !== 1) ||
        (s.gameplay_segment !== undefined && s.gameplay_segment !== previous.gameplay_segment)) {
      throw Error("Recent features require contiguous normal-speed gameplay");
    }
    return intervalFeatures(previous, s);
  });
}

// Keep real intervals across menus and speed changes; never subtract counters across a boundary.
export function activeGameplayWindow(snapshots, cutoff = Date.now()) {
  const intervals = [];
  for (let i = 1; i < snapshots.length; i++) {
    const previous = snapshots[i - 1], s = snapshots[i];
    if (previous.timestamp_ms < cutoff - ACTIVE_WINDOW_MS || s.timestamp_ms >= cutoff ||
        !Number.isInteger(s.gameplay_segment) || s.gameplay_segment !== previous.gameplay_segment ||
        ![.3, .7, 1, 2, 4].includes(s.context?.game_speed) || s.context.game_speed !== previous.context?.game_speed) continue;
    try {
      intervals.push({ start: previous.timestamp_ms, end: s.timestamp_ms,
        x: [...intervalFeatures(previous, s), s.context.game_speed, (cutoff - s.timestamp_ms) / 1000] });
    } catch { /* Invalid or interrupted intervals cannot supply observations. */ }
  }
  const selected = intervals.slice(-20);
  return { ready: selected.length === 20, count: selected.length, x: selected.map(s => s.x),
    start: selected[0]?.start, end: selected.at(-1)?.end };
}

export function validateResearchScaler(scaler) {
  const names = researchFeatureNames(scaler?.feature_schema);
  if (!names || scaler.type !== "standard" ||
      JSON.stringify(scaler.feature_names) !== JSON.stringify(names) ||
      !Array.isArray(scaler.mean) || !Array.isArray(scaler.scale) ||
      scaler.mean.length !== names.length || scaler.scale.length !== names.length ||
      !scaler.mean.every(Number.isFinite) || !scaler.scale.every(v => Number.isFinite(v) && v > 0)) throw Error("Invalid research scaler");
  return scaler;
}

export function scaleResearchSequence(sequence, scaler) {
  validateResearchScaler(scaler);
  if (sequence.length !== 20) throw Error("Expected 20 intervals");
  return sequence.map(row => {
    if (row.length !== scaler.mean.length || !row.every(Number.isFinite)) throw Error("Invalid research feature vector");
    return row.map((v, i) => (v - scaler.mean[i]) / scaler.scale[i]);
  });
}
