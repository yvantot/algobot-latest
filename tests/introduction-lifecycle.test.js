import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { INTRODUCTION_STORY, demonstrationStory, claimDemoReward } from "../src/game/global/introduction-story.js";

function setup(options) {
  const objects = [];
  const updates = [];
  const changes = [];
  const moves = [];
  const object = (fields = {}) => {
    const obj = { paused: false, hidden: false, removed: false, ...fields,
      exists() { return !this.removed; }, destroy() { this.removed = true; } };
    objects.push(obj); return obj;
  };
  const player = object({ hidden: true, paused: true });
  const visiblePlayer = object();
  let cam = {x:400,y:250}, zoom = {x:.8,y:.8};
  const k = { getCamPos:() => cam, getCamScale:() => zoom,
    setCamPos:(x,y) => cam = typeof x === "object" ? x : {x,y}, setCamScale:z => zoom = typeof z === "object" ? z : {x:z,y:z}, get: () => [...objects], debug: { timeScale: 0.7 }, dt: () => 1,
    onUpdate(fn) { updates.push(fn); return { cancel() { updates.splice(updates.indexOf(fn), 1); } }; } };
  const context = vm.createContext({ k, CONFIG: { FARM: { rows: 3, columns: 3, cell_size:76, gap:12, grid_origin:{x:0,y:0} } },
    CROP_DATA: { wheat: { reward: 3, exp: 3 } }, CropStates: {}, SoilStates: { INITIAL: 0 },
    INTRODUCTION_STORY, document: { hidden: false }, console,
    addLandBackground: () => [object(),object()],
    addSoilToGrid: () => object({setSoilState() {}}),
    addFarmbot: () => object({ is_available: true, botJump(x, y, done) { moves.push([x,y]);done(true); } }),
    destroyFarmEvents() {},
  });
  const source = fs.readFileSync(new URL("../src/game/global/live-demonstration.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export function", "function");
  vm.runInContext(source, context);
  const controller = context.startLiveDemonstration(change => changes.push(change),options);
  async function tick(count) { for (let i = 0; i < count; i++) { for (const fn of [...updates]) fn(); await Promise.resolve(); } }
  return { moves, objects, changes, controller, player, visiblePlayer, k, tick };
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

test("single command preview completes without advancing through the introduction",async()=>{
 const h=setup({singleAction:"move"}); await h.tick(15);
 assert.equal(h.changes.at(-1).ready,true);
 h.controller.next(); await h.tick(10);
 assert.equal(h.changes.filter(c=>c.chapter!==undefined).length,1);
 h.controller.dispose(); assert.equal(h.visiblePlayer.hidden,false);
 assert.deepEqual(h.k.getCamPos(),{x:400,y:250});
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
  assert.deepEqual(h.k.getCamPos(), {x:400,y:250});
  assert.deepEqual(h.k.getCamScale(), {x:.8,y:.8});
  assert.ok(h.objects.slice(2).every(obj => obj.removed));
  assert.equal(h.changes.length, 1, "canceled actions cannot update a closed introduction");
});

test("demo expansion owns new soil and restores the real camera when closed", async () => {
  const h=setup({singleAction:"expand"});
  await h.tick(5);
  assert.equal(h.changes.findLast(change=>change.purchase).purchase.id,"row");
  assert.equal(h.controller.purchase("column"),false);
  assert.equal(h.controller.purchase("row"),true);
  assert.equal(h.controller.purchase("row"),false);
  await h.tick(5);
  assert.equal(h.changes.findLast(change=>change.purchase).purchase.id,"column");
  h.controller.purchase("column");
  await h.tick(10);
  assert.equal(h.changes.at(-1).ready,true);
  assert.equal(h.objects.filter(object=>object.exists()).length,21,"two originals, two background layers, sixteen tiles and one bot");
  h.controller.dispose();
  assert.ok(h.objects.slice(2).every(object=>object.removed));
  assert.deepEqual(h.k.getCamPos(),{x:400,y:250});
  assert.deepEqual(h.k.getCamScale(),{x:.8,y:.8});
});

test("closing during farm expansion cancels pending work before more tiles are added", async () => {
  const h=setup({singleAction:"expand"});
  await h.tick(2);
  h.controller.dispose();
  const count=h.objects.length;
  await h.tick(40);
  assert.equal(h.objects.length,count);
  assert.ok(h.objects.slice(2).every(object=>object.removed));
});


test("expansion keeps traversing while purchases wait and visits newly added tiles",async()=>{
 const h=setup({singleAction:"expand"});
 try{
  await h.tick(60);const before=h.moves.length;await h.tick(60);assert.ok(h.moves.length>before);
  assert.ok(h.moves.every(([x,y])=>x<3&&y<3));
  h.controller.purchase("row");await h.tick(60);assert.ok(h.moves.some(([,y])=>y===3));
  h.controller.purchase("column");await h.tick(100);assert.ok(h.moves.some(([x])=>x===3));
  assert.equal(h.changes.at(-1).ready,true);
 }finally{h.controller.dispose();}
});

test("optional demos are separate from the short opening and reward only once",()=>{
  assert.deepEqual(demonstrationStory().map(s=>s.action),['welcome','move','plant','water','harvest','finish']);
  assert.ok(demonstrationStory('events').some(s=>s.action==='fire'));
  assert.ok(demonstrationStory('upgrades').some(s=>s.action==='expand'));
  const completed=[],grants=[];
  assert.equal(claimDemoReward(completed,'basics',r=>grants.push(r)),false);
  assert.equal(claimDemoReward(completed,'events',r=>grants.push(r)),true);
  assert.equal(claimDemoReward(completed,'events',r=>grants.push(r)),false);
  assert.equal(claimDemoReward(completed,'upgrades',r=>grants.push(r)),true);
  assert.equal(grants.length,2);
});
