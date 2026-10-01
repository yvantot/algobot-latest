import test from "node:test";
import assert from "node:assert/strict";
import worker from "../upload-worker/index.js";
import { sealDataset } from "../src/game/ml/export-integrity.js";
import { decodeUpload, MAX_DATASET_BYTES } from "../upload-worker/dataset.js";
import { dataset, zipped, fakeEnv, request } from "./helpers/upload-fixture.js";

const send = async (env, data, session = "s-1", participant = "P001") => worker.fetch(request(await zipped(data), { "X-Session": session, "X-Participant": participant }), env);
const read = async env => (await decodeUpload([...env.store.values()][0])).data;
const seal = sessions => sealDataset({ dataset_version: "v4", session_count: sessions.length, sessions });
const changed = async (data, fields) => seal([{ ...data.sessions[0], ...fields }]);

test("concurrent distinct sessions merge into one archive without losing either history", async () => {
  const env = fakeEnv();
  const data = await Promise.all(Array.from({ length: 6 }, (_, i) => dataset([i], "P001", `s-${i}`)));
  const responses = await Promise.all(data.map((d, i) => send(env, d, `s-${i}`)));
  assert(responses.every(r => r.status === 200));
  assert.equal(env.store.size, 1);
  assert.equal((await read(env)).session_count, 6);
});

test("a client missing archived sessions cannot remove them", async () => {
  const env = fakeEnv();
  await send(env, await dataset([1]));
  await send(env, await dataset([2], "P001", "other"), "other");
  assert.equal((await read(env)).session_count, 2);
});

test("participant archives exclude other students on a shared browser and remain isolated", async () => {
  const env = fakeEnv();
  const a = await dataset(), b = await dataset([2], "P002", "s-2");
  const mixed = await seal([...a.sessions, ...b.sessions]);
  await send(env, mixed);
  assert.deepEqual((await read(env)).sessions.map(s => s.student_id), ["P001"]);
  await send(env, mixed, "s-2", "P002");
  assert.equal(env.store.size, 2);
  assert.equal((await decodeUpload(env.store.get("round3/P002/data.json.gz"))).data.sessions[0].student_id, "P002");
});

test("new export IDs, timestamps and unchanged higher revisions do not rewrite player data", async () => {
  const env = fakeEnv(), data = await dataset();
  await send(env, data); const before = [...env.store.values()][0];
  const response = await send(env, await changed(data, { export_date: new Date().toISOString(), upload_revision: 99 }));
  assert.equal((await response.json()).duplicate, true);
  assert.equal([...env.store.values()][0], before);
});

test("equal conflicting revisions and higher revisions that drop history preserve the archive", async () => {
  const env = fakeEnv(), data = await dataset([1, 2]);
  await send(env, data); const before = [...env.store.values()][0];
  for (const fields of [{ raw_events: [1, 99] }, { raw_events: [1], upload_revision: 3 }]) {
    assert.equal((await send(env, await changed(data, fields))).status, 409);
    assert.equal([...env.store.values()][0], before);
  }
});

test("session end, completed quests and claimed assessments cannot be rolled back", async () => {
  for (const [field, before, after] of [
    ["end_time", "2026-09-30T00:00:00Z", null],
    ["quest_attempts", [{quest_key:"q", completed:true}], [{quest_key:"q", completed:false}]],
    ["challenge_attempts", [{assessment_id:"a",status:"completed",reward_claimed:true}], [{assessment_id:"a",status:"in_progress"}]],
  ]) {
    const env = fakeEnv(), data = await changed(await dataset(), { [field]: before });
    await send(env, data);
    assert.equal((await send(env, await changed(data, { [field]: after, upload_revision: 2 }))).status, 409);
    assert.deepEqual((await read(env)).sessions[0][field], before);
  }
});

test("legacy clients update the same archive and late retries cannot replace newer history", async () => {
  const env = fakeEnv(), data = await dataset();
  const old = await changed(data, { upload_revision: undefined, export_date: "2026-09-30T00:00:00Z" });
  const next = await changed(old, { raw_events: [1, 2], export_date: "2026-09-30T00:01:00Z" });
  assert.equal((await send(env, old)).status, 200);
  assert.equal((await send(env, next)).status, 200);
  assert.equal((await send(env, old)).status, 200);
  assert.deepEqual((await read(env)).sessions[0].raw_events, [1, 2]);
});

test("scored challenge provenance, submissions and QA exclusions cannot disappear", async () => {
  const env = fakeEnv();
  const attempt = {assessment_id:"a",task_id:"first-harvest-v1",status:"scored",score:2,max_score:3,
    submissions:[{score:2,source:"bot.harvest();"}]};
  const data = await changed(await dataset(), {source_type:"developer_test",research_exclusion_reasons:["QA"],challenge_attempts:[attempt]});
  await send(env, data);
  for (const fields of [
    {challenge_attempts:[{...attempt,submissions:[]}]},
    {challenge_attempts:[{...attempt,score:3}]},
    {challenge_attempts:[{...attempt,task_id:"different-task"}]},
    {source_type:"recorded"}, {research_exclusion_reasons:[]},
  ]) assert.equal((await send(env, await changed(data, {...fields,upload_revision:2}))).status,409);
});

test("legacy records without IDs deduplicate by content", async () => {
  const env = fakeEnv(), data = await dataset();
  const mixed = await seal([...data.sessions, {student_id:"P001",session_id:null,raw_events:[]}]);
  await send(env, mixed); await send(env, mixed);
  assert.equal((await read(env)).session_count, 2);
});

test("corrupt stored data fails closed and is never overwritten", async () => {
  const env = fakeEnv(), body = new TextEncoder().encode("corrupt");
  env.store.set("round3/P001/data.json.gz", body);
  assert.equal((await send(env, await dataset())).status, 503);
  assert.equal([...env.store.values()][0], body);
});

test("conditional write contention returns a retryable failure after bounded attempts", async () => {
  const env = fakeEnv(); let calls = 0;
  env.DATA.put = async () => { calls++; return null; };
  assert.equal((await send(env, await dataset())).status, 503);
  assert.equal(calls, 8);
});

test("combined archive size is bounded even when each individual upload fits", async () => {
  const env = fakeEnv();
  const a = await dataset(["a".repeat(Math.ceil(MAX_DATASET_BYTES / 2))]);
  const b = await dataset(["b".repeat(Math.ceil(MAX_DATASET_BYTES / 2))], "P001", "s-2");
  assert.equal((await send(env, a)).status, 200);
  const before = [...env.store.values()][0];
  assert.equal((await send(env, b, "s-2")).status, 413);
  assert.equal([...env.store.values()][0], before);
});


test("legacy duplicate collapse can extend history without dropping the archived events", async()=>{
 const env=fakeEnv(), event={t:10,event:'code_edit'}, later={t:11,event:'code_edit'};
 const old=await dataset([event,event,later]);await send(env,old);
 const next=await changed(old,{upload_revision:4,raw_events:[event,later,{t:12,event:'code_run'}]});
 assert.equal((await send(env,next)).status,200);
 assert.deepEqual((await read(env)).sessions[0].raw_events,[event,event,later,{t:12,event:'code_run'}]);
 assert.equal((await send(env,next)).status,200,'identical retry remains idempotent');
 for(const events of [[{...event,t:9},later],[later,event],[event,{...later,event:'harvest'}]]){
  assert.equal((await send(env,await changed(old,{upload_revision:5,raw_events:events}))).status,409);
 }
});
