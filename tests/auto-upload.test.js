import test from 'node:test';
import assert from 'node:assert/strict';
import {startAutoUpload} from '../src/game/ml/auto-upload.js';
function setup(upload,onError=()=>{}) {
 const windowTarget=new EventTarget(),documentTarget=new EventTarget();documentTarget.visibilityState='hidden';
 let tick,cancelled=false;
 const sync=startAutoUpload({upload,onError,windowTarget,documentTarget,schedule(fn,ms){assert.equal(ms,60000);tick=fn;return 1;},cancel(){cancelled=true;}});
 return {sync,windowTarget,documentTarget,tick:()=>tick(),cancelled:()=>cancelled};
}
test('uploads every minute and avoids overlap during slow requests',async()=>{
 let calls=0,finish;const t=setup(()=>{calls++;return new Promise(r=>finish=r);});
 const first=t.tick();await Promise.resolve();const second=t.tick();assert.equal(calls,1);finish();await Promise.all([first,second]);t.sync.stop();assert(t.cancelled());
});
test('failed upload retries on online and visible events and stops on cleanup',async()=>{
 let calls=0,errors=0;const t=setup(async()=>{calls++;if(calls===1)throw Error('offline');},()=>errors++);
 await t.tick();assert.equal(errors,1);
 t.windowTarget.dispatchEvent(new Event('online'));await t.sync.send();assert.equal(calls,2);
 t.documentTarget.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,2);
 t.documentTarget.visibilityState='visible';t.documentTarget.dispatchEvent(new Event('visibilitychange'));await t.sync.send();assert.equal(calls,3);
 t.sync.stop();t.windowTarget.dispatchEvent(new Event('online'));await t.tick();assert.equal(calls,3);
});

test('challenge updates send immediately and follow an in-flight upload with the newest state',async()=>{
 let state='before',release,active=0,maxActive=0;const sent=[];
 const t=setup(async()=>{active++;maxActive=Math.max(maxActive,active);sent.push(state);if(sent.length===1)await new Promise(r=>release=r);active--;});
 const first=t.tick();await new Promise(r=>setImmediate(r));
 state='scored';const score=t.sync.send({fresh:true});
 state='reward claimed';const reward=t.sync.send({fresh:true});
 release();await Promise.all([first,score,reward]);
 assert.deepEqual(sent,['before','reward claimed']);assert.equal(maxActive,1);
 state='second score';await t.sync.send({fresh:true});
 assert.deepEqual(sent,['before','reward claimed','second score']);t.sync.stop();
});

test('a failed in-flight upload still sends queued challenge data and allows later retries',async()=>{
 let release,calls=0,errors=0;
 const t=setup(async()=>{calls++;if(calls===1){await new Promise(r=>release=r);throw Error('offline');}},()=>errors++);
 const first=t.tick();await new Promise(r=>setImmediate(r));
 const queued=t.sync.send({fresh:true});release();await Promise.all([first,queued]);
 assert.equal(errors,1);assert.equal(calls,2);
 await t.tick();assert.equal(calls,3);t.sync.stop();
});

test('stopping the upload scheduler cancels queued challenge sends',async()=>{
 let release,calls=0;const t=setup(async()=>{calls++;await new Promise(r=>release=r);});
 const first=t.tick();await new Promise(r=>setImmediate(r));
 t.sync.send({fresh:true});t.sync.stop();release();await first;assert.equal(calls,1);
});
