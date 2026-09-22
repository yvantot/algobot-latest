import { backOut, cubicIn } from "svelte/easing";

export function rewardMotion(node, { enter }) {
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    duration: reduced ? 0 : enter ? 420 : 240,
    delay: enter && !reduced ? 240 : 0,
    easing: enter ? backOut : cubicIn,
    css: t => `opacity:${Math.min(1, t)};transform:translateX(-50%) translateY(${(1-t)*28}px) scale(${.88+.12*t});`,
  };
}
