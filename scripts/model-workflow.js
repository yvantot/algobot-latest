import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";
import { loadDeployedModel } from "./model-artifacts.js";
import { digest, makePlan, makePilotPlan, partitions, fitStandardScaler, normalized, means, regressionMetrics } from "./training-core.js";
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

export async function pilotWorkflow(datasetPath, output, settings = {}) {
  const data = read(datasetPath), plan = makePilotPlan(data, settings);
  freshDirectory(output);
  write(path.join(output, "pilot-plan.json"), plan);
  await tf.setBackend("cpu"); await tf.ready();
  const report = { pilot_only: true, deployment_ready: false, dataset_sha256: digest(data), plan_sha256: digest(plan),
    source_sha256: data.source_sha256, task_id: data.samples[0].task_id, rubric_version: data.samples[0].rubric_version,
    feature_schema: RESEARCH_SCHEMA, node: process.version, tensorflowjs: tf.version.tfjs, backend: tf.getBackend(),
    cutoffs: plan.cutoffs, folds: [], results: {}, predictions: { mean: [], lstm: [], mlp: [] } };
  const heldout = [];
  for (const [index, split] of plan.folds.entries()) {
    const { train, validation, test } = Object.fromEntries(Object.entries(split).map(([key, ids]) =>
      [key, data.samples.filter(s => ids.includes(s.student_id))]));
    const scaler = fitStandardScaler(train), mean = train.reduce((sum, s) => sum + s.y, 0) / train.length;
    const fold = { index, split, baseline_mean: mean, models: {} };
    heldout.push(...test);
    const record = (kind, predictions) => report.predictions[kind].push(...test.map((s, i) =>
      ({ assessment_id: s.assessment_id, student_id: s.student_id, actual: s.y, predicted: predictions[i] })));
    record("mean", test.map(() => mean));
    for (const kind of ["lstm", "mlp"]) {
      console.log(`Pilot fold ${index + 1}/${plan.folds.length}: ${kind}`);
      const model = createModel(kind, plan.seed);
      try {
        const result = await fit(model, train, validation, scaler, kind, plan, plan.seed);
        const directory = path.join(output, `fold-${index + 1}-${kind}`);
        await save(model, directory, scaler);
        const loaded = await loadDeployedModel(path.join(directory, "model.json"));
        const x = inputs(test, read(path.join(directory, "scaler_params.json")), kind);
        try {
          const predictions = await predict(loaded, x), original = await predict(model, x);
          const reloadError = Math.max(...predictions.map((v, i) => Math.abs(v - original[i])));
          if (reloadError > 1e-6) throw Error("Saved model predictions changed after reload");
          record(kind, predictions);
          fold.models[kind] = { ...result, reload_max_absolute_error: reloadError, files: hashes(directory) };
        } finally { x.dispose(); loaded.dispose(); }
      } finally { model.optimizer.dispose(); model.dispose(); }
    }
    report.folds.push(fold);
    write(path.join(output, `fold-${index + 1}.json`), fold);
  }
  for (const kind of ["mean", "lstm", "mlp"]) {
    report.results[kind] = regressionMetrics(heldout, report.predictions[kind].map(p => p.predicted), plan.cutoffs);
  }
  report.limitations = ["Exploratory cross-validation, not an untouched final test set.",
    "Tiny cohorts and single-participant validation give unstable estimates.",
    "Missing score categories cannot establish performance on those categories.",
    "Task-score prediction does not establish learning improvement or DDA effectiveness."];
  write(path.join(output, "pilot-results.json"), report);
  console.log(`Pilot saved to ${output}. No deployment bundle was created.`);
  return report;
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
    task_id:data.samples[0].task_id, rubric_version:data.samples[0].rubric_version, assessor_id:data.samples[0].assessor_id,
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
    task_id:report.task_id, rubric_version:report.rubric_version, assessor_id:report.assessor_id,
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
    task_id:development.task_id, rubric_version:development.rubric_version, assessor_id:development.assessor_id,
    feature_schema: RESEARCH_SCHEMA, input_shape: [20, 12], collection_interval_ms: 5000,
    dataset_sha256: development.dataset_sha256, plan_sha256: development.plan_sha256,
    files: selected.files, file_hash_encoding: "SHA-256 of file bytes",
    evaluation, deployment_ready: false, requires_review: "Review task validity, category support, baselines and runtime parity before deployment." });
  console.log(`Candidate bundle saved to ${output}. public/models is unchanged.`);
}

