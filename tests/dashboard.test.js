import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../upload-worker/index.js';
import { normalizeErrors, readErrors } from '../upload-worker/logs.js';
import { fakeEnv } from './helpers/upload-fixture.js';
const request = (path, authorized = true) => new Request('https://data.algobot.fun' + path, {headers: authorized ? {Authorization:'Bearer admin'} : {}});
test('dashboard assets contain no credentials and enforce browser security policy', async () => {
 for (const path of ['/', '/dashboard.js', '/dashboard.css']) {
  const response = await worker.fetch(request(path, false), fakeEnv());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
 }
});
test('every collection API requires admin authentication and disables caching', async () => {
 for (const path of ['/admin/list', '/admin/file?key=x', '/admin/errors']) {
  const response = await worker.fetch(request(path, false), fakeEnv());
  assert.equal(response.status,403);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
test('authenticated collection reads and downloads raw files', async () => {
 const env=fakeEnv();env.store.set('round3/P001/data.json.gz',new Uint8Array([1,2,3]));
 const list=await(await worker.fetch(request('/admin/list'),env)).json();
 assert.equal(list.objects[0].size,3);
 const download=await worker.fetch(request('/admin/file?key=round3/P001/data.json.gz'),env);
 assert.deepEqual([...new Uint8Array(await download.arrayBuffer())],[1,2,3]);
 assert.equal((await worker.fetch(request('/admin/file?key=missing'),env)).status,404);
});
test('storage and missing log configuration errors are explicit and sanitized', async () => {
 const env=fakeEnv();env.DATA.list=()=>{throw Error('secret detail')};
 const response=await worker.fetch(request('/admin/list'),env);
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/secret detail/);
 assert.equal((await worker.fetch(request('/admin/errors'),env)).status,503);
});
test('log normalization retains participant and deduplicates failures without exposing raw metadata',()=>{
 const platform={timestamp:123,$metadata:{requestId:'r1'},$workers:{outcome:'exceededCpu',event:{request:{headers:{'x-participant':'P017','x-study-token':'SECRET'}}}}};
 const app={timestamp:124,$metadata:{requestId:'r2'},source:{event:'research_upload_failed',participant_code:'P001',status:503,reason:'storage_unavailable',message:'SECRET'}};
 const result=normalizeErrors([platform,platform,app,{timestamp:125,source:{event:'research_upload_stored'}}]);
 assert.equal(result.length,2);assert.equal(result[1].participant,'P017');assert.equal(result[0].reason,'storage_unavailable');assert.doesNotMatch(JSON.stringify(result),/SECRET/);
});
test('log queries are bounded, scoped and sanitize upstream errors',async()=>{
 const env={OBSERVABILITY_TOKEN:'SECRET',CLOUDFLARE_ACCOUNT_ID:'account'};
 let body;
 const good=await readErrors(env,'999',async(url,options)=>{body=JSON.parse(options.body);return Response.json({success:true,result:{events:{events:[]}}});});
 assert.equal(good.status,200);assert.equal(body.limit,500);assert.equal(body.timeframe.to-body.timeframe.from,86400000);assert.equal(body.parameters.filters[0].value,'algobot-upload');
 const bad=await readErrors(env,1,async()=>Response.json({error:'SECRET'},{status:403}));
 assert.equal(bad.status,503);assert.doesNotMatch(await bad.text(),/SECRET/);
});
