<script>
  
  import { DOCUMENT_DATA as data, TYPE_COLORS, CROP_DATA } from "../game/global/global.js";

  import { CropTypes } from "../game/global/enum.js";
  import { toTitleCase } from "../game/utils/string.js";
  import { createResizable } from "./interface.svelte.js";

  let current_menu = $state("syntax");

  const resize = createResizable();

  const cropStats = {
    wheat: CROP_DATA[CropTypes.WHEAT],
    corn: CROP_DATA[CropTypes.CORN],
    rice: CROP_DATA[CropTypes.RICE],
    potato: CROP_DATA[CropTypes.POTATO],
    sugarcane: CROP_DATA[CropTypes.SUGARCANE],
    tomato: CROP_DATA[CropTypes.TOMATO],
  };

  function toggleMenu(name) {
    current_menu = name;
  }
</script>

<div style="width: {resize.width}px;" class="flex flex-col gap-2 h-[95vh] bg-gray-100 text-sm p-3 rounded-xl shadow-xl overflow-hidden text-slate-700 border-4 border-slate-500">
  <div role="separator" class="resize-handle {resize.is_resizing ? 'resizing-active' : ''}" onmousedown={resize.startResize}></div>
  <div>
    <h1 class="font-bold text-base text-center">Documentation</h1>
    <p class="text-xs text-center px-2">A handbook that provide all the concepts that you need</p>
  </div>
  <div class="flex flex-col gap-2 overflow-hidden text-xs">
    <div class="flex flex-wrap gap-1 justify-center">
      {#each Object.keys(data) as name}
        <button class="rounded-lg p-1 px-2 bg-gray-300 font-semibold" class:bg-green-300={current_menu === name} onclick={() => toggleMenu(name)}>{toTitleCase(name)}</button>
      {/each}
    </div>
    <div class="flex flex-col gap-2 flex-grow overflow-y-scroll h-[85vh]">
      {#each Object.keys(data[current_menu]) as name}
        {@const val = data[current_menu][name]}
        {@const stats = cropStats[name]}

        <div class="flex flex-col border-2 border-slate-400 rounded-lg p-2 gap-2">
          <div class="flex gap-2 items-center justify-between">
            <p class="font-bold" style="font-family: 'Courier Prime'">{name}</p>
            <p
              class="font-bold p-1 px-2 text-xs bg-[#262b36] rounded scale-90"
              style={"color:" + TYPE_COLORS[val.type]}
            >
              {val.type}
            </p>
          </div>

          {#if current_menu === "crops" || current_menu === "events"}
            <img class="w-10 h-10 object-contain" src={val.icon} alt={name} />
          {/if}

          <p>{val.definition}</p>

          {#if val.arguments}
            <div class="bg-yellow-200 p-2 rounded-lg border-2 border-yellow-400 flex flex-col gap-2">
              <p class="text-yellow-800 font-bold">Function Arguments</p>
              <pre class="overflow-x-auto code p-2 bg-gray-100 rounded-lg">{val.arguments}</pre>
            </div>
          {/if}
          {#if val.example}
            <div class="bg-blue-200 p-2 rounded-lg border-2 border-blue-400 flex flex-col gap-2">
              <p class="text-blue-800 font-bold">Example</p>
              <pre class="overflow-x-auto code p-2 bg-gray-100 rounded-lg">{val.example}</pre>
            </div>
          {/if}

          {#if val.note != null}
            <div class="bg-green-200 p-2 rounded-lg border-2 border-green-400">
              <p class="text-green-800 font-bold">Remember!</p>
              <p>{val.note}</p>
            </div>
          {/if}

          {#if current_menu === "crops"}
            <!-- Stats -->
            <div class="border-2 border-blue-400 bg-blue-100 rounded-lg p-2">
              <p class="font-bold mb-1 text-blue-800">Stats</p>

              <div class="grid grid-cols-2 gap-1">
                <p><b>❤️ Health:</b> {stats.health}</p>
                <p><b>⏱ Duration:</b> {stats.duration}s</p>
                <p><b>💰 Reward:</b> {stats.reward}</p>
                <p><b>⭐ EXP:</b> {stats.exp}</p>
                <p><b>🥀 Spoilage:</b> {stats.spoilage_time}s</p>
                <p><b>🌱 Seed Drop:</b> {(stats.seed_drop_chance * 100).toFixed(0)}%</p>
              </div>
            </div>

            <!-- Strength -->
            <div class="bg-green-100 border-2 border-green-300 rounded-lg p-2">
              <p class="font-bold text-green-800">Strength</p>
              <p>{val.strength}</p>
            </div>

            <!-- Weakness -->
            <div class="bg-red-100 border-2 border-red-300 rounded-lg p-2">
              <p class="font-bold text-red-800">Weakness</p>
              <p>{val.weakness}</p>
            </div>
          {/if}

          <div class="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-300">
            <span class="font-bold {val.is_unlocked ? 'text-green-700' : 'text-red-700'}">{val.is_unlocked ? "✓ Unlocked" : "🔒 Locked"}</span>
            {#if val.tier !== undefined}<span>Tier {val.tier}</span>{/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
