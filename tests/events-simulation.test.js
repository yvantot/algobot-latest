import test from "node:test";
import assert from "node:assert/strict";
import { CropStates, SoilStates } from "../src/game/global/enum.js";
import { getDifficultyParams } from "../src/game/events/difficulty.js";
import { FarmEventSimulation, canStartFireEvent, fireSettings, rainSettings } from "../src/game/events/simulation.js";
import { RAIN_TIMING, cloudPosition, cloudAppearance, dropPosition } from "../src/game/events/motion.js";

function makeFarm(rows = 3, columns = 3, planted = rows * columns) {
  const grid = new Map();
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const tile = {
      soil: {
        soil_state: SoilStates.READY, water_remaining: 0, waterCalls: 0,
        isWatered() { return this.water_remaining > 0; },
        water(options) {
          this.waterCalls++;
          this.lastWaterOptions = options;
          const changed = this.water_remaining < 1;
          this.water_remaining = 1;
          return changed;
        },
      },
    };
    if (planted-- > 0) {
      tile.crop = {
        crop_state: CropStates.YOUNG, crop_health: 100,
        damage(amount, options) {
          this.lastDamageOptions = options;
          this.crop_health -= amount;
          if (this.crop_health <= 0) tile.crop = null;
        },
      };
    }
    grid.set(`${y}-${x}`, tile);
  }
  return grid;
}

function settings(overrides = {}) {
  return {
    ...fireSettings(getDifficultyParams(100)),
    stageDuration: 1, damageInterval: 100, spreadInterval: 1,
    matureBurnDuration: 1000,
    spreadChance: 1,
    ...overrides,
  };
}

test("severity scales entity counts from one through eight and sanitizes invalid input", () => {
  assert.equal(getDifficultyParams(100).entityCount, 1);
  assert.equal(getDifficultyParams(10000).entityCount, 8);
  assert.equal(getDifficultyParams(100000).entityCount, 8);
  for (const input of [undefined, "bad", NaN, Infinity, -100]) {
    assert.equal(getDifficultyParams(input).pts, 100);
  }
});

test("initial fire needs two thirds live planted soil tiles, ignoring off-farm pest placeholders", () => {
  const grid = makeFarm(3, 3, 5);
  grid.set("-5-0", { bug: {} });
  assert.equal(canStartFireEvent(grid), false);
  const sim = new FarmEventSimulation(grid);
  assert.equal(sim.startFire().applied, false);
  grid.get("1-2").crop = { crop_state: CropStates.GROWING, crop_health: 10 };
  assert.equal(canStartFireEvent(grid), true);
  grid.get("1-2").crop.crop_state = CropStates.DEAD;
  assert.equal(canStartFireEvent(grid), false);
  assert.equal(canStartFireEvent(new Map()), false);
});

test("severity chooses distinct random initial fires and does not replace burning tiles", () => {
  const grid = makeFarm();
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const easy = sim.startFire(100);
  assert.equal(easy.fires.length, 1);
  const hard = sim.startFire(10000);
  assert.equal(hard.fires.length, 8);
  assert.equal(new Set([...easy.fires, ...hard.fires].map(fire => fire.key)).size, 9);
  assert.equal(sim.startFire(10000).applied, false);
});

test("fire begins spreading at the medium stage, only to orthogonal living crops", () => {
  const grid = makeFarm();
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const fire = sim.ignite("1-1", settings());
  assert.equal(fire.stage, 0);
  sim.update(0.95);
  assert.equal(fire.stage, 0);
  assert.equal(sim.fires.size, 1);
  sim.update(0.05);
  assert.equal(fire.stage, 1);
  assert.deepEqual([...sim.fires.keys()].sort(), ["0-1", "1-0", "1-1", "1-2", "2-1"]);
  assert.equal(grid.get("0-0").fire, undefined);
  assert.equal(grid.get("0-1").fire.stage, 0);
});

