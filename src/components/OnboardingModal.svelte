<script>
  import { dialogFocus } from "./dialog-focus.js";
  import { startLiveDemonstration } from "../game/global/live-demonstration.js";
  import { farm_grid_index } from "../game/game.js";
  import { fly, fade } from "svelte/transition";
  let { isOpen = $bindable(false), onClose } = $props();
  let command = $state("");
  let complete = $state(false);
  let replay = $state(0);
  $effect(() => {
    const revision = replay;
    if (!isOpen) return;
    complete = false;
    let frame;
    let dispose;
    command = "Getting the farm ready…";
    function startWhenReady() {
      // k.go enters the scene on the next engine frame, after Svelte mounts.
      if (!farm_grid_index.get("0-0")?.soil?.exists()) {
        frame = requestAnimationFrame(startWhenReady);
        return;
      }
      dispose = startLiveDemonstration(text => command = text, () => complete = true);
    }
    frame = requestAnimationFrame(startWhenReady);
    return () => { cancelAnimationFrame(frame); dispose?.(); };
  });
  function close() { isOpen = false; onClose?.(); }
</script>
{#if isOpen}
  <div class="live-cutscene" use:dialogFocus tabindex="-1" role="dialog" aria-modal="true" aria-label="Live gameplay demonstration" transition:fade={{duration:180}}>
    <header><span>LIVE DEMONSTRATION</span><button onclick={close}>Skip</button></header>
    <div class="caption" in:fly={{y:30,duration:350}} out:fly={{y:30,duration:220}}>
      <img src="/sprites/bot_teacher.png" alt="" />
      <div><p>Program your robot. Watch your farm grow.</p><strong aria-live="polite">{command}</strong></div>
      <button onclick={close}>{complete ? "Your turn" : "Try it myself"}</button>
      {#if complete}<button onclick={() => replay++}>Replay</button>{/if}
    </div>
  </div>
{/if}
<style>
.live-cutscene{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;justify-content:space-between;padding:20px;background:linear-gradient(#0f172a99,transparent 18%,transparent 75%,#0f172a99);color:#334155}
header{display:flex;justify-content:space-between;align-items:center;color:white;font-weight:bold;font-size:13px;letter-spacing:.08em}.caption{align-self:center;display:flex;align-items:center;gap:16px;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;padding:16px;max-width:850px;width:100%;box-shadow:0 8px 24px #0004}.caption img{width:48px;image-rendering:pixelated}.caption div{flex:1}p{font-size:13px;margin:0 0 5px}strong{font-size:18px}button{background:#bbf7d0;border:2px solid #64748b;border-radius:7px;color:#1e293b;padding:9px 15px;cursor:pointer;font-weight:bold}button:focus-visible{outline:3px solid #16a34a;outline-offset:3px}@media(max-width:650px){.caption{flex-wrap:wrap;gap:8px;padding:10px}.caption div{min-width:65%}strong{font-size:15px}}
@media(prefers-reduced-motion:reduce){.live-cutscene,.caption{transition:none!important;animation:none!important}}
</style>
