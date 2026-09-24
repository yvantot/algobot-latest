import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {recoverSamples,simulateSamples,participantFolds,fitScaler,normalize} from '../scripts/ml-experiment-data.js';
import {loadDeployedModel} from '../scripts/model-artifacts.js';
import * as tf from '@tensorflow/tfjs';

test('recovery excludes future observations and deduplicates session exports',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'algobot-data-'));
  try {
    const s={summary:{sessionId:'s',participantId:'p'},questAttempts:{a:{endTime:10,proficiencyLabel:.8,featureVectorAtEnd:Array(10).fill(.2)},
      b:{endTime:20,proficiencyLabel:1,featureVectorAtEnd:Array(10).fill(.9)}}};
    fs.writeFileSync(path.join(dir,'a.json'),JSON.stringify({sessions:[s,s]}));
    const data=recoverSamples(dir);
    assert.equal(data.samples.length,2);
    assert.deepEqual(data.samples[0].x.at(-1),Array(10).fill(.2));
    assert.equal(data.samples[0].real_timesteps,1);
  } finally {fs.rmSync(dir,{recursive:true});}
});

test('synthetic examples remain identifiable and cannot enter real evaluation folds',()=>{
  const generated=simulateSamples(240,42);
  assert.deepEqual(generated,simulateSamples(240,42));
  assert.ok(generated.every(s=>s.source_type==='synthetic' && !s.student_id && !s.independent_student_evidence));
  assert.deepEqual([...new Set(generated.map(s=>s.y<.3?0:s.y<.6?1:2))].sort(),[0,1,2]);
  assert.throws(()=>participantFolds(generated),/recorded/);
});

test('real folds separate participants and scaler never sees validation or test values',()=>{
  const samples=['a','b','c'].map((student_id,i)=>({source_type:'recorded',student_id,y:.9,x:Array.from({length:20},()=>Array(10).fill(i))}));
  for(const fold of participantFolds(samples)) {
    assert.ok(fold.train.every(s=>s.student_id!==fold.testId&&s.student_id!==fold.validationId));
    assert.notEqual(fold.testId,fold.validationId);
  }
  const scaler=fitScaler(samples.slice(0,1));
  assert.deepEqual(scaler.feature_max,Array(10).fill(0));
  assert.equal(normalize(samples.slice(2),scaler)[0][0][0],2);
});

test('saved experiment candidates load through browser-compatible TFJS artifacts',async()=>{
  for(const name of ['small_lstm','simulation_pretrained']) {
    const m=await loadDeployedModel(`training/experiments/2026-09-24-lstm/${name}/model.json`);
    const input=tf.zeros([1,20,10]);let output;
    try {output=m.predict(input);assert.ok(Array.from(await output.data()).every(v=>Number.isFinite(v)&&v>=0&&v<=1));}
    finally {tf.dispose([input,output]);m.dispose();}
  }
});
