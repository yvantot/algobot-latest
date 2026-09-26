<script>
  import BlockPlacementGuide from "./BlockPlacementGuide.svelte";
  import { fly } from "svelte/transition";
  import { cubicOut, cubicIn } from "svelte/easing";
  import { onMount, tick as nextRender } from "svelte";
  import { QUEST_DATA } from "../game/global/quests.js";
  import { missionHint, recordMissionHint } from "../game/global/mission-hints.js";
  import { currentQuest, QUEST_STATE, QUEST_FEEDBACK, TUTORIAL, ONBOARDING, robots_state, claimQuest } from "./global.svelte.js";
  import { telemetry } from "../game/ml/telemetry.js";
  import { INVENTORY } from "../game/global/global.js";
  import { farm_grid_index } from "../game/game.js";
  import { k } from "../lib/kaplay.js";
  let { onOpenQuestMenu, onOpenBlockEditor, onOpenEditor = onOpenBlockEditor, editorMode = "blocks" } = $props();
  let key = $derived(currentQuest());
  let mission = $derived(QUEST_DATA[key]);
  let hintLevel = $state(0), guideRevision = $state(0);
  let offered = $state(false);
  let tick = $state(0);
  let idle = 0;
  let lastErrors = 0;
  let lastProgress = 0;
  let awaitingClaim = $derived(Object.keys(QUEST_DATA).find(id => QUEST_STATE[id]?.is_completed && !QUEST_STATE[id]?.is_claimed));
  let needsSeed = $derived.by(() => { const refresh = tick; return INVENTORY.crops.wheat < 1; });
  let hintExample = $state.raw(null);
  $effect(() => { const id = key; hintLevel = 0; hintExample = null; offered = false; idle = 0; lastProgress = 0; lastErrors = telemetry.errorCount || 0; });
  $effect(() => { const progress = QUEST_STATE[key]?.progress; hintExample = null; offered = false; });
  async function showHint() {
    const quest = key;
    const crop = [...farm_grid_index.values()].find(tile=>tile.crop?.crop_type === "wheat")?.crop;
    const example = missionHint(quest,hintLevel,QUEST_STATE.tut_2.actions || [],crop?.crop_state === "_harvestable");
    recordMissionHint(telemetry,quest,editorMode,hintLevel,example);
    hintLevel++; offered = false;
    onOpenEditor?.();
    await nextRender();
    if (key !== quest) return;
    hintExample = example; guideRevision++;
  }
  function getInstruction(missionKey = key) {
    const refresh = tick;
    if (missionKey !== "tut_2") return QUEST_DATA[missionKey]?.description;
    const actions = QUEST_STATE.tut_2.actions || [];
    if (!actions.includes("till")) return "Clear the previous blocks. Open Farm, add Prepare soil, then press Start.";
    if (!actions.includes("plant")) return "Replace Prepare soil with Plant wheat. Press Start on the same tile.";
    if (!actions.includes("water")) return "Replace the planting block with Water soil and press Start.";
    const crop = [...farm_grid_index.values()].find(tile => tile.crop?.crop_type === "wheat")?.crop;
    if (crop && crop.crop_state !== "_harvestable") return crop.absorbing_water ? "Your wheat is growing. Watch the water soak in." : "Water again when the soil dries. Wheat needs two watering cycles.";
    return "Your wheat is ready. Replace the water block with Harvest crop and press Start.";
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
  <div class="heading"><img src="/sprites/icon_quest.png" alt="" /><span>{TUTORIAL.active ? "PRACTICE" : "YOUR NEXT MISSION"}</span><button onclick={onOpenQuestMenu}>Mission path</button></div>
  <div class="mission-stage">
  {#each [key] as missionKey (missionKey)}
  {@const mission = QUEST_DATA[missionKey]}
  <div class="mission-content" in:fly|global={{y:45,duration:650,delay:450,easing:cubicOut}} out:fly|global={{y:-40,duration:450,easing:cubicIn}}>
  {#if awaitingClaim}
    <h2>{QUEST_DATA[awaitingClaim].title}</h2><p>Complete! Collect your reward to continue.</p>
    <button class="primary" onclick={() => claimQuest(awaitingClaim)}>Collect reward</button>
  {:else if mission}
    <h2>{mission.title}</h2>
    <p aria-live="polite">{getInstruction(missionKey)}</p>
    <progress value={QUEST_STATE[missionKey]?.progress || 0} max={mission.goal}></progress>
    <p class="count">{QUEST_STATE[missionKey]?.progress || 0} / {mission.goal} successful {mission.goal === 1 ? "action" : "actions"}</p>
    <button class="primary" onclick={onOpenEditor}>Open {editorMode === "text" ? "code" : "blocks"}</button>
    <button class="show-step" class:offered onclick={showHint}>Need help?</button>
    {#if offered && hintLevel === 0}<p class="hint">Need a hand? Try “Need help?”.</p>{/if}
    {#if hintExample}
      {#if editorMode === "blocks"}{#key key + guideRevision}<BlockPlacementGuide mission={key} example={hintExample}/>{/key}
      {:else}<pre class="hint code-hint"><code>{hintExample.code}</code></pre>{/if}
    {/if}
    {#if key === "tut_2" && needsSeed}<button onclick={() => { if (INVENTORY.crops.wheat < 1) INVENTORY.changeCrops("wheat", 1); }}>Replace a used practice seed</button>{/if}
  {:else}<h2>All missions complete</h2><p>Keep experimenting with your farm programs.</p>{/if}
  </div>
  {/each}
  </div>
</aside>
<style>
  .code-hint{white-space:pre-wrap;overflow-wrap:anywhere;font-family:"Courier Prime",monospace;font-size:15px;text-align:left}
  .show-step{background:#fef3c7;border:2px solid #a16207;font-weight:800}.show-step.offered{animation:hint-pulse 1s ease-in-out 3}@keyframes hint-pulse{50%{transform:scale(1.04);box-shadow:0 0 0 4px #fde68a}}
  @media(prefers-reduced-motion:reduce){.show-step.offered{animation:none}}
  .mission{box-sizing:border-box;width:100%;background:#f3f4f6;color:#334155;border:4px solid #64748b;border-radius:12px;box-shadow:0 6px 14px #0003;overflow:hidden}
  .heading{display:flex;align-items:center;gap:7px;padding:9px 10px;background:#dcfce7;border-bottom:2px solid #94a3b8}.heading img{width:28px;height:28px;object-fit:contain;image-rendering:pixelated}.heading span{font-size:13px;font-weight:800;flex:1;letter-spacing:.04em}.heading button{font-size:13px;background:#e5e7eb;white-space:nowrap}
  .mission-stage{display:grid;overflow:hidden}.mission-content{grid-area:1/1;padding:12px}h2{font-size:19px;line-height:1.2;font-weight:800;margin:0 0 10px}p{font-size:13px;line-height:1.45;margin:8px 0}button{font-size:14px;padding:7px 8px;border:1px solid #94a3b8;border-radius:6px;cursor:pointer;background:#e5e7eb;color:#334155;margin:3px 3px 3px 0;transition:background .15s,transform .15s}button:hover{background:#d1d5db;transform:translateY(-1px)}.primary{background:#bbf7d0;font-weight:bold}.primary:hover{background:#86efac}progress{width:100%;accent-color:#22c55e;height:14px}.count{font-size:13px;color:#475569}.hint{background:#fff;border:2px solid #cbd5e1;padding:9px;border-radius:7px}button:focus-visible{outline:3px solid #16a34a;outline-offset:2px}
  @media(prefers-reduced-motion:reduce){.mission-content{animation:none!important}button{transition:none}}
</style>
