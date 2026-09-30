import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('prediction CLI matches the deployed shape and hashes its actual weight manifest', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'algobot-predict-'));
  try {
    // Test-only normalized input, never a participant record or accuracy result.
    const input = path.join(directory, 'input.json'), output = path.join(directory, 'output.json');
    const scaler = JSON.parse(fs.readFileSync('public/models/lstm/scaler_params.json', 'utf8'));
    const features = scaler.feature_names.length;
    fs.writeFileSync(input, JSON.stringify({ normalized: true, inputs: [Array.from({ length: 20 }, () => Array(features).fill(0))] }));
    const run = () => spawnSync(process.execPath, ['scripts/predict-deployed-model.js', '--input', input, '--output', output], { encoding: 'utf8' });
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const predictions = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.deepEqual(predictions.input_shape, [20, features]);
    assert.equal(predictions.predictions.length, 1);
    assert.ok(Number.isFinite(predictions.predictions[0]));
    const manifest = JSON.parse(fs.readFileSync('public/models/lstm/model.json', 'utf8')).weightsManifest;
    for (const group of manifest) for (const shard of group.paths) assert.match(predictions.model_sha256[shard], /^[a-f0-9]{64}$/);
    const before = fs.readFileSync(output, 'utf8');
    assert.notEqual(run().status, 0, 'must not overwrite an existing prediction record');
    assert.equal(fs.readFileSync(output, 'utf8'), before);
    fs.unlinkSync(output);
    fs.writeFileSync(input, JSON.stringify({ normalized: true, inputs: [Array.from({ length: 20 }, () => Array(features + 1).fill(0))] }));
    const invalid = run();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /scaled for this model/);
    assert.equal(fs.existsSync(output), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
