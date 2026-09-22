import { k } from "../../lib/kaplay.js";
import { CONFIG, CROP_DATA } from "./global.js";
import { CropStates, SoilStates } from "./enum.js";
import { addSoilToGrid } from "../components-kaplay/soil.js";
import { addFarmbot } from "../components-kaplay/robot.js";
import { addBug } from "../components-kaplay/pest.js";
import { addCrop } from "../components-kaplay/crop.js";
import { getFarmEventRuntime, destroyFarmEvents } from "../events/renderer.js";
import { INTRODUCTION_STORY } from "./introduction-story.js";

// The cutscene owns a separate farm; closing it restores the player's exact entities.
export function startLiveDemonstration(onChange, { singleAction = null } = {}) {
  const story = singleAction ? INTRODUCTION_STORY.filter(step => step.action === singleAction) : INTRODUCTION_STORY;
  let disposed = false;
  let running = false;
  let chapter = -1;
  let waiting = null;
  let elapsed = 0;
  const originals = k.get().map(object => ({ object, hidden: object.hidden, paused: object.paused }));
  const speed = k.debug.timeScale;
  const cameraPosition = k.getCamPos();
  const cameraScale = k.getCamScale();
  k.setCamScale(1);
  k.setCamPos(CONFIG.FARM.grid_origin.x + (CONFIG.FARM.columns * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2,
    CONFIG.FARM.grid_origin.y + (CONFIG.FARM.rows * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2);
  for (const { object } of originals) {
    if (object.sceneryBackground) continue;
    object.paused = true;
    if (!["grass_bg", "land_bg"].includes(object.layer)) object.hidden = true;
  }
  k.debug.timeScale = 1;
  const farm = new Map();
  farm.isDemonstration = true;
  farm.demoEffects = [];
  const owned = [];
  for (let y = 0; y < CONFIG.FARM.rows; y++) for (let x = 0; x < CONFIG.FARM.columns; x++) {
    const soil = addSoilToGrid(x, y, SoilStates.INITIAL, farm);
    owned.push(soil);
    farm.set(`${y}-${x}`, { soil, crop: null, bots: [] });
  }
  function addBot(id, x, y) {
    const bot = addFarmbot(id, farm, x, y);
    bot.botmove_duration = 1.3;
    bot.botact_duration = 1.4;
    owned.push(bot);
    return bot;
  }
  const robot = addBot(0, 0, 0);
  function pause(value) {
    for (const object of owned) if (object.exists()) object.paused = value;
    for (const tile of farm.values()) if (tile.crop?.exists()) tile.crop.paused = value;
  }
  const controller = k.onUpdate(() => {
    if (!running || document.hidden) return;
    elapsed += k.dt();
    if (waiting?.ready()) { const resume = waiting.resolve; waiting = null; resume(true); }
  });
  function until(ready) {
    if (disposed) return Promise.resolve(false);
    return new Promise(resolve => { waiting = { ready, resolve }; });
  }
  function wait(seconds) { const end = elapsed + seconds; return until(() => elapsed >= end); }
  function action(bot, line, method, ...args) {
    if (disposed) return Promise.resolve(false);
    onChange({ line });
    return new Promise((resolve, reject) => bot[method](...args, result => {
      if (!disposed && !result) reject(new Error(`Introduction action failed: ${method}`));
      else resolve(!disposed);
    }));
  }
  function plantAt(x, y, state = CropStates.YOUNG) {
    const tile = farm.get(`${y}-${x}`);
    tile.crop?.destroy();
    tile.soil.setSoilState(SoilStates.READY);
    const crop = addCrop(farm, "wheat", x, y, state);
    crop.crop_grow_duration = 3;
    tile.crop = crop;
    return crop;
  }
  async function next() {
    if (disposed || running || chapter >= story.length - 1) return;
    running = true; pause(false); chapter++;
    const step = story[chapter];
    onChange({ chapter, line: -1, ready: false });
    // Give the teacher's explanation a head start before anything moves.
    if (!await wait(2.5)) return;
    if (singleAction && singleAction !== "move") {
      if (!await action(robot, -1, "botJump", 1, singleAction === "fire" ? 1 : 0)) return;
      if (singleAction === "water") plantAt(1,0);
      if (singleAction === "harvest") plantAt(1,0,CropStates.HARVESTABLE);
    }
    switch (step.action) {
      case "move":
        if (!await action(robot, 0, "botJump", 1, 0)) return;
        break;
      case "plant":
        if (!await action(robot, 0, "botTill")) return;
        if (!await wait(1)) return;
        if (!await action(robot, 1, "botPlant", "wheat")) return;
        farm.get("0-1").crop.crop_grow_duration = 3;
        break;
      case "water":
        if (!await action(robot, 0, "botWater")) return;
        if (!await until(() => !farm.get("0-1").soil.isWatered())) return;
        if (!await wait(1.5)) return;
        if (!await action(robot, 2, "botWater")) return;
        if (!await until(() => farm.get("0-1").crop?.crop_state === CropStates.HARVESTABLE)) return;
        break;
      case "harvest":
        if (!await action(robot, 0, "botHarvest")) return;
        onChange({ coins: CROP_DATA.wheat.reward, exp: CROP_DATA.wheat.exp });
        break;
      case "spoil": {
        const crop = plantAt(1, 0, CropStates.HARVESTABLE);
        crop.crop_spoilage_time = 9;
        crop.spoilage_remaining = 9;
        crop.demonstrateSpoilage = true;
        crop.clearFreshness(); crop.initFreshness();
        if (!await until(() => crop.crop_state === CropStates.DEAD)) return;
        break;
      }
      case "bots": {
        const helper = addBot(1, 0, 1);
        if (!await until(() => helper.is_available)) return;
        if (!await action(robot, 1, "botJump", 1, 1)) return;
        if (!await action(robot, 2, "botTill")) return;
        if (!await action(helper, 4, "botJump", 1, 1)) return;
        if (!await action(helper, 5, "botJump", 2, 1)) return;
        if (!await action(helper, 6, "botTill")) return;
        break;
      }
      case "rain": {
        plantAt(1, 1); plantAt(2, 1);
        const runtime = getFarmEventRuntime(farm); owned.push(runtime.owner);
        runtime.simulation.startRain(100);
        if (!await until(() => runtime.simulation.clouds.size === 0 && runtime.simulation.drops.size === 0)) return;
        break;
      }
      case "pest": {
        plantAt(1, 1, CropStates.HARVESTABLE);
        const pest = addBug(farm, { damage: 1, attack_interval: 2, move_interval: 60, spawnAt: {x:1,y:1}, stationary:true });
        owned.push(pest);
        if (!await wait(4)) return;
        if (!await action(robot, 1, "botKillBug")) return;
        break;
      }
      case "fire": {
        for (let y = 0; y < CONFIG.FARM.rows; y++) for (let x = 0; x < CONFIG.FARM.columns; x++) plantAt(x, y);
        const runtime = getFarmEventRuntime(farm);
        runtime.simulation.ignite("1-1");
        if (!await wait(5)) return;
        if (!await action(robot, 1, "botExtinguish")) return;
        break;
      }
    }
    if (!await wait(1.5)) return;
    pause(true); running = false;
    onChange({ ready: true, line: -1 });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.cancel(); waiting?.resolve(false); waiting = null;
    destroyFarmEvents(farm);
    for (const effect of farm.demoEffects) if (effect.exists()) effect.destroy();
    for (const tile of farm.values()) tile.crop?.destroy();
    for (const object of owned.reverse()) if (object.exists()) object.destroy();
    for (const { object, hidden, paused } of originals) if (object.exists()) {
      object.hidden = hidden; object.paused = paused;
    }
    k.debug.timeScale = speed;
    k.setCamPos(cameraPosition); k.setCamScale(cameraScale);
  }
  function advance() {
    next().catch(error => { console.error("Farm introduction failed", error); dispose(); onChange({ error: true, ready: true }); });
  }
  advance();
  return { next: advance, dispose };
}
