import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { SaveStorage } from "../src/game/persistence/storage.js";
import { saveFixture } from "./save-fixtures.js";

test("checkpoint, backup, reward boundary and research commit atomically", async () => {
  const store = new SaveStorage({ indexedDB: new IDBFactory() });
  let revision = await store.acquire("one");
  const save = saveFixture();
  revision = await store.checkpoint("one", revision, save, { replace: true });
  save.revision++; save.payload.economy.coins = 100;
  revision = await store.checkpoint("one", revision, save, { boundary: true, research: r => r.operations.reward = { coins: 50 } });
  const root = await store.read();
  assert.equal(root.active.payload.economy.coins, 100);
  assert.equal(root.previous.payload.economy.coins, 100);
  assert.equal(root.floor, 2); assert.deepEqual(root.research.operations.reward, { coins: 50 });
  await assert.rejects(store.checkpoint("one", revision - 1, save), { code: "conflict" });
  await assert.rejects(store.acquire("two"), { code: "conflict" });
  store.close();
});

for (const stage of ["read", "before-write", "after-write"]) test(`transaction abort at ${stage} preserves last complete checkpoint`, async () => {
  let fail = false;
  const store = new SaveStorage({ indexedDB: new IDBFactory(), fault: at => { if (fail && at === stage) throw Error("Injected crash"); } });
  const revision = await store.acquire("one");
  await store.checkpoint("one", revision, saveFixture(), { replace: true });
  const before = await store.read();
  fail = true;
  await assert.rejects(store.checkpoint("one", before.revision, { ...saveFixture(), revision: 2 }, { boundary: true, research: r => r.operations.x = 1 }));
  fail = false;
  assert.deepEqual(await store.read(), before);
  store.close();
});

test("expired writer cannot overwrite replacement and unavailable storage is not no-save", async () => {
  let now = 100;
  const indexedDB = new IDBFactory(), a = new SaveStorage({ indexedDB, now: () => now }), b = new SaveStorage({ indexedDB, now: () => now });
  await a.acquire("a"); now += 16000;
  let revision = await b.acquire("b");
  revision = await b.checkpoint("b", revision, saveFixture(), { replace: true });
  await assert.rejects(a.checkpoint("a", revision, saveFixture()), { code: "conflict" });
  await assert.rejects(new SaveStorage({ indexedDB: null }).read(), { code: "storage" });
  a.close(); b.close();
});

test("the current writer renews after suspension but a superseded writer cannot renew", async () => {
  let now = 100;
  const store = new SaveStorage({ indexedDB: new IDBFactory(), now: () => now });
  let revision = await store.acquire("one");
  revision = await store.checkpoint("one", revision, saveFixture(), { replace: true });
  now += 600000;
  await store.heartbeat("one");
  assert.equal((await store.read()).lease.until, now + 15000);
  now += 600000;
  revision = await store.checkpoint("one", revision, { ...saveFixture(), revision: 2 });
  now += 600000;
  await store.acquire("two");
  await assert.rejects(store.heartbeat("one"), { code: "conflict" });
  await assert.rejects(store.checkpoint("one", revision, { ...saveFixture(), revision: 3 }), { code: "conflict" });
  store.close();
});
