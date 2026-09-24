import { tutorialPolicy } from "../global/tutorial.js";
import { k } from "../../lib/kaplay.js";
import { CROP_DATA, CONFIG, INVENTORY, PLAYER_DATA } from "../global/global.js";
import { CropStates, CropTypes, FreshnessStates, OrbTypes } from "../global/enum.js";
import { triggerDidYouKnow } from "../../components/global.svelte.js";
import { play_sfx } from "../utils/sound.js";
import { telemetry } from "../ml/telemetry.js";
import { freshness } from "./freshness.js";
import { gridpos } from "./grid.js";
import { ysort, popupicon, dropOrbs, effects } from "./presentation.js";

export function crop(farm_grid_index, type, state = CropStates.YOUNG) {
  const data = CROP_DATA[type];
  if (!data) throw new Error(`Unknown crop: ${type}`);
  return {
    id: "crop",
    require: ["gridpos", "timer", "animate", "rotate", "freshness", "dropOrbs"],
    crop_type: type,
    crop_state: state,
    crop_health: data.health,
    crop_duration: data.duration,
    crop_grow_duration: data.duration,
    crop_grow_time: 0,
    crop_reward: data.reward,
    crop_exp: data.exp,
    crop_spoilage_time: data.spoilage_time,
    crop_resistance: data.resistance,
    crop_seed_drop_chance: data.seed_drop_chance,
    absorbing_water: false,
    is_harvesting: false,
    crop_removed: false,
    spoilage_remaining: state === CropStates.HARVESTABLE ? data.spoilage_time : Infinity,
    crop_expiry_timer: null,
    crop_timers: new Set(),
    crop_synergy_elapsed: 0,
    crop_harvest_done: null,
    crop_harvest_completed: false,

    isCurrentCrop() {
      return !this.crop_removed && farm_grid_index.get(`${this.grid_y}-${this.grid_x}`)?.crop === this;
    },

    cropWait(seconds, action) {
      const timer = this.wait(seconds, () => {
        this.crop_timers.delete(timer);
        if (this.isCurrentCrop()) action();
      });
      this.crop_timers.add(timer);
      return timer;
    },

    cleanupCrop() {
      if (this.crop_removed) return;
      this.crop_removed = true;
      this.absorbing_water = false;
      for (const timer of this.crop_timers) timer.cancel();
      this.crop_timers.clear();
      this.crop_expiry_timer?.cancel();
      this.clearFreshness();
      const tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      if (tile?.crop === this) tile.crop = null;
      this.settleHarvest(this.crop_harvest_completed);
    },

    cropDestroy(reason = "removed") {
      if (this.crop_removed) return false;
      this.crop_removal_reason = reason;
      this.cleanupCrop();
      this.destroy();
      return true;
    },

    // KAPLAY calls component destroy hooks even for raw object.destroy().
    destroy() { this.cleanupCrop(); },

    matureNow() {
      if (!this.isCurrentCrop() || this.is_harvesting) return false;
      this.crop_state = CropStates.HARVESTABLE;
      this.crop_grow_time = 0;
      this.absorbing_water = false;
      this.spoilage_remaining = this.crop_spoilage_time;
      this.sprite = `${type}${this.crop_state}`;
      this.effectsEnabled(false);
      this.initFreshness();
      return true;
    },

    markDead(reason = "spoilage") {
      if (!this.isCurrentCrop() || this.is_harvesting || this.crop_state === CropStates.DEAD) return false;
      this.crop_state = CropStates.DEAD;
      this.absorbing_water = false;
      this.spoilage_remaining = 0;
      this.showFreshness(FreshnessStates.DEAD);
      this.effectsEnabled(false);
      this.sprite = `${type}${this.crop_state}`;
      if (reason === "spoilage" && !farm_grid_index.isDemonstration) {
        telemetry.recordCropHarvestOutcome(true);
        triggerDidYouKnow("spoilage");
      }
      return true;
    },

    // Weather can tune a burn duration across crop types without duplicating
    // crop resistance calculations or taking ownership of health/destruction.
    damageToKill(source) {
      const multiplier = this.crop_resistance?.[source] ?? 1;
      return multiplier > 0 ? this.crop_health / multiplier : Infinity;
    },

    damage(amount, { source, noTrace = false } = {}) {
      if (!this.isCurrentCrop() || !Number.isFinite(amount) || amount <= 0) return false;
      const multiplier = source ? (this.crop_resistance?.[source] ?? 1) : 1;
      this.crop_health = Math.max(0, this.crop_health - amount * multiplier);
      if (this.crop_health < 1e-9) this.crop_health = 0;
      if (this.crop_health === 0) return this.cropDestroy(source ?? "damage");
      if (!noTrace || this.crop_health > 0) {
        this.animation.seek(0);
        this.animate("scale", [k.vec2(1), k.vec2(1.15, 0.85), k.vec2(1)], { duration: 0.2, loops: 1 });
        this.animate("opacity", [1, 0.5, 1], { duration: 0.2, loops: 1 });
      }
      return true;
    },

    settleHarvest(success) {
      const done = this.crop_harvest_done;
      this.crop_harvest_done = null;
      done?.(success);
    },

    harvest(onComplete = null) {
      if (!this.isCurrentCrop() || this.is_harvesting || this.crop_state !== CropStates.HARVESTABLE) return false;
      this.is_harvesting = true;
      this.crop_harvest_completed = false;
      this.crop_harvest_done = onComplete;
      this.absorbing_water = false;
      const fresh = this.spoilage_remaining > this.crop_spoilage_time / 2;
      this.clearFreshness();
      this.unanimateAll();
      this.animation.seek(0);
      this.angle = 0;
      this.animate("scale", [k.vec2(1), k.vec2(1.2, 0.8), k.vec2(1)], { duration: 0.5, loops: 1 });
      if (this.crop_type !== CropTypes.SUGARCANE) this.animate("opacity", [1, 0], { duration: 0.5, loops: 1 });
      const dropSeed = Math.random() < this.crop_seed_drop_chance;
      // Rewards commit together only when this crop survives the harvest.
      this.cropWait(1, () => {
        if (farm_grid_index.isDemonstration) {
          const visuals = [
            ...(this.dropOrbs(this, this.crop_exp, OrbTypes.EXP) || []),
            ...(this.dropOrbs(this, this.crop_reward, OrbTypes.COIN) || []),
            ...(dropSeed ? this.dropOrbs(this, 1, "icon_seedpack", 0.4) || [] : []),
          ];
          farm_grid_index.demoEffects?.push(...visuals);
          play_sfx("collect");
          this.crop_harvest_completed = true;
          this.cropDestroy("harvest");
          return;
        }
        telemetry.recordCropHarvestOutcome(false);
        if (dropSeed) {
          triggerDidYouKnow("seed_drop");
          INVENTORY.changeCrops(this.crop_type, 1);
          this.dropOrbs(this, 1, "icon_seedpack", 0.4);
        }
        const exp = this.crop_exp / (fresh ? 1 : 2);
        PLAYER_DATA.changeExp(exp);
        this.dropOrbs(this, exp, OrbTypes.EXP);
          const coins = this.crop_reward / (fresh ? 1 : 2);
          INVENTORY.changeCoins(coins);
          this.dropOrbs(this, coins, OrbTypes.COIN);
          play_sfx("collect");
          this.crop_harvest_completed = true;
          if (this.crop_type === CropTypes.SUGARCANE) {
            triggerDidYouKnow("sugarcane");
            this.crop_state = CropStates.GROWING;
            this.crop_grow_time = 0;
            this.is_harvesting = false;
            this.spoilage_remaining = Infinity;
            this.freshness_state = FreshnessStates.FRESH;
            this.sprite = `${type}${this.crop_state}`;
            this.animate("angle", [-3, 3], { duration: 1, direction: "ping-pong" });
            this.settleHarvest(true);
          } else this.cropDestroy("harvest");
      });
      return true;
    },

    add() {
      this.tag(type);
      this.sprite = `${type}${this.crop_state}`;
      this.animate("angle", [-3, 3], { duration: 1, direction: "ping-pong", easing: k.easings.easeInOutSine });
      if (this.crop_state === CropStates.HARVESTABLE) this.initFreshness();
    },

    update() {
      if (this.crop_removed) return;
      const tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      if (tile?.crop !== this) { this.cropDestroy("replaced"); return; }
      if (this.is_harvesting) return;
      if (farm_grid_index.freezeCropLifecycle) return;
      let seconds = k.dt();
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      if (this.crop_state === CropStates.HARVESTABLE) {
        if (tutorialPolicy.protected && !(farm_grid_index.isDemonstration && this.demonstrateSpoilage)) return;
        this.spoilage_remaining = Math.max(0, this.spoilage_remaining - seconds);
        if (this.spoilage_remaining === 0) this.markDead();
        return;
      }
      this.absorbing_water = false;
      if (this.crop_state === CropStates.DEAD || !tile.soil) return;
      if (type === CropTypes.CORN) {
        this.crop_synergy_elapsed += seconds;
        if (this.crop_synergy_elapsed >= 1) {
          this.crop_synergy_elapsed = 0;
          const count = this.countAdjacentCrop(this.grid_x, this.grid_y, type);
          this.crop_grow_duration = Math.max(1, this.crop_duration - count * 6);
          this.effectsEnabled(count > 0);
          if (count > 0) { triggerDidYouKnow("corn_synergy"); this.showEffects("upgrade", "medium", null); }
        }
      }
      while (seconds > 0 && [CropStates.YOUNG, CropStates.GROWING].includes(this.crop_state)) {
        const remaining = Math.max(0, this.crop_grow_duration - this.crop_grow_time);
        const consumed = tile.soil.consumeWater(Math.min(seconds, remaining), this.crop_grow_duration);
        this.crop_grow_time += consumed;
        seconds -= consumed;
        this.absorbing_water = tile.soil.isWatered();
        if (this.crop_grow_time + 1e-9 < this.crop_grow_duration) break;
        this.crop_grow_time = 0;
        this.crop_state = this.crop_state === CropStates.YOUNG ? CropStates.GROWING : CropStates.HARVESTABLE;
        this.sprite = `${type}${this.crop_state}`;
        if (this.crop_state === CropStates.HARVESTABLE) {
          this.absorbing_water = false;
          this.effectsEnabled(false);
          this.spoilage_remaining = this.crop_spoilage_time;
          this.initFreshness();
        }
        if (consumed === 0) break;
      }
    },

    countAdjacentCrop(x, y, adjacentType) {
      return [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => {
        const neighbor = farm_grid_index.get(`${y + dy}-${x + dx}`)?.crop;
        return neighbor && !neighbor.crop_removed && neighbor.crop_state !== CropStates.DEAD && neighbor.crop_type === adjacentType;
      }).length;
    },
  };
}

export function addCrop(farm_grid_index, type, x, y, state = CropStates.YOUNG) {
  // prettier-ignore
  return k.add([
    k.pos(),
    k.sprite(`${type}${state}`),
    k.anchor("bot"),
    k.z(),
    k.rotate(),
    k.animate(),
    k.timer(),
    k.scale(k.vec2(1)),
    k.opacity(1),
    effects(true),
    freshness(),
    gridpos(x, y, CONFIG.FARM.tile_size / 2, CONFIG.FARM.tile_size / 2),
    ysort(),
    popupicon(),
    dropOrbs(),
    crop(farm_grid_index, type, state),
  ]);
}

// Spawn outside of the farm
// If outside, go to the farm
// If inside the farm, lock it inside and various bug behaviours
