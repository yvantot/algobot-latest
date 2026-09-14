import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import * as tf from '@tensorflow/tfjs';
import { loadDeployedModel } from './model-artifacts.js';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, output: { type: 'string' },
} });
if (!values.input || !values.output) {
  throw new Error('Usage: node scripts/predict-deployed-model.js --input inputs.json --output predictions.json');
}
const data = JSON.parse(await readFile(values.input, 'utf8'));
if (data.normalized !== true || !Array.isArray(data.inputs) || !data.inputs.length ||
    !data.inputs.every(sequence => Array.isArray(sequence) && sequence.length === 20 &&
      sequence.every(row => Array.isArray(row) && row.length === 10 && row.every(Number.isFinite)))) {
  throw new Error('Expected nonempty {normalized:true, inputs:[N,20,10]} exported from the processed dataset.');
}
await tf.setBackend('cpu');
await tf.ready();
const model = await loadDeployedModel('public/models/lstm/model.json');
try {
  const predictions = [];
  // Bounded batches also make this usable for a larger future test set.
  for (let offset = 0; offset < data.inputs.length; offset += 32) {
    const result = tf.tidy(() => model.predict(tf.tensor3d(data.inputs.slice(offset, offset + 32))));
    try { predictions.push(...await result.data()); }
    finally { result.dispose(); }
  }
  if (!predictions.every(Number.isFinite)) throw new Error('Model returned non-finite predictions');
  const hashes = {};
  for (const name of ['model.json', 'group1-shard1of1.bin', 'scaler_params.json']) {
    hashes[name] = createHash('sha256').update(await readFile(`public/models/lstm/${name}`)).digest('hex');
  }
  await writeFile(values.output, JSON.stringify({
    backend: 'tensorflowjs-cpu', model: 'preserved deployed LSTM',
    input_scaling: 'already normalized; no second scaling applied',
    input_sha256: createHash('sha256').update(await readFile(values.input)).digest('hex'),
    model_sha256: hashes, predictions,
  }, null, 2) + '\n', { flag: 'wx' });
  console.log(`Saved ${predictions.length} predictions to ${values.output}`);
} finally { model.dispose(); }
