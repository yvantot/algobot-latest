<script>
  import { fly } from "svelte/transition";
  import { EVENT_BANNER_STATE } from "./global.svelte.js";

  const RANK_COLORS = {
    Easy: "text-emerald-300 border-emerald-500/50 bg-emerald-950/40",
    Normal: "text-sky-300 border-sky-500/50 bg-sky-950/40",
    Hard: "text-amber-300 border-amber-500/50 bg-amber-950/40",
    Extreme: "text-red-400 border-red-500/50 bg-red-950/40",
  };
</script>

{#if EVENT_BANNER_STATE.active}
  <div
    in:fly={{ y: -60, duration: 400 }}
    out:fly={{ y: -60, duration: 300 }}
    class="fixed top-24 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none"
  >
    <div
      class="bg-[#ab7440] border-4 border-[#7c552f] outline-2 outline-[#F2E0CF] text-amber-50 shadow-2xl rounded-xl p-3 px-5 flex items-center gap-4 min-w-[340px] max-w-xl select-none"
    >
      <!-- Icon -->
      <div
        class="bg-[#7c552f]/90 p-2 rounded-lg border border-[#F2E0CF]/30 shrink-0"
      >
        <img
          src={EVENT_BANNER_STATE.icon}
          alt={EVENT_BANNER_STATE.title}
          class="w-10 h-10 object-contain drop-shadow-md animate-bounce-subtle"
          style="image-rendering: pixelated;"
        />
      </div>

      <!-- Title & Subtitle -->
      <div class="flex flex-col flex-grow min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="font-extrabold text-sm text-[#F2E0CF] uppercase tracking-wide font-mono truncate"
          >
            {EVENT_BANNER_STATE.title}
          </span>
        </div>
        <p class="text-xs text-amber-100/90 font-medium leading-snug truncate">
          {EVENT_BANNER_STATE.subtitle}
        </p>
      </div>

      <!-- Difficulty Points Badge -->
      <div
        class="flex flex-col items-center justify-center px-3 py-1 rounded-lg border shrink-0 text-center {RANK_COLORS[
          EVENT_BANNER_STATE.rank
        ] || RANK_COLORS.Easy}"
      >
        <span class="font-extrabold text-xs uppercase tracking-wider">
          {EVENT_BANNER_STATE.rank}
        </span>
        <span class="text-[10px] font-bold font-mono opacity-90">
          {EVENT_BANNER_STATE.difficultyPoints.toLocaleString()} PTS
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes bounce-subtle {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-3px);
    }
  }
  .animate-bounce-subtle {
    animation: bounce-subtle 1.2s ease-in-out infinite;
  }
</style>
