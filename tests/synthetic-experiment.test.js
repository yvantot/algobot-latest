import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { generateSynthetic, epochSamples, validateOutputs, fitAugmented } from '../scripts/synthetic-experiment.js';
import { createModel } from '../scripts/model-workflow.js';
import { fitStandardScaler, validateDataset } from '../scripts/training-core.js';
import { researchFeatureNames } from '../src/game/ml/research-features.js';
const sample = (n, y) => ({ source_type: 'recorded', label_source: 'independent_scored_task',
  student_id: `player-${n}`, assessment_id: `assessment-${n}`, session_id: `session-${n}`, task_id: 'task',
  rubric_version: 'v1', assessor_id: 'a', y, input_start_ms: 0, input_end_ms: 100, assessment_start_ms: 101,
  x: Array.from({ length: 20 }, (_, t) => [0, 1, 2, 3, 4, 5, 6, 7, 8, t, .4, 2, 1, 5]) });
const train = [sample(1, .1), sample(2, .5), sample(3, .9)];
test('synthetic generator is deterministic, labelled, bounded, preserves context and donor scores', () => {
  const before = JSON.stringify(train), generated = generateSynthetic(train, [.3, .6]);
  assert.deepEqual(generated, generateSynthetic(train, [.3, .6]));
  assert.equal(generated.samples.length, 90);
  assert.deepEqual(generated.donor_count_by_category, [1, 1, 1]);
  assert.equal(generated.method, 'feature_augmentation');
  assert.equal(new Set(generated.samples.map(s => s.student_id)).size, 90);
  for (const s of generated.samples) {
    const donor = train.find(t => t.assessment_id === s.donor_assessment_id);
    assert.equal(s.source_type, 'synthetic'); assert.equal(s.label_source, 'augmented_training_label');
    assert.equal(s.y, donor.y); assert.notEqual(s.student_id, donor.student_id);
    s.x.forEach((row, t) => {
      assert.deepEqual(row.slice(10), donor.x[t].slice(10));
      row.slice(0, 10).forEach((v, j) => { const original = donor.x[t][j];
        assert.ok(v >= original * .88 * .95 - 1e-12 && v <= original * 1.12 * 1.05 + 1e-12);
        if (!original) assert.equal(v, 0);
      });
    });
  }
  assert.equal(JSON.stringify(train), before);
  assert.throws(() => validateDataset({ feature_schema: 'active-14f-v2', feature_names: researchFeatureNames('active-14f-v2'), samples: generated.samples }), /synthetic/);
});
test('donors are exclusively supplied training samples; missing categories and invalid rates rejected', () => {
  const heldout = [sample(4, .1), sample(5, .5)];
  const generated = generateSynthetic(train, [.3, .6]);
  heldout[0].y = 1; heldout[1].x[0][1] = 9000;
  assert.deepEqual(generated, generateSynthetic(train, [.3, .6]));
  assert.ok(generated.samples.every(s => train.some(t => t.assessment_id === s.donor_assessment_id)));
  assert.throws(() => generateSynthetic(train.slice(1), [.3, .6]), /unsupported/);
  const bad = structuredClone(train); bad[0].x[0][0] = -1;
  assert.throws(() => generateSynthetic(bad, [.3, .6]), /valid recorded/);
  assert.throws(() => generateSynthetic(train, [.6, .3]), /cutoffs/);
});
test('epoch mix gives equal real/synthetic influence and rotates through synthetic sequences', () => {
  const synthetic = generateSynthetic(train, [.3, .6]).samples;
  const a = epochSamples(train, synthetic, 1, 42), b = epochSamples(train, synthetic, 2, 42);
  assert.deepEqual(a, epochSamples(train, synthetic, 1, 42));
  assert.equal(a.filter(s => s.source_type === 'recorded').length, train.length);
  assert.equal(a.filter(s => s.source_type === 'synthetic').length, train.length);
  assert.ok(a.filter(s => s.source_type === 'synthetic').every(s => !b.includes(s)));
});
test('output validation prevents source/raw/deployed overlap, nested outputs and overwrite', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'algobot-synthetic-'));
  try {
    const args = [path.join(root, 'data.json'), path.join(root, 'plan.json'), path.join(root, 'baseline')];
    validateOutputs(...args, path.join(root, 'synthetic.json'), path.join(root, 'run'));
    assert.throws(() => validateOutputs(...args, args[0], path.join(root, 'run')), /overlapping/);
    assert.throws(() => validateOutputs(...args, 'training/raw/new.json', path.join(root, 'run')), /overlapping/);
    assert.throws(() => validateOutputs(...args, 'public/models/new.json', path.join(root, 'run')), /overlapping/);
    assert.throws(() => validateOutputs(...args, path.join(root, 'run', 'synthetic.json'), path.join(root, 'run')), /overlapping/);
    fs.writeFileSync(path.join(root, 'synthetic.json'), '{}');
    assert.throws(() => validateOutputs(...args, path.join(root, 'synthetic.json'), path.join(root, 'run')), /overwrite/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('augmented fit uses real validation and restores a finite selected checkpoint', async () => {
  await tf.setBackend('cpu'); await tf.ready();
  const synthetic = generateSynthetic(train, [.3, .6]).samples;
  const scaler = fitStandardScaler(train, 'active-14f-v2'), model = createModel('mlp', 42, 14);
  try {
    const result = await fitAugmented(model, train, synthetic, [sample(4, .2), sample(5, .8)], scaler, 'mlp', { epochs: 2, cutoffs: [.3, .6] }, 42);
    assert.ok(result.best_epoch >= 1 && result.best_epoch <= 2);
    assert.equal(result.validation.n, 2); assert.ok(Number.isFinite(result.validation.rmse));
  } finally { model.optimizer.dispose(); model.dispose(); }
});
