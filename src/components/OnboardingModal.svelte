<script>
  import { dialogFocus } from "./dialog-focus.js";
  let { isOpen = $bindable(false), onClose } = $props();
  let step = $state(0);
  const commands = ["bot.right()", "bot.water()", "bot.harvest()"];
  $effect(() => {
    if (!isOpen) return;
    step = 0;
    const timer = setInterval(() => { if (!document.hidden && step < 3) step++; }, 2200);
    return () => clearInterval(timer);
  });
  function close() { isOpen = false; onClose?.(); }
</script>
{#if isOpen}
  <div class="demo-backdrop">
    <div use:dialogFocus tabindex="-1" role="dialog" aria-modal="true" aria-label="Watch your robot follow instructions" class="demo">
      <p class="eyebrow">WATCH FIRST · DEMONSTRATION</p>
      <h1>Your instructions bring the farm to life.</h1>
      <div class="preview" aria-label="Robot moves to wheat, waters it, then harvests it">
        <div class="tiles"><span></span><span></span><span></span></div>
        {#if step < 3}<img class="crop" src={step >= 2 ? "/sprites/wheat_harvestable.png" : "/sprites/wheat_young.png"} alt="Wheat" />{/if}
        <img class="robot" class:moved={step >= 1} src="/sprites/bot.png" alt="Robot" />
        {#if step === 2}<img class="drop" src="/sprites/icon_raindrop.png" alt="Water" />{/if}
        {#if step === 3}<span class="harvest">Harvest collected!</span>{/if}
      </div>
      <ol aria-label="Demonstration program">
        {#each commands as command, i}<li class:executing={Math.max(0, step - 1) === i}><span>{i + 1}</span><code>{command}</code></li>{/each}
      </ol>
      <p aria-live="polite">{["One command. One action.", "The robot moves to its crop.", "Water helps the wheat grow.", "Now make your own robot move."][step]}</p>
      <div class="actions"><button onclick={close}>{step === 3 ? "Your turn" : "Skip demonstration"}</button><button class="secondary" onclick={() => step = 0}>Replay</button></div>
    </div>
  </div>
{/if}
<style>
  .demo-backdrop{position:fixed;inset:0;background:#17251bcc;display:grid;place-items:center;z-index:10000;padding:20px}
  .demo{width:min(540px,100%);max-height:95vh;overflow:auto;background:#f6f1df;color:#243c31;border:4px solid #64715b;border-radius:14px;padding:26px}
  h1{font-size:24px;font-weight:800;line-height:1.2;margin:10px 0}.eyebrow{font-size:12px;letter-spacing:.1em;font-weight:800}
  .preview{height:170px;position:relative;background:#bdd192;border-radius:10px;overflow:hidden;margin:18px 0}.tiles{position:absolute;left:12%;right:12%;top:90px;display:flex;gap:5px}.tiles span{background:#95724a;height:52px;flex:1;border-bottom:8px solid #765735}
  .robot{position:absolute;width:64px;left:15%;top:46px;transition:left 1s cubic-bezier(.45,0,.55,1);image-rendering:pixelated}.robot.moved{left:42%}.crop{position:absolute;width:60px;left:55%;top:65px;image-rendering:pixelated}.drop{position:absolute;width:28px;left:58%;top:28px}.harvest{position:absolute;right:15px;top:20px;background:#fff8da;padding:8px;border-radius:6px}
  ol{list-style:none;padding:0;display:grid;gap:6px}li{padding:9px;background:#e0e4d6;border:2px solid transparent;border-radius:6px}li.executing{border-color:#39653e;background:#c9e5b3}li span{margin-right:14px;font-weight:bold}.actions{display:flex;gap:10px;margin-top:18px}button{background:#315936;color:white;padding:10px 16px;border-radius:6px;font-weight:bold;cursor:pointer}.secondary{background:#e1e6d6;color:#243c31}button:focus-visible{outline:3px solid #b16a12;outline-offset:3px}
  @media(prefers-reduced-motion:reduce){.robot{transition:none}}
</style>
