import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function rng(seed) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
const vector = v => Array.isArray(v) && v.length === 10 && v.every(Number.isFinite);
const time = v => typeof v === 'number' ? v : Date.parse(v);
const attempts = s => Object.entries(s.questAttempts ?? s.quest_attempts ?? {}).map(([key, a]) => ({quest_key: key, ...a}));
const label = a => a.proficiencyLabel ?? a.proficiency_label;

export function recoverSamples(directory) {
  const sessions = new Map(), hashes = {};
  for (const name of fs.readdirSync(directory).sort().filter(n => n.endsWith('.json') && !n.includes('replay'))) {
    const bytes = fs.readFileSync(path.join(directory, name));
    hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
    const file = JSON.parse(bytes.toString().replace(/^\uFEFF/, ''));
    for (const session of file.sessions ?? [file]) {
      const id = session.session_id ?? session.sessionId ?? session.summary?.sessionId;
      if (!id) continue;
      const score = attempts(session).filter(a => Number.isFinite(label(a))).length;
      if (!sessions.has(id) || score > sessions.get(id).score) sessions.set(id, {session, score});
    }
  }
  const samples = [];
  for (const [session_id, {session}] of sessions) {
    const student_id = session.student_id ?? session.summary?.participantId;
    if (!student_id || /^(unknown|anonymous)$/i.test(student_id)) continue;
    const records = attempts(session);
    const endVectors = records.map(a => ({t: time(a.endTime ?? a.end_time), v: a.featureVectorAtEnd ?? a.feature_vector_end})).filter(a => Number.isFinite(a.t) && vector(a.v));
    const sessionStart = time(session.start_time ?? session.summary?.startTime);
    const timed = (session.feature_timeseries ?? session.featureSnapshots ?? []).filter(s => !Array.isArray(s)).map(s => ({
      t: s.timestamp_ms ?? (Number.isFinite(s.t) ? sessionStart + s.t : NaN), v: s.vector,
    })).filter(s => Number.isFinite(s.t) && vector(s.v));
    for (const a of records) {
      const y = label(a), end = time(a.endTime ?? a.end_time);
      if (!Number.isFinite(y) || y < 0 || y > 1 || !Number.isFinite(end)) continue;
      const source = timed.length ? timed : endVectors;
      const observed = source.filter(s => s.t <= end).sort((a,b) => a.t-b.t).slice(-20).map(s => s.v);
      if (!observed.length) continue;
      samples.push({source_type:'recorded', student_id, session_id, quest_key:a.quest_key,
        sequence_source:timed.length ? 'timestamped_snapshots' : 'legacy_quest_end_vectors',
        real_timesteps:observed.length, y,
        x:[...Array.from({length:20-observed.length},()=>Array(10).fill(0)), ...observed]});
    }
  }
  return {samples, source_sha256:hashes, unique_sessions:sessions.size};
}

export function simulateSamples(count = 240, seed = 42) {
  const random = rng(seed), samples = [];
  for (let i=0; i<count; i++) {
    const skill = (i % 3 + random()) / 3;
    let errors=0, resets=0, hints=0, runs=0, successes=0, loops=0, conditions=0;
    const x=[];
    for (let t=0;t<20;t++) {
      runs++;
      if (random() < skill) successes++; else { errors++; if(random()<.55) resets++; }
      if(random()>(.7+.3*skill)) hints++;
      if(random()<skill*.3) loops++;
      if(random()<skill*.3) conditions++;
      const frustration=(errors>5?.3:0)+(resets>3?.3:0);
      x.push([Math.min(1,errors/10),Math.min(1,runs/((t+1)/2)/200),Math.min(1,loops/5),Math.min(1,conditions/10),0,0,
        frustration,successes/runs,Math.min(1,hints/10),Math.min(1,(t+1)*30/240)]);
    }
    const completed = successes >= 10;
    const y=.4*Number(completed)+.25*(1-Math.min(1,errors/10))+.2*(1-Math.min(1,resets/5))+.15*(1-Math.min(1,hints/5));
    samples.push({source_type:'synthetic', scenario_id:`simulation-${seed}-${i}`, generator:'counter-scenarios-v1',
      label_source:'simulated_gameplay_formula', independent_student_evidence:false, x, y});
  }
  return samples;
}

export function participantFolds(samples) {
  if(samples.some(s=>s.source_type!=='recorded')) throw Error('Evaluation accepts recorded samples only');
  const ids=[...new Set(samples.map(s=>s.student_id))].sort();
  if(ids.length<3) throw Error('At least three recorded participant IDs are required');
  return ids.map((testId,i)=>({testId,validationId:ids[(i+1)%ids.length],
    test:samples.filter(s=>s.student_id===testId),
    validation:samples.filter(s=>s.student_id===ids[(i+1)%ids.length]),
    train:samples.filter(s=>s.student_id!==testId && s.student_id!==ids[(i+1)%ids.length])}));
}

export function fitScaler(samples) {
  const min=Array(10).fill(Infinity), max=Array(10).fill(-Infinity);
  for(const s of samples) for(const row of s.x) row.forEach((v,i)=>{min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v);});
  return {feature_min:min,feature_max:max,feature_range:max.map((v,i)=>v-min[i] || 1)};
}
export const normalize = (samples,scaler) => samples.map(s=>s.x.map(row=>row.map((v,i)=>(v-scaler.feature_min[i])/scaler.feature_range[i])));
export function metrics(truth,predictions) {
  const mean=truth.reduce((a,b)=>a+b,0)/truth.length;
  const mse=truth.reduce((sum,y,i)=>sum+(y-predictions[i])**2,0)/truth.length;
  const variance=truth.reduce((sum,y)=>sum+(y-mean)**2,0)/truth.length;
  const category=v=>v<.3?0:v<.6?1:2;
  const confusion=Array.from({length:3},()=>[0,0,0]);
  truth.forEach((y,i)=>confusion[category(y)][category(predictions[i])]++);
  const perClass=confusion.map((row,c)=>{
    const support=row.reduce((a,b)=>a+b,0), predicted=confusion.reduce((sum,r)=>sum+r[c],0), tp=row[c];
    return {support,precision:predicted?tp/predicted:null,recall:support?tp/support:null,f1:support+predicted?2*tp/(support+predicted):null};
  });
  return {n:truth.length,rmse:Math.sqrt(mse),mae:truth.reduce((sum,y,i)=>sum+Math.abs(y-predictions[i]),0)/truth.length,
    r2:variance?1-mse/variance:null,accuracy:confusion.reduce((sum,row,i)=>sum+row[i],0)/truth.length,confusion_matrix:confusion,
    per_class:perClass,macro_f1:perClass.reduce((sum,c)=>sum+(c.f1??0),0)/3};
}
