<script>
  import { onMount } from "svelte";
  let { count = 64 } = $props();
  let active = $state(false);
  const colors = ["#facc15", "#4ade80", "#60a5fa", "#fb7185", "#fafafa"];
  onMount(() => {
    active = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => active = false, 4200);
    return () => clearTimeout(timer);
  });
</script>
{#if active}
<div class="confetti" aria-hidden="true">
  {#each Array(count) as _, i}
    <i style:left="{(i * 37) % 100}%" style:background={colors[i % colors.length]} style:--drift="{((i * 73) % 260) - 130}px" style:--turn="{i % 2 ? 680 : -620}deg" style:animation-delay="{(i % 13) * 45}ms" style:animation-duration="{2800 + (i % 7) * 100}ms"></i>
  {/each}
</div>
{/if}
<style>
.confetti{position:fixed;inset:0;z-index:10020;pointer-events:none;overflow:hidden}.confetti i{position:absolute;top:-20px;width:8px;height:13px;opacity:0;animation:fall 3s ease-in both}@keyframes fall{0%{transform:translate(0,-20px) rotate(0);opacity:0}8%{opacity:1}80%{opacity:1}100%{transform:translate(var(--drift),105vh) rotate(var(--turn));opacity:0}}
</style>
