import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { uploadConfig, uploadDataset } from "../src/game/ml/cloud-upload.js";

const config = { url: "https://worker.test/upload", token: "t" };
const reply = (status, body = { ok: true, key: "fixture" }) => ({ ok: status < 300, status, json: async () => body });

test("upload is off unless both address and token are set", () => {
  assert.equal(uploadConfig({}), null);
  assert.equal(uploadConfig({ VITE_UPLOAD_URL: "https://w.dev" }), null);
  assert.deepEqual(uploadConfig({ VITE_UPLOAD_URL: "https://w.dev/", VITE_UPLOAD_TOKEN: " t " }),
    { url: "https://w.dev/upload", token: "t" });
});

test("sends the gzipped dataset with study headers", async () => {
  let sent;
  const result = await uploadDataset({ sessions: [1] }, { participant: "P001", session: "s-1", config,
    fetchImpl: async (url, init) => { sent = { url, init }; return reply(200, { ok: true, key: "k" }); } });
  assert.deepEqual(result, { ok: true, key: "k" });
  assert.equal(sent.url, config.url);
  assert.equal(sent.init.headers["X-Study-Token"], "t");
  assert.equal(sent.init.headers["X-Participant"], "P001");
  assert.deepEqual(JSON.parse(gunzipSync(sent.init.body)), { sessions: [1] });
});

test("retries network and server errors but not rejections", async () => {
  let calls = 0;
  const flaky = async () => { calls++; if (calls === 1) throw Error("offline"); return calls === 2 ? reply(503) : reply(200); };
  await uploadDataset({}, { participant: "P1", session: "s", config, fetchImpl: flaky, wait: async () => {} });
  assert.equal(calls, 3);

  calls = 0;
  const rejected = async () => { calls++; return reply(403); };
  await assert.rejects(uploadDataset({}, { participant: "P1", session: "s", config, fetchImpl: rejected, wait: async () => {} }), /403/);
  assert.equal(calls, 1);
});

test("refuses unsafe IDs and unconfigured builds before sending", async () => {
  const never = async () => assert.fail("should not send");
  await assert.rejects(uploadDataset({}, { participant: "../x", session: "s", config, fetchImpl: never }), /participant/);
  await assert.rejects(uploadDataset({}, { participant: "P1", session: "s", config: null, fetchImpl: never }), /not configured/);
});
