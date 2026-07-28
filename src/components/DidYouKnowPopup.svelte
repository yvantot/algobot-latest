<script>
  import { DID_YOU_KNOW_STATE } from "./global.svelte.js";
  import { k } from "../lib/kaplay.js";
  import { elasticOut, cubicIn } from "svelte/easing";

  let position = $state({ x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 100 });
  let previousTimeScale = $state(null);
  let isClosing = $state(false);

  $effect(() => {
    if (DID_YOU_KNOW_STATE.activeTip) {
      isClosing = false;
      if (k && k.debug) {
        if (previousTimeScale === null) {
          previousTimeScale = k.debug.timeScale;
        }
        k.debug.timeScale = 0;
      }
    } else {
      if (k && k.debug && previousTimeScale !== null) {
        k.debug.timeScale = previousTimeScale;
        previousTimeScale = null;
      }
    }
  });

  function closePopup() {
    isClosing = true;
    setTimeout(() => {
      DID_YOU_KNOW_STATE.activeTip = null;
      isClosing = false;
    }, 240);
  }

  function popIn(node) {
    return {
      duration: 520,
      easing: elasticOut,
      css: (t) => {
        const s = 0.4 + 0.6 * t;
        const y = -40 * (1 - t);
        return `transform: scale(${s}) translateY(${y}px); opacity: ${Math.min(1, t * 2)};`;
      }
    };
  }

  function popOut(node) {
    return {
      duration: 220,
      easing: cubicIn,
      css: (t) => {
        const s = 0.5 + 0.5 * t;
        const y = -20 * (1 - t);
        return `transform: scale(${s}) translateY(${y}px); opacity: ${t};`;
      }
    };
  }

  function drag(node) {
    let moving = false;
    const onMouseDown = (e) => {
      if (e.target.closest("button")) return;
      moving = true;
    };
    const onMouseMove = (e) => {
      if (moving) {
        position = {
          x: Math.max(10, Math.min(window.innerWidth - 330, position.x + e.movementX)),
          y: Math.max(10, Math.min(window.innerHeight - 200, position.y + e.movementY))
        };
      }
    };
    const onMouseUp = () => (moving = false);

    node.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return {
      destroy() {
        node.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
    };
  }
</script>

{#if DID_YOU_KNOW_STATE.activeTip && !isClosing}
  <div
    use:drag
    in:popIn
    out:popOut
    class="fixed z-[10000] w-80 bg-gray-100 text-slate-700 border-4 border-slate-500 rounded-xl shadow-2xl overflow-hidden select-none flex flex-col dyk-popup"
    style="left: {position.x}px; top: {position.y}px;"
  >
    <!-- Header (Draggable Handle) -->
    <div class="flex justify-between items-center bg-gray-200 border-b-2 border-slate-400 px-3 py-2 cursor-grab active:cursor-grabbing">
      <div class="flex items-center gap-2">
        <span class="font-bold text-xs text-slate-800 uppercase tracking-wide">Did you know?</span>
      </div>
      <button
        onclick={closePopup}
        class="text-slate-500 hover:text-slate-800 font-bold text-xs px-1 py-0.5 rounded cursor-pointer"
      >✕</button>
    </div>

    <!-- Body -->
    <div class="p-3.5 space-y-2 text-xs">
      <div class="flex items-center justify-between">
        <h4 class="font-extrabold text-sm text-slate-800">{DID_YOU_KNOW_STATE.activeTip.title}</h4>
        <span class="text-[10px] font-bold px-2 py-0.5 bg-[#262b36] text-green-300 rounded uppercase">
          {DID_YOU_KNOW_STATE.activeTip.category}
        </span>
      </div>

      {#if DID_YOU_KNOW_STATE.activeTip.image}
        <div class="rounded-lg overflow-hidden border border-slate-300 bg-white">
          <img
            src={DID_YOU_KNOW_STATE.activeTip.image}
            alt={DID_YOU_KNOW_STATE.activeTip.title}
            class="w-full object-contain max-h-36"
            style="image-rendering: pixelated;"
          />
        </div>
      {/if}

      <p class="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-300 shadow-inner">
        {DID_YOU_KNOW_STATE.activeTip.description}
      </p>

      <button
        onclick={closePopup}
        class="got-it-btn w-full py-1.5 bg-gray-300 hover:bg-gray-400 text-slate-800 font-bold rounded-lg text-xs border border-slate-400 shadow cursor-pointer transition-transform"
      >
        Got it!
      </button>
    </div>
  </div>
{/if}

<style>
  /* Post-spring settle: a tiny side-to-side wiggle after the popup lands */
  @keyframes dyk-settle {
    0%   { transform: rotate(0deg); }
    20%  { transform: rotate(-1.5deg); }
    40%  { transform: rotate(1.2deg); }
    60%  { transform: rotate(-0.6deg); }
    80%  { transform: rotate(0.3deg); }
    100% { transform: rotate(0deg); }
  }

  .dyk-popup {
    animation: dyk-settle 0.55s ease-out 0.45s both;
    transform-origin: top center;
  }

  /* Tactile button press squish */
  .got-it-btn:active {
    transform: scale(0.94) translateY(1px);
  }
</style>