test("wet destination soil reduces spread probability without evaporating water", () => {
  const grid = makeFarm(1, 3);
  grid.get("0-2").soil.water_remaining = 1;
  const sim = new FarmEventSimulation(grid, { random: () => 0.2 });
  sim.ignite("0-1", settings({ spreadChance: 0.5, wetSpreadMultiplier: 0.2 }));
  sim.update(2);
  assert.equal(grid.get("0-0").fire.isBurning(), true);
  assert.equal(grid.get("0-2").fire, undefined);
  assert.equal(grid.get("0-2").soil.water_remaining, 1);
});

test("rain protection is lower probability, not complete fire immunity", () => {
  const grid = makeFarm(1, 2);
  grid.get("0-1").soil.water_remaining = 0.1;
  const sim = new FarmEventSimulation(grid, { random: () => 0.01 });
  sim.ignite("0-0", settings({ spreadChance: 0.5 }));
  sim.update(2);
  assert.equal(grid.get("0-1").fire.isBurning(), true);
});

test("fire cannot propagate onto bare soil, spoiled crops, or off-farm pest entries", () => {
  const grid = makeFarm(1, 3);
  grid.get("0-0").crop = null;
  grid.get("0-2").crop.crop_state = CropStates.DEAD;
  grid.set("1-1", { bug: {}, crop: { crop_state: CropStates.YOUNG } });
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  sim.ignite("0-1", settings());
  sim.update(5);
  assert.deepEqual([...sim.fires.keys()], ["0-1"]);
});

test("lethal fire calls crop's no-trace damage API and leaves soil intact", () => {
  const grid = makeFarm(1, 1);
  const tile = grid.get("0-0");
  const crop = tile.crop;
  const soil = tile.soil;
  crop.crop_health = 1;
  soil.water_remaining = 0.7;
  const sim = new FarmEventSimulation(grid);
  const fire = sim.ignite("0-0", settings({ damage: 100, damageInterval: 0.5 }));
  sim.update(0.5);
  assert.deepEqual(crop.lastDamageOptions, { source: "fire", noTrace: true });
  assert.equal(tile.crop, null);
  assert.equal(tile.soil, soil);
  assert.equal(soil.water_remaining, 0.7);
  assert.equal(tile.fire, null);
  assert.equal(fire.isBurning(), false);
});

test("a crop that spoils while burning is removed without a dead remnant at any fire stage", () => {
  for (const maturityTime of [0, 2]) {
    const grid = makeFarm(1, 1);
    const tile = grid.get("0-0");
    const crop = tile.crop;
    const soil = tile.soil;
    const removalReasons = [];
    crop.crop_state = CropStates.HARVESTABLE;
    crop.cropDestroy = reason => {
      removalReasons.push(reason);
      if (tile.crop === crop) tile.crop = null;
    };
    soil.water_remaining = 0.4;
    const sim = new FarmEventSimulation(grid);
    const fire = sim.ignite("0-0", settings());
    sim.update(maturityTime);
    crop.crop_state = CropStates.DEAD;
    sim.update(0.05);
    assert.equal(tile.crop, null);
    assert.equal(tile.soil, soil);
    assert.equal(soil.water_remaining, 0.4);
    assert.equal(fire.isBurning(), false);
    assert.equal(tile.fire, null);
    sim.update(5);
    assert.deepEqual(removalReasons, ["fire"]);
  }
});

test("a juvenile flame cannot grow or spread after its crop is removed", () => {
  const grid = makeFarm(1, 2);
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const fire = sim.ignite("0-0", settings());
  grid.get("0-0").crop = null;
  sim.update(5);
  assert.equal(fire.isBurning(), false);
  assert.equal(sim.fires.size, 0);
  assert.equal(grid.get("0-1").crop.crop_health, 100);
});

test("a mature fire extinguishes immediately after losing its crop even with neighbors", () => {
  const grid = makeFarm(1, 2);
  const sim = new FarmEventSimulation(grid, { random: () => 0.9 });
  const fire = sim.ignite("0-0", settings({ spreadChance: 0.5 }));
  sim.update(2);
  grid.get("0-0").crop = null;
  sim.update(0.05);
  assert.equal(fire.isBurning(), false);
  assert.equal(sim.fires.size, 0);
});

