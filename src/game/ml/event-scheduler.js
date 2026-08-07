// Automated Event Scheduler
// Periodically checks whether to spawn game events (bug, fire, rain) based on
// farm state, player level, and DDA mode (Bootstrap vs ML).
//
// Bootstrap Mode: Every 5 minutes, rolls a random chance (scaled by player level, max 30%)
// ML Mode: Every 2 minutes, uses the DQN's selected action to determine event type
// Precondition: > 1/3 of total grid tiles must have harvestable crops
// Cooldown: 5 minutes minimum between events

import { farm_grid_index } from "../game.js";
import { CONFIG, PLAYER_DATA } from "../global/global.js";
import { CropStates } from "../global/enum.js";
import { spawnBugEvent } from "../event.js";
import { mlAgent } from "./agent.js";
import { dda, DDA_ACTIONS } from "./dda.js";

const BOOTSTRAP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ML_INTERVAL_MS = 2 * 60 * 1000;         // 2 minutes
const COOLDOWN_MS = 5 * 60 * 1000;            // 5 minutes between events

class EventScheduler {
  constructor() {
    this.intervalId = null;
    this.lastEventTime = 0;
    this.isRunning = false;
    this.lastCheckTime = 0;
    this.eventsTriggered = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._scheduleNext();
    console.log(`Event Scheduler started (${mlAgent.mode} mode)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  _scheduleNext() {
    if (this.intervalId) clearInterval(this.intervalId);

    const intervalMs = mlAgent.mode === "ml" ? ML_INTERVAL_MS : BOOTSTRAP_INTERVAL_MS;
    this.intervalId = setInterval(() => this._check(), intervalMs);
  }

  _check() {
    this.lastCheckTime = Date.now();

    if (mlAgent.mode === "bootstrap") {
      this._bootstrapCheck();
    } else {
      this._mlCheck();
    }
  }

  // Count harvestable crops on the farm grid
  countHarvestableCrops() {
    let count = 0;
    for (const [, tile] of farm_grid_index) {
      if (tile.crop && tile.crop.crop_state === CropStates.HARVESTABLE) {
        count++;
      }
    }
    return count;
  }

  // Get total grid tile count (dynamic — expands when player buys land)
  getTotalTiles() {
    return CONFIG.FARM.rows * CONFIG.FARM.columns;
  }

  // Check precondition: > 1/3 of grid must be harvestable
  checkPrecondition() {
    const totalTiles = this.getTotalTiles();
    const threshold = Math.ceil(totalTiles / 3);
    const harvestable = this.countHarvestableCrops();
    return harvestable >= threshold;
  }

  // Check if cooldown has elapsed
  isCooldownActive() {
    return (Date.now() - this.lastEventTime) < COOLDOWN_MS;
  }

  // Compute spawn chance for Bootstrap mode (level-scaled, max 30%)
  computeSpawnChance() {
    const level = PLAYER_DATA.level;
    const baseChance = 0.03;
    const levelBonus = Math.min(0.27, level * 0.018);
    return Math.min(0.30, baseChance + levelBonus);
  }

  // Bootstrap mode: 5-min interval, random-chance roll scaled by player level
  _bootstrapCheck() {
    if (!this.checkPrecondition()) return;
    if (this.isCooldownActive()) return;

    const spawnChance = this.computeSpawnChance();
    const roll = Math.random();

    if (roll > spawnChance) return; // failed roll

    const harvestable = this.countHarvestableCrops();
    const baseDifficulty = 100 + (harvestable * 50);
    spawnBugEvent(farm_grid_index, baseDifficulty);
    this.lastEventTime = Date.now();
    this.eventsTriggered++;
  }

  // ML mode: 2-min interval, DQN action determines event type
  _mlCheck() {
    if (!this.checkPrecondition()) return;
    if (this.isCooldownActive()) return;

    const action = mlAgent.lastAction;
    const harvestable = this.countHarvestableCrops();
    const baseDifficulty = 100 + (harvestable * 50);

    // DQN-selected action determines which event fires
    if (action === DDA_ACTIONS.CHALLENGE || action === DDA_ACTIONS.STATE_OPTIMIZE) {
      spawnBugEvent(farm_grid_index, baseDifficulty);
      this.lastEventTime = Date.now();
      this.eventsTriggered++;
    }
    // Future: DDA_ACTIONS.SCAFFOLD → spawnRainEvent (helpful event)
    // NORMAL / GREEDY_GUIDE → no event
  }

  // Force an event check (for DevTools testing)
  forceCheck() {
    this.lastCheckTime = Date.now();
    if (mlAgent.mode === "bootstrap") {
      // Skip chance roll for forced check — just check precondition and cooldown
      if (!this.checkPrecondition()) return { triggered: false, reason: "precondition" };
      if (this.isCooldownActive()) return { triggered: false, reason: "cooldown" };

      const harvestable = this.countHarvestableCrops();
      const baseDifficulty = 100 + (harvestable * 50);
      spawnBugEvent(farm_grid_index, baseDifficulty);
      this.lastEventTime = Date.now();
      this.eventsTriggered++;
      return { triggered: true, reason: "forced" };
    } else {
      this._mlCheck();
      return { triggered: this.lastEventTime === Date.now(), reason: "ml_check" };
    }
  }

  // Get scheduler state for DevTools display
  getState() {
    const intervalMs = mlAgent.mode === "ml" ? ML_INTERVAL_MS : BOOTSTRAP_INTERVAL_MS;
    const timeSinceLastCheck = this.lastCheckTime ? Date.now() - this.lastCheckTime : null;
    const nextCheckIn = this.lastCheckTime
      ? Math.max(0, intervalMs - timeSinceLastCheck)
      : intervalMs;
    const cooldownRemaining = this.isCooldownActive()
      ? Math.max(0, COOLDOWN_MS - (Date.now() - this.lastEventTime))
      : 0;

    return {
      isRunning: this.isRunning,
      mode: mlAgent.mode,
      intervalMs,
      nextCheckIn,
      lastCheckTime: this.lastCheckTime,
      lastEventTime: this.lastEventTime,
      cooldownRemaining,
      cooldownActive: this.isCooldownActive(),
      harvestableCount: this.countHarvestableCrops(),
      totalTiles: this.getTotalTiles(),
      threshold: Math.ceil(this.getTotalTiles() / 3),
      preconditionMet: this.checkPrecondition(),
      spawnChance: this.computeSpawnChance(),
      playerLevel: PLAYER_DATA.level,
      eventsTriggered: this.eventsTriggered,
    };
  }
}

export const eventScheduler = new EventScheduler();
