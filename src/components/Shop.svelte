<script>
  import { ModalTypes } from "../game/global/enum.js";
  import { Modals, robots, UNLOCK_VERSION } from "./global.svelte.js";
  import { PLAYER_DATA, SHOP_DATA } from "../game/global/global.js";
  import { buyPlants, buyUpgrade, buyLand, buyBot } from "../game/global/shop.js";
  import { toTitleCase } from "../game/utils/string.js";
  import { createResizable } from "./interface.svelte.js";

  const resize = createResizable();
  const category_color = {
    seeds: "#79d132",
    land: "#bc822b",
    bot_upgrades: "#9ac2d1",
    bots: "#676767",
  };
  let selected_bot = $state(0);
  let current_category = $state("seeds");

  let shopContainerEl = $state(null);
  let hoveredItem = $state(null);

  function handleMouseEnter(e, name, item) {
    if (!item.definition || !shopContainerEl) return;
    const cardRect = e.currentTarget.getBoundingClientRect();
    const containerRect = shopContainerEl.getBoundingClientRect();

    const rawLeft = cardRect.left - containerRect.left + cardRect.width / 2;
    const rawTop = cardRect.top - containerRect.top;
    const rawBottom = cardRect.bottom - containerRect.top;

    const clampedLeft = Math.max(95, Math.min(containerRect.width - 95, rawLeft));
    const isTopPart = rawTop < containerRect.height * 0.45;

    hoveredItem = {
      name,
      definition: item.definition,
      left: clampedLeft,
      arrowLeft: rawLeft - clampedLeft + 90, // Relative arrow offset inside 180px tooltip
      top: isTopPart ? rawBottom + 8 : rawTop - 8,
      position: isTopPart ? "below" : "above",
    };
  }

  function handleMouseLeave() {
    hoveredItem = null;
  }
</script>

<div
  bind:this={shopContainerEl}
  style="width: {resize.width}px;"
  class="relative flex flex-col gap-2 h-fit bg-gray-100 text-sm p-3 pb-7 rounded-xl shadow-xl text-slate-700 border-4 border-slate-500"
