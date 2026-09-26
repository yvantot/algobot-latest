import { addLandBackground } from "../src/game/land-background.js";
import { isolateScene } from "../src/game/challenges/scene-session.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { registerHooks } from "node:module";
import { INTRODUCTION_STORY, demonstrationStory } from "../src/game/global/introduction-story.js";
import { FarmEventSimulation, fireSettings } from "../src/game/events/simulation.js";
import { getDifficultyParams } from "../src/game/events/difficulty.js";
import { evaluateChallenge } from "../src/game/challenges/engine.js";
import { CHALLENGES } from "../src/game/challenges/catalog.js";
import { joinBotInbox } from "../src/game/global/bot-messages.js";
import { cropReading } from "../src/game/global/crop-inspection.js";
import { scenarioSolutions } from "./scenario-solutions.js";
import { CropStates, CropTypes, FreshnessStates, SoilStates, IconTypes, OrbTypes } from "../src/game/global/enum.js";

const dataHook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/src/lib/kaplay.js")) return { format: "module", source: "export const k = {};", shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { CROP_DATA: deployedCropData, BASE_CROP_DATA } = await import("../src/game/global/global.js");
dataHook.deregister();

// Exercise the actual component methods with a small engine boundary. Destruction
// mirrors KAPLAY: component hooks run before child teardown and timer updates stop.
function harness() {
  let dt = 0;
  let now = 0;
  const roots = new Set();
  const timers = [];
  const visualDrops = [];
  const rewards = { coins: 0, exp: 0, seeds: 0, spoiled: 0 };
  const vec2 = (x = 0, y = x) => typeof x === "object" ? { x: x.x, y: x.y } : { x, y };
  function make(components, parent = null) {
    const hooks = { add: [], update: [], destroy: [] };
    const object = {
      children: [], parent, removed: false, pos: vec2(), angle: 0, scale: vec2(1),
      animations: {}, animation: { seek() {} },
      animate(name, keys, options) { this.animations[name] = { keys, options }; },
      unanimate(name) { delete this.animations[name]; }, unanimateAll() { this.animations = {}; }, tag() {},
      add(list) { return make(list, this); },
      wait(delay, fn) {
        const timer = { owner: this, at: now + delay, fn, canceled: false, cancel() { this.canceled = true; } };
        timers.push(timer);
        return timer;
      },
      loop(delay, fn) { const timer=this.wait(delay, fn);timer.repeat=delay;return timer; },
      exists() { return !this.removed; },
      update() { for (const fn of hooks.update) if (!this.removed) fn.call(this); },
      destroy() {
        if (this.removed) return;
        for (const fn of hooks.destroy) fn.call(this);
        this.removed = true;
        for (const timer of timers) if (timer.owner === this) timer.cancel();
        for (const child of [...this.children]) child.destroy();
        if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
        roots.delete(this);
      },
    };
    for (const component of components) {
      if (typeof component !== "object") continue;
      for (const [key, value] of Object.entries(component)) {
        if (key in hooks) { hooks[key].push(value); continue; }
        if (["id", "require"].includes(key)) continue;
        object[key] = typeof value === "function" ? value.bind(object) : value;
      }
    }
    if (parent) parent.children.push(object); else roots.add(object);
    for (const fn of hooks.add) fn.call(object);
    return object;
  }
  const k = {
    dt: () => dt, height: () => 600, vec2, add: list => make(list),
    rand: (a, b) => (a + b) / 2,
    readd(object) { roots.delete(object); roots.add(object); },
    easings: {}, WHITE: "white", RED: "red", GREEN: "green", YELLOW: "yellow",
    rect:(width,height)=>({width,height}),color:color=>({color}),
    pos: (x, y) => ({ pos: vec2(x, y) }), sprite: (sprite, options = {}) => ({ sprite, frame: options.frame ?? 0 }),
    circle: radius => ({ radius }), mask: mask => ({ mask }), opacity: (opacity = 1) => ({ opacity }),
    scale: (x = 1, y = x) => ({ scale: vec2(x, y) }), z: (z = 0) => ({ z }),
    anchor: anchor => ({ anchor }), rotate: () => ({ angle: 0 }), animate: () => ({}), timer: () => ({}), layer: () => ({}),
  };
  const CROP_DATA = Object.fromEntries(Object.values(CropTypes).map(type => [type, {
    duration: 10, health: 20, reward: 6, exp: 4, spoilage_time: 8, resistance: { fire: 1, bug: 0.5 }, seed_drop_chance: 0,
  }]));
  const CONFIG = { FARM: { tile_size: 64, cell_size: 70, grid_origin: vec2(), columns: 2, rows: 2 }, BOT: { move_duration: 0.7, action_duration: 0.8, check_duration: 0.5 } };
  const context = vm.createContext({
    tutorialPolicy: { protected: false }, joinBotInbox, cropReading, k, CONFIG, CROP_DATA, CropStates, CropTypes, SoilStates, FreshnessStates, IconTypes, OrbTypes, console,
    robots: [], triggerDidYouKnow() {}, play_sfx() {},
    telemetry: { recordCropHarvestOutcome(spoiled) { if (spoiled) rewards.spoiled++; }, recordError() {}, recordEventResponse() {} },
    INVENTORY: { crops: { wheat: 100 }, changeCoins(value) { rewards.coins += value; }, changeCrops(type, value) { rewards.seeds += value; } },
    PLAYER_DATA: { changeExp(value) { rewards.exp += value; } },
    DOCUMENT_DATA: { crops: {} }, SAY_DATA: { farm: { error: { no_plant: "No crop", no_bug: "No bug", water_initial: "Till first", water_watered: "Already watered", out_of_bounds: "Out of bounds" } } },
    lerpvec2: (a, b, progress) => vec2(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress),
    ysort: () => ({}), popupicon: () => ({ showIcon() {} }), dropOrbs: () => ({ dropOrbs(object, count, sprite) { const orb = make([]); visualDrops.push({count,sprite,orb}); return [orb]; } }),
    effects: () => ({ effectsEnabled() {}, showEffects() {} }),
  });
  for (const name of ["grid", "soil", "freshness", "crop", "robot", "pest"]) {
    const source = fs.readFileSync(new URL(`../src/game/components-kaplay/${name}.js`, import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function");
    vm.runInContext(source, context);
  }
  const farm = new Map();
  function addSoil(x = 0, y = 0, state = SoilStates.READY) {
    const soil = context.addSoilToGrid(x, y, state, farm);
    farm.set(`${y}-${x}`, { soil, crop: null });
    return soil;
  }
  function plant(type = CropTypes.WHEAT, state = CropStates.YOUNG, x = 0, y = 0) {
    const crop = context.addCrop(farm, type, x, y, state);
    farm.get(`${y}-${x}`).crop = crop;
    return crop;
  }
  function bot(id = 1) {
    return make([{ grid_x: 0, grid_y: 0, display_obj: {}, setDisplayColor() {}, sayText() {}, showIcon() {} }, context.gridpos(0, 0), context.gridmove(), context.botact(id, farm)]);
  }
  function advance(seconds) {
    dt = seconds;
    now += seconds;
    for (const object of [...roots]) object.update();
    // Newly scheduled timers start on this simulated frame, like engine waits.
    for (const timer of [...timers]) {
      if (timer.canceled || timer.owner.removed || timer.at > now) continue;
      if(timer.repeat)timer.at=now+timer.repeat;else timer.canceled = true;
      timer.fn();
    }
  }
  return { context, make, k, farm, timers, roots, rewards, visualDrops, addSoil, plant, bot, advance };
}

test("live demonstration plants and harvests without changing player rewards", () => {
  const h = harness();
  h.farm.isDemonstration = true;
  h.farm.demoEffects = [];
  h.addSoil();
  h.context.INVENTORY.crops.wheat = 0;
  const bot = h.bot(); h.advance(1);
  assert.equal(bot.botPlant("wheat"), true);
  h.advance(1);
  const crop = h.farm.get("0-0").crop;
  assert.ok(crop);
  crop.crop_state = CropStates.HARVESTABLE;
  assert.equal(bot.botHarvest(), "wheat");
  h.advance(2);
  assert.equal(h.farm.get("0-0").crop, null);
  assert.deepEqual(h.rewards, { coins: 0, exp: 0, seeds: 0, spoiled: 0 });
  assert.deepEqual(h.visualDrops.map(drop => drop.sprite), [OrbTypes.EXP, OrbTypes.COIN]);
  assert.equal(h.farm.demoEffects.length, 2, "demo owns the transient reward visuals");
});

test("protected practice allows crop growth but defers deterioration until released", () => {
  const h = harness(); const soil = h.addSoil(); const crop = h.plant();
  h.context.tutorialPolicy.protected = true;
  soil.water(); h.advance(10);
  assert.equal(crop.crop_state, CropStates.GROWING);
  soil.water(); h.advance(10);
  assert.equal(crop.crop_state, CropStates.HARVESTABLE);
  h.advance(100);
  assert.equal(crop.crop_state, CropStates.HARVESTABLE);
  assert.equal(crop.spoilage_remaining, 8);
  h.context.tutorialPolicy.protected = false;
  h.advance(8);
  assert.equal(crop.crop_state, CropStates.DEAD);
});

test("only the cutscene's designated crop can spoil during protected practice", () => {
  const h = harness(); h.addSoil();
  h.context.tutorialPolicy.protected = true;
  const crop = h.plant(CropTypes.WHEAT, CropStates.HARVESTABLE);
  crop.demonstrateSpoilage = true;
  h.advance(10);
  assert.equal(crop.crop_state, CropStates.HARVESTABLE, "a player crop cannot bypass practice protection");
  h.farm.isDemonstration = true;
  h.advance(10);
  assert.equal(crop.crop_state, CropStates.DEAD);
  assert.equal(h.rewards.spoiled, 0, "cutscene spoilage must not become a research outcome");
});

test("cutscene fire and pest responses do not enter player telemetry", () => {
  const h = harness(); h.addSoil(); h.farm.isDemonstration = true;
  let responses = 0;
  h.context.telemetry.recordEventResponse = () => responses++;
  const bot = h.bot(); h.advance(1);
  h.farm.get("0-0").fire = { spawned_at: 1, isBurning: () => true, extinguish: () => true };
  assert.equal(bot.botExtinguish(), true); h.advance(1);
  h.farm.get("0-0").bug = { spawned_at: 1, bugDestroy() {} };
  assert.equal(bot.botKillBug(), true);
  assert.equal(responses, 0);
});

test("empty watered soil drains visually in 0.25 seconds without storing a growth dose", () => {
  const h = harness(); const soil = h.addSoil();
  soil.water();
  const mask = soil.soil_water_mask;
  assert.equal(mask.parent, soil);
  assert.equal(soil.water_remaining, 0);
  assert.equal(soil.soil_state, SoilStates.READY);
  h.advance(0.125);
  assert.ok(mask.radius > 0 && mask.radius < 64 * 0.71);
  const crop = h.plant();
  h.advance(0.125);
  assert.equal(soil.soil_water_mask, null);
  assert.equal(mask.removed, true);
  assert.equal(crop.crop_grow_time, 0, "the draining visual cannot feed a new crop");
  soil.water(); h.advance(4);
  assert.equal(crop.crop_grow_time, 4);
  assert.equal(soil.water_remaining, 0.6);
  assert.equal(soil.parent, null);
});

test("bot removal during absorption releases water and a replacement needs a fresh dose", () => {
  const h = harness(); const soil = h.addSoil();
  const first = h.plant(); soil.water(); h.advance(4);
  const bot = h.bot(); h.advance(0.7);
  let result;
  assert.equal(bot.botDestroy(value => { result = value; }), true);
  assert.equal(first.removed, true);
  assert.equal(h.farm.get("0-0").crop, null);
  // Replant before soil.update: an old dose must not leak into the new crop.
  const replacement = h.plant(); h.advance(1);
  assert.equal(soil.isWatered(), false);
  assert.equal(replacement.crop_grow_time, 0);
  assert.equal(result, true);
  soil.water(); h.advance(10);
  assert.equal(replacement.crop_state, CropStates.GROWING);
});

test("raw destruction preserves the soil and a replacement's newly watered dose", () => {
  const h = harness(); const soil = h.addSoil();
  const first = h.plant(); soil.water(); h.advance(3);
  const replacement = h.plant(); soil.water();
  first.destroy(); first.cropDestroy(); first.destroy();
  assert.equal(h.farm.get("0-0").crop, replacement);
  assert.equal(soil.removed, false);
  assert.equal(soil.water_remaining, 1);
  assert.equal(soil.soil_water_mask.removed, false);
  h.advance(1);
  assert.equal(replacement.crop_grow_time, 1);
});

test("orphaned crop update removes itself without harming the replacement", () => {
  const h = harness(); h.addSoil(); const first = h.plant(); const second = h.plant();
  h.advance(1);
  assert.equal(first.removed, true);
  assert.equal(h.farm.get("0-0").crop, second);
});

test("two watering doses mature a crop and leftover water clears after spoilage", () => {
  const h = harness(); const soil = h.addSoil(); const crop = h.plant();
  soil.water(); h.advance(10);
  assert.equal(crop.crop_state, CropStates.GROWING);
  assert.equal(soil.isWatered(), false);
  soil.water(); h.advance(10);
  assert.equal(crop.crop_state, CropStates.HARVESTABLE);
  assert.equal(crop.spoilage_remaining, 8);
  soil.water(); h.advance(4.1); h.advance(0.1);
  assert.equal(crop.freshness_state, FreshnessStates.EXPIRING);
  assert.equal(soil.water_remaining, 1);
  h.advance(4); h.advance(100);
  assert.equal(crop.crop_state, CropStates.DEAD);
  assert.equal(h.rewards.spoiled, 1);
  assert.equal(soil.water_remaining, 0);
  assert.equal(soil.soil_water_mask, null);
});

test("rain on empty untilled soil drains quickly without preparing it", () => {
  const h = harness(); const soil = h.addSoil(0, 0, SoilStates.INITIAL);
  assert.equal(soil.water(), false);
  assert.equal(soil.water({ rain: true }), true);
  assert.equal(soil.soil_state, SoilStates.INITIAL);
  assert.ok(soil.soil_water_mask);
  h.advance(0.25);
  assert.equal(soil.soil_water_mask, null);
  assert.equal(soil.water_remaining, 0);
  assert.equal(soil.till(), true);
  assert.equal(soil.soil_state, SoilStates.READY);
  assert.equal(soil.isWatered(), false);
});

test("lethal fire destroys a crop immediately during absorption and respects resistance once", () => {
  const h = harness(); const soil = h.addSoil(); const crop = h.plant(); soil.water(); h.advance(2);
  crop.damage(10, { source: "bug" }); assert.equal(crop.crop_health, 15);
  crop.damage(100, { source: "fire", noTrace: true });
  assert.equal(crop.removed, true);
  assert.equal(h.farm.get("0-0").crop, null);
  assert.equal(soil.isWatered(), false);
  assert.equal(soil.water_remaining, 0);
  assert.ok(soil.soil_water_mask);
  h.advance(0.25);
  assert.equal(soil.soil_water_mask, null);
  assert.equal(crop.damage(100), false);
});

test("destroying a harvesting crop cancels rewards, even if a stale callback is invoked", () => {
  const h = harness(); h.addSoil(); const crop = h.plant(CropTypes.WHEAT, CropStates.HARVESTABLE);
  assert.equal(crop.harvest(), true);
  const pending = [...h.timers];
  crop.damage(100, { source: "fire", noTrace: true });
  h.plant();
  for (const timer of pending) timer.fn();
  h.advance(10);
  assert.equal(h.rewards.exp, 0);
  assert.equal(h.rewards.coins, 0);
  assert.equal(h.rewards.seeds, 0);
});

test("sugarcane harvest regrows once and no expiry callback kills the new stage", () => {
  const h = harness(); h.addSoil(); const crop = h.plant(CropTypes.SUGARCANE, CropStates.HARVESTABLE);
  assert.equal(crop.harvest(), true);
  assert.equal(crop.harvest(), false);
  h.advance(0.5); h.advance(0.5); h.advance(100);
  assert.equal(crop.crop_state, CropStates.GROWING);
  assert.equal(crop.removed, false);
  assert.equal(crop.is_harvesting, false);
  assert.equal(h.rewards.exp, 4);
  assert.equal(h.rewards.coins, 6);
  assert.equal(h.rewards.spoiled, 0);
});

test("bot harvest waits for crop rewards and reports false when fire cancels the harvest", () => {
  for (const killed of [false, true]) {
    const h = harness(); h.addSoil(); const bot = h.bot(); h.advance(0.7);
    const crop = h.plant(CropTypes.WHEAT, CropStates.HARVESTABLE);
    bot.botact_duration = 0.1;
    const results = [];
    assert.equal(bot.botHarvest(value => results.push(value)), CropTypes.WHEAT);
    h.advance(0.1);
    assert.deepEqual(results, []);
    assert.equal(bot.is_available, false);
    if (killed) crop.damage(100, { source: "fire", noTrace: true });
    h.advance(0.5); h.advance(0.5);
    assert.deepEqual(results, [killed ? false : CropTypes.WHEAT]);
    assert.equal(h.rewards.coins, killed ? 0 : 6);
    assert.equal(bot.is_available, true);
  }
});

test("bot water extinguishes a fire on already wet soil and reports completion once", () => {
  const h = harness(); const soil = h.addSoil(); h.plant(CropTypes.WHEAT, CropStates.HARVESTABLE); soil.water(); const bot = h.bot(); h.advance(0.7);
  const tile = h.farm.get("0-0"); let burning = true;
  tile.fire = { isBurning: () => burning, extinguish(source) { assert.equal(source, "bot"); const wasBurning = burning; burning = false; return wasBurning; } };
  const result = [];
  assert.equal(bot.botWater(value => result.push(value)), true);
  assert.equal(burning, false);
  h.advance(1); h.advance(1);
  assert.deepEqual(result, [true]);
  bot.botExtinguish(value => result.push(value)); h.advance(1);
  assert.deepEqual(result, [true, false]);
});

test("bot movement commits position before its completion callback; raw destruction removes all registrations", () => {
  const h = harness(); h.addSoil(); h.addSoil(1, 0); const bot = h.bot(); h.advance(0.7);
  let position;
  bot.botJump(1, 0, success => { position = [success, bot.grid_x, bot.grid_y]; });
  h.advance(0.7);
  assert.deepEqual(position, [true, 1, 0]);
  assert.equal(h.farm.get("0-1").bots[0], bot);
  let interrupted;
  bot.botWait(2, value => { interrupted = value; });
  bot.destroy(); h.advance(3);
  assert.equal(interrupted, false);
  assert.ok([...h.farm.values()].every(tile => !tile.bots?.includes(bot)));
});

test("direct soil destruction clears only its decorative child and safely stops growth", () => {
  const h = harness(); const soil = h.addSoil(); const crop = h.plant(); soil.water();
  const mask = soil.soil_water_mask; soil.destroy(); h.advance(2);
  assert.equal(mask.removed, true);
  assert.equal(soil.consumeWater(1, 10), 0);
  assert.equal(crop.crop_grow_time, 0);
});

test("raw bug destruction clears its reserved destination even before a jump updates coordinates", () => {
  const h = harness(); h.addSoil(); h.addSoil(1, 0);
  const bug = h.make([h.context.gridpos(null, null), h.context.gridmove(), h.context.bug(h.farm)]);
  bug.updateGridIndex(1, 0);
  assert.equal(h.farm.get("0-1").bug, bug);
  bug.destroy();
  assert.equal(h.farm.get("0-1").bug, null);
  assert.equal(h.farm.size, 2, "temporary off-grid spawn reservations are removed");
  assert.ok(h.timers.filter(timer => timer.owner === bug).every(timer => timer.canceled));
});

test("planting into an explicit target uses that tile and does not replace its shared record", () => {
  const h = harness(); h.addSoil(); h.addSoil(1, 0); const bot = h.bot(); h.advance(0.7);
  const target = h.farm.get("0-1");
  assert.equal(bot.botPlant(CropTypes.WHEAT, null, 1, 0), true);
  assert.equal(h.farm.get("0-1"), target);
  assert.equal(target.crop.grid_x, 1);
  assert.equal(target.crop.grid_y, 0);
  assert.equal(h.farm.get("0-0").crop, null);
});

test("every deployed crop survives fire growth, then burns down within about two mature seconds", () => {
  for (const points of [100, 500, 2000, 10000]) for (const [type, data] of Object.entries(deployedCropData)) {
    const h = harness();
    h.context.CROP_DATA[type] = data;
    const soil = h.addSoil();
    const crop = h.plant(type);
    soil.water();
    h.addSoil(1, 0);
    h.plant(type, CropStates.YOUNG, 1, 0);
    const sim = new FarmEventSimulation(h.farm, { random: () => 0 });
    const fire = sim.ignite("0-0", fireSettings(getDifficultyParams(points)));
    let spreadObserved = false;
    let matureStartingHealth;
    let heavyDamageObserved = false;
    // Leave the young crop unharvested; fire must kill it by damage even if it
    // never matures/spoils. Wet soil must not provide damage immunity.
    for (let tick = 0; tick < 2400 && !crop.removed; tick++) {
      h.advance(0.05);
      sim.update(0.05);
      if (fire.stage === 2 && matureStartingHealth === undefined) matureStartingHealth = crop.crop_health;
      if (!crop.removed && fire.matureAge >= fire.settings.matureBurnDuration * 0.6) {
        heavyDamageObserved ||= crop.crop_health < matureStartingHealth * 0.6;
      }
      if (sim.fires.has("0-1")) spreadObserved = true;
      if (fire.stage < 2) assert.ok(crop.crop_health > 0, `${type} survives juvenile fire at ${points} points`);
    }
    assert.equal(spreadObserved, true, `${type} survives an actual spread attempt at ${points} points`);
    assert.equal(heavyDamageObserved, true, `${type} takes substantial damage during mature fire`);
    assert.ok(Math.abs(fire.matureAge - fire.settings.matureBurnDuration) < 0.051, `${type} burns down on the configured mature deadline at ${points} points`);
    assert.equal(crop.removed, true, `${type} must eventually burn down at ${points} points`);
    assert.equal(crop.crop_health, 0, `${type} dies from damage, not spoilage`);
    assert.equal(crop.crop_removal_reason, "fire");
    assert.equal(fire.isBurning(), false);
    assert.equal(h.farm.get("0-0").fire, null);
    assert.equal(h.farm.get("0-0").crop, null);
    assert.equal(soil.exists(), true);
    assert.deepEqual(h.rewards, { coins: 0, exp: 0, seeds: 0, spoiled: 0 });
  }
});


test("freshness sparkles and flies stay in front when crop depth changes", () => {
  const h = harness(); h.addSoil();
  const crop = h.plant(CropTypes.WHEAT, CropStates.HARVESTABLE);
  crop.z = 300; crop.initFreshness();
  assert.equal(crop.freshness_effects.length, 3);
  assert.ok(crop.freshness_effects.every(effect => effect.z === 301));
  crop.ysort_enabled = true; crop.pos.y = 400; crop.ysort_add = 10;
  h.advance(0.1);
  assert.ok(crop.freshness_effects.every(effect => effect.z === 411));
  h.advance(4); h.advance(0.1);
  assert.ok(crop.freshness_effects.every(effect => effect.sprite === "icon_fly" && effect.z === 411));
  crop.destroy();
  assert.equal(crop.freshness_effects.length, 0);
});

test("watering a living crop during empty-soil drain cancels only the old visual", () => {
  const h = harness(); const soil = h.addSoil();
  soil.water(); h.advance(0.1);
  const crop = h.plant(); soil.water(); h.advance(0.3);
  assert.equal(soil.isWatered(), true);
  assert.ok(Math.abs(soil.water_remaining - 0.97) < 1e-9);
  assert.equal(crop.crop_grow_time, 0.3);
  assert.ok(soil.soil_water_mask);
});


test("large robot stacks retain tile order after movement and removal", () => {
  const h = harness(); h.addSoil(); h.addSoil(1, 0);
  const bots = Array.from({ length: 12 }, () => h.bot());
  h.advance(0.7);
  const first = bots[0];
  first.botJump(1, 0); h.advance(0.7);
  first.botJump(0, 0); h.advance(0.7); h.advance(0);
  const stack = h.farm.get("0-0").bots;
  assert.equal(stack.at(-1), first, "returning bottom bot becomes the top occupant");
  assert.deepEqual([...h.roots].filter(bot => stack.includes(bot)), Array.from(stack), "draw order follows stack order, not creation order");
  for (const [index, bot] of stack.entries()) {
    assert.equal(bot.anchor.y, index + 1);
    assert.equal(bot.display_obj.opacity, index === stack.length - 1 ? 1 : 0);
  }
  first.destroy(); bots[5].destroy(); h.advance(0);
  const remaining = h.farm.get("0-0").bots;
  assert.deepEqual([...h.roots].filter(bot => remaining.includes(bot)), Array.from(remaining));
  assert.equal(remaining.at(-1).display_obj.opacity, 1);
});

test("freshness restores distinct sparkle, flying-insect and rising green gas animations", () => {
  const h = harness(); h.addSoil();
  const crop = h.plant(CropTypes.WHEAT, CropStates.HARVESTABLE);
  const effects = [...crop.freshness_effects];
  assert.ok(effects.every(effect => effect.sprite === "icon_sparkle" && effect.animations.angle && effect.animations.opacity));
  h.advance(4.1); h.advance(0.01);
  assert.ok(effects.every(effect => effect.sprite === "icon_fly" && effect.animations.pos.keys.length === 10));
  assert.ok(effects.every(effect => !effect.animations.opacity && effect.opacity === 1));
  h.advance(4);
  assert.deepEqual(effects.map(effect => effect.sprite), ["icon_poison1", "icon_poison2", "icon_poison1"]);
  assert.ok(effects.every(effect => effect.animations.pos.keys[1].y < effect.animations.pos.keys[0].y));
  assert.ok(effects.every(effect => effect.animations.opacity.keys.join() === "0,1,0"));
  const gasAnimation = effects[0].animations.pos;
  h.advance(2);
  assert.equal(effects[0].animations.pos, gasAnimation, "dead-state update does not restart gas every frame");
  assert.equal(crop.freshness_effects.length, 3, "rot retains its gas until removed");
  crop.cropDestroy();
  assert.ok(effects.every(effect => effect.removed));
  assert.equal(crop.freshness_effects.length, 0);
});

test("directly rotted young crops get gas, while lethal fire leaves no gas or crop", () => {
  const h = harness(); h.addSoil(); const crop = h.plant();
  crop.markDead();
  assert.equal(crop.freshness_effects.length, 3);
  const effects = [...crop.freshness_effects];
  crop.damage(100, { source: "fire", noTrace: true });
  assert.ok(effects.every(effect => effect.removed));
  assert.equal(h.farm.get("0-0").crop, null);
});

test("scripted demonstration pest starts on its tile and never begins a wandering jump", () => {
  const h=harness(); h.addSoil(); h.farm.isDemonstration=true;
  const pest=h.make([h.context.gridpos(0,0),h.context.gridmove(),h.context.bug(h.farm,{spawnAt:{x:0,y:0},stationary:true})]);
  h.advance(10);
  assert.equal(pest.grid_x,0); assert.equal(pest.grid_y,0);
  assert.equal(h.farm.get("0-0").bug,pest);
  assert.equal(pest.animations.pos,undefined);
});

for (const lesson of ["full", "basics", "events", "upgrades"]) test(`every demonstration chapter completes with real crop, robot and event actions (${lesson})`, async () => {
  const h=harness(), changes=[], runtimes=new Map();
  Object.assign(h.context.CONFIG.FARM,{rows:3,columns:3,gap:6});
  h.context.tutorialPolicy.protected=true;
  Object.assign(h.k,{get:()=>[...h.roots],debug:{timeScale:1},getCamPos:()=>({x:0,y:0}),getCamScale:()=>({x:1,y:1}),setCamPos(){},setCamScale(){},onUpdate(fn){const owner=h.make([{update:fn}]);return {cancel:()=>owner.destroy()};}});
  h.context.addLandBackground=addLandBackground;
  h.context.document={hidden:false}; h.context.INTRODUCTION_STORY=INTRODUCTION_STORY;
  h.context.addFarmbot=(id,grid,x,y)=>h.make([{display_obj:{},setDisplayColor(){},sayText(){},showIcon(){}},h.context.gridpos(x,y),h.context.gridmove(),h.context.botact(id,grid)]);
  h.context.getFarmEventRuntime=grid=>{
    if(runtimes.has(grid))return runtimes.get(grid);
    const simulation=new FarmEventSimulation(grid,{random:()=>0});
    const owner=h.make([{update(){simulation.update(h.k.dt());},destroy(){simulation.dispose();runtimes.delete(grid);}}]);
    const runtime={owner,simulation};runtimes.set(grid,runtime);return runtime;
  };
  h.context.destroyFarmEvents=grid=>runtimes.get(grid)?.owner.destroy();
  const source=fs.readFileSync(new URL("../src/game/global/live-demonstration.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replace("export function","function");
  vm.runInContext(source,h.context);
  const story=lesson === "full" ? INTRODUCTION_STORY : demonstrationStory(lesson);
  const controller=h.context.startLiveDemonstration(change=>changes.push(change),{chapters:story});
  for(let chapter=0;chapter<story.length;chapter++){
    let frames=0;
    for(let frame=0;frame<1800&&!changes.findLast(change=>"ready" in change)?.ready;frame++){frames++;const pending=changes.findLast(change=>"purchase" in change)?.purchase;if(pending)controller.purchase(pending.id);h.advance(.05);await Promise.resolve();await Promise.resolve();}
    assert.equal(changes.at(-1)?.error,undefined,story[chapter].action+" failed");
    assert.equal(changes.findLast(change=>"ready" in change)?.ready,true,story[chapter].action+" stalled");
    if(story[chapter].action==="workflow"){
      assert.ok(frames*.05<16,"team explanation must arrive without waiting for a lap");
      const before=changes.filter(change=>change.line>=0).length;
      for(let i=0;i<30;i++){h.advance(.05);await Promise.resolve();await Promise.resolve();}
      assert.ok(changes.filter(change=>change.line>=0).length>before,"bots keep working after the explanation");
    }
    if(chapter<story.length-1)controller.next();
  }
  controller.dispose();
  assert.deepEqual(h.rewards,{coins:0,exp:0,seeds:0,spoiled:0});
  assert.equal(runtimes.size,0);
  assert.equal(h.context.CONFIG.FARM.rows,3);
  assert.equal(h.context.CONFIG.FARM.columns,3);
});

test("challenge interpreter harvests real crop objects without changing main-farm rewards", async()=>{
  const h=harness();
  h.farm.isDemonstration=true;h.farm.freezeCropLifecycle=true;
  const interpreterContext=vm.createContext({console,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(new URL('../public/js-interpreter.js',import.meta.url),'utf8'),interpreterContext);
  const world={reset(layout){
    for(const object of [...h.roots])object.destroy();h.farm.clear();
    h.farm.demoBounds={rows:1,columns:layout.length};
    layout.forEach((ready,x)=>{h.addSoil(x);h.plant(CropTypes.WHEAT,ready?CropStates.HARVESTABLE:CropStates.YOUNG,x);});
    return h.bot();
  }};
  const result=await evaluateChallenge('for(var x=0;x<columns();x++){if(bot.is_harvestable())bot.harvest();if(x<columns()-1)bot.right();}',CHALLENGES[0],interpreterContext.Interpreter,{world,yieldControl:async()=>{h.advance(.05);}});
  assert.equal(result.score,3);
  assert.deepEqual(h.rewards,{coins:0,exp:0,seeds:0,spoiled:0});
  assert.equal([...h.farm.values()].filter(tile=>tile.crop).length,0);
  assert.ok([...h.farm.values()].filter(tile=>tile.crop).every(tile=>tile.crop.crop_state===CropStates.YOUNG));
});

function scenarioHarness() {
  const h=harness();h.farm.isDemonstration=true;h.farm.freezeCropLifecycle=true;
  Object.assign(h.context.CROP_DATA,structuredClone(deployedCropData));
  const interpreterContext=vm.createContext({console,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(new URL('../public/js-interpreter.js',import.meta.url),'utf8'),interpreterContext);
  const world={robots:[],reset(layout,task={}){
    for(const object of [...h.roots])object.destroy();h.farm.clear();
    h.farm.freezeCropLifecycle=!["sequence","team"].includes(task.kind);
    h.farm.isChallenge=true;
    h.farm.demoBounds={rows:1,columns:layout.length};
    layout.forEach((value,x)=>{
      const spec=typeof value==='object'?value:{type:'wheat',state:value?'ready':'young'};
      h.addSoil(x,0,spec.state==='bare'?SoilStates.INITIAL:SoilStates.READY);
      if(spec.type){const crop=h.plant(spec.type,spec.state==='ready'?CropStates.HARVESTABLE:CropStates.YOUNG,x);
        if(spec.state==='dead')crop.markDead();if(spec.timeLeft)crop.spoilage_remaining=spec.timeLeft;}
    });
    this.robots=[h.bot(0)];
    if(task.kind==='team')this.robots.push(h.bot(1));
    return this.robots[0];
  },inspect:()=>[...h.farm.values()].map(tile=>({watered:tile.soil.isWatered()})),
    progress:()=>JSON.stringify([...h.farm.values()].map(tile=>[tile.crop?.crop_state,tile.crop?.crop_grow_time,tile.soil.water_remaining,tile.crop?.crop_health])),
  };
  const run=(code,task,extra={})=>evaluateChallenge(code,task,interpreterContext.Interpreter,{world,yieldControl:async()=>{h.advance(.05);},...extra});
  return {h,run};
}

test("all ten challenges succeed without triggering main-farm tips or rewards",async()=>{
  const {h,run}=scenarioHarness();
  const tips=[];h.context.triggerDidYouKnow=id=>tips.push(id);
  const harvest='for(var x=0;x<columns();x++){if(bot.is_harvestable())bot.harvest();if(x<columns()-1)bot.right();}';
  for(const task of CHALLENGES){
    const solution=task.kind?scenarioSolutions[task.kind]:harvest+(task.returnHome?'for(var x=1;x<columns();x++)bot.left();':'');
    const result=await run(solution,task);
    assert.equal(result.passed,true,task.id+JSON.stringify(result));
    assert.deepEqual(tips,[],task.id);
    assert.deepEqual(h.rewards,{coins:0,exp:0,seeds:0,spoiled:0});
  }
});

test("failed programs in every challenge cannot open main-farm tips",async()=>{
  const {h,run}=scenarioHarness(),tips=[];h.context.triggerDidYouKnow=id=>tips.push(id);
  for(const task of CHALLENGES){
    const source=task.kind==='team'?JSON.stringify({programs:['bot.jump(-1,0);','bot.harvest();']}):'bot.left();bot.harvest();';
    const result=await run(source,task);
    assert.equal(result.passed,false,task.id);
    assert.deepEqual(tips,[],task.id);
  }
});

test("new rubrics reject wrong ordering, blind treatment, unrolled watering and greedy route traps",async()=>{
  const {run}=scenarioHarness();const task=kind=>CHALLENGES.find(t=>t.kind===kind);
  assert.equal((await run('bot.plant("corn");',task('sequence'))).passed,false);
  assert.equal((await run('bot.water();bot.right();bot.water();bot.right();bot.water();',task('clinic'))).passed,false);
  const unrolled=await run('bot.water();bot.right();bot.water();',task('irrigation'));
  assert.equal(unrolled.results[0].checks.watered_every_crop,true);assert.equal(unrolled.results[0].checks.used_loop,false);
  assert.equal((await run('for(var x=0;x<columns();x++){bot.harvest();if(x<columns()-1)bot.right();}',task('greedy'))).passed,false);
  const greedyTrap=await run('bot.jump(3,0);bot.harvest();',task('planning'));
  assert.equal(greedyTrap.results[0].earned,9);assert.equal(greedyTrap.results[0].optimal_value,13);assert.equal(greedyTrap.passed,false);
  assert.equal((await run('bot.jump(3,0);bot.harvest();bot.left();',task('planning'))).passed,false);
  assert.equal((await run('while(true){}',task('sequence'))).passed,false);
  const controller=new AbortController();
  await assert.rejects(run('bot.till();bot.plant("corn");',task('sequence'),{signal:controller.signal,onAction:event=>{if(event.command==='till')controller.abort();}}),{name:'AbortError'});
});

test("corn grows and consumes water during checks without any bot.wait command",async()=>{
  const {h,run}=scenarioHarness();let absorbing=false;
  const task=CHALLENGES.find(task=>task.id==='corn-sequence-v2');
  const outcome=await run('bot.till();bot.plant("corn");while(!bot.is_harvestable()){if(!bot.is_watered()){bot.water();}}bot.harvest();',task,{
    onAction(){const tile=h.farm.get('0-0');if(tile.crop){assert.equal(tile.crop.crop_duration,30);if(tile.soil.water_remaining>0&&tile.soil.water_remaining<.9)absorbing=true;}}
  });
  assert.equal(outcome.passed,true,JSON.stringify(outcome));assert.equal(absorbing,true);
});

test("multi-bot assessment rejects missing messages, scores syntax errors and stops waiting loops",async()=>{
  const {run}=scenarioHarness(),task=CHALLENGES.find(task=>task.kind==='team');
  const noMessages=JSON.stringify({programs:['bot.water();bot.wait(1);bot.water();','bot.wait(5);bot.harvest();']});
  assert.equal((await run(noMessages,task)).results[0].checks.shared_work,false);
  const syntax=await run(JSON.stringify({programs:['var = ;','bot.say("hi");']}),task);
  assert.equal(syntax.passed,false);assert.ok(syntax.results.every(row=>row.error));
  const waiting='while(!bot.has_message()){bot.wait(0.2);}';
  const stalled=await run(JSON.stringify({programs:[waiting,waiting]}),task);
  assert.match(stalled.results[0].error,/waiting without/);
  const controller=new AbortController();
  await assert.rejects(run(scenarioSolutions.team,task,{signal:controller.signal,onAction:event=>{if(event.command==='water')controller.abort();}}),{name:'AbortError'});
});

test("live challenge factory keeps real soil after harvest and real pests destroy leftover crops",async()=>{
  const h=harness();Object.assign(h.context.CROP_DATA,structuredClone(deployedCropData));
  Object.assign(h.k,{get:()=>[...h.roots],debug:{timeScale:1},getCamPos:()=>h.k.vec2(),getCamScale:()=>h.k.vec2(1),setCamPos(){},setCamScale(){},
    onUpdate(fn){const object=h.make([{update:fn}]);return {cancel:()=>object.destroy()};}});
  let farm;
  Object.assign(h.context,{document:{getElementById:()=>null},isolateScene,addLandBackground,BASE_CROP_DATA,
    addFarmbot(id,map,x,y){farm=map;return h.make([{display_obj:{},setDisplayColor(){},sayText(){},showIcon(){}},h.context.gridpos(x,y),h.context.gridmove(),h.context.botact(id,map)]);}});
  vm.runInContext(fs.readFileSync('src/game/challenges/live-farm.js','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function'),h.context);
  const world=h.context.startChallengeFarm(()=>null),greedy=CHALLENGES.find(t=>t.kind==='greedy');
  for(const layout of greedy.cases){
    world.reset(layout,greedy);h.advance(1);
    assert.equal([...farm.values()].filter(tile=>tile.soil?.exists()).length,3);
    world.robot.botHarvest();h.advance(2);
    assert.equal(farm.get('0-0').crop,null);assert.equal(farm.get('0-0').soil.exists(),true);
  }
  const planner=CHALLENGES.find(t=>t.kind==='planning');
  const tips=[];h.context.triggerDidYouKnow=id=>tips.push(id);
  world.reset(planner.cases[0],planner);h.advance(1);
  await world.pestEnding({yieldControl:async()=>{h.advance(.05);}});
  assert.deepEqual(tips,[]);
  assert.equal([...farm.values()].filter(tile=>tile.crop).length,0);
  assert.equal([...farm.values()].filter(tile=>tile.soil?.exists()).length,4);
  const corn=CHALLENGES.find(t=>t.id==='corn-sequence-v2');
  h.context.CROP_DATA.corn.duration=21;h.context.CROP_DATA.corn.spoilage_time=19.5;
  world.reset(corn.cases[0],corn);h.advance(1);
  world.robot.botTill();h.advance(1);world.robot.botPlant('corn');h.advance(1);
  assert.equal(farm.get('0-0').crop.crop_duration,30);
  assert.equal(farm.get('0-0').crop.crop_spoilage_time,13);
  world.dispose();assert.equal(farm.size,0);assert.equal(h.roots.size,0);
  assert.equal(h.context.CROP_DATA.corn.duration,21);
  assert.equal(h.context.CROP_DATA.corn.spoilage_time,19.5);
  assert.deepEqual(h.rewards,{coins:0,exp:0,seeds:0,spoiled:0});
});

test("rubrics require productive work inside control structures and no-yield planning earns zero",async()=>{
  const {run}=scenarioHarness(),task=kind=>CHALLENGES.find(t=>t.kind===kind);
  const unrolled=await run('for(var i=0;i<1;i++){}bot.water();bot.right();bot.water();',task('irrigation'));
  assert.equal(unrolled.results[0].checks.watered_every_crop,true);
  assert.equal(unrolled.results[0].checks.used_loop,false);
  const unrelatedIf=await run('if(true){}for(var x=0;x<columns();x++){bot.is_dead()?bot.destroy():bot.is_harvestable()?bot.harvest():bot.water();if(x<columns()-1)bot.right();}',task('clinic'));
  assert.equal(unrelatedIf.results[0].checks.treated_every_crop,true);
  assert.equal(unrelatedIf.results[0].checks.used_condition,false);
  assert.equal((await run('bot.say("Hello");',task('planning'))).score,0);
  assert.equal((await run('bot.right();',task('planning'))).score,0);
});

test("isolated farms keep freshness and corn effects without opening main-farm tips",()=>{
  for(const isolated of [false,true]){
    const h=harness(),tips=[];
    h.context.triggerDidYouKnow=id=>tips.push(id);
    h.farm.isDemonstration=isolated;
    h.addSoil();const ripe=h.plant(CropTypes.WHEAT,CropStates.HARVESTABLE);
    h.bot().checkTilled();
    assert.equal(tips.includes('bot_check'),!isolated);
    ripe.spoilage_remaining=ripe.crop_spoilage_time/4;
    h.advance(.01);
    assert.equal(ripe.freshness_state,FreshnessStates.EXPIRING);
    assert.equal(tips.includes('freshness'),!isolated);
    ripe.destroy();
    h.addSoil(1);h.plant(CropTypes.CORN,CropStates.YOUNG,0);h.plant(CropTypes.CORN,CropStates.YOUNG,1);
    h.advance(1.1);
    assert.equal(tips.includes('corn_synergy'),!isolated);
  }
});

test("crop inspections do not consume the separate robot action allowance",async()=>{
  const {run}=scenarioHarness(),task=CHALLENGES.find(t=>t.kind==='greedy');
  const result=await run('for(var scan=0;scan<121;scan++){bot.crop_value(0,0);}'+scenarioSolutions.greedy,task);
  assert.equal(result.passed,true,JSON.stringify(result));
});

test("freestyle supports extra bot commands and preserves every challenge's rules",async()=>{
  const {h,run}=scenarioHarness();
  const basic={...CHALLENGES.find(task=>task.id==='careful-steps-v1'),playMode:'freestyle'};
  const jump='for(var x=0;x<columns();x++){bot.jump(x,0);if(bot.is_harvestable())bot.harvest();}';
  assert.equal((await run(jump,basic)).passed,true);
  assert.equal((await run(jump,{...basic,playMode:'recommended'})).passed,false);
  for(const task of CHALLENGES.filter(task=>task.kind)){
    const result=await run(scenarioSolutions[task.kind],{...task,playMode:'freestyle'});
    assert.equal(result.passed,true,task.id+JSON.stringify(result));
  }
  assert.deepEqual(h.rewards,{coins:0,exp:0,seeds:0,spoiled:0});
});