test("an isolated mature fire immediately dies when no crop remains to burn", () => {
  const grid = makeFarm(1, 1);
  const sim = new FarmEventSimulation(grid);
  const fire = sim.ignite("0-0", settings());
  sim.update(2);
  grid.get("0-0").crop = null;
  sim.update(0.05);
  assert.equal(fire.isBurning(), false);
});

test("a mature fire cannot spread after its fuel is removed", () => {
  const grid = makeFarm(1, 2);
  let roll = 0.9;
  const sim = new FarmEventSimulation(grid, { random: () => roll });
  const fire = sim.ignite("0-0", settings({ spreadChance: 0.5 }));
  sim.update(2);
  grid.get("0-0").crop = null;
  roll = 0;
  sim.update(1);
  assert.equal(fire.isBurning(), false);
  assert.equal(grid.get("0-1").fire, undefined);
});

test("bot extinguishing and repeated cleanup cancel damage and release only their own tile reference", () => {
  const grid = makeFarm(1, 1);
  const removed = [];
  const sim = new FarmEventSimulation(grid, { now: () => 123, onFireRemoved: (fire, source) => removed.push(source) });
  const fire = sim.ignite("0-0", settings());
  assert.equal(fire.spawned_at, 123);
  assert.equal(fire.extinguish("bot"), true);
  assert.equal(fire.extinguish("bot"), false);
  const replacement = sim.ignite("0-0", settings());
  fire.destroy();
  assert.equal(grid.get("0-0").fire, replacement);
  replacement.destroy();
  sim.update(200);
  assert.equal(grid.get("0-0").crop.crop_health, 100);
  assert.deepEqual(removed, ["bot", "destroyed"]);
});

test("removing a farm tile unregisters its flame without damaging replacement objects", () => {
  const grid = makeFarm(1, 1);
  const sim = new FarmEventSimulation(grid);
  const fire = sim.ignite("0-0", settings());
  grid.delete("0-0");
  sim.update(0.1);
  assert.equal(fire.isBurning(), false);
  assert.equal(sim.fires.size, 0);
});

test("rain selects crop tiles first, then bare tiles, and counts severity-limited clouds", () => {
  const grid = makeFarm(1, 3, 1);
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const easy = sim.startRain(100);
  assert.deepEqual(easy.clouds.map(cloud => cloud.key), ["0-0"]);
  const heavy = sim.startRain(10000);
  assert.deepEqual(heavy.clouds.map(cloud => cloud.key).sort(), ["0-1", "0-2"]);
  assert.equal(sim.startRain(100).applied, false);
  assert.equal(new FarmEventSimulation(makeFarm()).startRain(10000).clouds.length, 8);
});

test("cloud travels sideways before rainfall; water and extinguishing happen only on drop impact", () => {
  const grid = makeFarm(1, 1);
  const tile = grid.get("0-0");
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const fire = sim.ignite("0-0", settings());
  const result = sim.startRain();
  const cloud = result.clouds[0];
  assert.equal(cloud.side, -1);
  sim.update(RAIN_TIMING.travelDuration / 2);
  assert.equal(cloud.phase, "entering");
  assert.ok(Math.abs((cloud.phaseAge + sim.accumulator) / cloud.travelDuration - 0.5) < 1e-9);
  assert.equal(tile.soil.isWatered(), false);
  sim.update(RAIN_TIMING.travelDuration / 2 + RAIN_TIMING.dropDuration);
  assert.equal(cloud.phase, "raining");
  assert.equal(tile.soil.isWatered(), false);
  assert.equal(fire.isBurning(), true);
  sim.update(0.05);
  assert.equal(tile.soil.isWatered(), true);
  assert.deepEqual(tile.soil.lastWaterOptions, { rain: true });
  assert.equal(fire.isBurning(), false);
  assert.equal(fire.extinguishedBy, "rain");
  assert.equal(result.wateredTiles, 1);
  assert.equal(result.extinguishedFires, 1);
});

