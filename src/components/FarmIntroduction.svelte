<script>
  import DemonstrationBlocks from "./DemonstrationBlocks.svelte";
  import Confetti from "./Confetti.svelte";
  import { onDestroy } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { dialogFocus } from "./dialog-focus.js";
  import { startLiveDemonstration } from "../game/global/live-demonstration.js";
  import { INTRODUCTION_STORY } from "../game/global/introduction-story.js";
  import { farm_grid_index } from "../game/game.js";
  let { isOpen = $bindable(false) } = $props();
  let chapter = $state(0);
  let line = $state(-1);
  let ready = $state(false);
  let coins = $state(0);
  let exp = $state(0);
  let rewardVisible = $state(false);
  let rewardTimer;
  let error = $state(false);
  let closing = $state(false);
  let controller;
  let closeTimer;
  let step = $derived(INTRODUCTION_STORY[chapter]);
  let reducedMotion = $state(false);
  $effect(() => {
    if (!isOpen) return;
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    chapter = 0; coins = 0; exp = 0; ready = false; error = false; closing = false;
    let frame;
    function startWhenReady() {
      if (!farm_grid_index.get("0-0")?.soil?.exists()) {
        frame = requestAnimationFrame(startWhenReady); return;
      }
      controller = startLiveDemonstration(update => {
        if (update.chapter !== undefined) chapter = update.chapter;
        if (update.line !== undefined) line = update.line;
        if (update.ready !== undefined) ready = update.ready;
        if (update.coins !== undefined) { coins = update.coins; rewardVisible = true; clearTimeout(rewardTimer); rewardTimer = setTimeout(() => rewardVisible = false, 3800); }
        if (update.exp !== undefined) exp = update.exp;
        if (update.error) error = true;
      });
    }
    frame = requestAnimationFrame(startWhenReady);
    return () => { cancelAnimationFrame(frame); clearTimeout(rewardTimer); rewardVisible = false; clearTimeout(closeTimer); controller?.dispose(); controller = null; };
  });
  function close() {
    if (closing) return;
    closing = true;
    // Restore the real farm only once the closing curtain conceals the swap.
    closeTimer = setTimeout(() => { controller?.dispose(); isOpen = false; }, reducedMotion ? 0 : 450);
  }
  onDestroy(() => clearTimeout(closeTimer));
</script>

