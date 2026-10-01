import test from "node:test";
import assert from "node:assert/strict";
import worker from "../upload-worker/index.js";
import { fakeEnv, request, zipped } from "./helpers/upload-fixture.js";
const body = await zipped();
const upload = (headers, bytes = body) => request(bytes, headers);

test("stores an upload under one stable player key", async () => {
  const env = fakeEnv();
  const response = await worker.fetch(upload({}), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://algobot.fun");
  assert.equal([...env.store.keys()][0], "round3/P001/data.json.gz");
});

test("rejects a wrong token, unsafe IDs and empty bodies", async () => {
  const env = fakeEnv();
  assert.equal((await worker.fetch(upload({ "X-Study-Token": "nope" }), env)).status, 403);
  assert.equal((await worker.fetch(upload({ "X-Participant": "../P1" }), env)).status, 400);
  assert.equal((await worker.fetch(upload({}, ""), env)).status, 413);
  assert.equal(env.store.size, 0);
});

test("reading data requires the admin token, not the study token", async () => {
  const env = fakeEnv();
  await worker.fetch(upload({}), env);
  const list = auth => worker.fetch(new Request("https://w.dev/admin/list?prefix=round3/", { headers: { Authorization: `Bearer ${auth}` } }), env);
  assert.equal((await list("study")).status, 403);
  const { objects } = await (await list("admin")).json();
  assert.deepEqual(objects.map(o => o.key), [...env.store.keys()]);
  const file = await worker.fetch(new Request(`https://w.dev/admin/file?key=${encodeURIComponent(objects[0].key)}`, { headers: { Authorization: "Bearer admin" } }), env);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), env.store.get(objects[0].key));
});

test("answers the browser's CORS preflight for each game address", async () => {
  const preflight = origin => worker.fetch(new Request("https://w.dev/upload", { method: "OPTIONS", headers: { Origin: origin } }), fakeEnv());
  assert.equal((await preflight("https://www.algobot.fun")).headers.get("Access-Control-Allow-Origin"), "https://www.algobot.fun");
  const denied = await preflight("https://evil.example");
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  const response = await preflight("https://algobot.fun");
  assert.equal(response.status, 204);
  assert.match(response.headers.get("Access-Control-Allow-Headers"), /X-Study-Token/);
});


test("upload failures log searchable identity and safe reasons without data or credentials",async t=>{
 const logs=[];t.mock.method(console,'error',entry=>logs.push(entry));
 await worker.fetch(upload({'X-Participant':'P017','X-Study-Token':'private-token'}),fakeEnv());
 assert.equal(logs[0].participant_code,'P017');assert.equal(logs[0].session_id,'s-1');
 assert.equal(logs[0].status,403);assert.equal(logs[0].reason,'invalid_upload_token');
 assert.equal(logs[0].event,'research_upload_failed');
 await worker.fetch(upload({'X-Participant':'../unsafe'},'private-gameplay-body'),fakeEnv());
 assert.equal(logs[1].participant_code,null);assert.equal(logs[1].reason,'invalid_identity');
 await worker.fetch(upload({},'private-gameplay-body'),fakeEnv());assert.equal(logs[2].reason,'invalid_dataset');
 const env=fakeEnv();env.DATA.put=async()=>{throw Error('secret internal failure');};
 await worker.fetch(upload({}),env);assert.equal(logs[3].reason,'storage_unavailable');
 await worker.fetch(upload({Origin:'https://untrusted.example'}),fakeEnv());assert.equal(logs[4].reason,'origin_not_allowed');
 assert(!/private-token|private-gameplay-body|secret internal|untrusted.example/.test(JSON.stringify(logs)));
 assert(logs.every(entry=>Number.isFinite(Date.parse(entry.timestamp))));
 const count=logs.length;await worker.fetch(upload({}),fakeEnv());assert.equal(logs.length,count);
});
