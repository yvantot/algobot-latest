import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import * as tf from '@tensorflow/tfjs';

// Load exactly the deployed browser topology and weights, without tfjs-node or Python.
export async function loadDeployedModel(path) {
  const modelPath = resolve(path);
  const artifact = JSON.parse(await readFile(modelPath, 'utf8'));
  const weights = [];
  const buffers = [];
  for (const group of artifact.weightsManifest) {
    weights.push(...group.weights);
    for (const shard of group.paths) buffers.push(await readFile(resolve(dirname(modelPath), shard)));
  }
  const bytes = Buffer.concat(buffers);
  return tf.loadLayersModel(tf.io.fromMemory({
    modelTopology: artifact.modelTopology,
    weightSpecs: weights,
    weightData: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }));
}
