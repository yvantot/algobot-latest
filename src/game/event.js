import { tutorialPolicy } from "./global/tutorial.js";
import { addBug } from "./components-kaplay/components.js";
import { triggerEventBanner } from "../components/global.svelte.js";
import { dda } from "./ml/dda.js";
import { getDifficultyParams } from "./events/difficulty.js";
import { canStartFireEvent } from "./events/simulation.js";
import { getFarmEventRuntime } from "./events/renderer.js";

export { getDifficultyParams } from "./events/difficulty.js";
export { canStartFireEvent } from "./events/simulation.js";
export { configureFarmEvents, destroyFarmEvents } from "./events/renderer.js";

/** Spawn a pest event while preserving the existing DDA scaling. */
export function spawnBugEvent(farmGridIndex, difficultyPoints = 100) {
  if (tutorialPolicy.protected) return { applied: false, reason: "tutorial_protected" };
  const scaledPoints = Math.round(difficultyPoints * (dda.bugSpawnMultiplier ?? 1));
  const params = getDifficultyParams(scaledPoints);
  triggerEventBanner({
    icon: "/sprites/icon_bug.png",
    title: "Pest Infestation",
    subtitle: `Bugs are invading your farm! (${params.entityCount} ${params.entityCount === 1 ? "bug" : "bugs"})`,
    difficultyPoints: params.pts,
    rank: params.rank,
    type: "bug",
  });
  const bugs = [];
  const config = {
    damage: params.damage,
    attack_interval: params.attackInterval,
    move_interval: params.moveInterval,
    jump_duration: params.jumpDuration,
  };
  for (let i = 0; i < params.entityCount; i++) bugs.push(addBug(farmGridIndex, config));
  return { type: "bug", params, bugs };
}

/** Initial fires require at least two thirds of actual farm tiles to be planted. */
export function spawnFireEvent(farmGridIndex, difficultyPoints = 100) {
  if (tutorialPolicy.protected) return { applied: false, reason: "tutorial_protected" };
  const points = Math.round(difficultyPoints * (dda.fireSpawnMultiplier ?? 1));
  if (!canStartFireEvent(farmGridIndex)) {
    return { type: "fire", params: getDifficultyParams(points), fires: [], applied: false, reason: "insufficient_crops" };
  }
  const runtime = getFarmEventRuntime(farmGridIndex);
  const result = runtime.simulation.startFire(points);
  if (!result.applied) return result;
  runtime.renderer.update(0);
  triggerEventBanner({
    icon: "/sprites/icon_fire.png",
    title: "Farm Fire",
    subtitle: `${result.fires.length} ${result.fires.length === 1 ? "fire has" : "fires have"} started! Water or extinguish burning tiles before the flames spread.`,
    difficultyPoints: result.params.pts,
    rank: result.params.rank,
    type: "fire",
  });
  return result;
}

/** Clouds approach from the side; water and extinguishing happen on drop impact. */
export function spawnRainEvent(farmGridIndex, difficultyPoints = 100) {
  const runtime = getFarmEventRuntime(farmGridIndex);
  const result = runtime.simulation.startRain(difficultyPoints);
  if (!result.applied) return result;
  runtime.renderer.update(0);
  triggerEventBanner({
    icon: "/sprites/icon_rain.png",
    title: "Nourishing Rain",
    subtitle: `${result.clouds.length} rain ${result.clouds.length === 1 ? "cloud is" : "clouds are"} approaching your farm. Raindrops water soil and put out fires.`,
    difficultyPoints: result.params.pts,
    rank: result.params.rank,
    type: "rain",
  });
  return result;
}
