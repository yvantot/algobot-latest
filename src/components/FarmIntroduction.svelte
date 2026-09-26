<script>
  import DemoProgramPanel from "./DemoProgramPanel.svelte";
  import Confetti from "./Confetti.svelte";
  import { onDestroy } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { dialogFocus } from "./dialog-focus.js";
  import { startLiveDemonstration } from "../game/global/live-demonstration.js";
  import { demonstrationStory, demonstrationStep, DEMO_LESSONS } from "../game/global/introduction-story.js";
  import { farm_grid_index } from "../game/game.js";
  let { isOpen = $bindable(false), lesson = "basics", rewardAvailable = true, onComplete } = $props();
  let story = $derived(demonstrationStory(lesson));
  let chapter = $state(0);
  let line = $state(-1);
  let botLines = $state({});
  let programs = $derived(step.programs ?? [{bot:0,code:step.code}]);
  let ready = $state(false);
  let purchase=$state(null), traversing=$state(false), working=$state(false);
  let coins = $state(0);
  let exp = $state(0);
  let rewardVisible = $state(false);
  let rewardTimer;
  let error = $state(false);
  let closing = $state(false);
  let sceneChanging = $state(false);
  let controller;
  let closeTimer;
  let step = $derived(demonstrationStep(story, chapter));
  let reducedMotion = $state(false);
  $effect(() => {
    if (!isOpen) return;
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    purchase = null; traversing = false; chapter = 0; coins = 0; exp = 0; ready = false; error = false; closing = false;
    let frame;
    function startWhenReady() {
      if (!farm_grid_index.get("0-0")?.soil?.exists()) {
        frame = requestAnimationFrame(startWhenReady); return;
      }
      controller = startLiveDemonstration(update => {
        if (update.chapter !== undefined) { chapter = update.chapter; botLines = {}; traversing = false; purchase = null; }
        if (update.transition !== undefined) sceneChanging = update.transition;
        if (update.line !== undefined) { line = update.line; botLines = {...botLines,[update.bot ?? 0]:update.line}; }
        if (update.ready !== undefined) ready = update.ready;
        if (update.purchase !== undefined) purchase = update.purchase;
        if (update.traversing) traversing = true;
        if (update.working !== undefined) working = update.working;
        if (update.coins !== undefined) { coins = update.coins; rewardVisible = true; clearTimeout(rewardTimer); rewardTimer = setTimeout(() => rewardVisible = false, 3800); }
        if (update.exp !== undefined) exp = update.exp;
        if (update.error) error = true;
      }, { chapters: story });
    }
    frame = requestAnimationFrame(startWhenReady);
    return () => { cancelAnimationFrame(frame); clearTimeout(rewardTimer); rewardVisible = false; clearTimeout(closeTimer); controller?.dispose(); controller = null; };
  });
  function close(completed = false) {
    if (closing) return;
    closing = true;
    const finishedLesson = completed && ready && !error ? lesson : null;
    // Restore the real farm only once the closing curtain conceals the swap.
    closeTimer = setTimeout(() => {
      controller?.dispose(); controller = null;
      isOpen = false;
      if (finishedLesson) onComplete?.(finishedLesson);
    }, reducedMotion ? 0 : 450);
  }
  onDestroy(() => clearTimeout(closeTimer));
</script>

