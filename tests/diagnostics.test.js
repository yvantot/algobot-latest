import test from 'node:test';
import assert from 'node:assert/strict';
import {createErrorReporter,startErrorReporting} from '../src/game/diagnostics.js';
import worker from '../upload-worker/index.js';
import {normalizeErrors} from '../upload-worker/logs.js';
import {fakeEnv} from './helpers/upload-fixture.js';
const config={url:'https://upload.algobot.fun/upload',token:'SECRET_TOKEN'};
const tick=()=>new Promise(r=>setImmediate(r));
function setup(extra={}){let clock=0,id=0;const sent=[];const stored=new Map();const storage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};const reporter=createErrorReporter({config,storage,now:()=>clock,uuid:()=>`r${++id}`,context:()=>({participant:'P017',session:'s1',build:'build1'}),fetchImpl:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true};},...extra});return {reporter,sent,storage,advance:ms=>clock+=ms};}
test('browser reports redact sensitive strings, retain identity and deduplicate',async()=>{
 const {reporter,sent}=setup();const error=Error('Request https://algobot.fun/?token=abc failed SECRET_TOKEN for a@b.com');
 reporter.report('javascript',error);reporter.report('javascript',error);await tick();
 assert.equal(sent.length,1);assert.equal(sent[0].participant,'P017');assert.equal(sent[0].build,'build1');
 assert.doesNotMatch(JSON.stringify(sent),/SECRET_TOKEN|token=abc|a@b.com/);
});
test('failed delivery persists across reload and preserves original participant',async()=>{
 const first=setup({fetchImpl:async()=>{throw Error('offline')}});first.reporter.report('save_load',Error('Quota exceeded'));await tick();
 assert.equal(first.reporter.pendingCount(),1);
 const sent=[];const next=createErrorReporter({config,storage:first.storage,context:()=>({participant:'P999'}),fetchImpl:async(u,o)=>{sent.push(JSON.parse(o.body));return {ok:true};}});
 await next.flush();assert.equal(sent[0].participant,'P017');assert.equal(next.pendingCount(),0);
});
test('full storage falls back to memory and repeated failures respect retry cooldown',async()=>{
 let attempts=0;const {reporter,advance}=setup({storage:{getItem(){throw Error('denied')},setItem(){throw Error('quota')}},fetchImpl:async()=>{attempts++;throw Error('offline')}});
 reporter.report('upload',Error('network'));await tick();await reporter.flush();assert.equal(attempts,1);
 advance(60000);await reporter.flush();assert.equal(attempts,2);assert.equal(reporter.pendingCount(),1);
});
test('reporting caps unique errors and never overlaps deliveries',async()=>{
 let resolve;const {reporter}=setup({fetchImpl:()=>new Promise(r=>resolve=r)});
 for(let i=0;i<40;i++)reporter.report('promise',Error('error '+i));
 assert.equal(reporter.pendingCount(),10);resolve({ok:true});await tick();assert.equal(reporter.pendingCount(),9);
});
test('global listeners report without suppressing browser errors and clean up',async()=>{
 const target=new EventTarget(),sent=[];const stop=startErrorReporting({target,config,fetchImpl:async(u,o)=>{sent.push(JSON.parse(o.body));return {ok:true};}});
 try{const event=new Event('error',{cancelable:true});event.message='Synthetic failure';target.dispatchEvent(event);await tick();assert.equal(sent[0].kind,'javascript');assert.equal(event.defaultPrevented,false);}finally{stop();}
});
const payload={id:'report1',kind:'save_load',timestamp:'2026-10-02T00:00:00Z',participant:'P017',session:'s1',build:'build1',message:'Quota exceeded',stack:''};
const request=(body,token='study',origin='https://algobot.fun')=>new Request('https://upload.algobot.fun/errors',{method:'POST',headers:{'X-Study-Token':token,Origin:origin},body});
test('diagnostic endpoint authenticates, bounds streaming bodies, and never changes R2',async()=>{
 const env=fakeEnv();let log;const original=console.error;console.error=value=>{log=value};
 try{
 assert.equal((await worker.fetch(request(JSON.stringify(payload)),env)).status,200);
 assert.equal(log.event,'game_client_error');assert.equal(log.participant_code,'P017');assert.equal(env.store.size,0);
 assert.equal((await worker.fetch(request('{}','bad'),env)).status,403);
 assert.equal((await worker.fetch(request('{}','study','https://evil.test'),env)).status,403);
 assert.equal((await worker.fetch(request('x'.repeat(8193)),env)).status,413);
 assert.equal((await worker.fetch(request('malformed'),env)).status,400);
 }finally{console.error=original;}
});
test('dashboard includes sanitized browser reports and deduplicates retries by report ID',()=>{
 const event={timestamp:123,$metadata:{requestId:'request1'},source:{event:'game_client_error',report_id:'report1',kind:'challenge',occurred_at:payload.timestamp,participant_code:'P017',session_id:'s1',build:'build1',message:'Save failed',stack:'at https://algobot.fun/app.js?token=secret'}};
 const rows=normalizeErrors([event,{...event,$metadata:{requestId:'retry'}}]);assert.equal(rows.length,1);assert.equal(rows[0].participant,'P017');assert.match(rows[0].reason,/Game challenge/);assert.doesNotMatch(rows[0].stack,/secret/);
});
