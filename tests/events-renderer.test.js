import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { FarmEventSimulation } from "../src/game/events/simulation.js";

const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/src/lib/kaplay.js")) return {
      format: "module", shortCircuit: true,
      source: `export const k = {
        pos: (x,y) => ({pos:{x,y}}), vec2: (x,y=x) => ({x,y}),
        sprite: (sprite, options) => ({sprite,...options}), anchor: anchor => ({anchor}),
        scale: scale => ({scale}), opacity: opacity => ({opacity}), z: z => ({z}),
      };`,
    };
    if (url.endsWith("/src/game/global/global.js")) return { format: "module", shortCircuit: true, source: "export const CONFIG = {FARM:{tile_size:64}};" };
    return nextLoad(url, context);
  },
});
const { FarmEventRenderer } = await import("../src/game/events/renderer.js");
hook.deregister();

function harness() {
  const grid = new Map([["0-0", { soil: { gridAxisToWorld: () => ({x:0,y:0}), water() {} } }]]);
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const owner = { add(parts) {
    let onDestroy = () => {};
    return Object.assign({
      exists: () => true, onDestroy(fn) { onDestroy = fn; }, destroy() { onDestroy(); },
    }, ...parts);
  } };
  const renderer = new FarmEventRenderer(owner, sim);
  const cloud = sim.startRain().clouds[0];
  const step = seconds => { sim.update(seconds); renderer.update(seconds); };
  renderer.update(0);
  return { grid, sim, cloud, renderer, step, view: renderer.cloudViews.get(cloud.id).view };
}

test("renderer eases cloud travel every frame and does not teleport when departure begins", () => {
  const h = harness();
  assert.equal(h.view.pos.x, -148, "spawn outside the farm");
  h.step(1);
  const previous = h.view.pos.x;
  h.step(0.01);
  assert.ok(h.view.pos.x > previous, "render moves before another simulation tick");
  h.step(3.99);
  assert.equal(h.view.pos.x, 32);
  h.step(8);
  assert.equal(h.cloud.phase, "leaving");
  assert.equal(h.view.pos.x, 32, "exit starts at the resting position");
  h.step(0.01);
  assert.ok(h.view.pos.x < 32 && h.view.pos.x > 31.99, "ease out from rest");
  h.step(4);
  assert.equal(h.renderer.cloudViews.size, 0);
});

test("cloud entrance and exit fade and scale smoothly without a full-opacity spawn flash", () => {
  const h = harness();
  assert.equal(h.view.opacity, 0);
  assert.equal(h.view.scale.x, 0.65);
  h.step(h.cloud.travelDuration / 2);
  assert.ok(Math.abs(h.view.opacity - 0.5) < 1e-9);
  assert.ok(Math.abs(h.view.scale.x - 0.825) < 1e-9);
  h.step(h.cloud.travelDuration / 2);
  assert.equal(h.view.opacity, 1);
  assert.equal(h.view.scale.x, 1);
  h.step(h.cloud.rainDuration);
  assert.equal(h.view.opacity, 1, "departure starts without a flash or size jump");
  h.step(h.cloud.exitDuration / 2);
  assert.ok(Math.abs(h.view.opacity - 0.5) < 1e-9);
  assert.ok(Math.abs(h.view.scale.x - 0.825) < 1e-9);
  const pausedOpacity = h.view.opacity;
  h.step(0);
  assert.equal(h.view.opacity, pausedOpacity);
  h.step(h.cloud.exitDuration / 2 - 0.01);
  assert.ok(h.view.opacity < 0.001, "cloud is invisible before its object is removed");
  h.step(0.01);
  assert.equal(h.renderer.cloudViews.size, 0);
});

test("rain renderer interpolates drops between ticks and preserves cloud endpoints during expansion", () => {
  const h = harness();
  h.step(2);
  const x = h.view.pos.x;
  h.grid.set("0--10", { soil: { gridAxisToWorld: () => ({x:-1000,y:0}) } });
  h.renderer.update(0);
  assert.equal(h.view.pos.x, x, "changing farm bounds does not jump the cloud");
  h.step(3.05);
  const drop = [...h.renderer.dropViews.values()][0].view;
  const y = drop.pos.y;
  h.step(0.01);
  assert.ok(drop.pos.y > y, "drop movement is interpolated between simulation ticks");
  const pausedY = drop.pos.y;
  h.renderer.update(0);
  assert.equal(drop.pos.y, pausedY);
});
