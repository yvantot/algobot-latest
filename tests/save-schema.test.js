import test from "node:test";
import assert from "node:assert/strict";
import { plainData, validateSave, encodeTimer, decodeTimer } from "../src/game/persistence/schema.js";
import { inspectIdentity, requireOwner } from "../src/game/persistence/ownership.js";
import { createRandom } from "../src/game/persistence/random.js";
import { saveFixture } from "./save-fixtures.js";

test("save schema detaches data and rejects invalid references, bounds and future versions", () => {
  const save = saveFixture(), copy = validateSave(save);
  copy.payload.economy.coins = 0; assert.equal(save.payload.economy.coins, 50);
  for (const corrupt of [
    s => s.schemaVersion = 2, s => s.payload.rows = 0, s => s.payload.tiles.pop(),
    s => s.payload.tiles[1].x = 0, s => s.payload.bots.push(s.payload.bots[0]),
    s => s.payload.bots[0].x = -1, s => s.payload.economy.coins = Infinity,
    s => s.payload.economy.crops.wheat = .5, s => s.payload.quests.tut_2.is_claimed = true,
    s => s.payload.tiles[0].soil.water = 1, s => s.payload.hazards.fires.push({ cropId: "missing" }),
    s => s.payload.hazards.drops.push({ cloudId: "missing" }),
    s => delete s.payload.cropData.wheat, s => s.payload.cropData.wheat.duration = -1,
    s => s.payload.shop.unknown = {}, s => s.payload.lessonFires.push("0-0"),
  ]) { const bad = saveFixture(); corrupt(bad); assert.throws(() => validateSave(bad)); }
  assert.throws(() => plainData({ callback() {} }));
  assert.throws(() => plainData(new Map()));
  assert.throws(() => plainData(JSON.parse('{"__proto__":{}}')));
  assert.equal(decodeTimer(JSON.parse(JSON.stringify(encodeTimer(Infinity)))), Infinity);
});

test("OWNER-1 identity preflight has no writes and rejects mismatched or cleared owners", () => {
  const values = new Map([["algobot_participant_id", "student_A"], ["algobot_participant_id_source", "researcher_assigned_code"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem() { assert.fail("Preflight wrote identity"); } };
  const owner = saveFixture().owner;
  requireOwner(owner, inspectIdentity("", storage, "fixed-conditions-v1"));
  assert.throws(() => requireOwner(owner, inspectIdentity("?study_participant=B", storage, "fixed-conditions-v1")), { code: "owner" });
  assert.throws(() => requireOwner(owner, null), { code: "owner" });
  assert.throws(() => requireOwner(owner, { ...owner, identityKind: "browser_local_pseudonym" }));
  assert.throws(() => requireOwner(owner, { ...owner, studyProtocolVersion: "future" }));
  assert.throws(() => inspectIdentity("?study_participant=%20", storage));
});

test("saved gameplay RNG resumes its exact sequence across many seeds", () => {
  for (let seed = 0; seed < 100; seed++) {
    const first = createRandom(seed), second = createRandom();
    for (let n = 0; n < 17; n++) first.next();
    second.restore(first.snapshot());
    for (let n = 0; n < 100; n++) assert.equal(first.next(), second.next());
  }
});
