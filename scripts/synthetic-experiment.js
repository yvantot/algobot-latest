import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tf from '@tensorflow/tfjs';
import { createModel, inputs, predict, save } from './model-workflow.js';
import { digest, partitions, fitStandardScaler, regressionMetrics } from './training-core.js';
import { loadDeployedModel } from './model-artifacts.js';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const write = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2), { flag: 'wx' });
const files = ['model.json', 'weights.bin', 'scaler_params.json'];
const hashes = directory => Object.fromEntries(files.map(name => [name, digest(fs.readFileSync(path.join(directory, name)))]));
export const SETTINGS = Object.freeze({ seed: 20260929, per_category: 30, sequence_jitter: .12, timestep_jitter: .05,
  label_policy: 'Inherit donor score; categories are provisional score bands, not expertise ground truth',
  epoch_mix: 'One synthetic sequence per real training sample; deterministic rotation',
  scaler_policy: 'Fit on real training partition only', patience: 8 });

function random(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const category = (y, cutoffs) => y < cutoffs[0] ? 0 : y < cutoffs[1] ? 1 : 2;
export function generateSynthetic(train, cutoffs) {
  if (!Array.isArray(cutoffs) || cutoffs.length !== 2 || !cutoffs.every(Number.isFinite) ||
      cutoffs[0] <= 0 || cutoffs[1] >= 1 || cutoffs[0] >= cutoffs[1]) throw Error('Invalid category cutoffs');
  if (!train.length || train.some(s => s.source_type !== 'recorded' || s.label_source !== 'independent_scored_task' ||
      !s.assessment_id || !s.task_id || !Number.isFinite(s.y) || s.y < 0 || s.y > 1 || s.x?.length !== 20 ||
      s.x.some(r => r.length !== 14 || !r.every(Number.isFinite) || r.slice(0, 10).some(v => v < 0))) ||
      new Set(train.map(s => s.assessment_id)).size !== train.length || new Set(train.map(s => s.task_id)).size !== 1) {
    throw Error('Synthetic donors must be valid recorded 20x14 training sequences from one task');
  }
  const bands = [0, 1, 2].map(c => train.filter(s => category(s.y, cutoffs) === c).sort((a, b) => a.assessment_id.localeCompare(b.assessment_id)));
  if (bands.some(b => !b.length)) throw Error('Cannot synthesize an unsupported score category');
  const rng = random(SETTINGS.seed), samples = [];
  for (let n = 0; n < SETTINGS.per_category; n++) for (let c = 0; c < 3; c++) {
    const donor = bands[c][n % bands[c].length], scale = 1 + (rng() * 2 - 1) * SETTINGS.sequence_jitter;
    const id = `synthetic-${donor.task_id}-${SETTINGS.seed}-${c}-${n}`;
    samples.push({ independent_student_evidence: false, source_type: 'synthetic', label_source: 'augmented_training_label', student_id: id,
      session_id: id, assessment_id: id, donor_assessment_id: donor.assessment_id,
      task_id: donor.task_id, rubric_version: donor.rubric_version, collection_protocol: donor.collection_protocol,
      score_category: c, y: donor.y, x: donor.x.map(row => {
        const jitter = 1 + (rng() * 2 - 1) * SETTINGS.timestep_jitter;
        return row.map((v, j) => j < 10 ? v * scale * jitter : v);
      }) });
  }
  return { source_type: 'synthetic', method: 'feature_augmentation', experimental_only: true, deployment_ready: false, settings: SETTINGS,
    donor_count_by_category: bands.map(b => b.length), cutoffs, samples };
}

function canonical(p) {
  const absolute = path.resolve(p);
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute).toLowerCase();
  return path.join(canonical(path.dirname(absolute)), path.basename(absolute)).toLowerCase();
}
const contains = (a, b) => a === b || b.startsWith(a + path.sep);
export function validateOutputs(datasetPath, planPath, baselineRun, syntheticFile, output) {
  const destinations = [syntheticFile, output].map(canonical);
  const protectedPaths = [datasetPath, planPath, baselineRun, 'training/raw', 'training/data/raw', 'public/models'].map(canonical);
  if (destinations.some(d => protectedPaths.some(p => contains(p, d) || contains(d, p))) ||
      contains(destinations[0], destinations[1]) || contains(destinations[1], destinations[0])) throw Error('Unsafe overlapping output paths');
  if (fs.existsSync(syntheticFile) || fs.existsSync(output)) throw Error('Outputs must be new; refusing to overwrite');
}

