<script>
  import { DOCUMENT_DATA as data, TYPE_COLORS } from "../game/global/global.js";
  import { QUEST_DATA } from "../game/global/quests.js";
  import { createResizable } from "./interface.svelte.js";
  import { UNLOCK_VERSION } from "./global.svelte.js";

  const resize = createResizable();
  let selectedTier = $state("all");

  const tierTitles = {
    0: "Starter Basics",
    1: "Foundation & Movement",
    2: "Iteration & Repeating",
    3: "Conditionals & Events",
    4: "Functions & Advanced Concepts",
    5: "State Optimization & Mastery",
  };

  // Map item name -> quest title that unlocks it
  function getQuestRequirement(itemName) {
    for (const [questKey, quest] of Object.entries(QUEST_DATA)) {
      if (quest.rewards?.unlocks?.includes(itemName)) {
        return quest.title;
      }
    }
    return null;
  }

  function getTierData() {
    const _ = UNLOCK_VERSION.count; // Reactive dependency
    const tierMap = {};

    const categories = [
      data.crops,
      data.bot_movement,
      data.bot_farm_actions,
      data.bot_checks,
      data.globals,
    ];

    for (const cat of categories) {
      if (!cat) continue;
      for (const [name, item] of Object.entries(cat)) {
        const tier = item.tier ?? 1;
        if (!tierMap[tier]) tierMap[tier] = [];

        if (!tierMap[tier].some((x) => x.name === name)) {
          const questTitle = getQuestRequirement(name);
          tierMap[tier].push({
            name,
            ...item,
            unlockQuest: questTitle,
          });
        }
      }
    }

    return tierMap;
  }

  let tierData = $derived(getTierData());
  let sortedTiers = $derived(
    Object.keys(tierData)
      .map(Number)
      .sort((a, b) => a - b),
  );

  let filteredTiers = $derived(
    selectedTier === "all" ? sortedTiers : [Number(selectedTier)],
  );

  function unlockedCount(tier) {
    const items = tierData[tier] || [];
    return items.filter((x) => x.is_unlocked).length;
  }
</script>

<div
  style="width: {resize.width}px;"
  class="flex flex-col gap-2 h-[95vh] bg-gray-100 text-sm p-3 rounded-xl shadow-xl overflow-hidden text-slate-700 border-4 border-slate-500"
>
  <div
    role="separator"
    class="resize-handle {resize.is_resizing ? 'resizing-active' : ''}"
    onmousedown={resize.startResize}
  ></div>
  <div>
    <h1 class="font-bold text-base text-center">Research & Skill Tree</h1>
    <p class="text-xs text-center px-2">
      Progression overview categorized by Tiers and Quest requirements
    </p>
  </div>

  <!-- Tier Filter Tabs -->
  <div class="flex flex-wrap gap-1 justify-center text-xs">
    <button
      class="rounded-lg p-1 px-3 bg-gray-300 font-semibold cursor-pointer transition-colors"
      class:bg-green-300={selectedTier === "all"}
      onclick={() => (selectedTier = "all")}
    >
      All Tiers
    </button>
    {#each sortedTiers as tier}
      <button
        class="rounded-lg p-1 px-3 bg-gray-300 font-semibold cursor-pointer transition-colors"
        class:bg-green-300={selectedTier === tier}
        onclick={() => (selectedTier = tier)}
      >
        Tier {tier}
      </button>
    {/each}
  </div>

  <!-- Skill Tree List -->
  <div
    class="flex flex-col gap-3 flex-grow overflow-y-scroll h-[85vh] p-1 text-xs"
  >
    {#each filteredTiers as tier}
      {@const items = tierData[tier] || []}
      <div
        class="flex flex-col gap-2 bg-white border-2 border-slate-300 rounded-lg p-3 shadow-sm"
      >
        <!-- Tier Group Header -->
        <div
          class="flex justify-between items-center border-b border-slate-200 pb-1.5"
        >
          <h2 class="font-bold text-xs text-slate-800 flex items-center gap-2">
            <span
              class="bg-slate-800 text-amber-400 px-2 py-0.5 rounded text-[11px] font-bold"
              >Tier {tier}</span
            >
            <span>{tierTitles[tier] ?? `Tier ${tier} Unlocks`}</span>
          </h2>
          <span class="text-[11px] text-slate-500 font-bold">
            {unlockedCount(tier)} / {items.length} Unlocked
          </span>
        </div>

        <!-- Items Grid -->
        <div class="grid grid-cols-1 gap-2 mt-1">
          {#each items as item}
            <div
              class="flex justify-between items-center p-2 rounded-lg border transition-all {item.is_unlocked
                ? 'bg-green-50/60 border-green-300'
                : 'bg-slate-50 border-slate-200 opacity-75'}"
            >
              <div class="flex items-center gap-2.5">
                {#if item.icon}
                  <img
                    class="w-7 h-7 object-contain {item.is_unlocked
                      ? ''
                      : 'grayscale'}"
                    src={item.icon}
                    alt={item.name}
                  />
                {:else}
                  <div
                    class="w-7 h-7 bg-slate-700 text-white flex items-center justify-center font-bold rounded text-[11px]"
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                {/if}

                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="font-bold text-slate-800 text-xs"
                      style="font-family: 'Courier Prime'">{item.name}</span
                    >
                    {#if item.type}
                      <span
                        class="text-[9px] px-1.5 py-0.2 bg-[#262b36] rounded font-bold"
                        style={"color:" + (TYPE_COLORS[item.type] || "#fff")}
                        >{item.type}</span
                      >
                    {/if}
                  </div>
                  {#if !item.is_unlocked}
                    <span class="text-[10px] text-red-600 font-semibold">
                      {#if item.unlockQuest}
                        🏆 Unlock via Quest: <span
                          class="font-bold text-red-700"
                          >{item.unlockQuest}</span
                        >
                      {:else}
                        🔒 Locked (Complete Quests to unlock)
                      {/if}
                    </span>
                  {:else}
                    <span class="text-[10px] text-green-700 font-semibold">
                      ✓ Available in Bot Editor
                    </span>
                  {/if}
                </div>
              </div>

              <div>
                {#if item.is_unlocked}
                  <span
                    class="bg-green-200 text-green-800 border border-green-400 text-[10px] px-2 py-0.5 rounded font-bold"
                    >UNLOCKED</span
                  >
                {:else}
                  <span
                    class="bg-red-100 text-red-800 border border-red-300 text-[10px] px-2 py-0.5 rounded font-bold"
                    >LOCKED</span
                  >
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
