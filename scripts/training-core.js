import crypto from "node:crypto";
import { RESEARCH_SCHEMA, RESEARCH_FEATURES, scaleResearchSequence } from "../src/game/ml/research-features.js";

export const digest = value => crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export function validateDataset(data) {
  if (data.feature_schema !== RESEARCH_SCHEMA || JSON.stringify(data.feature_names) !== JSON.stringify(RESEARCH_FEATURES) || !data.samples?.length) {
    throw Error("Prepare a nonempty recent-12f-v1 scored-task dataset first");
  }
  const ids = new Set(), windows = new Set(), sessions = new Map();
  for (const s of data.samples) {
    if (s.source_type !== "recorded" || s.label_source !== "independent_scored_task" ||
        !s.student_id || /^(unknown|anonymous)$/i.test(s.student_id) || !s.session_id || !s.assessment_id ||
        ids.has(s.assessment_id) || !s.rubric_version || !s.task_id || !s.assessor_id ||
        !Number.isFinite(s.y) || s.y < 0 || s.y > 1 ||
        !Number.isFinite(s.input_start_ms) || !Number.isFinite(s.input_end_ms) ||
        !Number.isFinite(s.assessment_start_ms) || s.input_start_ms >= s.input_end_ms || s.input_end_ms >= s.assessment_start_ms ||
        s.x?.length !== 20 || s.x.some(row => row.length !== 12 || !row.every(Number.isFinite))) throw Error("Invalid, duplicate, synthetic or temporally leaked training sample");
    const window = `${s.session_id}:${s.input_start_ms}:${s.input_end_ms}`;
    if (windows.has(window)) throw Error("Multiple labels use the same input window");
    if (sessions.has(s.session_id) && sessions.get(s.session_id) !== s.student_id) throw Error("Session belongs to multiple participants");
    sessions.set(s.session_id, s.student_id); ids.add(s.assessment_id); windows.add(window);
  }
  if (new Set(data.samples.map(s => s.rubric_version)).size !== 1) throw Error("Use one reviewed rubric version per experiment");
  if (new Set(data.samples.map(s => s.task_id)).size !== 1) throw Error("Use one task per experiment; equal rubric names do not make tasks interchangeable");
  if (new Set(data.samples.map(s => s.assessor_id)).size !== 1) throw Error("Use one assessor protocol per experiment");
  return data;
}

export function makePlan(data, { seed = 42, epochs = 60, cutoffs = [.3, .6] } = {}) {
  validateDataset(data);
  if (!Number.isInteger(seed) || !Number.isInteger(epochs) || epochs < 1 || epochs > 500 ||
      cutoffs.length !== 2 || !cutoffs.every(Number.isFinite) || cutoffs[0] <= 0 || cutoffs[1] >= 1 || cutoffs[0] >= cutoffs[1]) throw Error("Invalid experiment settings");
  const ids = [...new Set(data.samples.map(s => s.student_id))].sort((a, b) => digest(`${seed}:${a}`).localeCompare(digest(`${seed}:${b}`)));
  if (ids.length < 6) throw Error("This holdout workflow requires at least 6 participant IDs (a software minimum, not adequate study power)");
  const heldout = Math.max(2, Math.floor(ids.length * .2));
  return { version: 1, dataset_sha256: digest(data), feature_schema: RESEARCH_SCHEMA,
    target: "independent_scored_task", task_id: data.samples[0].task_id, rubric_version: data.samples[0].rubric_version,
    assessor_id: data.samples[0].assessor_id,
    seed, epochs, candidate_seeds: [seed, seed + 1], cutoffs, cutoff_status: "provisional",
    split: { test: ids.slice(0, heldout), validation: ids.slice(heldout, heldout * 2), train: ids.slice(heldout * 2) },
    selection: "LSTM seed chosen by participant-macro validation RMSE; test opened separately",
    warning: "Do not regenerate splits or tune settings after viewing test results." };
}

export function partitions(data, plan) {
  validateDataset(data);
  if (digest(data) !== plan.dataset_sha256 || plan.feature_schema !== RESEARCH_SCHEMA) throw Error("Dataset changed after the split was frozen");
  const groups = Object.values(plan.split).flat();
  const expected = new Set(data.samples.map(s => s.student_id));
  if (new Set(groups).size !== groups.length || groups.length !== expected.size || groups.some(id => !expected.has(id)) ||
      ["train", "validation", "test"].some(key => !Array.isArray(plan.split[key]) || plan.split[key].length < 2)) throw Error("Invalid or overlapping participant split");
  return Object.fromEntries(["train", "validation", "test"].map(key => [key, data.samples.filter(s => plan.split[key].includes(s.student_id))]));
}

export function fitStandardScaler(samples) {
  const rows = samples.flatMap(s => s.x), n = rows.length;
  if (!n) throw Error("No training rows");
  const mean = RESEARCH_FEATURES.map((_, j) => rows.reduce((sum, r) => sum + r[j], 0) / n);
  const scale = mean.map((m, j) => Math.sqrt(rows.reduce((sum, r) => sum + (r[j] - m) ** 2, 0) / n) || 1);
  return { type: "standard", feature_schema: RESEARCH_SCHEMA, feature_names: RESEARCH_FEATURES, mean, scale };
}
export const normalized = (samples, scaler) => samples.map(s => scaleResearchSequence(s.x, scaler));
export const means = rows => rows.map(sequence => RESEARCH_FEATURES.map((_, j) => sequence.reduce((sum, row) => sum + row[j], 0) / sequence.length));

export function regressionMetrics(samples, predictions, cutoffs) {
  if (!samples.length || samples.length !== predictions.length || !predictions.every(Number.isFinite)) throw Error("Invalid evaluation predictions");
  const truth = samples.map(s => s.y), average = truth.reduce((a, b) => a + b, 0) / truth.length;
  const mse = truth.reduce((sum, y, i) => sum + (y - predictions[i]) ** 2, 0) / truth.length;
  const variance = truth.reduce((sum, y) => sum + (y - average) ** 2, 0) / truth.length;
  const category = v => v < cutoffs[0] ? 0 : v < cutoffs[1] ? 1 : 2;
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
  truth.forEach((y, i) => matrix[category(y)][category(predictions[i])]++);
  const per_class = matrix.map((row, i) => {
    const support = row.reduce((a, b) => a + b, 0), predicted = matrix.reduce((sum, r) => sum + r[i], 0);
    return { support, precision: predicted ? row[i] / predicted : null,
      recall: support ? row[i] / support : null, f1: support + predicted ? 2 * row[i] / (support + predicted) : null };
  });
  const per_participant = [...new Set(samples.map(s => s.student_id))].map(id => {
    const indices = samples.flatMap((s, i) => s.student_id === id ? [i] : []);
    return { student_id: id, n: indices.length, rmse: Math.sqrt(indices.reduce((sum, i) => sum + (truth[i] - predictions[i]) ** 2, 0) / indices.length) };
  });
  return { n: truth.length, rmse: Math.sqrt(mse), mae: truth.reduce((sum, y, i) => sum + Math.abs(y - predictions[i]), 0) / truth.length,
    r2: variance ? 1 - mse / variance : null,
    participant_macro_rmse: per_participant.reduce((sum, p) => sum + p.rmse, 0) / per_participant.length,
    per_participant, accuracy: matrix.reduce((sum, row, i) => sum + row[i], 0) / truth.length,
    confusion_matrix: matrix, per_class, macro_f1: per_class.reduce((sum, c) => sum + (c.f1 ?? 0), 0) / 3,
    missing_reference_classes: per_class.flatMap((c, i) => c.support ? [] : [i]) };
}
