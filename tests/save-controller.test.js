import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { PersistenceController } from "../src/game/persistence/controller.js";
import { SaveStorage } from "../src/game/persistence/storage.js";
import { saveFixture } from "./save-fixtures.js";
import { createRandom } from "../src/game/persistence/random.js";

function setup(fault = () => {}) {
  let world = structuredClone(saveFixture().payload), restores = 0;
  const storage = new SaveStorage({ indexedDB: new IDBFactory(), fault });
  const controller = new PersistenceController({ storage, capture: () => structuredClone(world), pause() {},
    fresh: async () => { world = structuredClone(saveFixture().payload); },
    restore: async payload => { world = structuredClone(payload); restores++; },
  });
  return { storage, controller, world: () => world, restores: () => restores };
}
test("New Game failure retains old farm; foreign-owner Continue never hydrates", async () => {
  let fail = false;
  const h = setup(stage => { if (fail && stage === "before-write") throw Error("disk full"); });
  await h.controller.start(saveFixture().owner, { newGame: true });
  h.world().economy.coins = 420; await h.controller.checkpoint();
  const saved = structuredClone((await h.storage.read()).active);
  fail = true;
  await assert.rejects(h.controller.start(saveFixture().owner, { newGame: true, replacementRevision: h.controller.revision }));
  fail = false;
  assert.deepEqual((await h.storage.read()).active, saved);
  assert.equal(h.world().economy.coins, 420);
  const other = new PersistenceController({ storage: h.storage, capture() {}, fresh() {}, pause() {}, restore() { assert.fail("Foreign farm hydrated"); } });
  await h.storage.release(h.controller.writer);
  await assert.rejects(other.start({ ...saveFixture().owner, participantId: "B" }), { code: "owner" });
  h.storage.close();
});
test("RESEARCH-5 backup recovery cannot cross the durable research floor", async () => {
  const h = setup(); await h.controller.start(saveFixture().owner, { newGame: true });
  h.world().economy.coins = 75; await h.controller.checkpoint();
  await h.controller.boundary(() => { h.world().economy.coins = 100; }, research => { research.operations.reward = { id: "reward" }; });
  const root = await h.storage.read();
  assert.equal(root.previous.payload.economy.coins, 100);
  await h.storage.transaction(root => { root.previous.revision = root.floor - 1; });
  await assert.rejects(h.controller.start(saveFixture().owner, { recover: true }), { code: "recovery" });
  h.storage.close();
});

test("replacement requires confirmation of the current stored revision before building a farm", async () => {
  const h = setup(); await h.controller.start(saveFixture().owner, { newGame: true });
  h.world().economy.coins = 420; await h.controller.checkpoint();
  const confirmedRevision = h.controller.revision;
  h.world().economy.coins = 421; await h.controller.checkpoint();
  const before = await h.storage.read();
  let builds = 0; const fresh = h.controller.fresh;
  h.controller.fresh = async () => { builds++; await fresh(); };
  for (const replacementRevision of [undefined, confirmedRevision]) {
    await assert.rejects(h.controller.start(saveFixture().owner, { newGame: true, replacementRevision }), { code: "confirmation" });
    const after = await h.storage.read();
    assert.deepEqual(after.active, before.active);
    assert.deepEqual(after.previous, before.previous);
    assert.deepEqual(after.research, before.research);
  }
  assert.equal(builds, 0);
  await h.controller.start(saveFixture().owner, { newGame: true, replacementRevision: before.revision });
  assert.equal(builds, 1);
  assert.notEqual(h.controller.current.playthroughId, before.active.playthroughId);
  assert.equal((await h.storage.read()).previous, null);
  h.storage.close();
});

test("explicit replacement works even when the existing save envelope is corrupt", async () => {
  const h = setup();
  await h.storage.transaction(root => { root.active = { damaged: true }; root.revision = 7; });
  await assert.rejects(h.controller.start(saveFixture().owner, { newGame: true }), { code: "confirmation" });
  assert.deepEqual((await h.storage.read()).active, { damaged: true });
  await h.controller.start(saveFixture().owner, { newGame: true, replacementRevision: 7 });
  assert.equal(h.controller.current.payload.economy.coins, 50);
  h.storage.close();
});
test("endurance: 100 load/checkpoint cycles and 50 replacements preserve invariants", async () => {
  const h = setup(); await h.controller.start(saveFixture().owner, { newGame: true });
  for (let i = 0; i < 100; i++) {
    h.world().economy.coins = i; await h.controller.checkpoint();
    await h.controller.start(saveFixture().owner);
    assert.equal(h.world().economy.coins, i);
  }
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    await h.controller.start(saveFixture().owner, { newGame: true, replacementRevision: h.controller.revision });
    ids.add(h.controller.current.playthroughId);
    assert.equal(h.world().economy.coins, 50);
    assert.equal((await h.storage.read()).previous, null);
  }
  assert.equal(ids.size, 50); assert.equal(h.restores(), 100);
  h.storage.close();
});

test("a successful commit never depends on a later read succeeding", async () => {
  const h = setup(); await h.controller.start(saveFixture().owner, { newGame: true });
  h.storage.read = () => Promise.reject(Error("read unavailable after commit"));
  h.world().economy.coins = 321;
  await h.controller.checkpoint();
  assert.equal(h.controller.current.payload.economy.coins, 321);
  assert.equal(h.controller.root.active.payload.economy.coins, 321);
  assert.equal(h.controller.status.phase, "saved");
  h.storage.close();
});

test("explicit saving rejects disabled writers instead of pretending to save", async () => {
  const h = setup();
  await assert.rejects(h.controller.checkpoint({ required: true }), { code: "not_ready" });
  await h.controller.start(saveFixture().owner, { newGame: true });
  h.world().economy.coins = 99;
  await h.storage.release(h.controller.writer);
  await h.storage.acquire("replacement");
  await assert.rejects(h.controller.checkpoint({ required: true }), { code: "conflict" });
  assert.equal(h.controller.ready, false);
  await assert.rejects(h.controller.checkpoint({ required: true }), { code: "not_ready" });
  assert.equal((await h.storage.read()).active.payload.economy.coins, 50);
  h.storage.close();
});

test("100 seeded mutation/reload sequences retain the last committed logical state", async () => {
  for (let seed = 0; seed < 100; seed++) {
    const h = setup(), random = createRandom(seed), sequence = [];
    await h.controller.start(saveFixture().owner, { newGame: true });
    try {
      for (let step = 0; step < 12; step++) {
        const choice = Math.floor(random.next() * 4); sequence.push(choice);
        if (choice === 0) h.world().economy.coins += 5;
        if (choice === 1) h.world().economy.crops.wheat++;
        if (choice === 2) h.world().bots[0].x = Math.floor(random.next() * 3);
        if (choice === 3) h.world().bots[0].program.text_code += "bot.moveRight();\n";
        h.world().rng = random.snapshot();
        await h.controller.checkpoint();
        const expected = structuredClone(h.world());
        await h.controller.start(saveFixture().owner);
        expected.ui.entryScreen = "onboarding";
        assert.deepEqual(h.world(), expected, `seed=${seed} shortest failing prefix=${sequence.join(",")}`);
      }
    } finally { h.storage.close(); }
  }
});
