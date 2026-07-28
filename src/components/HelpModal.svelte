<script>
  import { createResizable } from "./interface.svelte.js";
  import { onMount } from "svelte";

  let { onClose } = $props();

  const resize = createResizable();

  let activeTab = $state("slides");
  let dontShowAgain = $state(false);
  let currentSlide = $state(0);

  const SLIDES = [
    {
      title: "1. Welcome to AlgoBot",
      subtitle: "An Algorithmic Farming Edutainment System",
      description:
        "Learn fundamental programming concepts by coding autonomous robots to manage, plant, water, and harvest your farm!",
      image: "/sprites/art_intro_0.png",
      fallbackText: "Introduction",
      highlights: [
        "Write JavaScript text commands or use drag-and-drop code blocks",
        "Automate repetitive tasks across your entire farm grid",
        "Master loops, conditions, functions, and variables",
      ],
    },
    {
      title: "2. The Farming Lifecycle",
      subtitle: "Till -> Plant -> Water -> Harvest",
      description:
        "Every crop requires care. Automate each phase with bot functions:",
      image: "/sprites/art_intro_1.png",
      fallbackText: "Farming Cycle",
      highlights: [
        "bot.till() - Prepares initial unworked soil into tilled soil",
        'bot.plant("wheat") - Seeds a tilled tile with a specific crop',
        "bot.water() - Waters tilled soil to kickstart growth timers",
        "bot.harvest() - Collects mature crops for Coins & EXP",
      ],
    },
    {
      title: "3. Quests & Algorithmic Automation",
      subtitle: "Complete Quests to Unlock Power-Ups",
      description:
        "Expand your programming toolkit as you complete quest milestones and build an automated farming empire!",
      image: "/sprites/art_intro_2.png",
      fallbackText: "Automation & Quests",
      highlights: [
        "Unlock loops (for, while) to automate entire rows at once",
        "Use conditional statements (if, else) to inspect crop states",
        "Unlock higher-tier crops & extra helper robots in the Shop",
      ],
    },
  ];

  const MECHANICS_ITEMS = [
    {
      title: "Soil States",
      type: "mechanism",
      image: "/sprites/art_soil_states.png",
      fallbackText: "Soil States Illustration",
      description:
        "Land starts in an UNTILLED state (0). Use bot.till() to change it to READY (1). Use bot.water() to change READY soil into WATERED (2). Crops only absorb water and grow when planted in watered soil!",
    },
    {
      title: "Crop Growth & Spoilage",
      type: "mechanism",
      image: "/sprites/art_crop_growth.png",
      fallbackText: "Growth & Rot Illustration",
      description:
        "Crops progress from YOUNG -> GROWING -> HARVESTABLE. If a harvestable crop is left unpicked for too long, it expires into DEAD rot! Harvest promptly to maximize EXP and Coin yields.",
    },
    {
      title: "Crop Freshness Stages",
      type: "mechanism",
      image: "/sprites/art_crop_freshness.png",
      fallbackText: "Freshness Stages Illustration",
      description:
        "Once harvestable, a crop enters a freshness countdown. Sparkle icons = FRESH (100% rewards). Flies = EXPIRING (50% rewards). After full expiry, the crop rots and can no longer be harvested. Watch the visual indicators!",
    },
    {
      title: "Bug Infestations",
      type: "event",
      image: "/sprites/art_bug_infestation.png",
      fallbackText: "Bug Attack Illustration",
      description:
        "Purple bugs spawn outside the farm and march toward harvestable crops. They deal damage every 2.25 seconds and will destroy crops if left unchecked. Use bot.kill_bug() to eliminate them quickly.",
    },
    {
      title: "Crop Resistance to Bugs",
      type: "mechanism",
      image: "/sprites/art_crop_resistance.png",
      fallbackText: "Crop Resistance Chart",
      description:
        "Each crop has a resistance stat that determines how much bug damage it takes. Potato is completely immune to bugs (resistance = 0). Rice takes normal damage. Wheat, Corn, Tomato, and Sugarcane are more vulnerable.",
    },
    {
      title: "Seed Drop on Harvest",
      type: "mechanism",
      image: "/sprites/art_seed_drop.png",
      fallbackText: "Seed Drop Illustration",
      description:
        "Harvesting a crop can randomly drop a bonus seed pack back into your inventory. Wheat drops at 90% chance, Corn at 75%, Rice at 70%, Potato at 60%, Sugarcane at 10%, and Tomato at only 5%!",
    },
    {
      title: "Corn Synergy",
      type: "mechanism",
      image: "/sprites/art_corn_buff.png",
      fallbackText: "Corn Synergy Diagram",
      description:
        "Corn checks adjacent tiles every second. Each neighboring corn plant reduces its grow time by 6 seconds. Plant corn in clusters to maximize growth speed, sparkle effects appear when synergy is active!",
    },
    {
      title: "Sugarcane Regrowth",
      type: "mechanism",
      image: "/sprites/art_sugarcane_regrow.png",
      fallbackText: "Sugarcane Regrowth Illustration",
      description:
        "Sugarcane is the only crop that does not die after being harvested! Instead, it resets to GROWING state and regrows automatically. Automate your sugarcane harvest loop for a perpetual supply of coins.",
    },
    {
      title: "Shop & Expansion",
      type: "feature",
      image: "/sprites/art_shop_expansion.png",
      fallbackText: "Shop & Land Expansion",
      description:
        "Spend earned Coins in the Shop to purchase new seed varieties, expand farm rows & columns, and buy extra autonomous robots.",
    },
    {
      title: "Bot Inspection Functions",
      type: "feature",
      image: "/sprites/art_bot_check.png",
      fallbackText: "Bot Check Functions Diagram",
      description:
        "Bots can inspect their current tile using check functions: bot.is_tilled(), bot.is_watered(), bot.is_planted(), bot.is_harvestable(), bot.is_dead(), bot.is_bug(), and bot.is_fire(). All return true or false, use them with if statements to write intelligent, reactive bot logic.",
    },
    {
      title: "Bot Wait & Timing",
      type: "feature",
      image: "/sprites/art_bot_wait.png",
      fallbackText: "Bot Wait Timer Illustration",
      description:
        "bot.wait(seconds) pauses bot execution for a set duration and displays a timer icon overhead. Use it to introduce deliberate delays into automation scripts, for example, waiting for crops to grow before checking again.",
    },
  ];

  onMount(() => {
    dontShowAgain = localStorage.getItem("algobot_hide_onboarding") === "true";
  });

  function toggleDontShow() {
    dontShowAgain = !dontShowAgain;
    if (dontShowAgain) {
      localStorage.setItem("algobot_hide_onboarding", "true");
    } else {
      localStorage.removeItem("algobot_hide_onboarding");
    }
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

  <!-- Header -->
  <div
    class="flex justify-between items-center border-b-2 border-slate-400 pb-2"
  >
    <div>
      <h1 class="font-bold text-base text-center">Help & Game Guide</h1>
      <p class="text-xs text-center px-2 text-slate-500">
        Everything you need to know about playing & programming in AlgoBot
      </p>
    </div>
    {#if onClose}
      <button
        onclick={onClose}
        class="text-slate-500 hover:text-slate-800 text-sm font-bold px-2 py-0.5 rounded cursor-pointer"
        >✕</button
      >
    {/if}
  </div>

  <div class="flex flex-col gap-2 overflow-hidden text-xs flex-grow">
    <!-- Tab Buttons -->
    <div class="flex flex-wrap gap-1 justify-center shrink-0">
      <button
        class="rounded-lg p-1.5 px-3 bg-gray-300 font-semibold cursor-pointer transition-colors"
        class:bg-green-300={activeTab === "slides"}
        onclick={() => (activeTab = "slides")}>Tutorial Slides</button
      >
      <button
        class="rounded-lg p-1.5 px-3 bg-gray-300 font-semibold cursor-pointer transition-colors"
        class:bg-green-300={activeTab === "mechanics"}
        onclick={() => (activeTab = "mechanics")}>Game Mechanics</button
      >
    </div>

    <!-- Tab 1: Slideshow Viewer -->
    {#if activeTab === "slides"}
      <div
        class="flex flex-col gap-3 flex-grow overflow-y-auto p-1 custom-scrollbar"
      >
        <div
          class="flex justify-between items-center bg-gray-200 border-2 border-slate-300 rounded-lg p-2"
        >
          <label
            class="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700"
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onchange={toggleDontShow}
              class="rounded text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer"
            />
            <span>Don't show onboarding automatically on game start</span>
          </label>
        </div>

        <div
          class="border-2 border-slate-400 rounded-lg p-4 bg-white space-y-3 shadow-inner"
        >
          <div
            class="flex justify-between items-center border-b pb-2 border-slate-300"
          >
            <h3 class="font-extrabold text-sm text-slate-800">
              {SLIDES[currentSlide].title}
            </h3>
            <span class="text-xs font-bold text-slate-500"
              >{currentSlide + 1} / {SLIDES.length}</span
            >
          </div>

          <p class="text-xs text-green-800 font-bold uppercase">
            {SLIDES[currentSlide].subtitle}
          </p>

          <div
            class="relative w-full h-fit bg-gray-200 rounded-lg border border-slate-300 overflow-hidden flex items-center justify-center"
          >
            <img
              src={SLIDES[currentSlide].image}
              alt={SLIDES[currentSlide].title}
              class="w-full h-full object-contain relative z-10"
              onerror={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.nextElementSibling) {
                  e.currentTarget.nextElementSibling.classList.remove("hidden");
                  e.currentTarget.nextElementSibling.classList.add("flex");
                }
              }}
            />
            <div
              class="hidden absolute inset-0 flex-col items-center justify-center p-3 text-center bg-gray-200"
            >
              <span class="text-sm font-extrabold text-slate-700 mb-1"
                >{SLIDES[currentSlide].fallbackText}</span
              >
              <p class="text-xs text-slate-600 font-medium max-w-sm">
                {SLIDES[currentSlide].description}
              </p>
            </div>
          </div>

          <div
            class="bg-gray-100 p-2.5 rounded-lg border border-slate-300 space-y-1"
          >
            {#each SLIDES[currentSlide].highlights as h}
              <div class="flex items-center gap-2 text-xs">
                <span class="text-green-700 font-bold">✓</span>
                <span>{h}</span>
              </div>
            {/each}
          </div>

          <div class="flex justify-between items-center pt-2">
            <button
              disabled={currentSlide === 0}
              onclick={() => currentSlide > 0 && currentSlide--}
              class="px-3 py-1 bg-gray-300 hover:bg-gray-400 disabled:opacity-40 font-bold rounded text-slate-800 border border-slate-400 text-xs cursor-pointer"
              >Prev</button
            >
            <div class="flex gap-1">
              {#each SLIDES as _, i}
                <button
                  onclick={() => (currentSlide = i)}
                  class="w-2.5 h-2.5 rounded-full {i === currentSlide
                    ? 'bg-slate-700'
                    : 'bg-gray-300'}"
                ></button>
              {/each}
            </div>
            <button
              disabled={currentSlide === SLIDES.length - 1}
              onclick={() => currentSlide < SLIDES.length - 1 && currentSlide++}
              class="px-3 py-1 bg-gray-300 hover:bg-gray-400 disabled:opacity-40 font-bold rounded text-slate-800 border border-slate-400 text-xs cursor-pointer"
              >Next</button
            >
          </div>
        </div>
      </div>

      <!-- Tab 2: Game Mechanics -->
    {:else if activeTab === "mechanics"}
      <div
        class="flex flex-col gap-2 flex-grow overflow-y-auto p-1 custom-scrollbar"
      >
        {#each MECHANICS_ITEMS as item}
          <div
            class="border-2 border-slate-400 rounded-lg p-3 bg-white space-y-2 shadow-sm"
          >
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-sm text-slate-800">{item.title}</h3>
              <span
                class="text-[10px] font-bold px-2 py-0.5 bg-[#262b36] text-green-300 rounded uppercase"
                >{item.type}</span
              >
            </div>

            <!-- Image Container -->
            <div
              class="relative w-full h-fit bg-gray-100 rounded-lg border border-slate-300 overflow-hidden flex items-center justify-center"
            >
              <img
                src={item.image}
                alt={item.title}
                class="w-full h-full object-contain relative z-10"
                onerror={(e) => {
                  e.currentTarget.style.display = "none";
                  if (e.currentTarget.nextElementSibling) {
                    e.currentTarget.nextElementSibling.style.display = "flex";
                  }
                }}
              />
              <div
                class="hidden absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-gray-200"
              >
                <span class="text-xs font-extrabold text-slate-700"
                  >{item.fallbackText}</span
                >
              </div>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed">
              {item.description}
            </p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 10px;
  }
</style>