{#if isOpen}
  <div class="live-cutscene" use:dialogFocus tabindex="-1" role="dialog" aria-modal="true" aria-label="Meet your farm" out:fade={{duration:reducedMotion ? 0 : 400}}>
    <div class="curtain" class:closing></div>
    <header><span>Meet your farm · {chapter + 1} / {INTRODUCTION_STORY.length}</span><button onclick={close} disabled={closing}>Skip introduction</button></header>
    {#if step.code.some(command => !command.startsWith("//"))}
    <aside class="program" out:fly={{x:-30,duration:reducedMotion ? 0 : 250,easing:cubicOut}} in:fly={{x:-35,delay:350,duration:reducedMotion ? 0 : 500,easing:cubicOut}}>
      <h2>Robot program</h2>
      <p>{ready ? "These blocks made it happen" : "Watch the blocks and the farm"}</p>
      {#each [step] as scene (scene.action)}
        <div in:fade={{duration:250}}>
          <DemonstrationBlocks code={scene.code} {line}/>
        </div>
      {/each}

    </aside>
    {/if}
    {#if rewardVisible}<div class="earnings" in:fly={{y:24,duration:450}} out:fly={{y:-24,duration:450}} role="status"><img src="/sprites/icon_coin.png" alt=""/>+{coins} coins · +{exp} EXP <small>Example harvest</small></div>{/if}
    {#if chapter === INTRODUCTION_STORY.length - 1 && ready && !error}<Confetti/>{/if}
    {#if ready || error}
    <section class="teacher" out:fly={{y:24,duration:reducedMotion ? 0 : 200}} in:fly={{y:45,delay:350,duration:reducedMotion ? 0 : 500,easing:cubicOut}}>
      <img class="portrait" class:surprised={step.action === "spoil" || step.action === "pest"} class:happy={step.action === "harvest" || step.action === "finish"} src="/sprites/bot_teacher.png" alt="Bot Teacher"/>
      <div class="speech">
        <span class="speaker">Bot Teacher</span>
        {#each [step] as scene (scene.action)}
          <div in:fade={{duration:reducedMotion ? 0 : 300}}>
            <h1>{scene.title}</h1>
            <p aria-live="polite">{error ? "Let’s try this on your own farm. Your first mission will guide you." : scene.text}</p>
          </div>
        {/each}
        <footer><span>{ready ? "Take your time. Continue when you’re ready." : "Watch what happens on the farm…"}</span>
          {#if chapter === INTRODUCTION_STORY.length - 1 || error}
            <button class="primary" disabled={!ready || closing} onclick={close}>Start my first mission</button>
          {:else}
            <button class="primary" disabled={!ready || closing} onclick={() => controller?.next()}>Continue →</button>
          {/if}
        </footer>
      </div>
    </section>
    {:else}<div class="watch-cue" role="status">Watch what happens…</div>{/if}
  </div>
{/if}
<style>
.live-cutscene{position:fixed;inset:0;z-index:10000;padding:18px;color:#334155;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(#17251b55,transparent 20%,transparent 65%,#17251b66)}
.curtain{position:absolute;inset:0;background:#142016;z-index:10;pointer-events:none;opacity:0;animation:reveal .8s ease-out;transition:opacity .45s ease-in-out}.curtain.closing{opacity:1;animation:none}@keyframes reveal{from{opacity:1}to{opacity:0}}
header{display:flex;align-items:center;justify-content:space-between;color:white;font-size:15px;font-weight:bold;text-shadow:0 1px 2px #0008}button{font-family:inherit;padding:9px 14px;border:2px solid #64748b;border-radius:7px;background:#e5e7eb;color:#334155;font-weight:bold;cursor:pointer;text-shadow:none}button:disabled{opacity:.55;cursor:default}button:focus-visible{outline:3px solid #16a34a;outline-offset:3px}.primary{background:#bbf7d0;white-space:nowrap}
.program{position:absolute;top:90px;left:max(18px,calc(50% - 510px));width:330px;background:#f3f4f6;border:3px solid #64748b;border-radius:10px;overflow:hidden;box-shadow:0 5px 15px #0002}.program h2{font-size:18px;font-weight:bold;margin:0;padding:10px 12px;background:#e5e7eb;border-bottom:2px solid #94a3b8}.program>p{font-size:14px;margin:8px 12px;color:#475569}.earnings{position:absolute;left:50%;top:58%;transform:translateX(-50%);padding:12px 20px;border:3px solid #64748b;border-radius:10px;background:#f3f4f6;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;font-weight:bold;color:#166534}.earnings img{width:24px}.earnings small{width:100%;font-size:15px;color:#64748b}
.teacher{margin-top:auto;align-self:center;display:flex;gap:18px;align-items:center;width:min(940px,100%);padding:18px;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;box-shadow:0 8px 24px #0004}.watch-cue{margin-top:auto;align-self:center;padding:10px 18px;background:#f3f4f6;border:3px solid #64748b;border-radius:12px;font-size:17px}.portrait{animation:teacher-nod .8s ease-in-out 2;width:76px;image-rendering:pixelated;flex-shrink:0}.speech{flex:1;min-width:0}.speaker{font-size:14px;font-weight:bold;color:#15803d}h1{font-size:21px;font-weight:800;margin:4px 0 8px}.speech p{font-size:18px;line-height:1.5;margin:0}footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}footer>span{font-size:14px;color:#64748b}
@media(max-width:900px){.program{width:240px;top:70px;left:12px}.teacher{padding:12px;gap:12px}.portrait{width:50px}h1{font-size:18px}.speech p{font-size:15px}.live-cutscene{padding:12px}}
@media(max-width:500px){.program{width:170px;left:12px}.portrait{display:none}.teacher{max-height:42vh;overflow:auto}footer{flex-wrap:wrap}header span{font-size:14px}button{padding:7px 9px}.speech p{font-size:14px}}
@keyframes teacher-nod{50%{transform:translateY(-8px) rotate(-5deg)}}@keyframes teacher-surprise{40%{transform:translateY(-14px) rotate(8deg)}70%{transform:rotate(-6deg)}}.portrait.surprised{animation:teacher-surprise .7s ease-out}.portrait.happy{animation:teacher-nod .6s ease-in-out 3}
@media(prefers-reduced-motion:reduce){.portrait,.portrait.happy,.portrait.surprised{animation:none}.curtain{animation:none;transition:none}}
</style>