export function epochSamples(train, synthetic, epoch, seed) {
  const offset = (epoch - 1) * train.length;
  return [...train, ...Array.from({ length: train.length }, (_, i) => synthetic[(offset + i) % synthetic.length])]
    .sort((a, b) => digest(`${seed}:${epoch}:${a.assessment_id}`).localeCompare(digest(`${seed}:${epoch}:${b.assessment_id}`)));
}
export async function fitAugmented(model, train, synthetic, validation, scaler, kind, plan, seed) {
  const vx = inputs(validation, scaler, kind), history = [];
  let best = Infinity, bestWeights, bestEpoch = 0, stale = 0;
  try {
    for (let epoch = 1; epoch <= plan.epochs; epoch++) {
      const mixed = epochSamples(train, synthetic, epoch, seed), x = inputs(mixed, scaler, kind), y = tf.tensor2d(mixed.map(s => [s.y]));
      let loss;
      try { loss = (await model.fit(x, y, { epochs: 1, batchSize: Math.min(16, mixed.length), shuffle: false, verbose: 0 })).history.loss[0]; }
      finally { x.dispose(); y.dispose(); }
      const metrics = regressionMetrics(validation, await predict(model, vx), plan.cutoffs);
      if (!Number.isFinite(loss)) throw Error('Non-finite augmented training loss');
      history.push({ epoch, loss, validation_participant_macro_rmse: metrics.participant_macro_rmse });
      if (metrics.participant_macro_rmse < best - .00001) {
        best = metrics.participant_macro_rmse; bestEpoch = epoch; stale = 0;
        tf.dispose(bestWeights ?? []); bestWeights = model.getWeights().map(w => w.clone());
      } else if (++stale >= SETTINGS.patience) break;
    }
    model.setWeights(bestWeights);
    return { best_epoch: bestEpoch, history, validation: regressionMetrics(validation, await predict(model, vx), plan.cutoffs) };
  } finally { tf.dispose([vx, ...(bestWeights ?? [])]); }
}