test("rain calls the empty soil's watering API without changing its preparation", () => {
  const grid = makeFarm(1, 1, 0);
  const soil = grid.get("0-0").soil;
  soil.soil_state = SoilStates.INITIAL;
  const sim = new FarmEventSimulation(grid);
  const result = sim.startRain();
  sim.update(30);
  assert.ok(soil.waterCalls > 0);
  assert.equal(soil.soil_state, SoilStates.INITIAL);
  assert.equal(result.wateredTiles, 1);
  assert.equal(sim.clouds.size, 0);
  assert.equal(sim.drops.size, 0);
});

test("rain still lands on its soil when the target crop disappears in flight", () => {
  const grid = makeFarm(1, 1);
  const sim = new FarmEventSimulation(grid);
  sim.startRain();
  grid.get("0-0").crop = null;
  sim.update(RAIN_TIMING.travelDuration + RAIN_TIMING.dropDuration + 0.05);
  assert.equal(grid.get("0-0").soil.isWatered(), true);
});

test("destroying a cloud cancels its pending drops and future impacts", () => {
  const grid = makeFarm(1, 1);
  const sim = new FarmEventSimulation(grid);
  const cloud = sim.startRain().clouds[0];
  sim.update(RAIN_TIMING.travelDuration + 0.2);
  assert.equal(sim.drops.size, 1);
  assert.equal(cloud.destroy(), true);
  assert.equal(cloud.destroy(), false);
  sim.update(10);
  assert.equal(sim.clouds.size, 0);
  assert.equal(sim.drops.size, 0);
  assert.equal(grid.get("0-0").soil.waterCalls, 0);
});

test("pause and invalid time input cannot advance events", () => {
  const grid = makeFarm(1, 1);
  const sim = new FarmEventSimulation(grid);
  const fire = sim.ignite("0-0", settings());
  const cloud = sim.startRain().clouds[0];
  for (const dt of [0, -1, NaN, Infinity, undefined]) sim.update(dt);
  assert.equal(fire.age, 0);
  assert.equal(cloud.phaseAge, 0);
  assert.equal(grid.get("0-0").soil.waterCalls, 0);
});

test("fire behavior is invariant to update frame size", () => {
  const gridA = makeFarm();
  const gridB = makeFarm();
  const simA = new FarmEventSimulation(gridA, { random: () => 0.2 });
  const simB = new FarmEventSimulation(gridB, { random: () => 0.2 });
  simA.ignite("1-1", settings({ damageInterval: 1, damage: 3, spreadChance: 0.5 }));
  simB.ignite("1-1", settings({ damageInterval: 1, damage: 3, spreadChance: 0.5 }));
  simA.update(5);
  for (let i = 0; i < 500; i++) simB.update(0.01);
  const snapshot = sim => [...sim.fires.values()].map(fire => ({ key: fire.key, stage: fire.stage, age: fire.age }));
  assert.deepEqual(snapshot(simA), snapshot(simB));
  assert.deepEqual([...gridA.values()].map(tile => tile.crop?.crop_health), [...gridB.values()].map(tile => tile.crop?.crop_health));
});

test("scene disposal clears every event reference and prevents future actions", () => {
  const grid = makeFarm();
  const sim = new FarmEventSimulation(grid);
  const fire = sim.startFire().fires[0];
  sim.startRain();
  sim.update(1.7);
  const waterBeforeDispose=[...grid.values()].reduce((sum,tile)=>sum+tile.soil.waterCalls,0);
  sim.dispose();
  sim.dispose();
  sim.update(100);
  assert.equal(fire.isBurning(), false);
  assert.equal(grid.get(fire.key).fire, null);
  assert.equal(sim.fires.size, 0);
  assert.equal(sim.clouds.size, 0);
  assert.equal(sim.drops.size, 0);
  assert.equal(sim.startFire().applied, false);
  assert.equal(sim.startRain().applied, false);
  assert.equal([...grid.values()].reduce((sum, tile) => sum + tile.soil.waterCalls, 0), waterBeforeDispose);
});

