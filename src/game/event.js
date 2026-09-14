import { addBug } from "./components-kaplay/components.js";
import { triggerEventBanner } from "../components/global.svelte.js";
import { dda } from "./ml/dda.js";
import { waterRainTiles } from "./global/farm-rules.js";

/**
 * Calculates event difficulty parameters based on difficulty points (100 = Easy, 10000+ = Extreme).
 * @param {number} points Difficulty points
 */
export function getDifficultyParams(points) {
  const pts = Math.max(100, Number(points) || 100);

  let rank = "Easy";
  if (pts >= 5000) {
    rank = "Extreme";
  } else if (pts >= 1500) {
    rank = "Hard";
  } else if (pts >= 500) {
    rank = "Normal";
  }

  // Linear interpolation ratio between 100 pts and 10000 pts
  const ratio = Math.min(1, Math.max(0, (pts - 100) / 9900));

  // Entity count: 1 (at 100 pts) up to 8 (at 10000 pts)
  const entityCount = Math.min(8, Math.max(1, Math.round(1 + ratio * 7)));

  // Damage per attack tick: 5 (at 100 pts) up to 40 (at 10000 pts)
  const damage = Math.round(5 + ratio * 35);

  // Attack interval (seconds between attacks): 3.0s (100 pts) down to 1.0s (10000 pts)
  const attackInterval = Number((3.0 - ratio * 2.0).toFixed(2));

  // Move interval (seconds between tile moves): 6.0s (100 pts) down to 1.8s (10000 pts)
  const moveInterval = Number((6.0 - ratio * 4.2).toFixed(2));

  // Jump duration (seconds for grid jump animation): 0.6s (100 pts) down to 0.3s (10000 pts)
  const jumpDuration = Number((0.6 - ratio * 0.3).toFixed(2));

  return {
    pts,
    rank,
    entityCount,
    damage,
    attackInterval,
    moveInterval,
    jumpDuration,
  };
}

/**
 * Spawns a Bug Event scaled by difficulty points.
 * @param {Map} farmGridIndex Map reference to grid tiles
 * @param {number} difficultyPoints Difficulty points (100 to 10000+)
 */
export function spawnBugEvent(farmGridIndex, difficultyPoints = 100) {
  // Apply DDA bug spawn multiplier (Bootstrap/ML DDA scales pest difficulty)
  const scaledPoints = Math.round(difficultyPoints * (dda.bugSpawnMultiplier || 1.0));
  const params = getDifficultyParams(scaledPoints);

  // Trigger modular wooden announcement banner
  triggerEventBanner({
    icon: "/sprites/icon_bug.png",
    title: "Pest Infestation",
    subtitle: `Bugs are invading your farm! (${params.entityCount} ${params.entityCount === 1 ? "bug" : "bugs"})`,
    difficultyPoints: params.pts,
    rank: params.rank,
    type: "bug",
  });

  const spawnedBugs = [];
  const bugConfig = {
    damage: params.damage,
    attack_interval: params.attackInterval,
    move_interval: params.moveInterval,
    jump_duration: params.jumpDuration,
  };

  // Spawn configured number of bugs with scaled properties
  for (let i = 0; i < params.entityCount; i++) {
    const bugEntity = addBug(farmGridIndex, bugConfig);
    spawnedBugs.push(bugEntity);
  }

  return {
    type: "bug",
    params,
    bugs: spawnedBugs,
  };
}

/**
 * Placeholder for Fire Event (WIP)
 */
export function spawnFireEvent(farmGridIndex, difficultyPoints = 100) {
  // Apply DDA fire spawn multiplier
  const scaledPoints = Math.round(difficultyPoints * (dda.fireSpawnMultiplier || 1.0));
  const params = getDifficultyParams(scaledPoints);
  triggerEventBanner({
    icon: "/sprites/icon_bug.png",
    title: "Fire Event Unavailable",
    subtitle: "Fire gameplay has not been implemented in this version.",
    difficultyPoints: params.pts,
    rank: params.rank,
    type: "fire",
  });
  return { type: "fire", params, applied: false };
}

/**
 * Water eligible farm tiles immediately as a supportive DDA event.
 */
export function spawnRainEvent(farmGridIndex, difficultyPoints = 100) {
  const params = getDifficultyParams(difficultyPoints);
  const wateredTiles = waterRainTiles(farmGridIndex);
  if (wateredTiles === 0) return { type: "rain", params, wateredTiles, applied: false };
  triggerEventBanner({
    icon: "/sprites/icon_droplet.png",
    title: "Nourishing Rain",
    subtitle: `Rain watered ${wateredTiles} prepared farm tiles!`,
    difficultyPoints: params.pts,
    rank: params.rank,
    type: "rain",
  });
  return { type: "rain", params, wateredTiles, applied: true };
}