>
  <div
    role="separator"
    class="resize-handle {resize.is_resizing ? 'resizing-active' : ''}"
    onmousedown={resize.startResize}
  ></div>
  <div>
    <h1 class="font-bold text-base text-center">Shop</h1>
    <p class="text-xs text-center px-2">Buy seeds, bot upgrades and land expansions!</p>
  </div>
  <div class="flex flex-col gap-2 overflow-hidden items-center text-xs flex-grow">
    <!-- Categories -->
    <div class="flex justify-center gap-1 w-28">
      {#each Object.keys(SHOP_DATA) as category}
        <button
          class="rounded-lg p-1 px-3 bg-gray-300 font-semibold"
          class:bg-green-300={current_category === category}
          onclick={() => {
            current_category = category;
            hoveredItem = null;
          }}
        >
          {toTitleCase(category)}
        </button>
      {/each}
    </div>

    <!-- Items List -->
    <div
      onscroll={() => (hoveredItem = null)}
      class="flex flex-wrap gap-3 overflow-y-scroll justify-center h-fit max-h-[78vh] p-2 custom-scrollbar"
    >
      {#each Object.entries(SHOP_DATA[current_category]) as [name, item]}
        {@const _ = UNLOCK_VERSION.count}
        {@const isUnlocked = item.unlocked ?? true}
        <div
          onmouseenter={(e) => handleMouseEnter(e, name, item)}
          onmouseleave={handleMouseLeave}
          class="flex flex-col gap-2 rounded-lg h-fit p-2 outline-3 outline-gray-300 justify-center items-center relative transition-transform duration-150 {isUnlocked
            ? 'hover:scale-[1.02]'
            : 'opacity-60 bg-gray-200'}"
        >
          {#if !isUnlocked}
            <span
              class="absolute top-1 right-1 bg-red-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow"
              >Locked</span
            >
          {/if}

          <!-- Title -->
          <p
            class="font-bold text-center p-2 rounded-lg text-white w-full"
            style={`font-family: 'Courier Prime'; background-color: ${
              isUnlocked ? category_color[current_category] : "#94a3b8"
            };`}
          >
            {toTitleCase(name)}
          </p>

          <!-- Icon -->
          <div class="flex justify-center justify-self-end">
            <div class="rounded-lg p-2 bg-gray-300">
              <img
                class="w-10 h-10 object-contain {isUnlocked ? '' : 'grayscale'}"
                src={item.icon}
                alt={name}
              />
            </div>
          </div>

          <!-- Buy -->
          {#if current_category === "bot_upgrades"}
            <div class="flex flex-wrap gap-1 justify-center">
              {#each robots as bot}
                <button
                  onclick={() => (selected_bot = bot.bot_index)}
                  class:opacity-100={selected_bot === bot.bot_index}
                  class="opacity-80 px-3 py-1 bg-[#262737] text-[#82F54C] font-bold flex-grow text-center cursor-pointer select-none rounded-lg bot-index-font"
                  >{bot.bot_index}
                </button>
              {/each}
            </div>
          {/if}
          <button
            disabled={!isUnlocked}
            class="rounded-lg px-2 py-1 font-bold text-white mx-2 flex justify-around items-center gap-4 transition-colors {isUnlocked
              ? 'bg-orange-600 hover:bg-orange-500 cursor-pointer'
              : 'bg-gray-400 cursor-not-allowed'}"
            onclick={() => {
              if (!isUnlocked) return;
              if (current_category === "seeds") buyPlants(name, 1);
              if (current_category === "land") buyLand(name, 1);
              if (current_category === "bots") buyBot();
              if (current_category === "bot_upgrades") buyUpgrade(name, selected_bot);
            }}
          >
            {#if isUnlocked}
              <img class="w-5 h-5" src="/sprites/icon_coin.png" alt="coin" />
              <p>{item.price}</p>
            {:else}
              <p>Locked</p>
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Unclipped Floating Tooltip Popup -->
  {#if hoveredItem}
    <div
      class="pointer-events-none absolute z-[100] transition-all duration-150 transform -translate-x-1/2"
      style="left: {hoveredItem.left}px; {hoveredItem.position === 'above'
        ? `bottom: ${shopContainerEl.offsetHeight - hoveredItem.top}px;`
        : `top: ${hoveredItem.top}px;`}"
    >
      <div
        class="w-48 bg-gray-100 text-slate-700 border-2 border-slate-500 rounded-lg p-2.5 text-center relative shadow-2xl"
      >
        <p
          class="font-bold text-slate-800 text-[11px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
        >
          {toTitleCase(hoveredItem.name)}
        </p>
        <p class="text-[10px] text-slate-600 leading-snug font-medium">
          {hoveredItem.definition}
        </p>

        <!-- Tooltip Arrows -->
        {#if hoveredItem.position === "above"}
          <!-- Arrow pointing down -->
          <div
            class="absolute top-full border-4 border-transparent border-t-slate-500"
            style="left: {hoveredItem.arrowLeft}px; transform: translateX(-50%);"
          ></div>
          <div
            class="absolute top-full -mt-0.5 border-4 border-transparent border-t-gray-100"
            style="left: {hoveredItem.arrowLeft}px; transform: translateX(-50%);"
          ></div>
        {:else}
          <!-- Arrow pointing up -->
          <div
            class="absolute bottom-full border-4 border-transparent border-b-slate-500"
            style="left: {hoveredItem.arrowLeft}px; transform: translateX(-50%);"
          ></div>
          <div
            class="absolute bottom-full -mb-0.5 border-4 border-transparent border-b-gray-100"
            style="left: {hoveredItem.arrowLeft}px; transform: translateX(-50%);"
          ></div>
        {/if}
      </div>
    </div>
  {/if}
</div>
