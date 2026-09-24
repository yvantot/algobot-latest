import fs from 'node:fs';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { FEATURE_NAMES } from '../src/game/ml/model-input.js';
import {recoverSamples,simulateSamples,participantFolds,fitScaler,normalize,metrics} from './ml-experiment-data.js';

const output=process.argv[2];
if(!output || fs.existsSync(output)) throw Error('Supply a NEW experiment output directory; existing evidence is never overwritten');
const assessmentInput=process.argv[3];
const data=assessmentInput ? JSON.parse(fs.readFileSync(assessmentInput,'utf8')) : recoverSamples('training/data/raw');
if (assessmentInput && (!data.samples?.length || data.samples.some(s=>s.source_type!=='recorded' ||
    s.label_source!=='independent_scored_task' || !Number.isFinite(s.y) || s.y<0 || s.y>1))) {
  throw Error('Assessment training requires recorded independently scored samples');
}
if (assessmentInput && new Set(data.samples.map(s=>s.rubric_version)).size!==1) throw Error('Train one reviewed rubric version at a time');
const folds=participantFolds(data.samples);
const synthetic=assessmentInput ? [] : simulateSamples(240,42);
const candidateNames=assessmentInput ? ['small_lstm'] : ['small_lstm','simulation_pretrained'];
fs.mkdirSync(output,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));
write('recorded-samples.json',data);
if(synthetic.length)write('synthetic-training.json',{source_type:'synthetic',purpose:'Experimental pretraining only; not participant observations',samples:synthetic});

function model() {
  const m=tf.sequential();
  m.add(tf.layers.lstm({units:4,inputShape:[20,10],kernelInitializer:tf.initializers.glorotUniform({seed:42}),
    recurrentInitializer:tf.initializers.orthogonal({seed:43}),kernelRegularizer:tf.regularizers.l2({l2:.001})}));
  m.add(tf.layers.dense({units:1,activation:'sigmoid',kernelInitializer:tf.initializers.glorotUniform({seed:44})}));
  m.compile({optimizer:tf.train.adam(.01),loss:'meanSquaredError'});
  return m;
}
const tensors=(samples,scaler)=>[tf.tensor3d(normalize(samples,scaler)),tf.tensor2d(samples.map(s=>[s.y]))];
async function fit(m,train,scaler,validation=null,epochs=40) {
  const [x,y]=tensors(train,scaler), val=validation?tensors(validation,scaler):null;
  let best=Infinity, bestEpoch=1, bestWeights=null, stale=0;
  const history=[];
  try {
    for(let epoch=1;epoch<=epochs;epoch++) {
      const h=await m.fit(x,y,{epochs:1,batchSize:8,shuffle:false,verbose:0,...(val?{validationData:val}:{})});
      const loss=h.history.val_loss?.[0]??h.history.loss[0];
      if(!Number.isFinite(loss)) throw Error('Non-finite training loss');
      history.push({epoch,loss:h.history.loss[0],validation_loss:val?loss:null});
      if(val) {
        if(loss<best-.00001){best=loss;bestEpoch=epoch;stale=0;tf.dispose(bestWeights??[]);bestWeights=m.getWeights().map(w=>w.clone());}
        else if(++stale>=6) break;
      }
    }
    if(bestWeights)m.setWeights(bestWeights);
    return {best_epoch:val?bestEpoch:epochs,history};
  } finally {tf.dispose([x,y,...(val??[]),...(bestWeights??[])]);}
}
async function predict(m,samples,scaler) {
  const x=tf.tensor3d(normalize(samples,scaler));let y;
  try {y=m.predict(x);return Array.from(await y.data());}finally{tf.dispose([x,y]);}
}
async function save(m,name,scaler) {
  const dir=path.join(output,name);fs.mkdirSync(dir);
  await m.save(tf.io.withSaveHandler(async a=>{
    fs.writeFileSync(path.join(dir,'weights.bin'),Buffer.from(a.weightData));
    fs.writeFileSync(path.join(dir,'model.json'),JSON.stringify({format:'layers-model',generatedBy:'TensorFlow.js experiment',
      modelTopology:a.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:a.weightSpecs}]}));
    return {modelArtifactsInfo:tf.io.getModelArtifactsInfoForJSON(a)};
  }));
  fs.writeFileSync(path.join(dir,'scaler_params.json'),JSON.stringify({...scaler,feature_names:FEATURE_NAMES},null,2));
}

