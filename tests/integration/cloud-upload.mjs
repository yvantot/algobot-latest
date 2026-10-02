import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
// Use the local runtime shipped with our declared Wrangler dependency.
const { Miniflare, convertV4MiniflareOptions } = createRequire(import.meta.resolve('wrangler'))('miniflare');
const sources = {
  '/client.js': readFileSync('src/game/ml/cloud-upload.js'),
  '/diagnostics.js': readFileSync('src/game/diagnostics.js'),
  '/upload-worker/error-format.js': readFileSync('upload-worker/error-format.js'),
  '/seal.js': readFileSync('src/game/ml/export-integrity.js'),
};
const server = createServer((req, res) => {
  res.setHeader('Content-Type', sources[req.url] ? 'application/javascript' : 'text/html');
  res.end(sources[req.url] ?? '<!doctype html><title>Upload integration fixture</title>Local synthetic research upload test');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const mf = new Miniflare(convertV4MiniflareOptions({ modules: ['index.js', 'dashboard.js', 'logs.js', 'client-errors.js', 'error-format.js'].map(file => ({type:'ESModule',path:resolve('upload-worker',file)})),
  compatibilityDate:'2026-09-01',r2Buckets:['DATA'],bindings:{ROUND:'fixture',STUDY_TOKEN:'study',ADMIN_TOKEN:'admin',ALLOWED_ORIGINS:origin} }));
let browser;
try {
  const base = String(await mf.ready);
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.goto(origin);
  const receipt = await page.evaluate(async base => {
    const {uploadDataset} = await import('/client.js');
    const {sealDataset} = await import('/seal.js');
    const data = await sealDataset({dataset_version:'v4',session_count:1,sessions:[{student_id:'QA_LOCAL',session_id:'browser',upload_revision:1,raw_events:[{event:'fixture'}]}]});
    const options = {participant:'QA_LOCAL',session:'browser',config:{url:new URL('/upload',base).href,token:'study'}};
    const first = await uploadDataset(data,options);
    const retry = await uploadDataset(data,options);
    if (!retry.ok || retry.key !== first.key) throw Error('Retry did not replace the same key');
    await Promise.all(Array.from({length:4}, async (_,i) => {
      const session='parallel-'+i;
      const other=await sealDataset({dataset_version:'v4',session_count:1,sessions:[{student_id:'QA_LOCAL',session_id:session,upload_revision:1,raw_events:[{event:session}]}]});
      return uploadDataset(other,{...options,session});
    }));
    const newer=await sealDataset({...data,sessions:[{...data.sessions[0],upload_revision:2,raw_events:[{event:'fixture'},{event:'updated'}]}]});
    await uploadDataset(newer,options);
    await uploadDataset(data,options);
    return first;
  },base);
  assert.equal(receipt.ok,true);
  const diagnosticStatus = await page.evaluate(async base => {
    const {startErrorReporting} = await import('/diagnostics.js');
    let resolve; const sent = new Promise(r=>resolve=r);
    const stop = startErrorReporting({target:window,config:{url:base+'/upload',token:'study'},context:()=>({participant:'QA_LOCAL',session:'browser',build:'integration'}),fetchImpl:async(url,options)=>{
      const response=await fetch(url,options);resolve(response.status);return response;
    }});
    try { window.dispatchEvent(new ErrorEvent('error',{message:'Synthetic diagnostic integration test'}));return await sent; }
    finally {stop();}
  },base);
  assert.equal(diagnosticStatus,200);
  console.log('PASS: Chromium global error listener sends diagnostic through real Worker CORS endpoint');
  const saved = await mf.dispatchFetch('https://w.dev/admin/file?key='+encodeURIComponent(receipt.key),{headers:{Authorization:'Bearer admin'}});
  const data = await new Response(new Blob([await saved.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  assert.equal(data.sessions[0].student_id,'QA_LOCAL');
  assert.equal(data.session_count,1);
  assert.equal(data.sessions.find(s=>s.session_id==='browser').raw_events.length,1);
  for (const raw of ['not valid gzip or JSON', '']) {
    const status = await page.evaluate(async ({base, raw}) => (await fetch(new URL('/upload',base), {
      method:'POST',headers:{'X-Study-Token':'study','X-Participant':'QA_LOCAL','X-Session':'browser'},body:raw,
    })).status, {base, raw});
    assert.equal(status,200);
    const stored = await mf.dispatchFetch('https://w.dev/admin/file?key='+encodeURIComponent(receipt.key),{headers:{Authorization:'Bearer admin'}});
    assert.equal(await stored.text(),raw);
  }
  const listing=await mf.dispatchFetch('https://w.dev/admin/list',{headers:{Authorization:'Bearer admin'}});
  assert.equal((await listing.json()).objects.length,1);
  const denied = await page.evaluate(async base => {
    const r = await fetch(new URL('/upload',base), {method:'POST',headers:{'X-Study-Token':'wrong','X-Participant':'QA_LOCAL','X-Session':'browser'},body:'invalid'});
    return r.status;
  },base);
  assert.equal(denied,403);
  await page.goto(base);
  await page.getByLabel('Administrator key').fill('wrong');
  await page.getByRole('button', {name:'Open collection'}).click();
  await page.getByText('Administrator key was not accepted.').waitFor();
  await page.getByLabel('Administrator key').fill('admin');
  await page.getByRole('button', {name:'Open collection'}).click();
  await page.getByRole('button', {name:'Sign out'}).waitFor();
  await page.getByLabel('Include QA tests').check();
  await page.getByRole('cell', {name:'QA_LOCAL',exact:true}).waitFor();
  await page.getByLabel('Participant or file').fill('missing');
  await page.getByText('No datasets match these filters.').waitFor();
  await page.getByLabel('Participant or file').fill('QA_LOCAL');
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download fixture/QA_LOCAL/data.json.gz',exact:true}).click();
  assert.equal((await downloadEvent).suggestedFilename(),'fixture_QA_LOCAL_data.json.gz');
  await page.getByRole('button',{name:'Game & upload errors',exact:true}).click();
  await page.getByText('Live logs are not connected.',{exact:false}).waitFor();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.getByLabel('Administrator key').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  console.log('PASS: dashboard login, filters, download, missing-log state, mobile overflow, signout and no stored credentials');
  console.log('PASS: Chromium preflight/gzip, raw streaming including malformed and empty data, last upload replaces storage, authenticated readback');
} finally { await browser?.close();await mf.dispose();await new Promise(r=>server.close(r)); }
