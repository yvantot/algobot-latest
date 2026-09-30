// All durations use game seconds, so pause and game speed affect visuals and
// impacts together. Render between fixed simulation ticks using the remainder.
export const RAIN_TIMING = Object.freeze({
  travelDuration: 2.65,
  rainDuration: 8,
  exitDuration: 2.65,
  dropInterval: 0.8,
  dropDuration: 0.9,
});

export const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInQuad = t => t * t;
export const easeOutCubic = t => 1 - (1 - t) ** 3;
const bounceOut = t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const APPEAR = 0.4, HOLD = 0.25, DISAPPEAR = 0.4;

export function timedLerp(from, to, elapsed, duration, easing = easeInOutSine) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  if(t===0)return from;
  if(t===1)return to;
  return from + (to - from) * easing(t);
}

export function cloudPosition(cloud, outside, center, remainder = 0) {
  const elapsed = cloud.phaseAge + remainder;
  const x = cloud.phase === "entering"
    ? timedLerp(outside, center.x, elapsed - APPEAR - HOLD, cloud.travelDuration - APPEAR - HOLD, bounceOut)
    : cloud.phase === "leaving"
      ? timedLerp(center.x, outside, elapsed, cloud.exitDuration - HOLD - DISAPPEAR, bounceOut)
      : center.x;
  return { x, y: center.y - 100 };
}

export function cloudAppearance(cloud, remainder = 0) {
  const elapsed = cloud.phaseAge + remainder;
  if (cloud.phase === "entering") return {
    opacity: timedLerp(0, 1, elapsed, APPEAR / 2),
    scale: timedLerp(0, 1, elapsed, APPEAR, bounceOut),
  };
  if (cloud.phase === "leaving") {
    const age = elapsed - (cloud.exitDuration - DISAPPEAR);
    return { opacity: timedLerp(1, 0, age, DISAPPEAR),
      scale: timedLerp(1, 0, age, DISAPPEAR, t => 1 - bounceOut(1 - t)) };
  }
  return { opacity: 1, scale: 1 };
}

export function dropPosition(drop, center, remainder = 0) {
  return {
    x: center.x + ((drop.id % 3) - 1) * 12,
    y: timedLerp(center.y - 85, center.y, drop.age + remainder, drop.duration, easeInQuad),
  };
}
