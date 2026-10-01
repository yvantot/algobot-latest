import test from "node:test";
import assert from "node:assert/strict";
import worker from "../upload-worker/index.js";
import { sealDataset } from "../src/game/ml/export-integrity.js";
import { decodeUpload } from "../upload-worker/dataset.js";
import { dataset, zipped, fakeEnv, request } from "./helpers/upload-fixture.js";

const send = async (env, data, session = "s-1", participant = "P001") => worker.fetch(request(await zipped(data), { "X-Session": session, "X-Participant": participant }), env);
const read = async env => (await decodeUpload([...env.store.values()][0])).data;
const seal = sessions => sealDataset({ dataset_version: "v4", session_count: sessions.length, sessions });

test("last upload replaces all previous sessions and history regardless of revision", async () => {
  const env = fakeEnv();
  await send(env, await seal([...(await dataset([1, 2, 3])).sessions, ...(await dataset([4], 'P001', 'other')).sessions]));
  const latest = await dataset([99]);
  assert.equal((await send(env, latest)).status, 200);
  assert.deepEqual(await read(env), latest);
  assert.equal(env.store.size, 1);
});

test("single participant upload is stored byte for byte without reading existing storage", async () => {
  const env = fakeEnv(), body = await zipped();
  env.DATA.get = async () => { throw Error('Upload must not read storage'); };
  const put = env.DATA.put; let writes = 0;
  env.DATA.put = async (key, bytes, options) => {
    assert.equal(options.onlyIf, undefined); writes++;
    return put(key, bytes, options);
  };
  for (let i = 0; i < 2; i++) assert.equal((await worker.fetch(request(body), env)).status, 200);
  assert.equal(writes, 2);
  assert.deepEqual([...env.store.values()][0], new Uint8Array(body));
});

test("participant files exclude other students and retain valid checksums and challenge records", async () => {
  const env = fakeEnv();
  const a = (await dataset()).sessions[0], b = (await dataset([2], 'P002', 's-2')).sessions[0];
  a.challenge_attempts = [{assessment_id:'a',status:'scored',score:3,reward_claimed:true}];
  const mixed = await seal([a, b]);
  assert.equal((await send(env, mixed)).status, 200);
  const stored = await read(env);
  assert.deepEqual(stored.sessions, [a]);
  assert.equal(stored.participant_count, 1);
  assert.equal(stored.session_count, 1);
  await send(env, mixed, 's-2', 'P002');
  assert.equal(env.store.size, 2);
  assert.deepEqual((await decodeUpload(env.store.get('round3/P002/data.json.gz'))).data.sessions, [b]);
});

test("valid upload replaces corrupt old bytes", async () => {
  const env = fakeEnv(), data = await dataset();
  env.store.set('round3/P001/data.json.gz', new TextEncoder().encode('corrupt'));
  assert.equal((await send(env, data)).status, 200);
  assert.deepEqual(await read(env), data);
});

test("invalid incoming checksum leaves the previous file untouched", async () => {
  const env = fakeEnv(), data = await dataset();
  await send(env, data); const previous = [...env.store.values()][0];
  data.sessions[0].raw_events.push(999);
  assert.equal((await send(env, data)).status, 400);
  assert.equal([...env.store.values()][0], previous);
});

test("storage failure cannot return a successful receipt", async () => {
  const env = fakeEnv();
  env.DATA.put = async () => { throw Error('R2 unavailable'); };
  assert.equal((await send(env, await dataset())).status, 503);
});

test("participant identity is logged before body decoding or storage", async t => {
  const logs = []; t.mock.method(console, 'info', entry => logs.push(entry));
  const env = fakeEnv();
  env.DATA.put = async () => { assert.equal(logs[0].participant_code, 'P001'); return {}; };
  await send(env, await dataset());
  assert.equal(logs[0].event, 'research_upload_started');
  assert.equal(logs[0].session_id, 's-1');
});
