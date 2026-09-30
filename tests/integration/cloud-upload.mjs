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
  '/seal.js': readFileSync('src/game/ml/export-integrity.js'),
};
const server = createServer((req, res) => {
  res.setHeader('Content-Type', sources[req.url] ? 'application/javascript' : 'text/html');
  res.end(sources[req.url] ?? '<!doctype html><title>Upload integration fixture</title>Local synthetic research upload test');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const mf = new Miniflare(convertV4MiniflareOptions({ modules: ['index.js','dataset.js'].map(file => ({type:'ESModule',path:resolve('upload-worker',file)})),
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
    const data = await sealDataset({dataset_version:'v4',session_count:1,sessions:[{student_id:'QA_LOCAL',session_id:'browser',raw_events:[{event:'fixture'}]}]});
    const options = {participant:'QA_LOCAL',session:'browser',config:{url:new URL('/upload',base).href,token:'study'}};
    const first = await uploadDataset(data,options);
    const retry = await uploadDataset(data,options);
    if (!retry.duplicate || retry.key !== first.key) throw Error('Retry did not deduplicate');
    return first;
  },base);
  assert.equal(receipt.ok,true);
  const saved = await mf.dispatchFetch('https://w.dev/admin/file?key='+encodeURIComponent(receipt.key),{headers:{Authorization:'Bearer admin'}});
  const data = await new Response(new Blob([await saved.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  assert.equal(data.sessions[0].student_id,'QA_LOCAL');
  const denied = await page.evaluate(async base => {
    const r = await fetch(new URL('/upload',base), {method:'POST',headers:{'X-Study-Token':'wrong','X-Participant':'QA_LOCAL','X-Session':'browser'},body:'invalid'});
    return r.status;
  },base);
  assert.equal(denied,403);
  console.log('PASS: Chromium real cross-origin preflight, CompressionStream upload, workerd validation, local R2 storage and authenticated readback');
} finally { await browser?.close();await mf.dispose();await new Promise(r=>server.close(r)); }
