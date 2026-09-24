export const RESEARCH_SCHEMA = "recent-12f-v1";
export const RESEARCH_FEATURES = ["errors_per_minute", "edits_per_minute", "completed_runs_per_minute",
  "failed_runs_per_minute", "stopped_runs_per_minute", "requested_hints_per_minute",
  "harvests_per_minute", "spoilage_per_minute", "loop_iterations_per_minute",
  "conditions_per_minute", "stage_fraction", "robot_count"];
const counters = ["errors", "edits", "completed_runs", "failed_runs", "stopped_runs", "requested_hints",
  "harvested", "spoiled", "loop_iterations", "conditions"];

export function recentSequence(snapshots) {
  if (snapshots.length !== 21) throw Error("Recent features require 21 snapshots for 20 observed intervals");
  const read = (s, key) => key === "loop_iterations" ? s.counters?.for_loops + s.counters?.while_loops : s.counters?.[key];
  return snapshots.slice(1).map((s, i) => {
    const previous = snapshots[i], dt = s.timestamp_ms - previous.timestamp_ms;
    if (!Number.isFinite(dt) || dt < 2500 || dt > 7500 ||
        [previous, s].some(p => p.context?.phase !== "gameplay" || p.context?.game_speed !== 1)) {
      throw Error("Recent features require contiguous normal-speed gameplay");
    }
    const values = counters.map(key => {
      const a = read(previous, key), b = read(s, key);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) throw Error(`Invalid counter ${key}`);
      return (b - a) * 60000 / dt;
    });
    if (!Number.isInteger(s.stage) || s.stage < 1 || s.stage > 5 || !Number.isInteger(s.context.robot_count) || s.context.robot_count < 0) {
      throw Error("Missing stage or robot context");
    }
    return [...values, s.stage / 5, s.context.robot_count];
  });
}

export function validateResearchScaler(scaler) {
  if (scaler?.feature_schema !== RESEARCH_SCHEMA || scaler.type !== "standard" ||
      JSON.stringify(scaler.feature_names) !== JSON.stringify(RESEARCH_FEATURES) ||
      !Array.isArray(scaler.mean) || !Array.isArray(scaler.scale) ||
      scaler.mean.length !== 12 || scaler.scale.length !== 12 ||
      !scaler.mean.every(Number.isFinite) || !scaler.scale.every(v => Number.isFinite(v) && v > 0)) throw Error("Invalid research scaler");
  return scaler;
}

export function scaleResearchSequence(sequence, scaler) {
  validateResearchScaler(scaler);
  if (sequence.length !== 20) throw Error("Expected 20 intervals");
  return sequence.map(row => {
    if (row.length !== 12 || !row.every(Number.isFinite)) throw Error("Invalid research feature vector");
    return row.map((v, i) => (v - scaler.mean[i]) / scaler.scale[i]);
  });
}
