import { CropStates } from "../global/enum.js";
import { getDifficultyParams } from "./difficulty.js";
import { RAIN_TIMING } from "./motion.js";

const STEP = 0.05;
const EPSILON = 1e-9;
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function isLivingCrop(crop) {
  return Boolean(crop && crop.crop_state !== CropStates.DEAD
    && (crop.crop_health === undefined || crop.crop_health > 0)
    && (typeof crop.exists !== "function" || crop.exists()));
}

/** Pests may register off-farm placeholders; only soil objects are actual tiles. */
export function farmTiles(grid) {
  return [...grid.entries()].filter(([, tile]) => tile.soil
    && (typeof tile.soil.exists !== "function" || tile.soil.exists()));
}

export function canStartFireEvent(grid) {
  const tiles = farmTiles(grid);
  return tiles.length > 0
    && tiles.filter(([, tile]) => isLivingCrop(tile.crop)).length >= Math.ceil(tiles.length * 2 / 3)
    && tiles.some(([, tile]) => isLivingCrop(tile.crop) && !tile.fire?.isBurning());
}

function coordinates(key) {
  const match = /^(-?\d+)-(-?\d+)$/.exec(key);
  return match ? { x: Number(match[2]), y: Number(match[1]) } : null;
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function fireSettings(params) {
  return {
    stageDuration: 6,
    damageInterval: 1,
    damage: 2,
    stageDamageMultipliers: [0.5, 1, 2.5],
    spreadInterval: 3,
    spreadChance: 0.35 + Math.min(1, (params.pts - 100) / 9900) * 0.2,
    wetSpreadMultiplier: 0.2,
  };
}

/**
 * Deterministic game-time model. It knows tile capabilities, never KAPLAY,
 * sprites, crop timers, soil masks, inventory, or UI state.
 */
export class FarmEventSimulation {
  constructor(grid, { random = Math.random, now = Date.now, onFireRemoved = () => {} } = {}) {
    this.grid = grid;
    this.random = random;
    this.now = now;
    this.onFireRemoved = onFireRemoved;
    this.fires = new Map();
    this.clouds = new Map();
    this.drops = new Map();
    this.accumulator = 0;
    this.sequence = 0;
    this.disposed = false;
  }

  startFire(points = 100) {
    const params = getDifficultyParams(points);
    if (this.disposed || !canStartFireEvent(this.grid)) {
      return { type: "fire", params, applied: false, fires: [], reason: "insufficient_crops" };
    }
    const candidates = farmTiles(this.grid).filter(([, tile]) => isLivingCrop(tile.crop) && !tile.fire?.isBurning());
    const fires = shuffled(candidates, this.random).slice(0, params.entityCount)
      .map(([key]) => this.ignite(key, fireSettings(params))).filter(Boolean);
    return { type: "fire", params, applied: fires.length > 0, fires };
  }

  /** Also used by spread; occupancy threshold applies to events, not propagation. */
  ignite(key, settings = fireSettings(getDifficultyParams(100))) {
    const tile = this.grid.get(key);
    if (this.disposed || !tile?.soil || !isLivingCrop(tile.crop) || tile.fire?.isBurning() || !coordinates(key)) return null;
    const fire = {
      id: ++this.sequence, key, ...coordinates(key), settings: { ...settings },
      crop: tile.crop,
      stage: 0, age: 0, damageClock: 0, spreadClock: 0,
      spawned_at: this.now(), active: true,
      isBurning: () => fire.active,
      extinguish: (source = "bot") => this.extinguish(fire, source),
      destroy: () => this.extinguish(fire, "destroyed"),
    };
    this.fires.set(key, fire);
    tile.fire = fire;
    return fire;
  }

  extinguish(fire, source = "bot") {
    if (!fire?.active) return false;
    fire.active = false;
    fire.extinguishedBy = source;
    if (this.fires.get(fire.key) === fire) this.fires.delete(fire.key);
    const tile = this.grid.get(fire.key);
    if (tile?.fire === fire) tile.fire = null;
    this.onFireRemoved(fire, source);
    return true;
  }

  startRain(points = 100) {
    const params = getDifficultyParams(points);
    if (this.disposed) return { type: "rain", params, applied: false, clouds: [], reason: "disposed" };
    const occupied = new Set([...this.clouds.values()].map(cloud => cloud.key));
    const candidates = farmTiles(this.grid).filter(([key]) => !occupied.has(key));
    // Shuffle within priority groups; crops get rain before empty soil.
    const planted = shuffled(candidates.filter(([, tile]) => isLivingCrop(tile.crop)), this.random);
    const bare = shuffled(candidates.filter(([, tile]) => !isLivingCrop(tile.crop)), this.random);
    const result = { type: "rain", params, applied: false, clouds: [], wateredTiles: 0, extinguishedFires: 0 };
    const watered = new Set();
    for (const [key] of [...planted, ...bare].slice(0, params.entityCount)) {
      if (!coordinates(key)) continue;
      const cloud = {
        id: ++this.sequence, key, ...coordinates(key), side: this.random() < 0.5 ? -1 : 1,
        phase: "entering", phaseAge: 0, dropClock: 0, progress: 0,
        ...RAIN_TIMING,
        recordImpact: ({ wateredSoil, extinguished }) => {
          if (extinguished) result.extinguishedFires++;
          if (wateredSoil) watered.add(key);
          result.wateredTiles = watered.size;
        },
        destroy: () => this.removeCloud(cloud),
      };
      this.clouds.set(cloud.id, cloud);
      result.clouds.push(cloud);
    }
    result.applied = result.clouds.length > 0;
    if (!result.applied) result.reason = candidates.length ? "invalid_tiles" : "no_available_tiles";
    return result;
  }

  removeCloud(cloud) {
    if (!this.clouds.delete(cloud.id)) return false;
    for (const [id, drop] of this.drops) if (drop.cloud === cloud) this.drops.delete(id);
    return true;
  }

  removeDrop(drop) {
    return this.drops.delete(drop.id);
  }

  neighbors(fire) {
    return DIRECTIONS.map(([dx, dy]) => `${fire.y + dy}-${fire.x + dx}`)
      .filter(key => {
        const tile = this.grid.get(key);
        return tile?.soil && isLivingCrop(tile.crop) && !tile.fire?.isBurning();
      });
  }

  spread(fire) {
    for (const key of this.neighbors(fire)) {
      const tile = this.grid.get(key);
      const chance = fire.settings.spreadChance * (tile.soil.isWatered() ? fire.settings.wetSpreadMultiplier : 1);
      if (this.random() < chance) this.ignite(key, fire.settings);
    }
  }

  updateFire(fire, dt) {
    const tile = this.grid.get(fire.key);
    if (!tile?.soil || tile.fire !== fire) return this.extinguish(fire, "tile_removed");
    // A replacement plant must never inherit the previous crop's flame.
    if (tile.crop !== fire.crop) return this.extinguish(fire, "no_fuel");
    // Spoilage can happen between fire ticks. A crop already burning must not
    // leave a dead remnant just because its spoilage timer beat lethal damage.
    if (tile.crop?.crop_state === CropStates.DEAD) tile.crop.cropDestroy("fire");
    if (!isLivingCrop(tile.crop)) return this.extinguish(fire, "no_fuel");
    fire.age += dt;
    const previousStage = fire.stage;
    fire.stage = Math.min(2, Math.floor((fire.age + EPSILON) / fire.settings.stageDuration));
    fire.damageClock += dt;
    if (fire.damageClock + EPSILON >= fire.settings.damageInterval) {
      fire.damageClock -= fire.settings.damageInterval;
      const multiplier = fire.settings.stageDamageMultipliers?.[fire.stage] ?? 1;
      tile.crop.damage(fire.settings.damage * multiplier, { source: "fire", noTrace: true });
    }
    // Damage resolves before spread. A lethal tick cannot create an orphan
    // flame or spread again after consuming its plant.
    if (!isLivingCrop(tile.crop) || tile.crop !== fire.crop) return this.extinguish(fire, "no_fuel");
    if (fire.stage === 2) {
      fire.spreadClock += dt;
      if (previousStage < 2 || fire.spreadClock + EPSILON >= fire.settings.spreadInterval) {
        fire.spreadClock = 0;
        this.spread(fire);
      }
    }
  }

  updateCloud(cloud, dt) {
    if (!this.grid.get(cloud.key)?.soil) return this.removeCloud(cloud);
    cloud.phaseAge += dt;
    if (cloud.phase === "entering") {
      cloud.progress = Math.min(1, cloud.phaseAge / cloud.travelDuration);
      if (cloud.phaseAge + EPSILON >= cloud.travelDuration) {
        cloud.phase = "raining";
        cloud.phaseAge = 0;
        cloud.progress = 0;
        cloud.dropClock = cloud.dropInterval; // First visible drop starts on arrival.
      }
    } else if (cloud.phase === "raining") {
      cloud.dropClock += dt;
      if (cloud.dropClock + EPSILON >= cloud.dropInterval) {
        cloud.dropClock -= cloud.dropInterval;
        const drop = { id: ++this.sequence, key: cloud.key, cloud, age: 0, duration: cloud.dropDuration, progress: 0 };
        this.drops.set(drop.id, drop);
      }
      if (cloud.phaseAge + EPSILON >= cloud.rainDuration) {
        cloud.phase = "leaving";
        cloud.phaseAge = 0;
        cloud.progress = 0;
      }
    } else {
      cloud.progress = Math.min(1, cloud.phaseAge / cloud.exitDuration);
      if (cloud.phaseAge + EPSILON >= cloud.exitDuration) this.removeCloud(cloud);
    }
  }

  updateDrop(drop, dt) {
    drop.age += dt;
    drop.progress = Math.min(1, drop.age / drop.duration);
    if (drop.age + EPSILON < drop.duration) return;
    const tile = this.grid.get(drop.key);
    if (tile?.soil) {
      const extinguished = tile.fire?.extinguish("rain") ?? false;
      const wateredSoil = tile.soil.water({ rain: true });
      drop.cloud.recordImpact({ wateredSoil, extinguished });
    }
    this.drops.delete(drop.id);
  }

  update(dt) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += dt;
    while (this.accumulator + EPSILON >= STEP) {
      this.accumulator = Math.max(0, this.accumulator - STEP);
      // Impacts precede fire: a drop arriving this step prevents another attack.
      for (const drop of [...this.drops.values()]) this.updateDrop(drop, STEP);
      for (const cloud of [...this.clouds.values()]) this.updateCloud(cloud, STEP);
      for (const fire of [...this.fires.values()]) this.updateFire(fire, STEP);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const fire of [...this.fires.values()]) this.extinguish(fire, "scene_disposed");
    this.clouds.clear();
    this.drops.clear();
    this.accumulator = 0;
  }
}