export async function refitPilotWorkflow(datasetPath, run, output) {
  const data = read(datasetPath), plan = read(path.join(run, "pilot-plan.json"));
  const report = read(path.join(run, "pilot-results.json"));
  const expected = makePilotPlan(data, { seed: plan.seed, epochs: plan.epochs });
  if (digest(expected) !== digest(plan) || report.dataset_sha256 !== digest(data) ||
      report.plan_sha256 !== digest(plan) || report.folds.length !== plan.folds.length) throw Error("Pilot inputs changed");
  const selectedEpochs = report.folds.map(f => f.models.lstm.best_epoch).sort((a, b) => a - b);
  if (!selectedEpochs.every(e => Number.isInteger(e) && e > 0 && e <= plan.epochs)) throw Error("Invalid pilot checkpoints");
  // Use validation-selected durations, never the held-out errors, to fix refit length.
  const middle = Math.floor(selectedEpochs.length / 2);
  const epochs = Math.round(selectedEpochs.length % 2 ? selectedEpochs[middle] : (selectedEpochs[middle - 1] + selectedEpochs[middle]) / 2);
  freshDirectory(output);
  await tf.setBackend("cpu"); await tf.ready();
  const modelId = `first-task-lstm-${digest(data).slice(0, 12)}-seed-${plan.seed}-epochs-${epochs}`;
  const scaler = { ...fitStandardScaler(data.samples), model_id: modelId, model_status: "provisional",
    task_id: data.samples[0].task_id, prediction_target: "independent_scored_task" };
  const ordered = [...data.samples].sort((a, b) => digest(`${plan.seed}:${a.assessment_id}`).localeCompare(digest(`${plan.seed}:${b.assessment_id}`)));
  const model = createModel("lstm", plan.seed), x = inputs(ordered, scaler, "lstm"), y = tf.tensor2d(ordered.map(s => [s.y]));
  try {
    const result = await model.fit(x, y, { epochs, batchSize: Math.min(16, ordered.length), shuffle: false, verbose: 0 });
    if (!result.history.loss.every(Number.isFinite)) throw Error("Non-finite refit loss");
    const dir = path.join(output, "lstm");
    await save(model, dir, scaler);
    const loaded = await loadDeployedModel(path.join(dir, "model.json"));
    let reloadError;
    try {
      const a = await predict(model, x), b = await predict(loaded, x);
      reloadError = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      if (reloadError > 1e-6) throw Error("Refit changed after reload");
    } finally { loaded.dispose(); }
    const aggregate = Object.fromEntries(Object.entries(report.results).map(([kind, { per_participant, ...metrics }]) => [kind, metrics]));
    const card = { model_id: modelId, status: "provisional", deployment_ready: false,
      deployment_intent: "Explicitly requested experimental replacement; not validated for reliable proficiency assessment.",
      target: "independent_scored_task", task_id: data.samples[0].task_id, rubric_version: data.samples[0].rubric_version,
      feature_schema: RESEARCH_SCHEMA, input_shape: [20, 12], output: "Predicted first-harvest task score / maximum, not general programming proficiency",
      dataset_sha256: digest(data), pilot_report_sha256: digest(report),
      training_samples: data.samples.length, training_participants: new Set(data.samples.map(s => s.student_id)).size,
      seed: plan.seed, epochs, epoch_selection: "Median validation-selected LSTM epoch across pilot folds; no selection by test performance",
      training_loss: result.history.loss, reload_max_absolute_error: reloadError, files: hashes(dir),
      tensorflowjs: tf.version.tfjs, node: process.version, backend: tf.getBackend(),
      final_refit_independently_evaluated: false, pilot_cross_validation: aggregate,
      limitations: report.limitations };
    write(path.join(dir, "model-card.json"), card);
    console.log(`Provisional full-data LSTM refit saved to ${dir}; epochs=${epochs}. Public deployment requires a separate explicit copy.`);
    return card;
  } finally { tf.dispose([x, y]); model.optimizer.dispose(); model.dispose(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, a, b, c] = process.argv.slice(2);
  try {
    if (command === "plan" && a && b) { write(b, makePlan(read(a))); console.log(`Frozen plan saved to ${b}`); }
    else if (command === "train" && a && b && c) await trainWorkflow(a, b, c);
    else if (command === "evaluate" && a && b) await evaluateWorkflow(a, b);
    else if (command === "bundle" && a && b) bundleWorkflow(a, b);
    else if (command === "pilot" && a && b) await pilotWorkflow(a, b);
    else if (command === "refit-pilot" && a && b && c) await refitPilotWorkflow(a, b, c);
    else throw Error("Usage: npm run model -- plan <samples.json> <NEW-plan.json> | train <samples.json> <plan.json> <NEW-run-dir> | evaluate <samples.json> <run-dir> | bundle <run-dir> <NEW-bundle-dir> | pilot <samples.json> <NEW-pilot-dir> | refit-pilot <samples.json> <pilot-dir> <NEW-refit-dir>");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
