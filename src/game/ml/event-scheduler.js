// Periodic DDA events: rules or LSTM-assisted rules.
// Rain helps plants; challenge events choose eligible pests or fire.
import { farm_grid_index } from "../game.js";
import { CONFIG, PLAYER_DATA } from "../global/global.js";
import { CropStates } from "../global/enum.js";
import { spawnBugEvent, spawnRainEvent, spawnFireEvent, canStartFireEvent } from "../event.js";
import { mlAgent } from "./agent.js";
import { DDA_ACTIONS } from "./dda.js";
import { telemetry } from "./telemetry.js";

const BOOTSTRAP_INTERVAL_MS = 5 * 60 * 1000;
const ML_INTERVAL_MS = 2 * 60 * 1000;
const COOLDOWN_MS = 5 * 60 * 1000;

export class EventScheduler {
  constructor({ random = Math.random, events = {} } = {}) {
    this.random = random;
    this.events = { bug: spawnBugEvent, rain: spawnRainEvent, fire: spawnFireEvent, canStartFire: canStartFireEvent, ...events };
    this.intervalId = null;
    this.lastEventTime = 0;
    this.isRunning = false;
    this.lastCheckTime = 0;
    this.eventsTriggered = 0;
    this.shouldRun = () => true;
  }

  start({ shouldRun = () => true } = {}) {
    if (this.isRunning) return;
    this.shouldRun = shouldRun;
    this.lastEventTime = 0;
    this.lastCheckTime = 0;
    this.eventsTriggered = 0;
    this.isRunning = true;
    this._scheduleNext();
  }

  stop() {
    clearTimeout(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  _intervalMs() {
    return mlAgent.mode === "bootstrap" ? BOOTSTRAP_INTERVAL_MS : ML_INTERVAL_MS;
  }

  _scheduleNext() {
    clearTimeout(this.intervalId);
    if (!this.isRunning) return;
    // Re-read mode each tick in case inference fell back after initialization.
    this.intervalId = setTimeout(() => {
      try {
        this._check();
      } finally {
        this._scheduleNext();
      }
    }, this._intervalMs());
  }

  _check() {
    this.lastCheckTime = Date.now();
    if (!this.shouldRun()) return { triggered: false, reason: "gameplay_paused" };
    return mlAgent.mode === "bootstrap" ? this._bootstrapCheck() : this._mlCheck();
  }

  countHarvestableCrops() {
    return [...farm_grid_index.values()].filter(tile => tile.crop?.crop_state === CropStates.HARVESTABLE).length;
  }

  getTotalTiles() {
    return CONFIG.FARM.rows * CONFIG.FARM.columns;
  }

  checkPrecondition() {
    return this.getTotalTiles() > 0 && this.countHarvestableCrops() > this.getTotalTiles() / 3;
  }

  countPlantedCrops() {
    return [...farm_grid_index.values()].filter(tile => tile.soil && tile.crop && tile.crop.crop_state !== CropStates.DEAD).length;
  }

  eventSeverity() {
    return Math.min(10000, 100 + this.countPlantedCrops() * 50 + Math.max(0, PLAYER_DATA.level) * 100);
  }

  isCooldownActive() {
    return this.lastEventTime > 0 && Date.now() - this.lastEventTime < COOLDOWN_MS;
  }

  computeSpawnChance() {
    return Math.min(0.30, 0.03 + Math.min(0.27, Math.max(0, PLAYER_DATA.level) * 0.018));
  }

  _markEvent(type, result) {
    this.lastEventTime = Date.now();
    this.eventsTriggered++;
    telemetry.recordScheduledEvent(type, { mode: mlAgent.mode, actionId: mlAgent.lastAction });
    return { triggered: true, reason: type, event: result };
  }

  _rainCheck() {
    const result = this.events.rain(farm_grid_index, this.eventSeverity());
    return result.applied ? this._markEvent("rain", result) : { triggered: false, reason: result.reason || "no_waterable_tiles" };
  }

  _bugCheck() {
    if (!this.checkPrecondition()) return { triggered: false, reason: "precondition" };
    const result = this.events.bug(farm_grid_index, this.eventSeverity());
    if (result.applied === false) return { triggered: false, reason: result.reason || "no_bug_targets" };
    return this._markEvent("bug", result);
  }

  _challengeCheck() {
    const eligible = [];
    if (this.checkPrecondition()) eligible.push("bug");
    if (this.events.canStartFire(farm_grid_index)) eligible.push("fire");
    if (!eligible.length) return { triggered: false, reason: "precondition" };
    const choice = eligible[Math.min(eligible.length - 1, Math.floor(this.random() * eligible.length))];
    if (choice === "bug") return this._bugCheck();
    const result = this.events.fire(farm_grid_index, this.eventSeverity());
    return result.applied ? this._markEvent("fire", result) : { triggered: false, reason: result.reason || "no_fire_targets" };
  }

  _bootstrapCheck(force = false) {
    if (this.isCooldownActive()) return { triggered: false, reason: "cooldown" };
    if (!force && this.random() >= this.computeSpawnChance()) return { triggered: false, reason: "chance" };
    if (mlAgent.lastAction === DDA_ACTIONS.SCAFFOLD) return this._rainCheck();
    return this._challengeCheck();
  }

  _mlCheck() {
    if (this.isCooldownActive()) return { triggered: false, reason: "cooldown" };
    if (mlAgent.lastAction === DDA_ACTIONS.SCAFFOLD) return this._rainCheck();
    if ([DDA_ACTIONS.CHALLENGE, DDA_ACTIONS.STATE_OPTIMIZE].includes(mlAgent.lastAction)) return this._challengeCheck();
    return { triggered: false, reason: "no_event_for_action" };
  }

  forceCheck() {
    this.lastCheckTime = Date.now();
    return mlAgent.mode === "bootstrap" ? this._bootstrapCheck(true) : this._mlCheck();
  }

  getState() {
    const intervalMs = this._intervalMs();
    const cooldownRemaining = this.isCooldownActive() ? COOLDOWN_MS - (Date.now() - this.lastEventTime) : 0;
    return {
      isRunning: this.isRunning,
      mode: mlAgent.mode,
      intervalMs,
      nextCheckIn: this.lastCheckTime ? Math.max(0, intervalMs - (Date.now() - this.lastCheckTime)) : intervalMs,
      lastCheckTime: this.lastCheckTime,
      lastEventTime: this.lastEventTime,
      cooldownRemaining,
      cooldownActive: this.isCooldownActive(),
      harvestableCount: this.countHarvestableCrops(),
      totalTiles: this.getTotalTiles(),
      threshold: Math.floor(this.getTotalTiles() / 3) + 1,
      preconditionMet: this.checkPrecondition(),
      plantedCount: this.countPlantedCrops(),
      firePreconditionMet: this.events.canStartFire(farm_grid_index),
      severity: this.eventSeverity(),
      spawnChance: this.computeSpawnChance(),
      playerLevel: PLAYER_DATA.level,
      eventsTriggered: this.eventsTriggered,
    };
  }
}

export const eventScheduler = new EventScheduler();
