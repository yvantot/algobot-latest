import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { loadDeployedModel } from './model-artifacts.js';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, output: { type: 'string' }, model: { type: 'string', default: 'public/models/lstm/model.json' },
} });
if (!values.input || !values.output) {
  throw new Error('Usage: node scripts/predict-deployed-model.js --input inputs.json --output predictions.json [--model model.json]');
}
const data = JSON.parse(await readFile(values.input, 'utf8'));
await tf.setBackend('cpu');
await tf.ready();
const modelPath = resolve(values.model);
const model = await loadDeployedModel(modelPath);
try {
  const shape = model.inputs[0].shape;
  const [timesteps, features] = shape.slice(1);
  if (model.inputs.length !== 1 || shape.length !== 3 || !Number.isInteger(timesteps) || !Number.isInteger(features)) {
    throw new Error('Expected a single sequence input with fixed timestep and feature counts.');
  }
  if (data.normalized !== true || !Array.isArray(data.inputs) || !data.inputs.length ||
      !data.inputs.every(sequence => Array.isArray(sequence) && sequence.length === timesteps &&
        sequence.every(row => Array.isArray(row) && row.length === features && row.every(Number.isFinite)))) {
    throw new Error(`Expected nonempty {normalized:true, inputs:[N,${timesteps},${features}]} scaled for this model.`);
  }
  const predictions = [];
  // Bounded batches also make this usable for a larger future test set.
  for (let offset = 0; offset < data.inputs.length; offset += 32) {
    const result = tf.tidy(() => model.predict(tf.tensor3d(data.inputs.slice(offset, offset + 32))));
    try { predictions.push(...await result.data()); }
    finally { result.dispose(); }
  }
  if (!predictions.every(Number.isFinite)) throw new Error('Model returned non-finite predictions');
  const hashes = {};
  const artifact = JSON.parse(await readFile(modelPath, 'utf8'));
  const files = new Map([['model.json', modelPath], ['scaler_params.json', resolve(dirname(modelPath), 'scaler_params.json')]]);
  for (const group of artifact.weightsManifest) for (const shard of group.paths) files.set(shard, resolve(dirname(modelPath), shard));
  for (const [name, file] of files) {
    hashes[name] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
  await writeFile(values.output, JSON.stringify({
    backend: 'tensorflowjs-cpu', model: modelPath, input_shape: [timesteps, features],
    input_scaling: 'already normalized; no second scaling applied',
    input_sha256: createHash('sha256').update(await readFile(values.input)).digest('hex'),
    model_sha256: hashes, predictions,
  }, null, 2) + '\n', { flag: 'wx' });
  console.log(`Saved ${predictions.length} predictions to ${values.output}`);
} finally { model.dispose(); }