{#if isOpen}
  <div class="live-cutscene" use:dialogFocus tabindex="-1" role="dialog" aria-modal="true" aria-label={DEMO_LESSONS[lesson].title} out:fade={{duration:reducedMotion ? 0 : 400}}>
    <div class="curtain" class:closing={closing||sceneChanging}></div>
    <header><span>{DEMO_LESSONS[lesson].title} · {chapter + 1} / {story.length}</span><button onclick={() => close()} disabled={closing}>Close demo</button></header>
    <div class="programs">
    {#each programs.filter(program=>program.code.some(command=>!command.startsWith("//"))) as program,index (step.action+program.bot)}
      <DemoProgramPanel {program} {index} count={programs.length} reduced={reducedMotion} line={ready?-1:(botLines[program.bot]??-1)} dynamicGrid={traversing} {working}/>
    {/each}
    </div>
    {#if rewardVisible}<div class="earnings" in:fly={{y:24,duration:450}} out:fly={{y:-24,duration:450}} role="status"><img src="/sprites/icon_coin.png" alt=""/>+{coins} coins · +{exp} EXP</div>{/if}
    {#if chapter === story.length - 1 && ready && !error}<Confetti/>{/if}
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
          {#if chapter === story.length - 1 || error}
            <button class="primary" disabled={!ready || closing} onclick={() => close(true)}>{error ? "Back to farm" : lesson === "basics" ? "Your turn!" : rewardAvailable ? "Finish & collect reward" : "Back to farm"}</button>
          {:else}
            <button class="primary" disabled={!ready || closing} onclick={() => controller?.next()}>Continue →</button>
          {/if}
        </footer>
      </div>
    </section>
    {:else if purchase}<div class="purchase" in:fly={{y:20,duration:reducedMotion?0:250}} out:fly={{y:12,duration:200}}><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><div><strong>Bot Teacher</strong><p>{purchase.message}</p><button class="primary" onclick={()=>controller?.purchase(purchase.id)}>{purchase.label}</button></div></div>
    {:else}<div class="watch-cue" role="status">{traversing?"The loop visits every row and column…":"Watch what happens…"}</div>{/if}
  </div>
{/if}
<style>
 .purchase{top:min(calc(50% + 145px),calc(100% - 165px));display:flex;align-items:center;gap:12px;width:min(440px,calc(100% - 24px));z-index:3}.purchase img{width:48px;image-rendering:pixelated}.purchase strong{color:#166534;font-size:14px}
.live-cutscene{position:fixed;inset:0;z-index:10000;padding:18px;color:#334155;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(#17251b55,transparent 20%,transparent 65%,#17251b66)}
.curtain{position:absolute;inset:0;background:#142016;z-index:10;pointer-events:none;opacity:0;animation:reveal .8s ease-out;transition:opacity .45s ease-in-out}.curtain.closing{opacity:1;animation:none}@keyframes reveal{from{opacity:1}to{opacity:0}}
header{display:flex;align-items:center;justify-content:space-between;color:white;font-size:15px;font-weight:bold;text-shadow:0 1px 2px #0008}button{font-family:inherit;padding:9px 14px;border:2px solid #64748b;border-radius:7px;background:#e5e7eb;color:#334155;font-weight:bold;cursor:pointer;text-shadow:none}button:disabled{opacity:.55;cursor:default}button:focus-visible{outline:3px solid #16a34a;outline-offset:3px}.primary{background:#bbf7d0;white-space:nowrap}
.programs{position:absolute;inset:0;pointer-events:none;overflow:clip}.purchase{position:absolute;left:50%;transform:translateX(-50%);background:#f3f4f6;padding:16px;border:3px solid #64748b;border-radius:10px;text-align:left}.purchase p{margin:0 0 10px;font-size:16px}.earnings{position:absolute;left:50%;top:58%;transform:translateX(-50%);padding:12px 20px;border:3px solid #64748b;border-radius:10px;background:#f3f4f6;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;font-weight:bold;color:#166534}.earnings img{width:24px}
.teacher{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:18px;align-items:center;width:min(940px,calc(100% - 24px));padding:18px;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;box-shadow:0 8px 24px #0004}.watch-cue{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);padding:10px 18px;background:#f3f4f6;border:3px solid #64748b;border-radius:12px;font-size:17px}.portrait{animation:teacher-nod .8s ease-in-out 2;width:76px;image-rendering:pixelated;flex-shrink:0}.speech{flex:1;min-width:0}.speaker{font-size:14px;font-weight:bold;color:#15803d}h1{font-size:21px;font-weight:800;margin:4px 0 8px}.speech p{font-size:18px;line-height:1.5;margin:0}footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}footer>span{font-size:14px;color:#64748b}
@media(max-width:900px){.teacher{padding:12px;gap:12px}.portrait{width:50px}h1{font-size:18px}.speech p{font-size:15px}.live-cutscene{padding:12px}}
@media(max-width:500px){.portrait{display:none}.teacher{max-height:42vh;overflow:auto}footer{flex-wrap:wrap}header span{font-size:14px}button{padding:7px 9px}.speech p{font-size:14px}}
@keyframes teacher-nod{50%{transform:translateY(-8px) rotate(-5deg)}}@keyframes teacher-surprise{40%{transform:translateY(-14px) rotate(8deg)}70%{transform:rotate(-6deg)}}.portrait.surprised{animation:teacher-surprise .7s ease-out}.portrait.happy{animation:teacher-nod .6s ease-in-out 3}
@media(prefers-reduced-motion:reduce){.portrait,.portrait.happy,.portrait.surprised{animation:none}.curtain{animation:none;transition:none}}
</style>
