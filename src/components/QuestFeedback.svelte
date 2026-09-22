<script>
  import { dialogFocus } from "./dialog-focus.js";
  import { QUEST_FEEDBACK, finishIntroduction, robots } from "./global.svelte.js";
  import { play_sfx } from "../game/utils/sound.js";
  import { eventScheduler } from "../game/ml/event-scheduler.js";
  let item = $derived(QUEST_FEEDBACK.queue[0]);
  $effect(() => {
    if (!item) return;
    const key = item.key;
    play_sfx("collect");
    robots[0]?.sayText?.("Mission complete!");
    if (item.milestone) return;
    const timer = setTimeout(() => {
      if (QUEST_FEEDBACK.queue[0]?.key === key) QUEST_FEEDBACK.queue.shift();
    }, 2600);
    return () => clearTimeout(timer);
  });
  function startFarming() {
    eventScheduler.lastEventTime = Date.now();
    finishIntroduction();
  }
</script>

{#if item}
  {#key item.key}
    {#if item.milestone}<div class="scrim"></div>{/if}
    <section use:dialogFocus class="completion" class:milestone={item.milestone} role="status" aria-live="polite">
      <img src="/sprites/bot.png" alt="" class="celebrate" />
      <p>{item.milestone ? "MILESTONE REACHED" : "MISSION COMPLETE"}</p>
      <h2>{item.title}</h2>
      <div class="rewards"><span>+{item.rewards?.coins || 0} coins</span><span>+{item.rewards?.exp || 0} EXP</span></div>
      {#if item.rewards?.unlocks?.length}<p>Unlocked: {item.rewards.unlocks.map(name => name.replaceAll("_", " ")).join(", ")}</p>{/if}
      {#if item.milestone}<button onclick={() => QUEST_FEEDBACK.queue.shift()}>Continue</button>{/if}
    </section>
  {/key}
{:else if QUEST_FEEDBACK.hazardsPending}
  <div class="scrim"></div>
  <div use:dialogFocus tabindex="-1" class="completion milestone" role="dialog" aria-modal="true" aria-label="Ready for normal farming">
    <h2>Your farm is ready.</h2>
    <p>Harvest ripe crops before they spoil. Rain helps your crops; pests and fire can damage them.</p>
    <p>Use bot.kill_bug() for pests and bot.extinguish() or water for fire. Rain also extinguishes fire.</p>
    <p>Your next mission introduces conditions so your robot can check before acting. Text coding is now available too.</p>
    <button onclick={startFarming}>Start farming</button>
  </div>
{/if}

<style>
  .scrim{position:fixed;inset:0;background:#17251b99;z-index:10000}
  .completion{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:200;background:#fff6d8;border:3px solid #87682c;border-radius:12px;padding:18px 24px;max-width:min(470px,92vw);color:#3b321d;box-shadow:0 6px 20px #0003;text-align:center;animation:arrive .25s ease-out}
  .milestone{bottom:auto;top:30%;z-index:10001}.completion p{margin:8px 0;font-size:14px}.completion h2{font-size:21px;font-weight:bold}.celebrate{width:45px;display:block;margin:auto;image-rendering:pixelated;animation:hop .55s ease-in-out 2}.rewards{display:flex;justify-content:center;gap:20px;font-weight:bold;margin:12px 0}button{background:#315936;color:white;border-radius:6px;padding:10px 18px;font-weight:bold;cursor:pointer}button:focus-visible{outline:3px solid #b16a12;outline-offset:3px}@keyframes hop{50%{transform:translateY(-12px) rotate(8deg)}}@keyframes arrive{from{opacity:0;margin-bottom:-12px}to{opacity:1;margin-bottom:0}}@media(prefers-reduced-motion:reduce){.completion,.celebrate{animation:none}}
</style>
