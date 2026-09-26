import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as tf from '@tensorflow/tfjs';
import { loadDeployedModel } from '../scripts/model-artifacts.js';
import { validateResearchScaler, scaleResearchSequence } from '../src/game/ml/research-features.js';

test('deployed LSTM and DQN weights load, predict finite values and release tensors', async () => {
  await tf.setBackend('cpu');
  await tf.ready();
  const before = tf.memory().numTensors;
  for (const [name, inputShape, outputSize] of [
    ['lstm', [1, 20, 12], 1], ['dqn', [1, 4], 5],
  ]) {
    const model = await loadDeployedModel(`public/models/${name}/model.json`);
    try {
      assert.deepEqual(model.inputs[0].shape.slice(1), inputShape.slice(1));
      const afterLoad = tf.memory().numTensors;
      for (let i = 0; i < 3; i++) {
        const output = tf.tidy(() => model.predict(tf.zeros(inputShape)));
        try {
          const values = Array.from(await output.data());
          assert.equal(values.length, outputSize);
          assert.ok(values.every(Number.isFinite));
          if (name === 'lstm') assert.ok(values[0] >= 0 && values[0] <= 1);
        } finally { output.dispose(); }
      }
      assert.equal(tf.memory().numTensors, afterLoad, `${name} inference leaked tensors`);
    } finally { model.dispose(); }
  }
  assert.equal(tf.memory().numTensors, before);
});

test('deployed research model, scaler and provenance match the provisional bundle', async () => {
  const deployed = JSON.parse(await readFile('public/models/lstm/scaler_params.json', 'utf8'));
  validateResearchScaler(deployed);
  const card = JSON.parse(await readFile('public/models/lstm/model-card.json', 'utf8'));
  assert.equal(card.model_id, deployed.model_id);
  assert.equal(card.task_id, deployed.task_id);
  assert.equal(card.status, 'provisional');
  assert.equal(card.final_refit_independently_evaluated, false);
  for (const [file, hash] of Object.entries(card.files)) {
    assert.equal(createHash('sha256').update(await readFile(`public/models/lstm/${file}`)).digest('hex'), hash);
  }
  const model = await loadDeployedModel('public/models/lstm/model.json');
  const x = tf.tensor3d([scaleResearchSequence(Array.from({ length: 20 }, () => [...deployed.mean]), deployed)]);
  let y;
  try { y = model.predict(x); const value = (await y.data())[0]; assert.ok(Number.isFinite(value) && value >= 0 && value <= 1); }
  finally { tf.dispose([x, y]); model.dispose(); }
});
