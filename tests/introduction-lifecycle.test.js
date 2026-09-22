import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { INTRODUCTION_STORY } from "../src/game/global/introduction-story.js";

function setup() {
  const objects = [];
  const updates = [];
  const changes = [];
  const object = (fields = {}) => {
    const obj = { paused: false, hidden: false, removed: false, ...fields,
      exists() { return !this.removed; }, destroy() { this.removed = true; } };
    objects.push(obj); return obj;
  };
  const player = object({ hidden: true, paused: true });
  const visiblePlayer = object();
  const k = { get: () => [...objects], debug: { timeScale: 0.7 }, dt: () => 1,
    onUpdate(fn) { updates.push(fn); return { cancel() { updates.splice(updates.indexOf(fn), 1); } }; } };
  const context = vm.createContext({ k, CONFIG: { FARM: { rows: 3, columns: 3 } },
    CROP_DATA: { wheat: { reward: 3, exp: 3 } }, CropStates: {}, SoilStates: { INITIAL: 0 },
    INTRODUCTION_STORY, document: { hidden: false }, console,
    addSoilToGrid: () => object(),
    addFarmbot: () => object({ is_available: true, botJump(x, y, done) { done(true); } }),
    destroyFarmEvents() {},
  });
  const source = fs.readFileSync(new URL("../src/game/global/live-demonstration.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export function", "function");
  vm.runInContext(source, context);
  const controller = context.startLiveDemonstration(change => changes.push(change));
  async function tick(count) { for (let i = 0; i < count; i++) { for (const fn of [...updates]) fn(); await Promise.resolve(); } }
  return { objects, changes, controller, player, visiblePlayer, k, tick };
}

test("introduction holds each chapter until the player continues", async () => {
  const h = setup();
  await h.tick(10);
  assert.equal(h.changes.at(-1).ready, true);
  await h.tick(40);
  assert.deepEqual(h.changes.filter(x => x.chapter !== undefined).map(x => x.chapter), [0]);
  h.controller.next(); h.controller.next();
  await h.tick(10);
  assert.deepEqual(h.changes.filter(x => x.chapter !== undefined).map(x => x.chapter), [0, 1]);
  assert.equal(h.changes.at(-1).ready, true);
  h.controller.dispose();
});

test("skipping during a running chapter restores prior visibility, pause and speed", async () => {
  const h = setup();
  assert.equal(h.visiblePlayer.hidden, true);
  assert.equal(h.visiblePlayer.paused, true);
  h.controller.dispose(); h.controller.dispose();
  await h.tick(20);
  assert.equal(h.player.hidden, true);
  assert.equal(h.player.paused, true);
  assert.equal(h.visiblePlayer.hidden, false);
  assert.equal(h.visiblePlayer.paused, false);
  assert.equal(h.k.debug.timeScale, 0.7);
  assert.ok(h.objects.slice(2).every(obj => obj.removed));
  assert.equal(h.changes.length, 1, "canceled actions cannot update a closed introduction");
});
