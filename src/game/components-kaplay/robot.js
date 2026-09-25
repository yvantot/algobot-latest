import { k } from "../../lib/kaplay.js";
import { CONFIG, INVENTORY, DOCUMENT_DATA, SAY_DATA, CROP_DATA } from "../global/global.js";
import { CropStates, SoilStates, IconTypes } from "../global/enum.js";
import { robots, triggerDidYouKnow } from "../../components/global.svelte.js";
import { telemetry } from "../ml/telemetry.js";
import { cropReading } from "../global/crop-inspection.js";
import { play_sfx } from "../utils/sound.js";
import { addCrop } from "./crop.js";
import { gridpos, gridmove } from "./grid.js";
import { ysort, saytext, popupicon, effects, displaytext } from "./presentation.js";

export function botact(id, farm_grid_index) {
  return {
    id: "bot",
    require: ["gridpos", "gridmove", "sprite", "timer"],
    bot_index: id,
    botmove_duration: CONFIG.BOT.move_duration,
    botact_duration: CONFIG.BOT.action_duration,
    botcheck_duration: CONFIG.BOT.check_duration,
    is_available: true,
    bot_removed: false,
    bot_action_timer: null,
    bot_action_done: null,
    bot_action_version: 0,
    bot_action_waiting: false,
    bot_action_elapsed: false,
    bot_action_result: true,
    bot_move_timer: null,

    add() { this.botJump(this.grid_x, this.grid_y); },

    update() {
      const bots = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`)?.bots ?? [];
      const index = Math.max(0, bots.indexOf(this));
      // Preserve the original stack draw order for equal-y sprites. Only the
      // bottom bot needs to reorder the tile's stack, rather than every bot.
      if (index === 0 && bots.length > 1) for (const bot of bots) k.readd(bot);
      this.display_obj.opacity = bots.length < 2 || index === bots.length - 1 ? 1 : 0;
      this.anchor = k.vec2(0, index + 1);
      this.display_obj.anchor = bots.length < 2 ? k.vec2(-1, -1) : k.vec2(-1, index * 3.55 - 0.5);
    },

    showError(message) {
      this.executionErrorCount = (this.executionErrorCount || 0) + 1;
      if (!farm_grid_index.isDemonstration) telemetry.recordError(message);
      this.sayText(message, "#ffb8bd", "#763c40");
      this.setDisplayColor(k.RED);
    },

    performAct(animate = true, duration = this.botact_duration, callback = null, result = true, pending = false) {
      this.bot_action_timer?.cancel();
      const previous = this.bot_action_done;
      this.bot_action_done = null;
      previous?.(false);
      const version = ++this.bot_action_version;
      this.is_available = false;
      this.setDisplayColor(k.YELLOW);
      this.bot_action_done = callback;
      this.bot_action_waiting = pending;
      this.bot_action_elapsed = false;
      this.bot_action_result = result;
      this.bot_action_timer = this.wait(duration, () => {
        if (this.bot_removed || version !== this.bot_action_version) return;
        this.bot_action_timer = null;
        this.bot_action_elapsed = true;
        this.finishBotAction();
      });
      if (animate && duration > 0) {
        this.unanimate("pos");
        this.animation.seek(0);
        this.animate("scale", [k.vec2(1), k.vec2(1.1, 0.9), k.vec2(1)], { duration, loops: 1, easing: k.easings.easeInOutSine });
      }
      return result;
    },

    settleBotAction(result, version) {
      if (this.bot_removed || version !== this.bot_action_version) return;
      this.bot_action_result = result;
      this.bot_action_waiting = false;
      this.finishBotAction();
    },

    finishBotAction() {
      if (!this.bot_action_elapsed || this.bot_action_waiting) return;
      this.is_available = true;
      this.setDisplayColor(k.GREEN);
      const done = this.bot_action_done;
      this.bot_action_done = null;
      done?.(this.bot_action_result);
    },

    rejectAction(message, callback, duration = this.botact_duration) {
      this.performAct(true, duration, callback, false);
      this.showError(message);
      return false;
    },

    inspectTile(callback, x, y, inspect) {
      const tile = farm_grid_index.get(`${y}-${x}`);
      const result = tile ? inspect(tile) : false;
      this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
      play_sfx("bot_act");
      this.performAct(true, this.botcheck_duration, callback, result);
      return result;
    },

    checkTilled(callback = null, x = this.grid_x, y = this.grid_y) {
      triggerDidYouKnow("bot_check");
      return this.inspectTile(callback, x, y, tile => !!tile.soil && tile.soil.soil_state !== SoilStates.INITIAL);
    },
    checkWatered(callback = null, x = this.grid_x, y = this.grid_y) {
      return this.inspectTile(callback, x, y, tile => tile.soil?.isWatered() ?? false);
    },
    checkDead(callback = null, x = this.grid_x, y = this.grid_y) {
      return this.inspectTile(callback, x, y, tile => tile.crop?.crop_state === CropStates.DEAD);
    },
    checkPlanted(callback = null, x = this.grid_x, y = this.grid_y) {
      return this.inspectTile(callback, x, y, tile => !!tile.crop && !tile.crop.crop_removed);
    },
    isHarvestable(callback = null, x = this.grid_x, y = this.grid_y) {
      return this.inspectTile(callback, x, y, tile => tile.crop?.crop_state === CropStates.HARVESTABLE && !tile.crop.is_harvesting);
    },
    isBug(callback = null, x = this.grid_x, y = this.grid_y) {
      return this.inspectTile(callback, x, y, tile => !!tile.bug && !tile.bug.is_dying);
    },
    checkFire(callback = null, x = this.grid_x, y = this.grid_y) {
      return this.inspectTile(callback, x, y, tile => tile.fire?.isBurning() ?? false);
    },

    isCurrentCropDead() {
      return farm_grid_index.get(`${this.grid_y}-${this.grid_x}`)?.crop?.crop_state === CropStates.DEAD;
    },

    readCrop(field, x = this.grid_x, y = this.grid_y) {
      if (!this.isWithinBounds(x, y)) throw Error("Choose a column and row inside the farm (starting at 0).");
      return cropReading(farm_grid_index.get(`${y}-${x}`)?.crop, field);
    },
    getHarvestChoice() {
      const current = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`)?.crop;
      if (!current || current.crop_state !== CropStates.HARVESTABLE || current.is_harvesting) return null;
      const remaining = current.spoilage_remaining ?? Infinity;
      for (const { crop } of farm_grid_index.values()) {
        if (crop && crop !== current && crop.crop_state === CropStates.HARVESTABLE && !crop.is_harvesting && (crop.spoilage_remaining ?? Infinity) < remaining) return false;
      }
      return true;
    },

    isWithinBounds(x, y) {
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < (farm_grid_index.demoBounds?.columns ?? CONFIG.FARM.columns) && y < (farm_grid_index.demoBounds?.rows ?? CONFIG.FARM.rows);
    },

    removeBotFromGrid() {
      for (const tile of farm_grid_index.values()) if (tile.bots) tile.bots = tile.bots.filter(bot => bot !== this);
    },

    botMovedTo(current_x, current_y, x, y, duration) {
      this.bot_move_timer?.cancel();
      this.removeBotFromGrid();
      this.bot_move_timer = this.wait(duration, () => {
        if (this.bot_removed) return;
        const tile = farm_grid_index.get(`${y}-${x}`);
        if (!tile) return;
        tile.bots ??= [];
        if (!tile.bots.includes(this)) tile.bots.push(this);
      });
    },

    botJump(x = this.grid_x, y = this.grid_y, callback = null) {
      if (!this.isWithinBounds(x, y) || !farm_grid_index.get(`${y}-${x}`)?.soil) {
        if (!farm_grid_index.isDemonstration) triggerDidYouKnow("out_of_bounds");
        return this.rejectAction(SAY_DATA.farm.error.out_of_bounds, callback, this.botmove_duration);
      }
      this.botMovedTo(this.grid_x, this.grid_y, x, y, this.botmove_duration);
      this.gridJump(x, y, this.botmove_duration);
      play_sfx("bot_jump");
      return this.performAct(false, this.botmove_duration, callback, true);
    },

    botWait(duration, callback = null) {
      if (!Number.isFinite(duration) || duration < 0 || duration > 3600) return this.rejectAction("Wait must be a number from 0 to 3600 seconds.", callback);
      this.showIcon(IconTypes.TIMER, duration, false);
      play_sfx("bot_act");
      return this.performAct(false, duration, callback, true);
    },

    botKillBug(callback = null, x = this.grid_x, y = this.grid_y) {
      const bug = farm_grid_index.get(`${y}-${x}`)?.bug;
      if (!bug || bug.is_dying) return this.rejectAction(SAY_DATA.farm.error.no_bug, callback);
      if (!farm_grid_index.isDemonstration && bug.spawned_at) telemetry.recordEventResponse(Date.now() - bug.spawned_at);
      bug.bugDestroy();
      this.showIcon(IconTypes.SPARK, this.botact_duration);
      play_sfx("bot_kill");
      return this.performAct(true, this.botact_duration, callback, true);
    },

    botTill(callback = null, x = this.grid_x, y = this.grid_y) {
      const soil = farm_grid_index.get(`${y}-${x}`)?.soil;
      if (!soil) return this.rejectAction(SAY_DATA.farm.error.out_of_bounds, callback);
      if (!soil.till()) return this.rejectAction(SAY_DATA.farm.error.till_tilled, callback);
      this.showIcon(IconTypes.HOE, this.botact_duration);
      if (!farm_grid_index.isDemonstration) triggerDidYouKnow("soil");
      play_sfx("bot_till");
      return this.performAct(true, this.botact_duration, callback, true);
    },

    extinguishTile(tile) {
      if (!tile?.fire?.isBurning()) return false;
      const fire = tile.fire;
      const result = fire.extinguish("bot");
      if (!farm_grid_index.isDemonstration && result && fire.spawned_at) telemetry.recordEventResponse(Date.now() - fire.spawned_at);
      return result;
    },

    botWater(callback = null, x = this.grid_x, y = this.grid_y) {
      const tile = farm_grid_index.get(`${y}-${x}`);
      if (!tile?.soil) return this.rejectAction(SAY_DATA.farm.error.out_of_bounds, callback);
      const extinguished = this.extinguishTile(tile);
      const watered = tile.soil.water();
      if (!extinguished && !watered) return this.rejectAction(tile.soil.soil_state === SoilStates.INITIAL ? SAY_DATA.farm.error.water_initial : SAY_DATA.farm.error.water_watered, callback);
      this.showIcon(IconTypes.DROPLET, this.botact_duration);
      play_sfx("bot_water");
      return this.performAct(true, this.botact_duration, callback, true);
    },

    botExtinguish(callback = null, x = this.grid_x, y = this.grid_y) {
      if (!this.extinguishTile(farm_grid_index.get(`${y}-${x}`))) return this.rejectAction("There is no fire here.", callback);
      this.showIcon(IconTypes.DROPLET, this.botact_duration);
      play_sfx("bot_water");
      return this.performAct(true, this.botact_duration, callback, true);
    },

    botPlant(type, callback = null, x = this.grid_x, y = this.grid_y) {
      if (!CROP_DATA[type]) return this.rejectAction("Unknown crop type.", callback);
      if (!farm_grid_index.isDemonstration && DOCUMENT_DATA.crops[type] && !DOCUMENT_DATA.crops[type].is_unlocked) return this.rejectAction(SAY_DATA.farm.error.crop_locked, callback);
      const tile = farm_grid_index.get(`${y}-${x}`);
      if (!tile?.soil) return this.rejectAction(SAY_DATA.farm.error.out_of_bounds, callback);
      if (tile.crop) return this.rejectAction(SAY_DATA.farm.error.plant_planted, callback);
      if (tile.soil.soil_state === SoilStates.INITIAL) return this.rejectAction(SAY_DATA.farm.error.plant_initial, callback);
      if (!farm_grid_index.isDemonstration && !(INVENTORY.crops[type] > 0)) return this.rejectAction(SAY_DATA.farm.error.insufficient_resources, callback);
      tile.crop = addCrop(farm_grid_index, type, x, y);
      if (!farm_grid_index.isDemonstration) INVENTORY.changeCrops(type, -1);
      this.showIcon(IconTypes.SEEDPACK, this.botact_duration);
      play_sfx("plant");
      return this.performAct(true, this.botact_duration, callback, true);
    },

    botHarvest(callback = null, x = this.grid_x, y = this.grid_y) {
      const crop = farm_grid_index.get(`${y}-${x}`)?.crop;
      if (!crop) return this.rejectAction(SAY_DATA.farm.error.no_plant, callback);
      if (crop.crop_state === CropStates.DEAD) return this.rejectAction(SAY_DATA.farm.error.crop_dead, callback);
      if (crop.crop_state !== CropStates.HARVESTABLE || crop.is_harvesting) return this.rejectAction(SAY_DATA.farm.error.harvest_not_ready, callback);
      this.performAct(true, this.botact_duration, callback, crop.crop_type, true);
      const version = this.bot_action_version;
      const started = crop.harvest(success => this.settleBotAction(success ? crop.crop_type : false, version));
      if (!started) this.settleBotAction(false, version);
      play_sfx("plant");
      return started ? crop.crop_type : false;
    },

    botDestroy(callback = null, x = this.grid_x, y = this.grid_y) {
      const crop = farm_grid_index.get(`${y}-${x}`)?.crop;
      if (!crop || !crop.cropDestroy("bot")) return this.rejectAction(SAY_DATA.farm.error.no_plant, callback);
      this.showIcon(IconTypes.ANGEL, this.botact_duration);
      play_sfx("plant");
      return this.performAct(true, this.botact_duration, callback, true);
    },

    destroy() {
      if (this.bot_removed) return;
      this.bot_removed = true;
      this.bot_action_timer?.cancel();
      this.bot_move_timer?.cancel();
      this.bot_action_version++;
      this.removeBotFromGrid();
      const done = this.bot_action_done;
      this.bot_action_done = null;
      done?.(false);
      const index = robots.indexOf(this);
      if (index !== -1) robots.splice(index, 1);
    },
  };
}

export function addFarmbot(id, farm_grid_index, x = 0, y = 0) {
  const object = k.add([
    "botact",
    k.pos(),
    k.sprite("robot"),
    k.anchor("bot"),
    k.z(),
    k.scale(),
    k.animate(),
    k.timer(),
    gridpos(x, y, CONFIG.FARM.tile_size / 2, CONFIG.FARM.tile_size / 2 - 15),
    gridmove(),
    ysort(),
    saytext(0, -70),
    popupicon(),
    effects(),
    displaytext(id, -64 / 2, -58, { size: 20, color: k.GREEN }),
    botact(id, farm_grid_index)]);
  if (!farm_grid_index.isDemonstration) robots.push(object);
  return object;
}
