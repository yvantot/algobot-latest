/** Event severity is shared by pests, fire, and rain (100 through 10000). */
export function getDifficultyParams(points) {
  const value = Number(points);
  const pts = Number.isFinite(value) ? Math.max(100, value) : 100;
  const ratio = Math.min(1, (pts - 100) / 9900);
  const rank = pts >= 5000 ? "Extreme" : pts >= 1500 ? "Hard" : pts >= 500 ? "Normal" : "Easy";
  return {
    pts,
    rank,
    entityCount: Math.min(8, Math.max(1, Math.round(1 + ratio * 7))),
    damage: Math.round(5 + ratio * 35),
    attackInterval: Number((3 - ratio * 2).toFixed(2)),
    moveInterval: Number((6 - ratio * 4.2).toFixed(2)),
    jumpDuration: Number((0.6 - ratio * 0.3).toFixed(2)),
  };
}
