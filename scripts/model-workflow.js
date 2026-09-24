import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";
import { loadDeployedModel } from "./model-artifacts.js";
import { digest, makePlan, partitions, fitStandardScaler, normalized, means, regressionMetrics } from "./training-core.js";
import { RESEARCH_SCHEMA } from "../src/game/ml/research-features.js";

const read = p => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2), { flag: "wx" });
const freshDirectory = p => { if (fs.existsSync(p)) throw Error(`Output already exists: ${p}`); fs.mkdirSync(p, { recursive: true }); };
const artifactFiles = ["model.json", "weights.bin", "scaler_params.json"];
const hashFile = p => digest(fs.readFileSync(p));
const hashes = dir => Object.fromEntries(artifactFiles.map(f => [f, hashFile(path.join(dir, f))]));

function createModel(kind, seed) {
  const model = tf.sequential();
  const initializer = () => tf.initializers.glorotUniform({ seed });
  if (kind === "lstm") model.add(tf.layers.lstm({ units: 8, inputShape: [20, 12],
    kernelInitializer: initializer(), recurrentInitializer: tf.initializers.orthogonal({ seed: seed + 1 }),
    kernelRegularizer: tf.regularizers.l2({ l2: .001 }) }));
  else model.add(tf.layers.dense({ units: 8, inputShape: [12], activation: "relu", kernelInitializer: initializer(),
    kernelRegularizer: tf.regularizers.l2({ l2: .001 }) }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid", kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 2 }) }));
  model.compile({ optimizer: tf.train.adam(.003), loss: "meanSquaredError" });
  return model;
}
const inputs = (samples, scaler, kind) => kind === "lstm"
  ? tf.tensor3d(normalized(samples, scaler)) : tf.tensor2d(means(normalized(samples, scaler)));

async function predict(model, x) {
  const y = model.predict(x);
  try { return Array.from(await y.data()); } finally { y.dispose(); }
}

async function fit(model, train, validation, scaler, kind, plan, seed) {
  // A seeded ordering and shuffle:false avoid TFJS's unseeded fit-time shuffle.
  const ordered = [...train].sort((a, b) => digest(`${seed}:${a.assessment_id}`).localeCompare(digest(`${seed}:${b.assessment_id}`)));
  const x = inputs(ordered, scaler, kind), y = tf.tensor2d(ordered.map(s => [s.y])), vx = inputs(validation, scaler, kind);
  let best = Infinity, bestWeights, bestEpoch = 0, stale = 0;
  const history = [];
  try {
    for (let epoch = 1; epoch <= plan.epochs; epoch++) {
      const result = await model.fit(x, y, { epochs: 1, batchSize: Math.min(16, train.length), shuffle: false, verbose: 0 });
      const metrics = regressionMetrics(validation, await predict(model, vx), plan.cutoffs);
      history.push({ epoch, loss: result.history.loss[0], validation_participant_macro_rmse: metrics.participant_macro_rmse });
      if (!Number.isFinite(result.history.loss[0])) throw Error("Non-finite training loss");
      if (metrics.participant_macro_rmse < best - .00001) {
        best = metrics.participant_macro_rmse; bestEpoch = epoch; stale = 0;
        tf.dispose(bestWeights ?? []); bestWeights = model.getWeights().map(w => w.clone());
      } else if (++stale >= 8) break;
    }
    model.setWeights(bestWeights);
    return { best_epoch: bestEpoch, history, validation: regressionMetrics(validation, await predict(model, vx), plan.cutoffs) };
  } finally { tf.dispose([x, y, vx, ...(bestWeights ?? [])]); }
}

async function save(model, directory, scaler) {
  fs.mkdirSync(directory);
  await model.save(tf.io.withSaveHandler(async artifact => {
    fs.writeFileSync(path.join(directory, "weights.bin"), Buffer.from(artifact.weightData));
    write(path.join(directory, "model.json"), { format: "layers-model", generatedBy: `TensorFlow.js ${tf.version.tfjs}`,
      modelTopology: artifact.modelTopology, weightsManifest: [{ paths: ["weights.bin"], weights: artifact.weightSpecs }] });
    return { modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(artifact) };
  }));
  write(path.join(directory, "scaler_params.json"), scaler);
}

export async function trainWorkflow(datasetPath, planPath, output) {
  const data = read(datasetPath), plan = read(planPath), { train, validation } = partitions(data, plan);
  if (!Number.isInteger(plan.epochs) || plan.epochs < 1 || plan.epochs > 500 ||
      !Array.isArray(plan.candidate_seeds) || plan.candidate_seeds.length !== 2 || !plan.candidate_seeds.every(Number.isInteger)) throw Error("Invalid training settings");
  freshDirectory(output);
  await tf.setBackend("cpu"); await tf.ready();
  write(path.join(output, "plan.json"), plan);
  const scaler = fitStandardScaler(train);
  const baseline = train.reduce((sum, s) => sum + s.y, 0) / train.length;
  const report = { dataset_sha256: digest(data), plan_sha256: digest(plan), target: "independent_scored_task",
    feature_schema: RESEARCH_SCHEMA, node: process.version, tensorflowjs: tf.version.tfjs, backend: tf.getBackend(),
    baseline_mean: baseline, test_evaluated: false, training_samples: train.length, validation_samples: validation.length,
    mean_validation: regressionMetrics(validation, validation.map(() => baseline), plan.cutoffs), candidates: [], selected: {},
    note: "Only train/validation used. Early stopping and seed selection use participant-macro validation RMSE. No full-data refit." };
  for (const kind of ["lstm", "mlp"]) {
    for (const seed of plan.candidate_seeds) {
      const name = `${kind}-seed-${seed}`, model = createModel(kind, seed);
      console.log(`Training ${name}`);
      try {
        const result = await fit(model, train, validation, scaler, kind, plan, seed);
        const directory = path.join(output, name);
        await save(model, directory, scaler);
        report.candidates.push({ name, kind, seed, ...result, files: hashes(directory) });
      } finally { model.optimizer.dispose(); model.dispose(); }
    }
    report.selected[kind] = report.candidates.filter(c => c.kind === kind)
      .sort((a, b) => a.validation.participant_macro_rmse - b.validation.participant_macro_rmse)[0].name;
  }
  write(path.join(output, "development.json"), report);
  console.log(`Saved development results to ${output}. Test data has not been evaluated.`);
  return report;
}

export async function evaluateWorkflow(datasetPath, run) {
  const data = read(datasetPath), plan = read(path.join(run, "plan.json")), report = read(path.join(run, "development.json"));
  const { test } = partitions(data, plan);
  if (digest(plan) !== report.plan_sha256 || digest(data) !== report.dataset_sha256) throw Error("Experiment inputs changed");
  const reportPath = path.join(run, "evaluation.json");
  if (fs.existsSync(reportPath)) throw Error("This run has already been evaluated; do not repeatedly tune against test results");
  write(path.join(run, "evaluation-started.json"), { at: new Date().toISOString(), development_sha256: digest(report) });
  await tf.setBackend("cpu"); await tf.ready();
  const evaluation = { dataset_sha256: digest(data), development_sha256: digest(report),
    test_participant_ids: plan.split.test, cutoff_status: plan.cutoff_status, cutoffs: plan.cutoffs,
    deployment_ready: false, results: { mean: regressionMetrics(test, test.map(() => report.baseline_mean), plan.cutoffs) }, predictions: {} };
  for (const kind of ["lstm", "mlp"]) {
    const selected = report.candidates.find(c => c.name === report.selected[kind] && c.kind === kind);
    if (!selected || !new RegExp(`^${kind}-seed--?\\d+$`).test(selected.name)) throw Error("Invalid selected model");
    const dir = path.join(run, selected.name);
    if (JSON.stringify(hashes(dir)) !== JSON.stringify(selected.files)) throw Error("Model artifacts changed after validation");
    const scaler = read(path.join(dir, "scaler_params.json"));
    const model = await loadDeployedModel(path.join(dir, "model.json")), x = inputs(test, scaler, kind);
    try {
      const predictions = await predict(model, x);
      evaluation.results[kind] = regressionMetrics(test, predictions, plan.cutoffs);
      evaluation.predictions[kind] = test.map((s, i) => ({ assessment_id: s.assessment_id, student_id: s.student_id, actual: s.y, predicted: predictions[i] }));
    } finally { x.dispose(); model.dispose(); }
  }
  evaluation.review = { beats_mean_rmse: evaluation.results.lstm.rmse < evaluation.results.mean.rmse,
    beats_mlp_rmse: evaluation.results.lstm.rmse < evaluation.results.mlp.rmse,
    all_reference_categories_present: evaluation.results.lstm.missing_reference_classes.length === 0,
    limitations: ["Holdout size may be too small for stable conclusions.", "Cutoffs require review; missing categories cannot establish category recognition.",
      "Evaluation is for this task and cohort, not evidence of learning improvement or causal DDA effectiveness."] };
  write(reportPath, evaluation);
  const format = v => v === null ? "undefined" : v.toFixed(4);
  const summary = ["# Held-out model evaluation", "", "Target: separately scored programming task / maximum score.", "",
    `Test participants: ${plan.split.test.length}. Test observations: ${test.length}. Cutoffs: ${plan.cutoffs.join(", ")} (${plan.cutoff_status}).`, "",
    "| Model | RMSE | MAE | Participant-macro RMSE | Accuracy | Macro F1 |", "|---|---:|---:|---:|---:|---:|",
    ...Object.entries(evaluation.results).map(([name, r]) => `| ${name} | ${format(r.rmse)} | ${format(r.mae)} | ${format(r.participant_macro_rmse)} | ${format(r.accuracy)} | ${format(r.macro_f1)} |`), "",
    "LSTM confusion matrix (rows: reference; columns: prediction; category order: low, middle, high):", "",
    "```json", JSON.stringify(evaluation.results.lstm.confusion_matrix), "```", "",
    "| Category | Support | Precision | Recall | F1 |", "|---|---:|---:|---:|---:|",
    ...evaluation.results.lstm.per_class.map((r, i) => `| ${i} | ${r.support} | ${format(r.precision)} | ${format(r.recall)} | ${format(r.f1)} |`), "",
    "Undefined class metrics are null in JSON; macro F1 assigns absent classes zero. These cutoffs are provisional.", "",
    "This report does not authorize deployment. Compare both baselines, inspect category coverage, and review the rubric and cohort size. It does not establish student learning improvement.", ""];
  fs.writeFileSync(path.join(run, "evaluation.md"), summary.join("\n"), { flag: "wx" });
  console.log(`Held-out evaluation saved to ${reportPath}. No model was deployed.`);
  return evaluation;
}

export function bundleWorkflow(run, output) {
  const development = read(path.join(run, "development.json")), evaluation = read(path.join(run, "evaluation.json"));
  if (digest(development) !== evaluation.development_sha256) throw Error("Development report changed after test evaluation");
  const selected = development.candidates.find(c => c.name === development.selected.lstm && c.kind === "lstm");
  if (!selected || !/^lstm-seed--?\d+$/.test(selected.name)) throw Error("Invalid model selection");
  const source = path.join(run, selected.name);
  if (JSON.stringify(hashes(source)) !== JSON.stringify(selected.files)) throw Error("Model artifacts changed");
  freshDirectory(output);
  for (const file of artifactFiles) fs.copyFileSync(path.join(source, file), path.join(output, file));
  write(path.join(output, "model-card.json"), { target: "independent_scored_task", output: "score / maximum",
    feature_schema: RESEARCH_SCHEMA, input_shape: [20, 12], collection_interval_ms: 5000,
    dataset_sha256: development.dataset_sha256, plan_sha256: development.plan_sha256,
    files: selected.files, file_hash_encoding: "SHA-256 of file bytes",
    evaluation, deployment_ready: false, requires_review: "Review task validity, category support, baselines and runtime parity before deployment." });
  console.log(`Candidate bundle saved to ${output}. public/models is unchanged.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, a, b, c] = process.argv.slice(2);
  try {
    if (command === "plan" && a && b) { write(b, makePlan(read(a))); console.log(`Frozen plan saved to ${b}`); }
    else if (command === "train" && a && b && c) await trainWorkflow(a, b, c);
    else if (command === "evaluate" && a && b) await evaluateWorkflow(a, b);
    else if (command === "bundle" && a && b) bundleWorkflow(a, b);
    else throw Error("Usage: npm run model -- plan <samples.json> <NEW-plan.json> | train <samples.json> <plan.json> <NEW-run-dir> | evaluate <samples.json> <run-dir> | bundle <run-dir> <NEW-bundle-dir>");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