test("fire growth uses the point-scaled clock at every severity", () => {
  for (const points of [100, 500, 2000, 10000]) {
    const sim = new FarmEventSimulation(makeFarm(1, 1));
    const fire = sim.startFire(points).fires[0];
    const duration = fire.settings.stageDuration;
    // The simulation applies transitions on the first 50ms tick at/after
    // the threshold; intermediate point values need not divide that tick.
    const firstStageAt = Math.ceil((duration - 1e-9) / 0.05) * 0.05;
    const adultAt = Math.ceil((2 * duration - 1e-9) / 0.05) * 0.05;
    sim.update(firstStageAt - 0.05);
    assert.equal(fire.stage, 0);
    sim.update(0.05);
    assert.equal(fire.stage, 1);
    sim.update(adultAt - firstStageAt - 0.05);
    assert.equal(fire.stage, 1);
    sim.update(0.05);
    assert.equal(fire.stage, 2);
  }
});

test("spawner points scale fire pressure and rain intensity while travel remains readable", () => {
  let previousFire, previousRain;
  for (const points of [100, 500, 2000, 10000]) {
    const params = getDifficultyParams(points);
    const fire = fireSettings(params);
    const rain = rainSettings(params);
    if (previousFire) {
      assert.ok(fire.stageDuration < previousFire.stageDuration);
      assert.ok(fire.damage / fire.damageInterval > previousFire.damage / previousFire.damageInterval);
      assert.ok(fire.spreadInterval < previousFire.spreadInterval);
      assert.ok(fire.spreadChance > previousFire.spreadChance);
      assert.ok(fire.matureBurnDuration < previousFire.matureBurnDuration);
      assert.ok(rain.rainDuration > previousRain.rainDuration);
      assert.ok(rain.dropInterval < previousRain.dropInterval);
    }
    assert.ok(fire.stageDuration >= 6);
    assert.ok(fire.damage / fire.damageInterval <= 2.5);
    assert.ok(fire.matureBurnDuration >= 1.8 && fire.matureBurnDuration <= 2.2);
    assert.equal(rain.travelDuration, RAIN_TIMING.travelDuration);
    assert.equal(rain.exitDuration, rain.travelDuration);
    const sim = new FarmEventSimulation(makeFarm());
    assert.deepEqual(sim.startFire(points).fires[0].settings, fire);
    const cloud = sim.startRain(points).clouds[0];
    assert.equal(cloud.rainDuration, rain.rainDuration);
    assert.equal(cloud.dropInterval, rain.dropInterval);
    previousFire = fire; previousRain = rain;
  }
});

test("lethal adult damage extinguishes before a simultaneous spread attempt", () => {
  const grid = makeFarm(1, 2);
  let roll = 0.9;
  const sim = new FarmEventSimulation(grid, { random: () => roll });
  const fire = sim.ignite("0-0", settings({ matureBurnDuration: 1, spreadChance: 0.5 }));
  sim.update(2);
  assert.equal(fire.stage, 2);
  assert.equal(grid.get("0-0").crop.crop_health, 100, "maturity starts the burn clock");
  roll = 0;
  sim.update(1);
  assert.equal(grid.get("0-0").crop, null);
  assert.equal(grid.get("0-0").fire, null);
  assert.equal(fire.active, false);
  assert.equal(grid.get("0-1").fire, undefined);
});

test("extinguishing a mature flame cancels the remaining lethal burn", () => {
  const grid = makeFarm(1, 1);
  const sim = new FarmEventSimulation(grid);
  const fire = sim.startFire(100).fires[0];
  sim.update(fire.settings.stageDuration * 2 + 1);
  const health = grid.get("0-0").crop.crop_health;
  assert.ok(health > 0 && health < 75, "mature fire damages heavily before its deadline");
  fire.extinguish("bot");
  sim.update(10);
  assert.equal(grid.get("0-0").crop.crop_health, health);
  assert.equal(sim.fires.size, 0);
});

test("replacement crops cannot inherit a removed crop's fire", () => {
  const grid = makeFarm(1, 2);
  const sim = new FarmEventSimulation(grid, { random: () => 0 });
  const fire = sim.ignite("0-0", settings());
  sim.update(2);
  const replacement = { crop_state: CropStates.YOUNG, crop_health: 20, damage() { assert.fail("old fire damaged new crop"); } };
  grid.get("0-0").crop = replacement;
  sim.update(0.05);
  assert.equal(fire.active, false);
  assert.equal(grid.get("0-0").crop, replacement);
});

