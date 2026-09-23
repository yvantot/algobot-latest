import { k } from "../../lib/kaplay.js";
import { CONFIG, CROP_DATA } from "./global.js";
import { CropStates, SoilStates } from "./enum.js";
import { addSoilToGrid } from "../components-kaplay/soil.js";
import { addFarmbot } from "../components-kaplay/robot.js";
import { addBug } from "../components-kaplay/pest.js";
import { addCrop } from "../components-kaplay/crop.js";
import { getFarmEventRuntime, destroyFarmEvents } from "../events/renderer.js";
import { INTRODUCTION_STORY } from "./introduction-story.js";
import { addLandBackground } from "../land-background.js";

// The cutscene owns a separate farm; closing it restores the player's exact entities.
export function startLiveDemonstration(onChange, { singleAction = null } = {}) {
  const story = singleAction ? INTRODUCTION_STORY.filter(step => step.action === singleAction) : INTRODUCTION_STORY;
  let disposed = false;
  let running = false;
  let chapter = -1;
  const waiting = new Set();
  const actions = new Set();
  let elapsed = 0;
  const originals = k.get().map(object => ({ object, hidden: object.hidden, paused: object.paused }));
  const demoSize = {rows:3,columns:3};
  const speed = k.debug.timeScale;
  const cameraPosition = k.getCamPos();
  const cameraScale = k.getCamScale();
  k.setCamScale(1);
  k.setCamPos(CONFIG.FARM.grid_origin.x + (demoSize.columns * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2,
    CONFIG.FARM.grid_origin.y + (demoSize.rows * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2);
  for (const { object } of originals) {
    if (object.sceneryBackground) continue;
    object.paused = true;
    if (object.layer !== "grass_bg") object.hidden = true;
  }
  k.debug.timeScale = 1;
  const farm = new Map();
  farm.isDemonstration = true;
  farm.demoBounds = {...demoSize};
  farm.demoEffects = [];
  const owned = [];
  let ground = [];
  function refreshGround() {
    for (const object of ground) object.destroy();
    ground = addLandBackground(k, {...CONFIG.FARM, ...farm.demoBounds});
    owned.push(...ground);
  }
  refreshGround();
  for (let y = 0; y < farm.demoBounds.rows; y++) for (let x = 0; x < farm.demoBounds.columns; x++) {
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
    for (const pending of [...waiting]) if (pending.ready()) { waiting.delete(pending); pending.resolve(true); }
  });
  function until(ready) {
    if (disposed) return Promise.resolve(false);
    return new Promise(resolve => { waiting.add({ ready, resolve }); });
  }
  function wait(seconds) { const end = elapsed + seconds; return until(() => elapsed >= end); }
  function action(bot, line, method, ...args) {
    if (disposed) return Promise.resolve(false);
    onChange({ line, bot: bot.bot_index ?? 0 });
    return new Promise((resolve, reject) => {
      actions.add(resolve);
      bot[method](...args, result => {
      actions.delete(resolve);
      if (!disposed && !result) reject(new Error(`Introduction action failed: ${method}`));
      else resolve(!disposed);
    }); });
  }
  function plantAt(x, y, state = CropStates.YOUNG, type = "wheat") {
    const tile = farm.get(`${y}-${x}`);
    tile.crop?.destroy();
    tile.soil.setSoilState(SoilStates.READY);
    const crop = addCrop(farm, type, x, y, state);
    crop.crop_grow_duration = 3;
    tile.crop = crop;
    return crop;
  }
  let helper;
  function eventRuntime() {
    const runtime = getFarmEventRuntime(farm);
    if (!owned.includes(runtime.owner)) owned.push(runtime.owner);
    return runtime;
  }
  function clearCrops() {
    destroyFarmEvents(farm);
    for (const tile of farm.values()) { tile.bug?.destroy(); tile.crop?.destroy(); tile.soil?.setSoilState(SoilStates.INITIAL); }
  }
  function fillFarm(state = CropStates.YOUNG) {
    clearCrops();
    for (let y=0;y<farm.demoBounds.rows;y++) for(let x=0;x<farm.demoBounds.columns;x++) plantAt(x,y,state);
  }
  function expand(axis) {
    const index = farm.demoBounds[axis]++;
    const count = axis === "rows" ? farm.demoBounds.columns : farm.demoBounds.rows;
    for(let i=0;i<count;i++) {
      const x=axis === "rows" ? i : index, y=axis === "rows" ? index : i;
      const soil=addSoilToGrid(x,y,SoilStates.INITIAL,farm);
      owned.push(soil); farm.set(y+"-"+x,{soil,crop:null,bots:[]});
    }
    refreshGround();
  }
  let purchaseRequest = null;
  function requestPurchase(id, label) {
    return new Promise(resolve => {
      purchaseRequest = {id, resolve};
      onChange({purchase: {id, label}});
    });
  }
  function purchase(id) {
    if (disposed || purchaseRequest?.id !== id) return false;
    const request = purchaseRequest;
    purchaseRequest = null;
    onChange({purchase: null});
    request.resolve(true);
    return true;
  }
  async function next() {
    if (disposed || running || chapter >= story.length - 1) return;
    running = true; pause(false); chapter++;
    const step = story[chapter];
    onChange({ chapter, line: -1, ready: false });
    // Leave a short beat to notice the blocks before the action starts.
    if (!await wait(0.8)) return;
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
        if (!await action(robot, 1, "botWait", 3)) return;
        if (!await until(() => !farm.get("0-1").soil.isWatered())) return;
        if (!await action(robot, 2, "botWater")) return;
        if (!await action(robot, 3, "botWait", 3)) return;
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
        helper = addBot(1, 0, 1);
        if (!await until(() => helper.is_available)) return;
        if (!await action(robot, 0, "botJump", 1, 1)) return;
        if (!await action(robot, 1, "botTill")) return;
        if (!await action(helper, 0, "botJump", 1, 1)) return;
        if (!await action(helper, 1, "botJump", 2, 1)) return;
        if (!await action(helper, 2, "botTill")) return;
        break;
      }
      case "rain": {
        plantAt(1, 1); plantAt(2, 1);
        const runtime = eventRuntime();
        runtime.simulation.startRain(100);
        if (!await until(() => runtime.simulation.clouds.size === 0 && runtime.simulation.drops.size === 0)) return;
        break;
      }
      case "fire_loss": {
        fillFarm();
        const runtime=eventRuntime();
        const fire=runtime.simulation.ignite("1-1");
        Object.assign(fire.settings,{stageDuration:2,spreadChance:1,spreadInterval:.3});
        if (!await until(()=>[...farm.values()].every(tile=>!tile.crop))) return;
        break;
      }
      case "pest_loss": {
        fillFarm(CropStates.HARVESTABLE);
        for(let y=0;y<farm.demoBounds.rows;y++) for(let x=0;x<farm.demoBounds.columns;x++) {
          const pest=addBug(farm,{damage:farm.get(y+"-"+x).crop.damageToKill("bug")/5,attack_interval:1.3+x*.1,spawnAt:{x,y},stationary:true});
          owned.push(pest);
        }
        if (!await until(()=>[...farm.values()].every(tile=>!tile.crop || tile.crop.crop_state===CropStates.DEAD))) return;
        break;
      }
      case "pest": {
        clearCrops();
        plantAt(1, 1, CropStates.HARVESTABLE);
        const pest = addBug(farm, { damage: 1, attack_interval: 2, move_interval: 60, spawnAt: {x:1,y:1}, stationary:true });
        owned.push(pest);
        if (!await wait(4)) return;
        if (!await action(robot, 1, "botKillBug")) return;
        break;
      }
      case "fire": {
        clearCrops();
        for (let y = 0; y < farm.demoBounds.rows; y++) for (let x = 0; x < farm.demoBounds.columns; x++) plantAt(x, y);
        const runtime = eventRuntime();
        runtime.simulation.ignite("1-1");
        if (!await wait(5)) return;
        if (!await action(robot, 1, "botExtinguish")) return;
        break;
      }
      case "expand": {
        clearCrops();
        if(!await requestPurchase("row", "Buy a row"))return;
        onChange({line:0,bot:0}); expand("rows");
        if(!await wait(2)) return;
        if(!await requestPurchase("column", "Buy a column"))return;
        onChange({line:1,bot:0}); expand("columns");
        k.setCamScale(.85);
        k.setCamPos(CONFIG.FARM.grid_origin.x+(farm.demoBounds.columns*CONFIG.FARM.cell_size-CONFIG.FARM.gap)/2,CONFIG.FARM.grid_origin.y+(farm.demoBounds.rows*CONFIG.FARM.cell_size-CONFIG.FARM.gap)/2);
        if(!await wait(2)) return;
        break;
      }
      case "upgrade": {
        if(!await requestPurchase("move", "Upgrade movement"))return;
        onChange({line:0,bot:0}); robot.sayText("Faster moves!"); robot.botmove_duration=.18;
        if(!await action(robot,0,"botJump",0,0)) return;
        if(!await action(robot,0,"botJump",1,0)) return;
        if(!await requestPurchase("action", "Upgrade actions"))return;
        onChange({line:1,bot:0}); robot.sayText("Faster work!"); robot.botact_duration=.15;
        if(!await action(robot,1,"botTill")) return;
        onChange({traversing:true});
        robot.sayText("Visiting every tile!");
        const rows=farm.demoBounds.rows, columns=farm.demoBounds.columns;
        for(let row=0;row<rows;row++)for(let column=0;column<columns;column++) {
          if(!await action(robot,2,"botJump",column,row))return;
        }
        onChange({traversing:false});
        break;
      }
      case "workflow": {
        while(farm.demoBounds.rows<6)expand("rows");
        while(farm.demoBounds.columns<6)expand("columns");
        clearCrops();
        const types=["wheat","corn","rice","potato","tomato","sugarcane"];
        for(let y=0;y<6;y++)for(let x=0;x<6;x++)plantAt(x,y,CropStates.HARVESTABLE,types[(x+y)%types.length]);
        for(const row of [0,3])for(let x=0;x<6;x++){
          const tile=farm.get(row+"-"+x);tile.crop.destroy();tile.soil.setSoilState(SoilStates.INITIAL);
        }
        if(!helper)helper=addBot(1,0,1);
        const team=[robot,helper,addBot(2,0,3),addBot(3,0,4)];
        for(const bot of team){bot.botmove_duration=.16;bot.botact_duration=.16;}
        k.setCamScale(.8);
        k.setCamPos(CONFIG.FARM.grid_origin.x+(6*CONFIG.FARM.cell_size-CONFIG.FARM.gap)/2,CONFIG.FARM.grid_origin.y+(6*CONFIG.FARM.cell_size-CONFIG.FARM.gap)/2);
        await Promise.all(team.map((bot,id)=>action(bot,-1,"botJump",0,[0,1,3,4][id])));
        if(disposed)return;
        async function grow(bot,row,type) {
          bot.sayText("Planting "+type+"!");
          for(let x=0;x<6;x++) {
            if(!await action(bot,1,"botTill"))return;
            if(!await action(bot,2,"botPlant",type))return;
            farm.get(row+"-"+x).crop.crop_grow_duration=.6;
            if(!await action(bot,3,"botWater"))return;
            if(!await action(bot,4,"botWait",.7))return;
            if(!await action(bot,5,"botWater"))return;
            if(!await action(bot,6,"botWait",.7))return;
            if(x<5&&!await action(bot,7,"botJump",x+1,row))return;
          }
          bot.sayText("Fresh crops ready!");
        }
        async function harvest(bot,row) {
          for(let x=0;x<6;x++) {
            bot.sayText("Harvesting!");onChange({bot:bot.bot_index,line:0});
            if(farm.get(row+"-"+x).crop?.crop_state===CropStates.HARVESTABLE){
              if(!await action(bot,1,"botHarvest"))return;
            }
            if(x<5&&!await action(bot,2,"botJump",x+1,row))return;
          }
          bot.sayText("Harvest done!");
        }
        await Promise.all([grow(robot,0,"wheat"),harvest(helper,1),grow(team[2],3,"potato"),harvest(team[3],4)]);
        if(disposed)return;
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
    purchaseRequest?.resolve(false); purchaseRequest=null;
    controller.cancel();
    for (const pending of waiting) pending.resolve(false);
    waiting.clear();
    for (const resolve of actions) resolve(false);
    actions.clear();
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
  return { next: advance, dispose, purchase };
}
