<script>
  import { onMount } from "svelte";
  import { QUEST_DATA } from "../game/global/quests.js";
  import { INTRO_HINTS } from "../game/global/tutorial.js";
  import { currentQuest, QUEST_STATE, QUEST_FEEDBACK, TUTORIAL, ONBOARDING, robots_state, claimQuest } from "./global.svelte.js";
  import { telemetry } from "../game/ml/telemetry.js";
  import { INVENTORY } from "../game/global/global.js";
  import { farm_grid_index } from "../game/game.js";
  import { k } from "../lib/kaplay.js";
  let { onOpenQuestMenu, onOpenBlockEditor, onReplay } = $props();
  let key = $derived(currentQuest());
  let mission = $derived(QUEST_DATA[key]);
  let hintLevel = $state(0);
  let offered = $state(false);
  let tick = $state(0);
  let idle = 0;
  let lastErrors = 0;
  let lastProgress = 0;
  let awaitingClaim = $derived(Object.keys(QUEST_DATA).find(id => QUEST_STATE[id]?.is_completed && !QUEST_STATE[id]?.is_claimed));
  let needsSeed = $derived.by(() => { const refresh = tick; return INVENTORY.crops.wheat < 1; });
  let hints = $derived(INTRO_HINTS[key] || [mission?.tip || "Open the mission path to choose your next task."]);
  $effect(() => { const id = key; hintLevel = 0; offered = false; idle = 0; lastProgress = 0; lastErrors = telemetry.errorCount || 0; });
  function showHint() {
    if (hintLevel < hints.length) {
      telemetry.recordHintShown(hints[hintLevel]);
      hintLevel++;
    }
    offered = false;
    onOpenBlockEditor?.();
  }
  function getInstruction() {
    const refresh = tick;
    if (key !== "tut_2") return mission?.description;
    const actions = QUEST_STATE.tut_2.actions || [];
    if (!actions.includes("till")) return "Clear the previous blocks. Open Farm, add bot.till, then press Start.";
    if (!actions.includes("plant")) return "Replace bot.till with bot.plant wheat. Press Start on the same tile.";
    if (!actions.includes("water")) return "Replace the planting block with bot.water and press Start.";
    const crop = [...farm_grid_index.values()].find(tile => tile.crop?.crop_type === "wheat")?.crop;
    if (crop && crop.crop_state !== "_harvestable") return crop.absorbing_water ? "Your wheat is growing. Watch the water soak in." : "Water again when the soil dries. Wheat needs two watering cycles.";
    return "Your wheat is ready. Replace the water block with bot.harvest and press Start.";
  }
  onMount(() => {
    const resetIdle = () => { idle = 0; };
    window.addEventListener("pointerdown", resetIdle);
    window.addEventListener("keydown", resetIdle);
    const timer = setInterval(() => {
      tick++;
      if (ONBOARDING.isModalOpen || document.hidden || k.debug.timeScale <= 0 || robots_state.some(state => state.is_running)) return;
      const growing = key === "tut_2" && QUEST_STATE.tut_2.actions?.includes("water") && [...farm_grid_index.values()].some(tile => tile.crop?.absorbing_water);
      if (growing) return;
      const progress = QUEST_STATE[key]?.progress || 0;
      if (progress !== lastProgress) { idle = 0; lastProgress = progress; offered = false; }
      const errors = telemetry.errorCount || 0;
      idle++;
      if (idle >= 35 || errors - lastErrors >= 2) { offered = true; lastErrors = errors; }
    }, 1000);
    return () => { clearInterval(timer); window.removeEventListener("pointerdown", resetIdle); window.removeEventListener("keydown", resetIdle); };
  });
</script>

<aside aria-label="Current mission" class="mission">
  <div class="heading"><span>{TUTORIAL.active ? "PROTECTED PRACTICE" : "YOUR NEXT MISSION"}</span><button onclick={onOpenQuestMenu}>Mission path</button></div>
  {#if awaitingClaim}
    <h2>{QUEST_DATA[awaitingClaim].title}</h2><p>Complete! Collect your reward to continue.</p>
    <button class="primary" onclick={() => claimQuest(awaitingClaim)}>Collect reward</button>
  {:else if mission}
    <h2>{mission.title}</h2>
    <p aria-live="polite">{getInstruction()}</p>
    <progress value={QUEST_STATE[key]?.progress || 0} max={mission.goal}></progress>
    <p class="count">{QUEST_STATE[key]?.progress || 0} / {mission.goal} successful {mission.goal === 1 ? "action" : "actions"}</p>
    <button class="primary" onclick={onOpenBlockEditor}>Open blocks</button>
    <button onclick={showHint}>Show me the next step</button>
    {#if offered && hintLevel === 0}<p class="hint">Need a hand? Try “Show me the next step”.</p>{/if}
    {#if hintLevel}<p class="hint" aria-live="polite">{hints[hintLevel - 1]}</p>{/if}
    {#if key === "tut_2" && needsSeed}<button onclick={() => { if (INVENTORY.crops.wheat < 1) INVENTORY.changeCrops("wheat", 1); }}>Replace a used practice seed</button>{/if}
  {:else}<h2>All missions complete</h2><p>Keep experimenting with your farm programs.</p>{/if}
  <button class="replay" onclick={onReplay}>Watch the demonstration</button>
</aside>
<style>
  .mission{box-sizing:border-box;width:300px;max-width:90vw;background:#f5f0df;color:#263c32;border:3px solid #60755c;border-radius:10px;padding:15px;box-shadow:0 4px 10px #0002}.heading{display:flex;align-items:center;gap:10px;justify-content:space-between}.heading span{font-size:10px;letter-spacing:.06em;font-weight:bold}h2{font-size:20px;line-height:1.2;font-weight:800;margin:12px 0}p{font-size:14px;line-height:1.45;margin:8px 0}button{font-size:12px;padding:7px 8px;border-radius:5px;cursor:pointer;background:#e0e5d5;color:#263c32;margin:3px 3px 3px 0}.primary{background:#315936;color:white;font-weight:bold}.replay{display:block;margin-top:12px;background:transparent;text-decoration:underline}progress{width:100%;accent-color:#426c36;height:12px}.count{font-size:12px}.hint{background:#fff6cd;padding:10px;border-radius:5px}button:focus-visible{outline:3px solid #aa620d;outline-offset:2px}
</style>
