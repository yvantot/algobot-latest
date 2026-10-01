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
