<script>
  import { UNLOCK_ANIMATIONS } from "./global.svelte.js";
</script>

<div class="fixed inset-0 pointer-events-none z-[999999] overflow-hidden">
  {#each UNLOCK_ANIMATIONS.flyingItems as item (item.id)}
    <div
      class="absolute font-mono font-bold text-sm bg-amber-300 text-amber-950 px-3 py-1.5 rounded-lg border-2 border-amber-600 shadow-xl flex items-center gap-1.5 fly-badge"
      style="
				left: 0;
				top: 0;
				--startX: {item.startX}px;
				--startY: {item.startY}px;
				--endX: {item.endX}px;
				--endY: {item.endY}px;
				animation-delay: {item.delay}ms;
			"
    >
      <span class="text-amber-700 font-extrabold text-sm">✨</span>
      <span
        class="tracking-wide uppercase font-mono font-extrabold text-amber-950"
        >{item.text}</span
      >
      <span
        class="text-sm text-amber-900 font-bold bg-amber-200 px-1.5 py-0.5 rounded border border-amber-500 uppercase"
        >Unlocked!</span
      >
    </div>
  {/each}
</div>

<style>
  @keyframes flyToCommandMenu {
    0% {
      transform: translate(var(--startX), var(--startY)) scale(0.5)
        rotate(-8deg);
      opacity: 0;
      filter: drop-shadow(0 0 10px rgba(202, 138, 4, 0.6));
    }
    20% {
      transform: translate(var(--startX), calc(var(--startY) - 45px)) scale(1.2)
        rotate(0deg);
      opacity: 1;
      filter: drop-shadow(0 0 20px rgba(234, 179, 8, 0.9));
    }
    80% {
      transform: translate(var(--endX), calc(var(--endY) + 20px)) scale(0.9)
        rotate(5deg);
      opacity: 0.95;
      filter: drop-shadow(0 0 14px rgba(202, 138, 4, 0.7));
    }
    100% {
      transform: translate(var(--endX), var(--endY)) scale(0.2) rotate(15deg);
      opacity: 0;
      filter: drop-shadow(0 0 25px rgba(234, 179, 8, 1));
    }
  }

  .fly-badge {
    animation: flyToCommandMenu 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    will-change: transform, opacity;
  }
</style>