const report={seed:42,architecture:'LSTM(4), Dense(1 sigmoid), L2=.001',
  feature_schema:'legacy-10f unchanged',cutoffs:[.3,.6],cutoff_status:'provisional',
  evaluation:'Leave-one-recorded-participant-ID-out; next ID reserved for validation; train-only scaling',
  deployment_ready:false,label_source:assessmentInput?'independent_scored_task':'recorded_gameplay_formula',limitations:[
    'Participant IDs are grouping identifiers, not verified distinct people.',
    assessmentInput?'Labels measure the separately scored task; rubric validity still needs review.':'Labels measure a gameplay formula, not independently assessed skill.',
    'Legacy quest-end vectors do not reconstruct missing time-series observations.',
    'All real labels may occupy one category; synthetic categories cannot establish real category discrimination.',
    'Single fixed seed and very few participant groups: exploratory comparison, not a stable population estimate.',
  ],folds:[],candidates:{}};
const pooled={mean:[],...Object.fromEntries(candidateNames.map(name=>[name,[]]))},truth=[];
for(const fold of folds) {
  const entry={test_id:fold.testId,validation_id:fold.validationId,train_ids:[...new Set(fold.train.map(s=>s.student_id))],
    counts:{train:fold.train.length,validation:fold.validation.length,test:fold.test.length},results:{}};
  const baseline=fold.train.reduce((sum,s)=>sum+s.y,0)/fold.train.length;
  const y=fold.test.map(s=>s.y);truth.push(...y);pooled.mean.push(...y.map(()=>baseline));
  entry.results.mean=metrics(y,y.map(()=>baseline));
  for(const name of candidateNames) {
    console.log(`Training ${name}: held-out ${fold.testId}`);
    const scaler=fitScaler(name==='small_lstm'?fold.train:[...fold.train,...synthetic]);
    const m=model();
    try {
      if(name==='simulation_pretrained')await fit(m,synthetic,scaler,null,8);
      const training=await fit(m,fold.train,scaler,fold.validation);
      const prediction=await predict(m,fold.test,scaler);pooled[name].push(...prediction);
      entry.results[name]={...metrics(y,prediction),predictions:prediction,...training};
    } finally {m.optimizer.dispose();m.dispose();}
  }
  report.folds.push(entry);write('evaluation.json',report);
}
for(const [name,predictions] of Object.entries(pooled)) report.candidates[name]=metrics(truth,predictions);
for(const name of candidateNames) {
  const epochs=report.folds.map(f=>f.results[name].best_epoch).sort((a,b)=>a-b)[Math.floor(folds.length/2)];
  const scaler=fitScaler(name==='small_lstm'?data.samples:[...data.samples,...synthetic]);
  const m=model();
  try {
    if(name==='simulation_pretrained')await fit(m,synthetic,scaler,null,8);
    await fit(m,data.samples,scaler,null,epochs);
    await save(m,name,scaler);
    report.candidates[name].final_training_epochs=epochs;
    report.candidates[name].final_model_evaluation='Final refit uses all recorded samples; fold metrics belong to separate fold models, not an untouched holdout for this refit.';
  }finally{m.optimizer.dispose();m.dispose();}
}
write('evaluation.json',report);
console.log(JSON.stringify(report.candidates,null,2));
console.log('Candidate models saved separately. Deployed model unchanged.');
