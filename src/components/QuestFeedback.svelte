<script>
  import Confetti from "./Confetti.svelte";
  import { fade } from "svelte/transition";
  import { rewardMotion } from "./quest-motion.js";
  import { dialogFocus } from "./dialog-focus.js";
  import { QUEST_FEEDBACK, finishIntroduction } from "./global.svelte.js";
  import { play_sfx } from "../game/utils/sound.js";
  import { eventScheduler } from "../game/ml/event-scheduler.js";
  let panel = $state(null);
  let flying = $state([]);
  function rewardFlights() {
    const origin = panel?.getBoundingClientRect();
    if (!origin || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    flying = [
      { target: document.getElementById("coin-icon"), image: "/sprites/icon_coin.png" },
      { target: document.getElementById("player-info"), image: "/sprites/icon_quest.png" },
    ].flatMap(({ target, image }) => {
      const destination = target?.getBoundingClientRect();
      return destination ? [{ image, x: origin.x + origin.width / 2, y: origin.y + 45,
        dx: destination.x + destination.width / 2 - origin.x - origin.width / 2,
        dy: destination.y + destination.height / 2 - origin.y - 45 }] : [];
    });
  }
  let item = $derived(QUEST_FEEDBACK.queue[0]);
  $effect(() => {
    if (!item) return;
    const key = item.key;
    play_sfx("collect");
    const flight = setTimeout(rewardFlights, 1700);
    if (item.milestone) return () => { clearTimeout(flight); flying = []; };
    const timer = setTimeout(() => {
      if (QUEST_FEEDBACK.queue[0]?.key === key) QUEST_FEEDBACK.queue.shift();
    }, 5800);
    return () => { clearTimeout(timer); clearTimeout(flight); flying = []; };
  });
  function startFarming() {
    eventScheduler.lastEventTime = Date.now();
    finishIntroduction();
  }
</script>

{#if item}
  {#each [item] as item (item.key)}
    {#if item.milestone}<Confetti/><div class="scrim" transition:fade|global={{duration:400}}></div>{/if}
    <section in:rewardMotion|global={{enter:true}} out:rewardMotion|global={{enter:false}} data-quest-reward bind:this={panel} use:dialogFocus={item.milestone} class="clay-menu clay-shell completion" class:milestone={item.milestone} role="status" aria-live="polite">
      <img src="/sprites/bot.png" alt="" class="celebrate" />
      <p>{item.milestone ? "MILESTONE REACHED" : "MISSION COMPLETE"}</p>
      <h2>{item.title}</h2>
      <div class="rewards"><span><img src="/sprites/icon_coin.png" alt=""/>+{item.rewards?.coins || 0} coins</span><span><img src="/sprites/icon_quest.png" alt=""/>+{item.rewards?.exp || 0} EXP</span></div>
      {#if item.rewards?.unlocks?.length}<p>Unlocked: {item.rewards.unlocks.map(name => name.replaceAll("_", " ")).join(", ")}</p>{/if}
      {#if item.milestone}<button onclick={() => QUEST_FEEDBACK.queue.shift()}>Continue</button>{/if}
    </section>
  {/each}
{:else if QUEST_FEEDBACK.hazardsPending}
  <div class="scrim" transition:fade|global={{duration:400}}></div>
  <div in:rewardMotion|global={{enter:true}} out:rewardMotion|global={{enter:false}} use:dialogFocus tabindex="-1" class="clay-menu clay-shell completion milestone" role="dialog" aria-modal="true" aria-label="Ready for normal farming">
    <h2>Your farm is ready.</h2>
    <p>You’re ready to make this farm your own. Try your ideas, learn as you go, and enjoy the harvest.</p>
    <p>Good luck, and have fun!</p>
    <button onclick={startFarming}>Start farming</button>
  </div>
{/if}

{#each flying as reward}
  <img class="reward-flight" src={reward.image} alt="" style:left="{reward.x}px" style:top="{reward.y}px" style:--dx="{reward.dx}px" style:--dy="{reward.dy}px" />
{/each}
<style>
  .reward-flight{position:fixed;z-index:10002;width:28px;pointer-events:none;animation:fly 1.6s cubic-bezier(.45,0,.55,1) forwards}@keyframes fly{0%{transform:translate(0,0) scale(1);opacity:1}85%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.6);opacity:0}}
  .rewards span{display:flex;align-items:center;gap:7px;padding:8px 12px;border:2px solid #cbd5e1;border-radius:8px;background:white}.rewards img{width:26px;height:26px;object-fit:contain}.completion>p:first-of-type{color:#15803d;font-weight:800;letter-spacing:.07em}
  .scrim{position:fixed;inset:0;background:#17251b99;z-index:10000}
  .completion{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:200;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;padding:18px 24px;max-width:min(470px,92vw);color:#334155;box-shadow:0 6px 20px #0003;text-align:center}
  .milestone{bottom:auto;top:30%;z-index:10001}.completion p{margin:8px 0;font-size:14px}.completion h2{font-size:21px;font-weight:bold}.celebrate{width:45px;display:block;margin:auto;image-rendering:pixelated;animation:hop .85s ease-in-out 2}.rewards{display:flex;justify-content:center;gap:20px;font-weight:bold;margin:12px 0}button{background:#bbf7d0;color:#1e293b;border:2px solid #94a3b8;border-radius:6px;padding:10px 18px;font-weight:bold;cursor:pointer}button:focus-visible{outline:3px solid #b16a12;outline-offset:3px}@keyframes hop{50%{transform:translateY(-12px) rotate(8deg)}}@keyframes arrive{from{opacity:0;margin-bottom:-12px}to{opacity:1;margin-bottom:0}}@media(prefers-reduced-motion:reduce){.completion,.celebrate{animation:none}}
</style>