test("eased cloud motion stays continuous across arrival and departure", () => {
  const sim = new FarmEventSimulation(makeFarm(1, 1));
  const cloud = sim.startRain().clouds[0];
  const target = { x: 300, y: 200 };
  const position = () => cloudPosition(cloud, 0, target, sim.accumulator);
  assert.equal(position().x, 0);
  sim.update(.67);
  assert.ok(position().x > 0 && position().x < 300, "cubic-out movement starts quickly after the entrance beat");
  sim.update(cloud.travelDuration - .67);
  assert.equal(cloud.phase, "raining");
  assert.equal(position().x, 300);
  sim.update(cloud.rainDuration);
  assert.equal(cloud.phase, "leaving");
  assert.equal(cloud.progress, 0, "departure must not retain arrival's 100% progress");
  assert.ok(Math.abs(position().x - 300) < 1e-8, "no teleport on the transition frame");
  sim.update(0.05);
  const arrival = cloudPosition({phase:"entering",phaseAge:.7,travelDuration:cloud.travelDuration},0,target);
  assert.ok(Math.abs(position().x - (300 - arrival.x)) < 1e-8, "departure mirrors the entrance easing");
  sim.update(cloud.exitDuration - 0.05);
  assert.equal(position().x, 0);
  assert.equal(sim.clouds.size, 0);
});

test("clouds and falling drops animate between fixed ticks and stop with game time", () => {
  const sim = new FarmEventSimulation(makeFarm(1, 1));
  const cloud = sim.startRain().clouds[0];
  const center = { x: 300, y: 200 };
  sim.update(.67);
  const first = cloudPosition(cloud, 0, center, sim.accumulator).x;
  sim.update(0.01);
  const next = cloudPosition(cloud, 0, center, sim.accumulator).x;
  assert.ok(next > first, "visual movement does not wait for the next 50ms tick");
  sim.update(cloud.travelDuration - .68 + 0.05);
  const drop = [...sim.drops.values()][0];
  const start = dropPosition(drop, center, sim.accumulator).y;
  sim.update(0.01);
  assert.ok(dropPosition(drop, center, sim.accumulator).y > start);
  const paused = dropPosition(drop, center, sim.accumulator);
  sim.update(0);
  assert.deepEqual(dropPosition(drop, center, sim.accumulator), paused);
  assert.equal(dropPosition({ ...drop, age: drop.duration }, center).y, center.y);
});

test("cloud pops in and holds before travel, then shrinks only after departure", () => {
  const cloud={phase:"entering",phaseAge:.3,travelDuration:5,exitDuration:4};
  assert.equal(cloudPosition(cloud,0,{x:300,y:200}).x,0);
  assert.ok(cloudAppearance(cloud).scale>1,"entrance overshoots for a bounce");
  cloud.phaseAge=.55;
  assert.equal(cloudPosition(cloud,0,{x:300,y:200}).x,0);
  assert.equal(cloudAppearance(cloud).scale,1);
  cloud.phase="leaving";cloud.phaseAge=3.8;
  assert.equal(cloudPosition(cloud,0,{x:300,y:200}).x,0);
  assert.ok(cloudAppearance(cloud).opacity<1);
});


test("cloud travel keeps a constant height without vertical jiggle",()=>{
 for(const phase of ["entering","raining","leaving"])for(let age=0;age<6;age+=.1){
  assert.equal(cloudPosition({phase,phaseAge:age,travelDuration:5,exitDuration:4},0,{x:300,y:200}).y,100);
 }
});

test("cloud entrance gives its eased flight two seconds after pop and pause",()=>{
 const cloud={phase:"entering",phaseAge:.65,travelDuration:RAIN_TIMING.travelDuration};
 assert.equal(cloudPosition(cloud,0,{x:300,y:200}).x,0);
 cloud.phaseAge=2.05;assert.ok(cloudPosition(cloud,0,{x:300,y:200}).x>300);
 cloud.phaseAge=2.65;assert.equal(cloudPosition(cloud,0,{x:300,y:200}).x,300);
});
