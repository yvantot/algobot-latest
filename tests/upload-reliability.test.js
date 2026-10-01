import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadDataset } from "../src/game/ml/cloud-upload.js";
import worker from "../upload-worker/index.js";
import { MAX_DATASET_BYTES, readLimited } from "../upload-worker/dataset.js";
import { pullData } from "../scripts/pull-data.js";
import { dataset, zipped, fakeEnv, request } from "./helpers/upload-fixture.js";

const config = { url: "https://w.dev/upload", token: "study" };
test("a delayed retry replaces the stored file under last-write-wins semantics", async () => {
  const env = fakeEnv();
  let release, started, calls = 0;
  const waiting = new Promise(r => started = r), gate = new Promise(r => release = r);
  const old = uploadDataset(await dataset([1]), { participant: "P001", session: "s-1", config,
    fetchImpl: async (url, init) => {
      const response = await worker.fetch(new Request(url, init), env);
      if (++calls === 1) throw Error("lost acknowledgement");
      return response;
    }, wait: async () => { started(); await gate; } });
  await waiting;
  await uploadDataset(await dataset([1, 2, 3]), { participant: "P001", session: "s-1", config,
    fetchImpl: (url, init) => worker.fetch(new Request(url, init), env) });
  release(); await old;
  assert.equal(env.store.size, 1);
  assert.deepEqual([...env.store.values()].map(v => JSON.parse(gunzipSync(v)).sessions[0].raw_events.length), [1]);
});

test("simultaneous identical uploads update one player object", async () => {
  const env = fakeEnv(), body = await zipped();
  const receipts = await Promise.all(Array.from({ length: 5 }, async () => (await worker.fetch(request(body), env)).json()));
  assert.equal(env.store.size, 1);
  assert(receipts.every(r => r.ok && !r.duplicate));
});

test("Worker stores malformed gzip, JSON, schema, checksum and mismatched payload identity unchanged", async () => {
  const env = fakeEnv(), data = await dataset();
  const edited = structuredClone(data); edited.sessions[0].raw_events.push(999);
  for (const bytes of [new TextEncoder().encode("plain text"), gzipSync("{"), gzipSync("{}"), await zipped(edited)]) {
    assert.equal((await worker.fetch(request(bytes), env)).status, 200);
    assert.deepEqual(env.store.get('round3/P001/data.json.gz'), new Uint8Array(bytes));
  }
  assert.equal((await worker.fetch(request(await zipped(data), { "X-Participant": "other" }), env)).status, 200);
  assert.equal(env.store.size, 2);
});

test("Worker never decompresses uploads, including files beyond the offline validation limit", async () => {
  const env = fakeEnv();
  const bomb = gzipSync(Buffer.alloc(MAX_DATASET_BYTES + 1, 32));
  assert.equal((await worker.fetch(request(bomb), env)).status, 200);
  assert.deepEqual([...env.store.values()][0], new Uint8Array(bomb));
});

test("offline dataset reader retains its size bound", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
  await assert.rejects(readLimited(stream, 10), /size limit/);
  assert.equal(cancelled, true);
});

test("deadline aborts stalled requests and retries are bounded", async () => {
  let calls = 0;
  await assert.rejects(uploadDataset({}, { participant: "P001", session: "s-1", config, timeoutMs: 10,
    attempts: 2, wait: async () => {}, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      calls++; signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }) }), /timed out/);
  assert.equal(calls, 2);
});

test("a stalled response body is also covered by the deadline", async () => {
  await assert.rejects(uploadDataset({}, { participant: "P001", session: "s-1", config, timeoutMs: 10, attempts: 1,
    fetchImpl: async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }) }) }), /timed out/);
});

test("a 200 response without a storage receipt is not reported as success", async () => {
  await assert.rejects(uploadDataset({}, { participant: "P001", session: "s-1", config, attempts: 1,
    fetchImpl: async () => Response.json({}) }), /confirm storage/);
});

test("pull continues past a corrupt object and preserves legacy and snapshot files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "algobot-pull-")), good = await zipped();
  const keys = ["round3/P001/old.json.gz", "round3/P001/bad.json.gz", `round3/P001/s-1--${"a".repeat(64)}.json.gz`];
  try {
    const result = await pullData({ base: "https://w.dev", token: "admin", outDir: dir, warn: () => {},
      fetchImpl: async url => url.includes("/list?") ? Response.json({ objects: keys.map(key => ({ key })) })
        : new Response(decodeURIComponent(url).includes("bad.json.gz") ? "corrupt" : good) });
    assert.equal(result.written, 2); assert.equal(result.failures.length, 1);
    assert.equal(readdirSync(dir).length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
