import test from "node:test";
import assert from "node:assert/strict";
import { FarmEventSimulation, fireSettings } from "../src/game/events/simulation.js";
import { createRandom } from "../src/game/persistence/random.js";

function farm() {
  const grid = new Map();
  for (let x = 0; x < 3; x++) {
    const tile = { soil: { water_remaining: 0, waterCalls: 0, isWatered() { return this.water_remaining > 0; }, water() { this.waterCalls++; this.water_remaining = 1; return true; } } };
    tile.crop = { saveId: `crop-${x}`, crop_state: "_growing", crop_health: 100,
      damage(amount) { this.crop_health = Math.max(0, this.crop_health - amount); if (!this.crop_health) tile.crop = null; } };
    grid.set(`0-${x}`, tile);
  }
  return grid;
}
const state = grid => [...grid].map(([key, t]) => [key, t.crop?.crop_health ?? null, t.soil.water_remaining, t.soil.waterCalls]);
// New spawns have different wall-clock provenance after closure; logical ages
// and all gameplay effects must still agree.
const logical = sim => { const value = sim.snapshot(); for (const fire of value.fires) delete fire.spawned_at; return value; };
for (const offset of [.049, .949, 1.049, 1.949, 2.149, 2.749, 4.349, 6.949]) {
  test(`HAZARD-1/2 exact fire and rain continuation at ${offset}s`, () => {
    const a = farm(), b = farm(), rng = createRandom(31), restoredRng = createRandom();
    const left = new FarmEventSimulation(a, { random: () => rng.next(), now: () => 42 });
    left.ignite("0-0", { ...fireSettings({ pts: 100 }), stageDuration: 1, damageInterval: .2, matureBurnDuration: .8, spreadChance: .5 });
    left.startRain(10000); left.update(offset);
    for (const [key, tile] of a) {
      const other = b.get(key);
      if (tile.crop) other.crop.crop_health = tile.crop.crop_health; else other.crop = null;
      other.soil.water_remaining = tile.soil.water_remaining; other.soil.waterCalls = tile.soil.waterCalls;
    }
    const checkpoint = JSON.parse(JSON.stringify(left.snapshot()));
    restoredRng.restore(rng.snapshot());
    const right = new FarmEventSimulation(b, { random: () => restoredRng.next(), now: () => 42 + 86400000 });
    right.restore(checkpoint);
    assert.deepEqual(right.snapshot(), checkpoint);
    for (let n = 0; n < 180; n++) {
      left.update(.05); right.update(.05);
      assert.deepEqual(logical(right), logical(left)); assert.deepEqual(state(b), state(a));
    }
  });
}
test("HAZARD-1 substituted fuel is rejected and lesson fire's unbounded clock round-trips", () => {
  const a = farm(), sim = new FarmEventSimulation(a);
  sim.ignite("0-0", { ...fireSettings({ pts: 100 }), stageDuration: Infinity });
  const saved = JSON.parse(JSON.stringify(sim.snapshot()));
  const b = farm(), restored = new FarmEventSimulation(b);
  restored.restore(saved); assert.equal(restored.fires.get("0-0").settings.stageDuration, Infinity);
  const c = farm(); c.get("0-0").crop.saveId = "replacement";
  assert.throws(() => new FarmEventSimulation(c).restore(saved), /different fuel/);
});
