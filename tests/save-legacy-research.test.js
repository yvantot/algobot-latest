import test from "node:test";
import assert from "node:assert/strict";
import { inspectLegacyResearch } from "../src/game/persistence/legacy-research.js";

test("legacy inspection retains exact malformed bytes and imports valid records separately", () => {
  const records = '[{"session_id":"valid"},null,{"session_id":"also-valid"}]';
  const values = new Map([["algobot_sessions", records], ["algobot_challenge_exposure_v1", " { broken\n"]]);
  const result = inspectLegacyResearch({ getItem: key => values.get(key) ?? null }, structuredClone);
  assert.equal(result.bytes.algobot_sessions, records);
  assert.equal(result.bytes.algobot_challenge_exposure_v1, " { broken\n");
  assert.equal(result.errors.length, 2);
  assert.deepEqual(result.sessions.map(session => session.session_id), ["valid", "also-valid"]);
  assert.equal(result.exposureHistoryUnavailable, true);
  assert.deepEqual(result.exposures, {});
});

test("valid exposure history remains usable despite malformed legacy sessions", () => {
  const ledger = { '["student","task"]': true };
  const values = new Map([["algobot_sessions", "{broken"], ["algobot_challenge_exposure_v1", JSON.stringify(ledger)]]);
  const result = inspectLegacyResearch({ getItem: key => values.get(key) ?? null }, structuredClone);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(result.exposures, ledger);
  assert.equal(result.exposureHistoryUnavailable, false);
});

test("denied legacy storage is not treated as recoverable empty research", () => {
  assert.throws(() => inspectLegacyResearch({ getItem() { throw Error("denied"); } }, structuredClone), /denied/);
});