export async function syntheticExperiment(datasetPath, planPath, baselineRun, syntheticFile, output) {
  validateOutputs(datasetPath, planPath, baselineRun, syntheticFile, output);
  const data = read(datasetPath), plan = read(planPath), { train, validation, test } = partitions(data, plan);
  const previous = read(path.join(baselineRun, 'evaluation.json')), development = read(path.join(baselineRun, 'development.json'));
  if (data.feature_schema !== 'active-14f-v2' || plan.epochs !== 60 || JSON.stringify(plan.candidate_seeds) !== '[42,43]' ||
      digest(plan) !== development.plan_sha256 || digest(data) !== development.dataset_sha256 ||
      previous.dataset_sha256 !== digest(data) || previous.development_sha256 !== digest(development) ||
      JSON.stringify(previous.test_participant_ids) !== JSON.stringify(plan.split.test)) throw Error('Baseline, frozen plan, or schema mismatch');
  const generated = generateSynthetic(train, plan.cutoffs), scaler = fitStandardScaler(train, data.feature_schema);
  fs.mkdirSync(path.dirname(syntheticFile), { recursive: true });
  write(syntheticFile, { ...generated, feature_schema: data.feature_schema, feature_names: data.feature_names, real_dataset_sha256: digest(data), plan_sha256: digest(plan) });
  fs.mkdirSync(output, { recursive: true });
  const experiment = { experimental_only: true, deployment_ready: false, settings: SETTINGS, plan,
    dataset_sha256: digest(data), baseline_evaluation_sha256: digest(previous), synthetic_file_sha256: digest(fs.readFileSync(syntheticFile)),
    donor_count_by_category: generated.donor_count_by_category, real_training_samples: train.length, synthetic_sequences: generated.samples.length,
    real_validation_samples: validation.length, real_test_samples: test.length,
    limitations: ['Synthetic jitter creates no new independently observed students or expertise labels.',
      'Only one low-score donor per task may cause pseudo-replication; inspect donor counts.',
      'Previously viewed test participants are reused: exploratory comparison, not new independent validation.',
      'An unjittered resampling control uses the same category balance and extra training exposure; neither arm establishes synthetic realism.',
      'No evidence of improved learning or effective DDA; do not deploy this experimental model.'] };
  write(path.join(output, 'experiment-plan.json'), experiment);
  await tf.setBackend('cpu'); await tf.ready();
  const report = { ...experiment, tensorflowjs: tf.version.tfjs, node: process.version, backend: tf.getBackend(), candidates: [], selected: {} };
  for (const arm of ['augmented', 'resampling_control']) {
    const synthetic = arm === 'augmented' ? generated.samples : generated.samples.map(s => ({ ...s, x: train.find(t => t.assessment_id === s.donor_assessment_id).x }));
    report.selected[arm] = {};
    for (const kind of ['lstm', 'mlp']) {
    for (const seed of plan.candidate_seeds) {
      const name = `${arm}-${kind}-seed-${seed}`, model = createModel(kind, seed, 14), directory = path.join(output, name);
      console.log(`Experimental augmentation: ${name}`);
      try {
        const result = await fitAugmented(model, train, synthetic, validation, scaler, kind, plan, seed);
        const modelId = `synthetic-experiment-${kind}-${digest({ data: digest(data), settings: SETTINGS, arm, seed }).slice(0, 20)}`;
        await save(model, directory, { ...scaler, model_id: modelId, model_status: 'experimental-only', task_id: plan.task_id,
          prediction_target: 'independent_scored_task', experiment_arm: arm, synthetic_training: true, deployment_ready: false });
        const loaded = await loadDeployedModel(path.join(directory, 'model.json')), vx = inputs(validation, scaler, kind);
        let parity;
        try { const a = await predict(model, vx), b = await predict(loaded, vx); parity = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
          if (parity > 1e-6) throw Error('Saved predictions changed after reload'); }
        finally { vx.dispose(); loaded.dispose(); }
        report.candidates.push({ name, arm, kind, seed, ...result, synthetic_presentations_at_checkpoint: train.length * result.best_epoch,
          unique_synthetic_sequences_at_checkpoint: Math.min(generated.samples.length, train.length * result.best_epoch), reload_max_absolute_error: parity, files: hashes(directory) });
      } finally { model.optimizer.dispose(); model.dispose(); }
    }
    report.selected[arm][kind] = report.candidates.filter(c => c.kind === kind && c.arm === arm).sort((a, b) => a.validation.participant_macro_rmse - b.validation.participant_macro_rmse)[0].name;
  }
  }
  write(path.join(output, 'development.json'), report);
  const evaluation = { experimental_only: true, deployment_ready: false, real_test_only: true, test_participant_ids: plan.split.test,
    reused_test: true, development_sha256: digest(report), real_only_results: previous.results, augmented_results: {}, resampling_control_results: {}, predictions: {},
    mean_results: regressionMetrics(test, test.map(() => train.reduce((sum, s) => sum + s.y, 0) / train.length), plan.cutoffs) };
  write(path.join(output, 'evaluation-started.json'), { development_sha256: digest(report) });
  for (const arm of ['augmented', 'resampling_control']) for (const kind of ['lstm', 'mlp']) {
    const candidate = report.candidates.find(c => c.name === report.selected[arm][kind]), directory = path.join(output, candidate.name);
    if (JSON.stringify(hashes(directory)) !== JSON.stringify(candidate.files)) throw Error('Model artifacts changed');
    const model = await loadDeployedModel(path.join(directory, 'model.json')), x = inputs(test, read(path.join(directory, 'scaler_params.json')), kind);
    try { const predictions = await predict(model, x); evaluation[`${arm}_results`][kind] = regressionMetrics(test, predictions, plan.cutoffs);
      evaluation.predictions[`${arm}_${kind}`] = test.map((s, i) => ({ assessment_id: s.assessment_id, student_id: s.student_id, actual: s.y, predicted: predictions[i] })); }
    finally { x.dispose(); model.dispose(); }
  }
  write(path.join(output, 'evaluation.json'), evaluation);
  return evaluation;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = process.argv.slice(2); if (args.length !== 5) throw Error('Usage: node scripts/synthetic-experiment.js <dataset> <plan> <baseline-run> <NEW-synthetic.json> <NEW-run-dir>');
    await syntheticExperiment(...args); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
