// All durations use game seconds, so pause and game speed affect visuals and
// impacts together. Render between fixed simulation ticks using the remainder.
export const RAIN_TIMING = Object.freeze({
  travelDuration: 5,
  rainDuration: 8,
  exitDuration: 4,
  dropInterval: 0.8,
  dropDuration: 0.9,
});

export const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInQuad = t => t * t;

export function timedLerp(from, to, elapsed, duration, easing = easeInOutSine) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  return from + (to - from) * easing(t);
}

export function cloudPosition(cloud, outside, center, remainder = 0) {
  const elapsed = cloud.phaseAge + remainder;
  const x = cloud.phase === "entering"
    ? timedLerp(outside, center.x, elapsed, cloud.travelDuration)
    : cloud.phase === "leaving"
      ? timedLerp(center.x, outside, elapsed, cloud.exitDuration)
      : center.x;
  return { x, y: center.y - 100 };
}

export function cloudAppearance(cloud, remainder = 0) {
  const elapsed = cloud.phaseAge + remainder;
  const opacity = cloud.phase === "entering"
    ? timedLerp(0, 1, elapsed, cloud.travelDuration)
    : cloud.phase === "leaving"
      ? timedLerp(1, 0, elapsed, cloud.exitDuration)
      : 1;
  return { opacity, scale: 0.65 + 0.35 * opacity };
}

export function dropPosition(drop, center, remainder = 0) {
  return {
    x: center.x + ((drop.id % 3) - 1) * 12,
    y: timedLerp(center.y - 85, center.y, drop.age + remainder, drop.duration, easeInQuad),
  };
}
