<script>
  import { QUEST_DATA } from "../game/global/quests.js";
  import { QUEST_STATE, claimQuest } from "./global.svelte.js";

  let { onOpenQuestMenu } = $props();

  let expanded = $state({});

  function toggleExpand(key, e, isCurrentlyExpanded) {
    e.stopPropagation();
    expanded[key] = !isCurrentlyExpanded;
  }

  function getActiveQuests() {
    return Object.entries(QUEST_DATA)
      .filter(([key, data]) => {
        const state = QUEST_STATE[key];
        if (!state || state.is_completed || state.is_claimed) return false;
        // Check prereqs
        if (data.prereq && data.prereq.length > 0) {
          for (const req of data.prereq) {
            if (!QUEST_STATE[req] || !QUEST_STATE[req].is_claimed) return false;
          }
        }
        return true;
      })
      .slice(0, 3); // Show max 3 active quests
  }

  function getCompletedQuests() {
    return Object.entries(QUEST_DATA).filter(([key, data]) => {
      const state = QUEST_STATE[key];
      return state && state.is_completed && !state.is_claimed;
    });
  }
</script>

<div class="flex flex-col gap-2 w-[280px]">
  <!-- Completed Quests Popup List -->
  {#each getCompletedQuests() as [key, data], index (key)}
    {@const isExpanded = expanded[key] ?? index === 0}
    <div
      role="button"
      tabindex="0"
      class="completed-card animate-bounce-short relative overflow-hidden cursor-pointer"
      onclick={() => onOpenQuestMenu?.()}
      onkeydown={(e) => e.key === "Enter" && onOpenQuestMenu?.()}
    >
      <div
        class="absolute inset-0 bg-yellow-200 opacity-20 pulse-bg pointer-events-none"
      ></div>

      <div class="flex justify-between items-center mb-1">
        <h4
          class="font-bold text-yellow-800 text-xs uppercase flex items-center gap-1"
        >
          🎉 Quest Completed!
        </h4>
        <button
          type="button"
          class="toggle-btn"
          onclick={(e) => toggleExpand(key, e, isExpanded)}
        >
          {isExpanded ? "▲" : "▼"}
        </button>
      </div>

      <p
        class="text-xs text-slate-700 font-bold mb-2"
        style="font-family: 'Courier Prime'"
      >
        {data.title}
      </p>

      {#if isExpanded}
        <p
          class="text-[11px] text-slate-600 mb-2 italic border-t border-slate-300 pt-1"
        >
          {data.description}
        </p>
      {/if}

      <!-- Reward Badges -->
      <div class="flex flex-wrap gap-1 mb-2">
        {#if data.rewards?.exp}
          <span
            class="reward-badge bg-green-200 text-green-900 border border-green-400"
            >+{data.rewards.exp} EXP</span
          >
        {/if}
        {#if data.rewards?.coins}
          <span
            class="reward-badge bg-yellow-200 text-yellow-900 border border-yellow-400"
            >+{data.rewards.coins} Coins</span
          >
        {/if}
        {#if data.rewards?.unlocks}
          <span
            class="reward-badge bg-purple-200 text-purple-900 border border-purple-400"
            >Unlocks: {data.rewards.unlocks.join(", ")}</span
          >
        {/if}
      </div>

      <button
        type="button"
        class="claim-btn"
        onclick={(e) => {
          e.stopPropagation();
          claimQuest(key);
        }}
      >
        Claim Reward
      </button>
    </div>
  {/each}

  <!-- Active Quests HUD -->
  <div
    role="button"
    tabindex="0"
    class="quests-panel cursor-pointer"
    onclick={() => onOpenQuestMenu?.()}
    onkeydown={(e) => e.key === "Enter" && onOpenQuestMenu?.()}
  >
    <div
      class="flex justify-between items-center border-b-2 border-slate-300 pb-1 mb-2"
    >
      <h3
        class="text-xs font-bold uppercase text-slate-600 flex items-center gap-1"
      >
        📋 Active Quests
      </h3>
      <span class="text-[10px] text-slate-400 italic">Click to view all</span>
    </div>

    <div class="flex flex-col gap-3">
      {#each getActiveQuests() as [key, data], index}
        {@const state = QUEST_STATE[key]}
        {@const isExpanded = expanded[key] ?? index === 0}
        <div
          class="text-xs flex flex-col gap-1 border-b-2 border-slate-300 pb-2 last:border-0 last:pb-0"
        >
          <div class="flex justify-between items-center">
            <span
              class="font-bold text-slate-700 flex-1"
              style="font-family: 'Courier Prime'">{data.title}</span
            >
            <div class="flex items-center gap-1">
              <span class="text-[11px] text-slate-500 font-bold"
                >{state ? state.progress : 0}/{data.goal}</span
              >
              <button
                type="button"
                class="toggle-btn"
                onclick={(e) => toggleExpand(key, e, isExpanded)}
              >
                {isExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>

          {#if isExpanded}
            <p class="text-[11px] text-slate-500 italic my-0.5">
              {data.description}
            </p>
            {#if data.tip}
              <div
                class="bg-yellow-200 border-2 border-yellow-400 rounded-lg p-1.5 text-xs text-yellow-800 my-1 flex gap-2 items-start"
              >
                <span class="font-bold">Tip: </span>
                <span>{data.tip}</span>
              </div>
            {/if}
            <div class="flex flex-wrap gap-1 mt-0.5 text-xs">
              {#if data.rewards?.exp}
                <span
                  class="reward-badge bg-green-200 text-green-900 border border-green-400 mb-1"
                  >+{data.rewards.exp} EXP</span
                >
              {/if}
              {#if data.rewards?.coins}
                <span
                  class="reward-badge bg-yellow-200 text-yellow-900 border border-yellow-400 mb-1"
                  >+{data.rewards.coins} Coins</span
                >
              {/if}
              {#if data.rewards?.unlocks}
                <div>
                  <span class="font-bold">Unlocks: </span>
                  <div class="flex flex-wrap gap-1 mt-0.5">
                    {#each data.rewards.unlocks as unlock}
                      <span
                        class="reward-badge bg-purple-200 text-purple-900 border border-purple-400 mb-1"
                        >{unlock}</span
                      >
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Progress Bar -->
          <div class="w-full bg-slate-300 rounded-full h-1.5 overflow-hidden">
            <div
              class="bg-green-400 h-1.5 rounded-full transition-all duration-300"
              style="width: {state
                ? Math.min((state.progress / data.goal) * 100, 100)
                : 0}%"
            ></div>
          </div>
        </div>
      {:else}
        <p class="text-xs text-slate-400 italic text-center py-1">
          No active quests.
        </p>
      {/each}
    </div>
  </div>
</div>

<style>
  .quests-panel {
    background-color: #f3f4f6; /* bg-gray-100 */
    border: 2px solid #64748b; /* border-slate-500 */
    border-radius: 0.75rem; /* rounded-xl */
    padding: 0.75rem;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -4px rgba(0, 0, 0, 0.1);
    color: #334155; /* text-slate-700 */
    transition: box-shadow 0.2s;
  }
  .quests-panel:hover {
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.15),
      0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }

  .completed-card {
    background-color: #fef9c3; /* yellow-100 */
    border: 2px solid #a16207; /* yellow-700-ish */
    border-color: #ca8a04; /* yellow-600 */
    border-radius: 0.75rem;
    padding: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    color: #334155;
  }

  .reward-badge {
    padding: 1px 6px;
    border-radius: 0.375rem;
    font-weight: 700;
  }

  .claim-btn {
    width: 100%;
    background-color: #16a34a; /* green-600 */
    color: white;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: background-color 0.15s;
    border: none;
  }
  .claim-btn:hover {
    background-color: #15803d; /* green-700 */
  }

  .toggle-btn {
    color: #64748b;
    font-size: 10px;
    padding: 0 4px;
    font-weight: 700;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
  }
  .toggle-btn:hover {
    color: #1e293b;
  }

  @keyframes bounce-short {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }
  .animate-bounce-short {
    animation: bounce-short 0.6s ease-in-out;
  }

  @keyframes pulse {
    0% {
      opacity: 0.1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 0.1;
    }
  }
  .pulse-bg {
    animation: pulse 2s infinite;
  }
</style>
