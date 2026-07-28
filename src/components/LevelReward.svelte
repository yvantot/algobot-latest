<script>
  import { ModalTypes, RewardTypes } from "../game/global/enum.js";
  import { LEVEL_REWARDS_DATA, PLAYER_DATA, INVENTORY } from "../game/global/global.js";
  import { Modals, CLAIMED_REWARDS } from "./global.svelte.js";

  const MAX_LEVEL = 30;

  function claimReward(level) {
    if (CLAIMED_REWARDS[level]) return;
    CLAIMED_REWARDS[level] = true;
    const { type, item = null, amount } = LEVEL_REWARDS_DATA[level] ?? LEVEL_REWARDS_DATA.DEFAULT;
    if (type === RewardTypes.COIN) INVENTORY.changeCoins(amount);
    else if (type === RewardTypes.CROPS) INVENTORY.changeCrops(item, amount);
  }

  function getReward(level) {
    return LEVEL_REWARDS_DATA[level] ?? LEVEL_REWARDS_DATA.DEFAULT;
  }

  function getRewardLabel(reward) {
    if (reward.type === RewardTypes.COIN) return `${reward.amount} Coins`;
    return `x${reward.amount} ${reward.item.charAt(0).toUpperCase() + reward.item.slice(1)}`;
  }

  function getRewardIcon(reward) {
    if (reward.type === RewardTypes.COIN) return "/sprites/icon_coin.png";
    return `/sprites/icon_${reward.item}.png`;
  }

  function isSpecial(level) {
    return LEVEL_REWARDS_DATA[level] !== undefined;
  }
</script>

{#if Modals[ModalTypes.LEVEL_REWARDS]}
  <div class="z-50 fixed inset-0 backdrop-blur-sm flex justify-center items-center">
    <div class="enter-anim relative flex flex-col gap-2 w-[30vw] max-h-[90vh] bg-gray-100 text-sm p-3 rounded-xl shadow-xl overflow-hidden text-slate-700 border-4 border-slate-500 select-none">

      <!-- Header -->
      <div class="flex items-center justify-between pb-2 border-b border-slate-300">
        <div>
          <h1 class="font-bold text-base">Level Rewards</h1>
          <p class="text-xs text-slate-500">Free coins and seeds as you level up</p>
        </div>
        <button
          onclick={() => (Modals[ModalTypes.LEVEL_REWARDS] = false)}
          class="text-slate-500 hover:text-slate-800 font-bold text-sm px-2 py-0.5 rounded hover:bg-slate-200 transition-colors"
        >
          Close
        </button>
      </div>

      <!-- Progress indicator -->
      <div class="flex items-center gap-2 bg-white border-2 border-slate-300 rounded-lg p-2">
        <div class="flex-1">
          <p class="font-semibold text-xs text-slate-500 uppercase tracking-wide">Current Level</p>
          <p class="font-bold text-base">Level {PLAYER_DATA.getLevel()}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500">
            {#each Array(MAX_LEVEL) as _, i}
              {#if !CLAIMED_REWARDS[i + 1] && PLAYER_DATA.level >= i + 1}
                {#if i === 0}
                  <span class="text-green-700 font-semibold">Rewards available!</span>
                {/if}
              {/if}
            {/each}
          </p>
        </div>
      </div>

      <!-- Reward list -->
      <div class="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-0.5">
        {#each Array(MAX_LEVEL) as _, i}
          {@const level = i + 1}
          {@const reward = getReward(level)}
          {@const is_unlocked = PLAYER_DATA.level >= level}
          {@const is_claimed = CLAIMED_REWARDS[level]}
          {@const special = isSpecial(level)}

          <button
            onclick={() => claimReward(level)}
            disabled={!is_unlocked || is_claimed}
            class="flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left
              {is_claimed
                ? 'border-slate-200 bg-white opacity-50 cursor-default'
                : is_unlocked
                  ? 'border-green-400 bg-green-50 hover:bg-green-100 cursor-pointer shadow-sm'
                  : 'border-slate-200 bg-white opacity-40 cursor-not-allowed'}"
          >
            <!-- Level badge -->
            <div class="w-10 shrink-0 text-center">
              <p class="font-bold text-xs text-slate-500">Lv.</p>
              <p class="font-bold text-base leading-none {special ? 'text-slate-800' : 'text-slate-500'}">{level}</p>
            </div>

            <!-- Divider -->
            <div class="w-px self-stretch bg-slate-200 shrink-0"></div>

            <!-- Reward icon -->
            <img
              class="w-8 h-8 object-contain shrink-0 {is_claimed ? 'grayscale' : ''}"
              src={getRewardIcon(reward)}
              alt="Reward"
            />

            <!-- Label -->
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-xs truncate">{getRewardLabel(reward)}</p>
              {#if special && reward.type === RewardTypes.CROPS}
                <p class="text-xs text-slate-400">Seed reward</p>
              {:else}
                <p class="text-xs text-slate-400">Coins</p>
              {/if}
            </div>

            <!-- Status badge -->
            <div class="shrink-0">
              {#if is_claimed}
                <span class="text-xs font-semibold text-slate-400">Claimed</span>
              {:else if is_unlocked}
                <span class="text-xs font-semibold text-green-700 claim-pulse">Claim!</span>
              {:else}
                <span class="text-xs text-slate-400 font-semibold">Locked</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes scaleup {
    0% { transform: scale(0.85); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .enter-anim {
    animation: scaleup 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes pulse-green {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .claim-pulse {
    animation: pulse-green 1.5s ease-in-out infinite;
  }
</style>
