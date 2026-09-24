import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import * as tf from '@tensorflow/tfjs';
import { loadDeployedModel } from '../scripts/model-artifacts.js';

test('deployed LSTM and DQN weights load, predict finite values and release tensors', async () => {
  await tf.setBackend('cpu');
  await tf.ready();
  const before = tf.memory().numTensors;
  for (const [name, inputShape, outputSize] of [
    ['lstm', [1, 20, 10], 1], ['dqn', [1, 4], 5],
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

test('deployed normalization is identical to the preserved model training normalization', async () => {
  const original = JSON.parse(execFileSync('git', ['show', '008bc124204c7ff47e90e051625dcbb2bba22cd4:training/data/processed/scaler_params.json'], { encoding: 'utf8' }));
  const deployed = JSON.parse(await readFile('public/models/lstm/scaler_params.json', 'utf8'));
  assert.deepEqual(deployed, original);
});
