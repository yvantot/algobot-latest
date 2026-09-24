import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RESEARCH_SCHEMA, RESEARCH_FEATURES, recentSequence, scaleResearchSequence } from "../src/game/ml/research-features.js";
import { sealDataset } from "../src/game/ml/export-integrity.js";
import { readCollection, assessmentSamples } from "../scripts/collection-dataset.js";
import { digest, makePlan, partitions, fitStandardScaler, regressionMetrics } from "../scripts/training-core.js";
import { trainWorkflow, evaluateWorkflow, bundleWorkflow } from "../scripts/model-workflow.js";
import { loadDeployedModel } from "../scripts/model-artifacts.js";
import * as tf from "@tensorflow/tfjs";

function snapshots() {
  return Array.from({ length: 21 }, (_, i) => ({ timestamp_ms: 1700000000000 + i * 5000, stage: 2,
    context: { phase: "gameplay", game_speed: 1, robot_count: 2 }, vector: Array(10).fill(0),
    counters: { errors: 20 + i, edits: i, completed_runs: i, failed_runs: 0, stopped_runs: i,
      requested_hints: 0, harvested: i, spoiled: 0, for_loops: i, while_loops: 0, conditions: i } }));
}
// Fabricated fixtures exercise code only; they are never research results.
function dataset() {
  return { feature_schema: RESEARCH_SCHEMA, feature_names: RESEARCH_FEATURES,
    samples: Array.from({ length: 12 }, (_, i) => ({ source_type: "recorded", label_source: "independent_scored_task",
      student_id: `fixture-p${Math.floor(i / 2)}`, session_id: `fixture-s${i}`, assessment_id: `fixture-a${i}`,
      rubric_version: "test-fixture", task_id: "fixture-task", assessor_id: "fixture-assessor",
      input_start_ms: 0, input_end_ms: 100000, assessment_start_ms: 105000,
      x: recentSequence(snapshots()).map(row => row.map(v => v * (i + 1) / 12)), y: (i % 3) / 2 })) };
}

test("recent features capture recovery after cumulative counters saturate and reject gaps", () => {
  const s = snapshots();
  assert.equal(recentSequence(s)[0][0], 12);
  s.at(-1).counters.errors = s.at(-2).counters.errors;
  assert.equal(recentSequence(s).at(-1)[0], 0);
  s[5].timestamp_ms += 10000;
  assert.throws(() => recentSequence(s), /contiguous/);
});

test("sealed export checksums detect edited records and divergent overlapping histories", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "algobot-integrity-"));
  try {
    const session = { session_id: "fixture-s", student_id: "fixture-p", feature_timeseries: snapshots(), raw_events: [] };
    const sealed = await sealDataset({ dataset_version: "v4", sessions: [session] });
    const file = path.join(dir, "dataset.json");
    fs.writeFileSync(file, JSON.stringify(sealed));
    assert.equal(readCollection(file).sessions.length, 1);
    sealed.sessions[0].student_id = "edited";
    fs.writeFileSync(file, JSON.stringify(sealed));
    assert.throws(() => readCollection(file), /checksum mismatch/);
    fs.writeFileSync(file, JSON.stringify(await sealDataset({ dataset_version: "v4", sessions: [session] })));
    const edited = structuredClone(session); edited.feature_timeseries[0].vector[0] = 1;
    fs.writeFileSync(path.join(dir, "second.json"), JSON.stringify(await sealDataset({ dataset_version: "v4", sessions: [edited] })));
    assert.throws(() => readCollection(dir), /Conflicting/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("new assessment preparation produces the same recent features used at runtime", () => {
  const s = snapshots();
  const session = { session_id: "fixture-s", student_id: "fixture-p", source_type: "recorded",
    collection: { independent_of_inference: true }, feature_names: ["error_rate", "execution_speed", "iteration_usage", "condition_reactivity",
      "greedy_efficiency", "yield_quality", "frustration", "code_success_rate", "hint_consumption_rate", "normalized_completion_time"], feature_timeseries: s };
  const assessment = { assessment_id: "fixture-a", session_id: session.session_id, student_id: session.student_id,
    purpose: "model_target", status: "scored", assistance: "none", rubric_version: "fixture", task_id: "fixture", assessor_id: "fixture",
    score: 0, max_score: 10, started_at: new Date(s.at(-1).timestamp_ms + 1000).toISOString(), finished_at: new Date(s.at(-1).timestamp_ms + 30000).toISOString() };
  const prepared = assessmentSamples([session], [assessment], { schema: RESEARCH_SCHEMA });
  assert.deepEqual(prepared.samples[0].x, recentSequence(s));
  assert.equal(prepared.samples[0].y, 0);
});

test("frozen participant splits, train-only scaling and missing-class metrics", () => {
  const data = dataset(), plan = makePlan(data), parts = partitions(data, plan);
  assert.deepEqual(plan, makePlan(data));
  assert.equal(new Set(Object.values(plan.split).flat()).size, 6);
  const scaler = fitStandardScaler(parts.train);
  const expected = parts.train.flatMap(s => s.x).reduce((sum, row) => sum + row[0], 0) / (parts.train.length * 20);
  assert.equal(scaler.mean[0], expected);
  assert.ok(scaleResearchSequence(parts.test[0].x, scaler).flat().every(Number.isFinite));
  data.samples[0].y += .01;
  assert.throws(() => partitions(data, plan), /changed/);
  const m = regressionMetrics([{ student_id: "a", y: 1 }], [1], [.3, .6]);
  assert.deepEqual(m.missing_reference_classes, [0, 1]);
  assert.equal(m.per_class[0].recall, null);
  assert.equal(m.r2, null);
});

test("local train/evaluate/bundle pipeline runs and blocks reevaluation and modified artifacts", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "algobot-workflow-fixture-"));
  try {
    const data = dataset(), plan = makePlan(data, { epochs: 2 });
    const input = path.join(dir, "samples.json"), planFile = path.join(dir, "plan.json"), run = path.join(dir, "run");
    fs.writeFileSync(input, JSON.stringify(data)); fs.writeFileSync(planFile, JSON.stringify(plan));
    const development = await trainWorkflow(input, planFile, run);
    assert.equal(development.test_evaluated, false);
    assert.equal(development.candidates.length, 4);
    assert.equal(fs.existsSync(path.join(run, "evaluation.json")), false);
    const evaluation = await evaluateWorkflow(input, run);
    assert.equal(evaluation.results.lstm.n, 4);
    assert.equal(evaluation.deployment_ready, false);
    await assert.rejects(() => evaluateWorkflow(input, run), /already been evaluated/);
    const bundle = path.join(dir, "bundle"); bundleWorkflow(run, bundle);
    const card = JSON.parse(fs.readFileSync(path.join(bundle, "model-card.json")));
    assert.equal(card.files["weights.bin"], digest(fs.readFileSync(path.join(bundle, "weights.bin"))));
    const model = await loadDeployedModel(path.join(bundle, "model.json"));
    const scaler = JSON.parse(fs.readFileSync(path.join(bundle, "scaler_params.json")));
    const x = tf.tensor3d([scaleResearchSequence(data.samples[0].x, scaler)]);
    let y;
    try { y = model.predict(x); assert.ok(Array.from(await y.data()).every(v => v >= 0 && v <= 1)); }
    finally { tf.dispose([x, y]); model.dispose(); }
    fs.appendFileSync(path.join(run, development.selected.lstm, "weights.bin"), "changed");
    assert.throws(() => bundleWorkflow(run, path.join(dir, "bad-bundle")), /artifacts changed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
